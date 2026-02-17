// ============================================================
// AI営業ロープレ - フロントエンド
// ============================================================

// ===== 状態管理 =====
const state = {
  currentScreen: 'setup', // setup | roleplay | feedback
  // API設定
  apiKey: localStorage.getItem('roleplay_apiKey') || '',
  baseURL: localStorage.getItem('roleplay_baseURL') || 'https://api.openai.com/v1',
  model: localStorage.getItem('roleplay_model') || 'gpt-4o',
  apiConnected: false,
  // 設定
  scenario: '',
  persona: '',
  criteria: '',
  // 会話
  messages: [],
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  startTime: null,
  elapsedSeconds: 0,
  timerInterval: null,
  // 音声
  recognition: null,
  synthesis: window.speechSynthesis,
  selectedVoice: null,
  // フィードバック
  feedback: null,
  isFeedbackLoading: false,
  // 設定
  autoSpeak: true,
  interimTranscript: '',
};

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  initVoices();
  loadPresets();
  render();
});

// ===== 音声初期化 =====
function initVoices() {
  const setVoice = () => {
    const voices = state.synthesis.getVoices();
    state.selectedVoice =
      voices.find(v => v.lang === 'ja-JP' && v.name.includes('Female')) ||
      voices.find(v => v.lang === 'ja-JP' && v.name.includes('Google')) ||
      voices.find(v => v.lang === 'ja-JP') ||
      voices.find(v => v.lang.startsWith('ja')) ||
      voices[0];
  };
  setVoice();
  state.synthesis.onvoiceschanged = setVoice;
}

// ===== プリセット =====
const PRESETS = {
  newBiz: {
    name: '新規法人開拓',
    icon: 'fa-building',
    scenario: 'あなたはIT企業の営業担当です。中堅製造業（従業員300名）の情報システム部門長に対して、クラウド型の業務管理システムの初回提案を行います。先方は現在オンプレミスのレガシーシステムを使用しており、DX推進に関心はあるが慎重な姿勢です。',
    persona: '田中部長（52歳）。情報システム部門長として15年の経験。技術には詳しいが新しいことには慎重。予算権限はあるが、経営層の承認が必要。「本当に効果があるのか」「移行リスクは？」が主な懸念。物腰は丁寧だが核心を突く質問をする。',
    criteria: '1. 第一印象と挨拶（適切な自己紹介、アイスブレイク）\n2. ヒアリング力（課題の深掘り、オープンクエスチョンの活用）\n3. 提案力（顧客課題に合った提案、具体的なメリット提示）\n4. 反論対応力（懸念への適切な対処、エビデンスの活用）\n5. クロージング（次のステップの提示、合意形成）',
  },
  upsell: {
    name: '既存顧客アップセル',
    icon: 'fa-chart-line',
    scenario: 'あなたはSaaS企業の営業担当です。1年前から基本プランを使用している既存顧客（ECサイト運営会社）に対して、上位プランへのアップグレードを提案します。顧客の売上は好調で、現在のプランの機能制限に不満が出始めています。',
    persona: '鈴木マネージャー（38歳）。EC事業部のマネージャー。データドリブンな意思決定を好む。現行プランには概ね満足だが「もう少しできたらいいのに」と感じている部分もある。コスパに厳しく、ROIを重視する。',
    criteria: '1. 関係構築（既存関係の活用、現状への感謝）\n2. 課題発見（利用状況の確認、潜在ニーズの発掘）\n3. 価値提案（上位プランのROI説明、具体的な成果予測）\n4. 価格交渉（価格に対する価値の説明）\n5. 次回アクション（明確なネクストステップ）',
  },
  complaint: {
    name: 'クレーム対応',
    icon: 'fa-exclamation-triangle',
    scenario: 'あなたはサービス会社のカスタマーサクセス担当です。システム障害により3時間サービスが停止し、影響を受けた重要顧客からクレームの電話を受けています。顧客は感情的になっており、解約も匂わせています。',
    persona: '山田常務（58歳）。古くからの重要顧客企業の役員。普段は温厚だが今回の件で非常に怒っている。「信頼していたのに裏切られた」という気持ち。具体的な損害額も把握している。誠意ある対応を求めている。',
    criteria: '1. 初期対応（迅速な謝罪、共感の表現）\n2. 傾聴力（顧客の怒りを受け止める、遮らない）\n3. 事実確認（冷静な状況把握、正確な情報提供）\n4. 解決策提示（具体的な補償案、再発防止策）\n5. 関係修復（信頼回復へのコミットメント）',
  },
};

