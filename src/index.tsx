import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamText } from 'hono/streaming'

type Bindings = {
  GENSPARK_TOKEN: string
  GENSPARK_BASE_URL: string
  GENSPARK_ROUTE_IDENTIFIER: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

// ============================
// GenSpark API ヘルパー
// ============================
function getGenSparkConfig(c: any) {
  const token = c.env?.GENSPARK_TOKEN || (typeof process !== 'undefined' ? process.env.GENSPARK_TOKEN : '')
  const baseURL = c.env?.GENSPARK_BASE_URL || (typeof process !== 'undefined' ? process.env.GENSPARK_BASE_URL : 'https://www.genspark.ai')
  const routeId = c.env?.GENSPARK_ROUTE_IDENTIFIER || (typeof process !== 'undefined' ? process.env.GENSPARK_ROUTE_IDENTIFIER : '')
  return { token, baseURL, routeId }
}

async function callLLM(config: { token: string; baseURL: string; routeId: string }, messages: { role: string; content: string }[], options: { temperature?: number; max_tokens?: number; stream?: boolean } = {}) {
  const url = `${config.baseURL}/api/llm_proxy/v1/chat/completions`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.token}`,
  }
  if (config.routeId) {
    headers['X-Route-ID'] = config.routeId
  }

  const body = {
    model: 'gpt-5',
    messages,
    temperature: options.temperature ?? 0.8,
    max_tokens: options.max_tokens ?? 500,
    stream: options.stream ?? false,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`LLM API error ${response.status}: ${errText}`)
  }

  return response
}

// ============================
// API: 会話 (ストリーミング)
// ============================
app.post('/api/chat', async (c) => {
  try {
    const { messages, scenario, persona } = await c.req.json()
    const config = getGenSparkConfig(c)

    const systemPrompt = buildSystemPrompt(scenario, persona)

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content }))
    ]

    // ストリーミングで呼び出し
    const response = await callLLM(config, allMessages, { stream: true, temperature: 0.8, max_tokens: 500 })

    // SSEストリームをテキストストリームに変換
    return streamText(c, async (textStream) => {
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                await textStream.write(content)
              }
            } catch {}
          }
        }
      }
    })
  } catch (e: any) {
    console.error('Chat API error:', e?.message || e)
    return c.json({ error: e?.message || 'Unknown error' }, 500)
  }
})

// ============================
// API: 会話 (非ストリーミング - フォールバック)
// ============================
app.post('/api/chat-sync', async (c) => {
  try {
    const { messages, scenario, persona } = await c.req.json()
    const config = getGenSparkConfig(c)

    const systemPrompt = buildSystemPrompt(scenario, persona)

    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content }))
    ]

    const response = await callLLM(config, allMessages, { stream: false, temperature: 0.8, max_tokens: 500 })
    const result = await response.json() as any
    const content = result.choices?.[0]?.message?.content || ''

    return c.json({ content })
  } catch (e: any) {
    console.error('Chat-sync API error:', e?.message || e)
    return c.json({ error: e?.message || 'Unknown error' }, 500)
  }
})

// ============================
// API: フィードバック生成
// ============================
app.post('/api/feedback', async (c) => {
  try {
    const { messages, scenario, persona, criteria } = await c.req.json()
    const config = getGenSparkConfig(c)

    const conversationLog = messages
      .map((m: any) => `${m.role === 'user' ? '営業担当' : '顧客(AI)'}：${m.content}`)
      .join('\n')

    const feedbackPrompt = `あなたは営業研修の専門コーチです。以下のロールプレイングの会話ログを分析し、詳細なフィードバックを提供してください。

## ロープレシナリオ
${scenario}

## 顧客ペルソナ
${persona}

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
}`

    const response = await callLLM(config, [{ role: 'user', content: feedbackPrompt }], { stream: false, temperature: 0.4, max_tokens: 2000 })
    const result = await response.json() as any
    const content = result.choices?.[0]?.message?.content || '{}'

    try {
      const feedback = JSON.parse(content)
      return c.json(feedback)
    } catch {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const feedback = JSON.parse(jsonMatch[0])
          return c.json(feedback)
        } catch {}
      }
      return c.json({
        overallScore: 0,
        summary: content,
        scores: [],
        strengths: [],
        improvements: [],
        modelAnswer: ''
      })
    }
  } catch (e: any) {
    console.error('Feedback API error:', e?.message || e)
    return c.json({ error: e?.message || 'Unknown error' }, 500)
  }
})

// ============================
// メインページ配信
// ============================
app.get('/', (c) => {
  return c.html(mainPageHTML())
})

export default app

// ============================
// システムプロンプト構築
// ============================
function buildSystemPrompt(scenario: string, persona: string): string {
  return `あなたは営業ロールプレイングの練習相手として、顧客役を演じてください。

## シナリオ
${scenario}

## あなたの顧客ペルソナ
${persona}

## 重要なルール
- 必ず日本語で応答してください
- 顧客として自然で現実的な反応をしてください
- 簡単には承諾せず、適度に質問や懸念を投げかけてください
- 1回の応答は2〜4文程度に抑え、会話のテンポを保ってください
- 相手の提案が良ければ段階的に前向きになってください
- 感情的な反応も適度に入れてください（興味、疑問、不安など）
- 「AI」「ロールプレイ」などメタ的な発言は一切しないでください
- あくまで本物の顧客として振る舞い続けてください`
}

// ============================
// HTML テンプレート
// ============================
function mainPageHTML(): string {
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
    .btn-danger {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      transition: all 0.2s;
    }
    .btn-danger:hover {
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4);
    }
    textarea:focus, select:focus, input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div id="app"></div>
  <script src="/static/app.js"></script>
</body>
</html>`
}
