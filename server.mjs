// Node.js プロキシサーバー
// フロントエンドからAPIキーを受け取ってLLM APIを呼び出す
import express from 'express';
import { createServer } from 'http';
import { resolve, join } from 'path';

const app = express();
app.use(express.json({ limit: '10mb' }));

// ============================
// デフォルト設定（環境変数またはユーザー入力）
// ============================
const DEFAULT_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'gpt-4o';

// ============================
// LLM API 呼び出し
// ============================
async function callLLM(apiKey, baseURL, model, messages, options = {}) {
  const url = `${baseURL}/chat/completions`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  // GenSpark 固有ヘッダー (あれば)
  const routeId = process.env.GENSPARK_ROUTE_IDENTIFIER || '';
  if (routeId) headers['X-Route-ID'] = routeId;

  const body = {
    model: model || DEFAULT_MODEL,
    messages,
    temperature: options.temperature ?? 0.8,
    max_tokens: options.max_tokens ?? 500,
    stream: options.stream ?? false,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  return response;
}

// ============================
// CORS
// ============================
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ============================
// API: 会話 (ストリーミング)
// ============================
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, scenario, persona, apiKey, baseURL, model, isFirstMessage, productURL, goal } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'APIキーが設定されていません' });
    }

    const systemPrompt = buildSystemPrompt(scenario, persona, productURL, goal);
    const allMessages = [
      { role: 'system', content: systemPrompt },
    ];

    if (isFirstMessage) {
      // 最初のメッセージ: AIが顧客として第一声を出す
      // 会話の中でAI=assistant=顧客役、user=営業担当
      allMessages.push({
        role: 'user',
        content: '（営業担当がお客様のオフィスに到着し、受付を通って会議室に案内されました。お客様が会議室に入ってきます。お客様として最初の一言をお願いします。簡潔に挨拶してください。）'
      });
    } else {
      // 通常の会話: フロントエンドの messages をそのまま使う
      // user = 営業担当の発言、assistant = 顧客(AI)の発言
      allMessages.push(...messages.map(m => ({ role: m.role, content: m.content })));
    }

    const response = await callLLM(
      apiKey,
      baseURL || DEFAULT_BASE_URL,
      model || DEFAULT_MODEL,
      allMessages,
      { stream: true, temperature: 0.8, max_tokens: 500 }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`LLM API error ${response.status}: ${errText}`);
      return res.status(response.status).json({ error: `API エラー (${response.status}): ${errText}` });
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const processStream = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) res.write(content);
            } catch {}
          }
        }
      }
      res.end();
    };

    processStream().catch(err => {
      console.error('Stream error:', err);
      res.end();
    });

  } catch (e) {
    console.error('Chat API error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================
// API: フィードバック生成
// ============================
app.post('/api/feedback', async (req, res) => {
  try {
    const { messages, scenario, persona, criteria, apiKey, baseURL, model, productURL, goal } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'APIキーが設定されていません' });
    }

    const conversationLog = messages
      .map(m => `${m.role === 'user' ? '【営業担当（練習者）】' : '【顧客（AI）】'}：${m.content}`)
      .join('\n');

    const feedbackPrompt = `あなたは営業研修の専門コーチです。以下のロールプレイングの会話ログを分析し、「営業担当（練習者）」のパフォーマンスについて詳細なフィードバックを提供してください。
注意：「顧客（AI）」はAIが演じた顧客役です。評価対象は「営業担当（練習者）」の発言・行動のみです。

## ロープレシナリオ
${scenario}

## 顧客ペルソナ
${persona}
${productURL ? `\n## 提案商品/サービスURL\n${productURL}` : ''}
${goal ? `\n## 営業のゴール設定\n${goal}` : ''}

## 評価基準
${criteria}

## 会話ログ
${conversationLog}

## フィードバック形式
以下のJSON形式で回答してください。必ず有効なJSONのみを返してください（マークダウンのコードブロック記法は使わないでください）。
{
  "overallScore": <1-100の数値>,
  "summary": "<全体の総評（2-3文）>",
  "scores": [
    {
      "criterion": "<評価基準名>",
      "score": <1-10の数値>,
      "maxScore": 10,
      "comment": "<具体的なフィードバック>"
    }
  ],
  "strengths": ["<良かった点1>", "<良かった点2>"],
  "improvements": ["<改善点1>", "<改善点2>"],
  "modelAnswer": "<この場面での模範的な対応例（3-5文）>"
}`;

    const response = await callLLM(
      apiKey,
      baseURL || DEFAULT_BASE_URL,
      model || DEFAULT_MODEL,
      [{ role: 'user', content: feedbackPrompt }],
      { stream: false, temperature: 0.4, max_tokens: 2000 }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `API エラー (${response.status}): ${errText}` });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '{}';

    try {
      const feedback = JSON.parse(content);
      return res.json(feedback);
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const feedback = JSON.parse(jsonMatch[0]);
          return res.json(feedback);
        } catch {}
      }
      return res.json({
        overallScore: 0,
        summary: content,
        scores: [],
        strengths: [],
        improvements: [],
        modelAnswer: ''
      });
    }
  } catch (e) {
    console.error('Feedback API error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================
// API: 接続テスト
// ============================
app.post('/api/test-connection', async (req, res) => {
  try {
    const { apiKey, baseURL, model } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'APIキーが設定されていません' });
    }

    const response = await callLLM(
      apiKey,
      baseURL || DEFAULT_BASE_URL,
      model || DEFAULT_MODEL,
      [{ role: 'user', content: 'テスト。「接続成功」とだけ返答してください。' }],
      { stream: false, temperature: 0, max_tokens: 20 }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ success: false, error: errText });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';
    return res.json({ success: true, message: content, model: result.model });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ============================
// API: TTS（テキスト→音声変換）
// ============================
app.post('/api/tts', async (req, res) => {
  try {
    const { text, apiKey, baseURL, voice, instructions } = req.body;

    if (!apiKey) {
      return res.status(400).json({ error: 'APIキーが設定されていません' });
    }
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'テキストが空です' });
    }

    const ttsBaseURL = (baseURL || DEFAULT_BASE_URL).replace(/\/+$/, '');
    const url = `${ttsBaseURL}/audio/speech`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    const routeId = process.env.GENSPARK_ROUTE_IDENTIFIER || '';
    if (routeId) headers['X-Route-ID'] = routeId;

    const body = {
      model: 'gpt-4o-mini-tts',
      input: text,
      voice: voice || 'coral',
      response_format: 'mp3',
    };
    // instructions でトーンを制御（gpt-4o-mini-ttsのみ）
    if (instructions) body.instructions = instructions;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`TTS API error ${response.status}: ${errText}`);
      return res.status(response.status).json({ error: `TTS API エラー (${response.status})` });
    }

    // 音声バイナリをそのままプロキシ
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');

    const reader = response.body.getReader();
    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    };
    pump().catch(err => {
      console.error('TTS stream error:', err);
      res.end();
    });

  } catch (e) {
    console.error('TTS API error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ============================
// 静的ファイル配信
// ============================
const publicDir = resolve(import.meta.dirname, 'public');
app.use('/static', express.static(join(publicDir, 'static')));

// ============================
// メインページ
// ============================
app.get('/', (req, res) => {
  res.type('html').send(mainPageHTML());
});

// ============================
// サーバー起動
// ============================
const PORT = process.env.PORT || 3000;
const server = createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`AI営業ロープレ サーバー起動: http://0.0.0.0:${PORT}`);
});