function loadPresets() {
  state.scenario = PRESETS.newBiz.scenario;
  state.persona = PRESETS.newBiz.persona;
  state.criteria = PRESETS.newBiz.criteria;
}

// ===== レンダリング =====
function render() {
  const app = document.getElementById('app');
  switch (state.currentScreen) {
    case 'setup': app.innerHTML = renderSetup(); break;
    case 'roleplay': app.innerHTML = renderRoleplay(); scrollChatToBottom(); break;
    case 'feedback': app.innerHTML = renderFeedback(); break;
  }
}

// ============================================================
// 画面1: ロープレ設定
// ============================================================
function renderSetup() {
  const apiStatus = state.apiConnected
    ? '<span class="text-green-600 text-sm font-medium"><i class="fas fa-check-circle mr-1"></i>接続済み</span>'
    : state.apiKey
      ? '<span class="text-yellow-600 text-sm font-medium"><i class="fas fa-exclamation-circle mr-1"></i>未テスト</span>'
      : '<span class="text-red-600 text-sm font-medium"><i class="fas fa-times-circle mr-1"></i>未設定</span>';

  return `
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
    <!-- ヘッダー -->
    <header class="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <i class="fas fa-headset text-white text-lg"></i>
        </div>
        <div>
          <h1 class="text-xl font-bold text-gray-800">AI営業ロープレ</h1>
          <p class="text-xs text-gray-500">AIと対話しながら営業スキルを磨く</p>
        </div>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-8">
      <!-- API設定 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-key text-amber-500"></i>API設定
          </h2>
          ${apiStatus}
        </div>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1">APIキー <span class="text-red-500">*</span></label>
            <input id="apiKey" type="password" value="${state.apiKey}"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
              placeholder="sk-... または APIキーを入力">
            <p class="text-xs text-gray-400 mt-1">OpenAI API や互換サービスのAPIキーを入力してください。ブラウザのローカルストレージに保存されます。</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">ベースURL</label>
              <input id="baseURL" type="text" value="${state.baseURL}"
                class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                placeholder="https://api.openai.com/v1">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">モデル</label>
              <input id="model" type="text" value="${state.model}"
                class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                placeholder="gpt-4o">
            </div>
          </div>

          <div class="flex gap-3">
            <button onclick="saveApiSettings()" class="btn-primary text-white px-6 py-2 rounded-xl text-sm font-medium">
              <i class="fas fa-save mr-1"></i>保存
            </button>
            <button onclick="testConnection()" class="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2 rounded-xl text-sm font-medium transition-all" id="testBtn">
              <i class="fas fa-plug mr-1"></i>接続テスト
            </button>
          </div>
        </div>
      </div>

      <!-- プリセット選択 -->
      <div class="mb-6">
        <h2 class="text-sm font-semibold text-gray-600 mb-3 flex items-center gap-2">
          <i class="fas fa-bookmark text-blue-500"></i>プリセットシナリオ
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${Object.entries(PRESETS).map(([key, p]) => `
            <button onclick="applyPreset('${key}')"
              class="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-md transition-all text-left group">
              <div class="flex items-center gap-2 mb-1">
                <i class="fas ${p.icon} text-blue-500 group-hover:text-blue-600"></i>
                <span class="font-semibold text-gray-800 group-hover:text-blue-600">${p.name}</span>
              </div>
              <div class="text-xs text-gray-500 line-clamp-2">${p.scenario.substring(0, 60)}...</div>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- シナリオ設定 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-cog text-blue-500"></i>ロープレ設定
        </h2>
        
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-file-alt text-blue-400 mr-1"></i>シナリオ
            </label>
            <textarea id="scenario" rows="4" 
              class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none"
              placeholder="営業シーンの状況を記述してください...">${state.scenario}</textarea>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-user-tie text-blue-400 mr-1"></i>顧客ペルソナ
            </label>
            <textarea id="persona" rows="4"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none"
              placeholder="顧客の役職、性格、懸念事項などを記述してください...">${state.persona}</textarea>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-clipboard-check text-blue-400 mr-1"></i>評価基準
            </label>
            <textarea id="criteria" rows="4"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none"
              placeholder="評価したい項目を記述してください...">${state.criteria}</textarea>
          </div>
        </div>
      </div>

      <!-- 音声設定 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-microphone text-blue-500"></i>音声設定
        </h2>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-700">AIの応答を音声で読み上げる</p>
            <p class="text-xs text-gray-500 mt-1">ブラウザの音声合成機能を使用します</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="autoSpeak" ${state.autoSpeak ? 'checked' : ''} class="sr-only peer">
            <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
          </label>
        </div>
      </div>

      <!-- 開始ボタン -->
      <div class="text-center">
        <button onclick="startRoleplay()" 
          class="btn-primary text-white px-12 py-4 rounded-2xl text-lg font-bold shadow-lg inline-flex items-center gap-3 ${!state.apiKey ? 'opacity-50 cursor-not-allowed' : ''}"
          ${!state.apiKey ? 'disabled' : ''}>
          <i class="fas fa-play"></i>
          ロープレを開始する
        </button>
        <p class="text-xs text-gray-400 mt-3">
          ${!state.apiKey ? 'まずAPIキーを設定してください' : 'マイクへのアクセス許可が必要です'}
        </p>
      </div>
    </main>
  </div>`;
}

// ===== API設定 =====
window.saveApiSettings = () => {
  state.apiKey = document.getElementById('apiKey').value.trim();
  state.baseURL = document.getElementById('baseURL').value.trim() || 'https://api.openai.com/v1';
  state.model = document.getElementById('model').value.trim() || 'gpt-4o';
  state.apiConnected = false;

  localStorage.setItem('roleplay_apiKey', state.apiKey);
  localStorage.setItem('roleplay_baseURL', state.baseURL);
  localStorage.setItem('roleplay_model', state.model);

  render();
  showToast('設定を保存しました');
};

window.testConnection = async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const baseURL = document.getElementById('baseURL').value.trim() || 'https://api.openai.com/v1';
  const model = document.getElementById('model').value.trim() || 'gpt-4o';

  if (!apiKey) {
    showToast('APIキーを入力してください', 'error');
    return;
  }

  const btn = document.getElementById('testBtn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>テスト中...';
  btn.disabled = true;

  try {
    const res = await fetch('/api/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, baseURL, model }),
    });
    const data = await res.json();
    
    if (data.success) {
      state.apiConnected = true;
      state.apiKey = apiKey;
      state.baseURL = baseURL;
      state.model = model;
      localStorage.setItem('roleplay_apiKey', apiKey);
      localStorage.setItem('roleplay_baseURL', baseURL);
      localStorage.setItem('roleplay_model', model);
      showToast(`接続成功！ モデル: ${data.model}`, 'success');
    } else {
      state.apiConnected = false;
      showToast(`接続失敗: ${data.error}`, 'error');
    }
  } catch (e) {
    state.apiConnected = false;
    showToast(`接続エラー: ${e.message}`, 'error');
  }

  render();
};

function showToast(message, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const colors = {
    info: 'bg-blue-500',
    success: 'bg-green-500',
    error: 'bg-red-500',
  };
  
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-xl shadow-lg z-50 fade-in text-sm font-medium`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

window.applyPreset = (key) => {
  const p = PRESETS[key];
  state.scenario = p.scenario;
  state.persona = p.persona;
  state.criteria = p.criteria;
  document.getElementById('scenario').value = p.scenario;
  document.getElementById('persona').value = p.persona;
  document.getElementById('criteria').value = p.criteria;
  showToast(`「${p.name}」を適用しました`);
};

window.startRoleplay = () => {
  state.scenario = document.getElementById('scenario').value;
  state.persona = document.getElementById('persona').value;
  state.criteria = document.getElementById('criteria').value;
  state.autoSpeak = document.getElementById('autoSpeak').checked;

  if (!state.apiKey) {
    showToast('APIキーを設定してください', 'error');
    return;
  }
  if (!state.scenario.trim() || !state.persona.trim()) {
    showToast('シナリオと顧客ペルソナは必須です', 'error');
    return;
  }

  state.messages = [];
  state.currentScreen = 'roleplay';
  state.startTime = Date.now();
  state.elapsedSeconds = 0;
  render();
  startTimer();
  generateAIFirstMessage();
};

// ============================================================
// 画面2: ロープレ（音声会話）
// ============================================================
function renderRoleplay() {
  const minutes = Math.floor(state.elapsedSeconds / 60).toString().padStart(2, '0');
  const seconds = (state.elapsedSeconds % 60).toString().padStart(2, '0');

  return `
  <div class="min-h-screen bg-gray-50 flex flex-col" style="height: 100vh; height: 100dvh;">
    <!-- ヘッダー -->
    <header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <i class="fas fa-headset text-white text-sm"></i>
        </div>
        <span class="font-bold text-gray-800">ロープレ中</span>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-2 text-sm text-gray-600">
          <i class="fas fa-clock text-blue-500"></i>
          <span id="timer" class="font-mono font-semibold">${minutes}:${seconds}</span>
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <i class="fas fa-comments"></i>
          <span>${state.messages.length}</span>
        </div>
      </div>
    </header>

    <!-- チャットエリア -->
    <div id="chatArea" class="flex-1 overflow-y-auto chat-scroll px-4 py-4 space-y-3">
      ${state.messages.map((m, i) => renderChatBubble(m, i)).join('')}
      ${state.isProcessing ? renderTypingIndicator() : ''}
    </div>

    <!-- 中間テキスト表示 -->
    ${state.interimTranscript ? `
      <div class="px-4 py-2 bg-blue-50 border-t border-blue-100 flex-shrink-0">
        <p class="text-sm text-blue-600 italic">
          <i class="fas fa-microphone text-blue-400 mr-1"></i>${state.interimTranscript}
        </p>
      </div>
    ` : ''}

    <!-- 操作パネル -->
    <div class="bg-white border-t border-gray-200 px-4 py-4 flex-shrink-0">
      <div class="text-center mb-3">
        ${state.isListening ? `
          <div class="flex items-center justify-center gap-2">
            <div class="voice-wave voice-wave-red">
              <div class="bar"></div><div class="bar"></div><div class="bar"></div>
              <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
            </div>
            <span class="text-sm font-medium text-red-600">聞いています...</span>
          </div>
        ` : state.isSpeaking ? `
          <div class="flex items-center justify-center gap-2">
            <div class="voice-wave">
              <div class="bar"></div><div class="bar"></div><div class="bar"></div>
              <div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div>
            </div>
            <span class="text-sm font-medium text-blue-600">AIが話しています...</span>
          </div>
        ` : state.isProcessing ? `
          <div class="flex items-center justify-center gap-2">
            <div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
            <span class="text-sm text-gray-500">考え中...</span>
          </div>
        ` : `
          <p class="text-sm text-gray-400">マイクボタンを押して話してください</p>
        `}
      </div>

      <div class="flex items-center justify-center gap-4">
        <button onclick="toggleTextInput()"
          class="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-all"
          title="テキスト入力">
          <i class="fas fa-keyboard"></i>
        </button>
        <button id="micBtn" onclick="toggleListening()"
          class="w-16 h-16 rounded-full ${state.isListening ? 'bg-red-500 hover:bg-red-600' : 'btn-primary'} text-white flex items-center justify-center shadow-lg transition-all relative"
          ${state.isProcessing || state.isSpeaking ? 'disabled' : ''}>
          ${state.isListening ? `
            <div class="absolute inset-0 rounded-full bg-red-400 pulse-ring"></div>
            <i class="fas fa-stop text-xl relative z-10"></i>
          ` : `
            <i class="fas fa-microphone text-xl"></i>
          `}
        </button>
        <button onclick="endRoleplay()"
          class="w-12 h-12 rounded-full bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 flex items-center justify-center transition-all"
          title="ロープレ終了">
          <i class="fas fa-stop-circle"></i>
        </button>
      </div>

      <div id="textInputArea" class="hidden mt-4">
        <div class="flex gap-2">
          <input id="textInput" type="text" 
            class="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm"
            placeholder="テキストで入力..."
            onkeydown="if(event.key==='Enter')sendText()">
          <button onclick="sendText()" class="btn-primary text-white px-6 py-3 rounded-xl font-medium text-sm">
            送信
          </button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderChatBubble(msg, index) {
  const isUser = msg.role === 'user';
  return `
    <div class="flex ${isUser ? 'justify-end' : 'justify-start'} fade-in">
      ${!isUser ? `
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
          <i class="fas fa-user-tie text-white text-xs"></i>
        </div>
      ` : ''}
      <div class="${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'} px-4 py-3 max-w-[80%] shadow-sm">
        <p class="text-sm leading-relaxed whitespace-pre-wrap">${escapeHtml(msg.content)}</p>
      </div>
      ${isUser ? `
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0 ml-2 mt-1">
          <i class="fas fa-user text-white text-xs"></i>
        </div>
      ` : ''}
    </div>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderTypingIndicator() {
  return `
    <div class="flex justify-start fade-in">
      <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
        <i class="fas fa-user-tie text-white text-xs"></i>
      </div>
      <div class="chat-bubble-ai px-4 py-3 shadow-sm">
        <div class="flex gap-1">
          <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0s"></div>
          <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.2s"></div>
          <div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.4s"></div>
        </div>
      </div>
    </div>`;
}

// ===== タイマー =====
function startTimer() {
  state.timerInterval = setInterval(() => {
    state.elapsedSeconds = Math.floor((Date.now() - state.startTime) / 1000);
    const el = document.getElementById('timer');
    if (el) {
      const m = Math.floor(state.elapsedSeconds / 60).toString().padStart(2, '0');
      const s = (state.elapsedSeconds % 60).toString().padStart(2, '0');
      el.textContent = `${m}:${s}`;
    }
  }, 1000);
}

// ===== AI第一声 =====
async function generateAIFirstMessage() {
  state.isProcessing = true;
  render();

  const firstMsg = { role: 'user', content: '（営業担当が訪問/電話してきました。顧客として最初の反応をしてください。）' };

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [firstMsg],
        scenario: state.scenario,
        persona: state.persona,
        apiKey: state.apiKey,
        baseURL: state.baseURL,
        model: state.model,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'API呼び出しに失敗しました');
    }

    const text = await readStream(response);
    state.messages.push({ role: 'assistant', content: text });
    state.isProcessing = false;
    render();
    if (state.autoSpeak) speak(text);
  } catch (e) {
    console.error('AI first message error:', e);
    state.isProcessing = false;
    state.messages.push({ role: 'assistant', content: 'はい、どちらさまでしょうか？' });
    render();
    showToast(`AIエラー: ${e.message}`, 'error');
  }
}

// ===== ストリーム読み取り =====
async function readStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  return text.trim();
}

// ===== 音声認識 =====
window.toggleListening = () => {
  if (state.isListening) stopListening();
  else startListening();
};

function startListening() {
  state.synthesis.cancel();
  state.isSpeaking = false;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('お使いのブラウザは音声認識に対応していません。Chromeをお使いください。', 'error');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'ja-JP';
  recognition.continuous = true;
  recognition.interimResults = true;

  let finalTranscript = '';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    state.interimTranscript = interim;
    render();
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      showToast(`音声認識エラー: ${event.error}`, 'error');
    }
  };

  recognition.onend = () => {
    if (state.isListening) {
      // ユーザーが停止した場合、最終テキストを送信
      if (finalTranscript.trim()) {
        sendMessage(finalTranscript.trim());
        finalTranscript = '';
      }
      state.isListening = false;
      state.interimTranscript = '';
      state.recognition = null;
      render();
    }
  };

  try {
    recognition.start();
    state.recognition = recognition;
    state.isListening = true;
    finalTranscript = '';
    render();
  } catch (e) {
    console.error('Failed to start recognition:', e);
    showToast('マイクの起動に失敗しました', 'error');
  }
}

function stopListening() {
  if (state.recognition) {
    state.recognition.stop();
    // onend で処理される
  }
}