// ============================
// システムプロンプト構築
// ============================
function buildSystemPrompt(scenario, persona, productURL, goal) {
  let prompt = `あなたは営業ロールプレイングの練習相手として「顧客役」を演じてください。
この会話では、あなた(assistant)＝顧客、相手(user)＝営業担当者です。
あなたは絶対に営業担当者の立場で話してはいけません。常に顧客としてのみ発言してください。

## シナリオ
${scenario}

## あなたが演じる顧客のペルソナ
${persona}`;

  if (productURL) {
    prompt += `

## 営業担当が提案する商品/サービス
参考URL: ${productURL}
※営業担当がこのサービスについて説明してくるかもしれません。顧客として内容について質問したり、疑問を投げかけてください。`;
  }

  if (goal) {
    prompt += `

## このロープレのゴール設定（営業担当の目標）
${goal}
※これは営業担当の目標です。あなたは顧客なので、簡単にはこの目標を達成させないでください。ただし良い提案をされたら段階的に前向きになってください。`;
  }

  prompt += `

## 重要なルール
- 必ず日本語で応答してください
- あなたは「顧客」です。営業担当者ではありません。この点を絶対に忘れないでください
- 顧客の立場から、自然で現実的な反応をしてください
- 簡単には承諾せず、適度に質問や懸念を投げかけてください
- 1回の応答は2〜4文程度に抑え、会話のテンポを保ってください
- 相手（営業担当者）の提案が良ければ段階的に前向きになってください
- 感情的な反応も適度に入れてください（興味、疑問、不安など）
- 「AI」「ロールプレイ」「シミュレーション」などメタ的な発言は一切しないでください
- あくまで本物の顧客として振る舞い続けてください
- 自己紹介する際はペルソナに記載されている名前・肩書きを使ってください`;

  return prompt;
}