// ===== メッセージ送信 =====
async function sendMessage(text) {
  if (!text.trim() || state.isProcessing) return;

  state.messages.push({ role: 'user', content: text.trim() });
  state.isProcessing = true;
  render();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.messages,
        scenario: state.scenario,
        persona: state.persona,
        apiKey: state.apiKey,
        baseURL: state.baseURL,
        model: state.model,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'API呼び出しに失敗しました');
    }

    const aiText = await readStream(response);
    state.messages.push({ role: 'assistant', content: aiText });
    state.isProcessing = false;
    render();
    if (state.autoSpeak) speak(aiText);
  } catch (e) {
    console.error('Chat error:', e);
    state.isProcessing = false;
    render();
    showToast(`エラー: ${e.message}`, 'error');
  }
}

// ===== テキスト入力 =====
window.toggleTextInput = () => {
  const area = document.getElementById('textInputArea');
  if (area) {
    area.classList.toggle('hidden');
    if (!area.classList.contains('hidden')) {
      document.getElementById('textInput')?.focus();
    }
  }
};

window.sendText = () => {
  const input = document.getElementById('textInput');
  if (input && input.value.trim()) {
    sendMessage(input.value);
    input.value = '';
  }
};

// ===== 音声合成 =====
function speak(text) {
  state.synthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  if (state.selectedVoice) utterance.voice = state.selectedVoice;

  utterance.onstart = () => { state.isSpeaking = true; render(); };
  utterance.onend = () => { state.isSpeaking = false; render(); };
  utterance.onerror = () => { state.isSpeaking = false; render(); };

  state.synthesis.speak(utterance);
}

// ===== チャットスクロール =====
function scrollChatToBottom() {
  setTimeout(() => {
    const el = document.getElementById('chatArea');
    if (el) el.scrollTop = el.scrollHeight;
  }, 100);
}

// ===== ロープレ終了 =====
window.endRoleplay = () => {
  if (state.messages.length < 2) {
    showToast('もう少し会話を続けてからフィードバックを受けましょう', 'error');
    return;
  }
  if (!confirm('ロープレを終了してフィードバックを受けますか？')) return;

  stopListening();
  state.synthesis.cancel();
  clearInterval(state.timerInterval);
  state.isListening = false;
  state.isSpeaking = false;

  state.currentScreen = 'feedback';
  state.isFeedbackLoading = true;
  render();
  generateFeedback();
};

// ============================================================
// 画面3: フィードバック
// ============================================================
async function generateFeedback() {
  try {
    const response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.messages,
        scenario: state.scenario,
        persona: state.persona,
        criteria: state.criteria,
        apiKey: state.apiKey,
        baseURL: state.baseURL,
        model: state.model,
      }),
    });
    
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'フィードバック生成に失敗');
    }

    state.feedback = await response.json();
  } catch (e) {
    console.error('Feedback error:', e);
    state.feedback = {
      overallScore: 0,
      summary: `フィードバックの生成に失敗しました: ${e.message}`,
      scores: [], strengths: [], improvements: [], modelAnswer: '',
    };
  }
  state.isFeedbackLoading = false;
  render();
}