// ============================
// HTML テンプレート
// ============================
function mainPageHTML() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI営業ロープレ</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { font-family: 'Noto Sans JP', sans-serif; }
    .chat-scroll::-webkit-scrollbar { width: 6px; }
    .chat-scroll::-webkit-scrollbar-track { background: transparent; }
    .chat-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
    .voice-wave { display: flex; align-items: center; gap: 3px; height: 32px; }
    .voice-wave .bar {
      width: 4px; border-radius: 2px; background: #3b82f6;
      animation: wave 1s ease-in-out infinite;
    }
    .voice-wave .bar:nth-child(1) { animation-delay: 0s; height: 8px; }
    .voice-wave .bar:nth-child(2) { animation-delay: 0.1s; height: 16px; }
    .voice-wave .bar:nth-child(3) { animation-delay: 0.2s; height: 24px; }
    .voice-wave .bar:nth-child(4) { animation-delay: 0.3s; height: 16px; }
    .voice-wave .bar:nth-child(5) { animation-delay: 0.4s; height: 8px; }
    .voice-wave .bar:nth-child(6) { animation-delay: 0.15s; height: 20px; }
    .voice-wave .bar:nth-child(7) { animation-delay: 0.35s; height: 12px; }
    @keyframes wave {
      0%, 100% { transform: scaleY(0.4); }
      50% { transform: scaleY(1); }
    }
    .voice-wave-red .bar { background: #ef4444; }
    .pulse-ring { animation: pulseRing 1.5s ease-out infinite; }
    @keyframes pulseRing {
      0% { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(1.8); opacity: 0; }
    }
    .fade-in { animation: fadeIn 0.3s ease-out; }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .slide-in { animation: slideIn 0.5s ease-out; }
    @keyframes slideIn {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .score-bar-fill { transition: width 1s ease-out; }
    .chat-bubble-user {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white; border-radius: 18px 18px 4px 18px;
    }
    .chat-bubble-ai {
      background: #f1f5f9;
      color: #1e293b; border-radius: 18px 18px 18px 4px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      transition: all 0.2s;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    }
    textarea:focus, select:focus, input:focus {
      outline: none; border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="app"></div>
  <script src="/static/app.js"></script>
</body>
</html>`;
}