function renderFeedback() {
  if (state.isFeedbackLoading) {
    return `
    <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-lg font-semibold text-gray-700">フィードバックを生成中...</p>
        <p class="text-sm text-gray-500 mt-2">AIが会話を分析しています</p>
      </div>
    </div>`;
  }

  const fb = state.feedback;
  const minutes = Math.floor(state.elapsedSeconds / 60);
  const seconds = state.elapsedSeconds % 60;
  const scoreColor = fb.overallScore >= 70 ? 'text-green-600' : fb.overallScore >= 40 ? 'text-yellow-600' : 'text-red-600';

  return `
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
    <header class="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <i class="fas fa-chart-line text-white text-lg"></i>
          </div>
          <div>
            <h1 class="text-xl font-bold text-gray-800">フィードバック</h1>
            <p class="text-xs text-gray-500">ロープレ結果レポート</p>
          </div>
        </div>
        <button onclick="backToSetup()" class="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
          <i class="fas fa-redo"></i>もう一度
        </button>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <!-- 概要カード -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 slide-in">
        <div class="flex flex-col sm:flex-row items-center gap-6">
          <div class="relative w-32 h-32 flex-shrink-0">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="#e5e7eb" stroke-width="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none" stroke="url(#scoreGradient)" stroke-width="3"
                stroke-dasharray="${fb.overallScore}, 100" stroke-linecap="round" />
              <defs>
                <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style="stop-color:#3b82f6" />
                  <stop offset="100%" style="stop-color:#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-3xl font-bold ${scoreColor}">${fb.overallScore}</span>
              <span class="text-xs text-gray-500">/ 100</span>
            </div>
          </div>
          <div class="flex-1 text-center sm:text-left">
            <p class="text-gray-700 leading-relaxed">${escapeHtml(fb.summary)}</p>
            <div class="mt-3 flex flex-wrap gap-3 justify-center sm:justify-start">
              <span class="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                <i class="fas fa-clock mr-1"></i>${minutes}分${seconds}秒
              </span>
              <span class="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full">
                <i class="fas fa-comments mr-1"></i>${state.messages.length}ターン
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 項目別スコア -->
      ${fb.scores && fb.scores.length > 0 ? `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 slide-in">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-star text-yellow-500"></i>項目別評価
        </h2>
        <div class="space-y-4">
          ${fb.scores.map(s => {
            const pct = (s.score / s.maxScore) * 100;
            const barColor = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
            return `
            <div>
              <div class="flex justify-between items-center mb-1">
                <span class="text-sm font-medium text-gray-700">${escapeHtml(s.criterion)}</span>
                <span class="text-sm font-bold ${pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-600'}">${s.score}/${s.maxScore}</span>
              </div>
              <div class="w-full bg-gray-100 rounded-full h-2.5 mb-1">
                <div class="${barColor} h-2.5 rounded-full score-bar-fill" style="width: ${pct}%"></div>
              </div>
              <p class="text-xs text-gray-500">${escapeHtml(s.comment)}</p>
            </div>`;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <!-- 良かった点 & 改善点 -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 slide-in">
        ${fb.strengths && fb.strengths.length > 0 ? `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <i class="fas fa-thumbs-up text-green-500"></i>良かった点
          </h2>
          <ul class="space-y-2">
            ${fb.strengths.map(s => `
              <li class="flex items-start gap-2 text-sm text-gray-700">
                <i class="fas fa-check-circle text-green-400 mt-0.5 flex-shrink-0"></i>
                <span>${escapeHtml(s)}</span>
              </li>`).join('')}
          </ul>
        </div>` : ''}
        
        ${fb.improvements && fb.improvements.length > 0 ? `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <i class="fas fa-lightbulb text-orange-500"></i>改善ポイント
          </h2>
          <ul class="space-y-2">
            ${fb.improvements.map(s => `
              <li class="flex items-start gap-2 text-sm text-gray-700">
                <i class="fas fa-arrow-circle-up text-orange-400 mt-0.5 flex-shrink-0"></i>
                <span>${escapeHtml(s)}</span>
              </li>`).join('')}
          </ul>
        </div>` : ''}
      </div>

      <!-- 模範回答 -->
      ${fb.modelAnswer ? `
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 slide-in">
        <h2 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
          <i class="fas fa-trophy text-blue-500"></i>模範的な対応例
        </h2>
        <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(fb.modelAnswer)}</p>
      </div>` : ''}

      <!-- 会話ログ -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 slide-in">
        <details>
          <summary class="cursor-pointer text-lg font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-scroll text-gray-500"></i>会話ログ
          </summary>
          <div class="mt-4 space-y-3 max-h-96 overflow-y-auto chat-scroll">
            ${state.messages.map(m => `
              <div class="flex items-start gap-2 text-sm ${m.role === 'user' ? 'text-blue-700' : 'text-gray-700'}">
                <span class="font-bold flex-shrink-0">${m.role === 'user' ? '営業：' : '顧客：'}</span>
                <span>${escapeHtml(m.content)}</span>
              </div>
            `).join('')}
          </div>
        </details>
      </div>

      <div class="text-center pb-8 slide-in">
        <button onclick="backToSetup()"
          class="btn-primary text-white px-10 py-3 rounded-2xl font-bold shadow-lg inline-flex items-center gap-2">
          <i class="fas fa-redo"></i>もう一度ロープレする
        </button>
      </div>
    </main>
  </div>`;
}

window.backToSetup = () => {
  state.currentScreen = 'setup';
  state.messages = [];
  state.feedback = null;
  state.isFeedbackLoading = false;
  state.isProcessing = false;
  state.isSpeaking = false;
  state.isListening = false;
  render();
};
