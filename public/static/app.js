// ============================================================
// AI営業ロープレ - フロントエンド v3
// ============================================================

// ===== 状態管理 =====
const state = {
  currentScreen: 'setup', // setup | roleplay | feedback
  // API設定
  apiKey: localStorage.getItem('roleplay_apiKey') || '',
  baseURL: localStorage.getItem('roleplay_baseURL') || 'https://api.openai.com/v1',
  model: localStorage.getItem('roleplay_model') || 'gpt-5.2',
  apiConnected: false,
  // 設定
  scenario: '',
  persona: '',
  criteria: '',
  productURL: '',
  goal: '',
  // ペルソナ追加パラメータ
  personaSpeed: localStorage.getItem('roleplay_personaSpeed') || 'normal',   // slow | normal | fast
  personaTone: localStorage.getItem('roleplay_personaTone') || 'business',    // gentle | firm | friendly | business
  // クロージングポイント
  closingPoints: '',
  // 会話
  messages: [],
  isListening: false,
  isSpeaking: false,
  isProcessing: false,
  startTime: null,
  elapsedSeconds: 0,
  timerInterval: null,
  turnCount: 0,
  // TTS設定
  ttsMode: 'api',
  ttsVoice: localStorage.getItem('roleplay_ttsVoice') || 'coral',
  // フィードバック
  feedback: null,
  isFeedbackLoading: false,
  // 設定
  autoSpeak: true,
  interimTranscript: '',
  showTextInput: false,
  // テンプレート
  templates: JSON.parse(localStorage.getItem('roleplay_templates') || '[]'),
  // 提案書ライブラリ
  documents: JSON.parse(localStorage.getItem('roleplay_documents') || '[]'),
  documentId: '',           // 選択中の資料ID（空=なし）
  documentMode: '',         // 'pre-shared' | 'on-the-spot'
  documentEnabled: false,   // 提案書有無トグル
};

// ===== ペルソナパラメータ選択肢 =====
const PERSONA_SPEEDS = [
  { id: 'slow', name: 'ゆっくり', desc: '慎重に考えながら話す', icon: 'fa-turtle' },
  { id: 'normal', name: '普通', desc: '標準的なテンポ', icon: 'fa-person-walking' },
  { id: 'fast', name: '早口', desc: 'テンポよく短く話す', icon: 'fa-person-running' },
];
const PERSONA_TONES = [
  { id: 'gentle', name: '穏やか', desc: '腰が低く丁寧な話し方' },
  { id: 'firm', name: '固め', desc: '芝居敷が短く核心を突く' },
  { id: 'friendly', name: 'フレンドリー', desc: '明るく打ち解けた雰囲気' },
  { id: 'business', name: 'ビジネスライク', desc: '淡々と効率重視' },
];

// ===== 既知モデル一覧 =====
const KNOWN_MODELS = [
  'gpt-5.2', 'gpt-5.2-pro',
  'gpt-5.1',
  'gpt-5', 'gpt-5-mini', 'gpt-5-nano',
  'gpt-4o', 'gpt-4o-mini',
  'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
  'o4-mini', 'o3', 'o3-pro', 'o3-mini',
  'gpt-3.5-turbo',
];

// ===== TTS ボイス一覧 =====
const TTS_VOICES = [
  { id: 'coral', name: 'Coral', desc: '落ち着いた女性' },
  { id: 'sage', name: 'Sage', desc: '穏やかな男性' },
  { id: 'alloy', name: 'Alloy', desc: '中性的' },
  { id: 'ash', name: 'Ash', desc: '低めの男性' },
  { id: 'ballad', name: 'Ballad', desc: '柔らかい男性' },
  { id: 'echo', name: 'Echo', desc: '明瞭な男性' },
  { id: 'fable', name: 'Fable', desc: '表現豊かな男性' },
  { id: 'nova', name: 'Nova', desc: '若い女性' },
  { id: 'onyx', name: 'Onyx', desc: '深い男性' },
  { id: 'shimmer', name: 'Shimmer', desc: '明るい女性' },
  { id: 'marin', name: 'Marin', desc: '自然な女性（推奨）' },
  { id: 'cedar', name: 'Cedar', desc: '自然な男性（推奨）' },
];

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  loadPresets();
  render();
});

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
  // 初回のみデフォルトプリセットを適用（既に値がある場合は上書きしない）
  if (!state.scenario) state.scenario = PRESETS.newBiz.scenario;
  if (!state.persona) state.persona = PRESETS.newBiz.persona;
  if (!state.criteria) state.criteria = PRESETS.newBiz.criteria;
}

// ===== フォームの入力値をstateに同期 =====
function syncStateFromForm() {
  const el = (id) => document.getElementById(id);
  if (el('scenario')) state.scenario = el('scenario').value;
  if (el('persona')) state.persona = el('persona').value;
  if (el('criteria')) state.criteria = el('criteria').value;
  if (el('productURL')) state.productURL = el('productURL').value;
  if (el('goal')) state.goal = el('goal').value;
  if (el('closingPoints')) state.closingPoints = el('closingPoints').value;
  // 提案書設定
  const docToggle = el('documentEnabled');
  if (docToggle) state.documentEnabled = docToggle.checked;
  const docSelect = el('documentId');
  if (docSelect) state.documentId = docSelect.value;
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

  const isCustomModel = !KNOWN_MODELS.includes(state.model);

  return `
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
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
            <p class="text-xs text-gray-400 mt-1">OpenAI API キーを入力してください（Responses API 使用）</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">ベースURL</label>
              <input id="baseURL" type="text" value="${state.baseURL}"
                class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
                placeholder="https://api.openai.com/v1">
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 mb-1">チャットモデル</label>
              <select id="model" onchange="onModelSelectChange()" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white">
                <optgroup label="GPT-5.2 系（最新フラッグシップ）">
                  <option value="gpt-5.2" ${state.model === 'gpt-5.2' ? 'selected' : ''}>gpt-5.2（最高性能）</option>
                  <option value="gpt-5.2-pro" ${state.model === 'gpt-5.2-pro' ? 'selected' : ''}>gpt-5.2-pro（高精度版）</option>
                </optgroup>
                <optgroup label="GPT-5.1 系">
                  <option value="gpt-5.1" ${state.model === 'gpt-5.1' ? 'selected' : ''}>gpt-5.1</option>
                </optgroup>
                <optgroup label="GPT-5 系">
                  <option value="gpt-5" ${state.model === 'gpt-5' ? 'selected' : ''}>gpt-5</option>
                  <option value="gpt-5-mini" ${state.model === 'gpt-5-mini' ? 'selected' : ''}>gpt-5-mini（コスパ◎）</option>
                  <option value="gpt-5-nano" ${state.model === 'gpt-5-nano' ? 'selected' : ''}>gpt-5-nano（最速・最安）</option>
                </optgroup>
                <optgroup label="GPT-4o 系">
                  <option value="gpt-4o" ${state.model === 'gpt-4o' ? 'selected' : ''}>gpt-4o</option>
                  <option value="gpt-4o-mini" ${state.model === 'gpt-4o-mini' ? 'selected' : ''}>gpt-4o-mini（コスパ◎）</option>
                </optgroup>
                <optgroup label="GPT-4.1 系">
                  <option value="gpt-4.1" ${state.model === 'gpt-4.1' ? 'selected' : ''}>gpt-4.1</option>
                  <option value="gpt-4.1-mini" ${state.model === 'gpt-4.1-mini' ? 'selected' : ''}>gpt-4.1-mini</option>
                  <option value="gpt-4.1-nano" ${state.model === 'gpt-4.1-nano' ? 'selected' : ''}>gpt-4.1-nano</option>
                </optgroup>
                <optgroup label="o 系（推論特化モデル）">
                  <option value="o4-mini" ${state.model === 'o4-mini' ? 'selected' : ''}>o4-mini（高速推論）</option>
                  <option value="o3" ${state.model === 'o3' ? 'selected' : ''}>o3</option>
                  <option value="o3-pro" ${state.model === 'o3-pro' ? 'selected' : ''}>o3-pro（高精度推論）</option>
                  <option value="o3-mini" ${state.model === 'o3-mini' ? 'selected' : ''}>o3-mini</option>
                </optgroup>
                <optgroup label="旧モデル">
                  <option value="gpt-3.5-turbo" ${state.model === 'gpt-3.5-turbo' ? 'selected' : ''}>gpt-3.5-turbo（低コスト）</option>
                </optgroup>
                <optgroup label="カスタム">
                  <option value="custom" ${isCustomModel ? 'selected' : ''}>カスタムモデル名を入力...</option>
                </optgroup>
              </select>
              <input id="modelCustom" type="text" 
                value="${isCustomModel ? state.model : ''}"
                class="w-full px-4 py-2 border border-gray-300 rounded-xl text-sm mt-2 ${isCustomModel ? '' : 'hidden'}"
                placeholder="カスタムモデル名を入力">
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

      <!-- テンプレート & プリセット -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-gray-600 flex items-center gap-2">
            <i class="fas fa-bookmark text-blue-500"></i>シナリオ選択
          </h2>
          ${state.templates.length > 0 ? `
            <button onclick="toggleTemplateList()" class="text-xs text-blue-600 hover:text-blue-800 font-medium">
              <i class="fas fa-folder-open mr-1"></i>保存済みテンプレート (${state.templates.length})
            </button>
          ` : ''}
        </div>
        
        <!-- プリセット -->
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          ${Object.entries(PRESETS).map(([key, p]) => `
            <button onclick="applyPreset('${key}')"
              class="p-4 rounded-xl border-2 border-gray-200 bg-white hover:border-blue-400 hover:shadow-md transition-all text-left group">
              <div class="flex items-center gap-2 mb-1">
                <i class="fas ${p.icon} text-blue-500 group-hover:text-blue-600"></i>
                <span class="font-semibold text-gray-800 group-hover:text-blue-600 text-sm">${p.name}</span>
              </div>
              <div class="text-xs text-gray-500 line-clamp-2">${p.scenario.substring(0, 60)}...</div>
            </button>
          `).join('')}
        </div>

        <!-- テンプレートエクスポート/インポート -->
        <div class="flex gap-2 mt-2">
          <button onclick="exportTemplates()" class="text-xs text-gray-500 hover:text-blue-600 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 transition-all bg-white">
            <i class="fas fa-file-export"></i>エクスポート
          </button>
          <button onclick="importTemplates()" class="text-xs text-gray-500 hover:text-blue-600 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-blue-300 transition-all bg-white">
            <i class="fas fa-file-import"></i>インポート
          </button>
        </div>

        <!-- 保存済みテンプレート一覧 -->
        <div id="templateList" class="hidden mt-3 space-y-2">
          ${state.templates.map((t, i) => `
            <div class="flex items-center gap-2 p-3 rounded-xl border border-gray-200 bg-white hover:border-blue-200 transition-colors">
              <button onclick="loadTemplate(${i})" class="flex-1 text-left hover:text-blue-600 transition-colors">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-sm font-semibold text-gray-800">${escapeHtml(t.name)}</span>
                  ${t.productURL ? '<span class="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">URL付き</span>' : ''}
                  ${t.goal ? '<span class="text-[10px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">目標付き</span>' : ''}
                  ${t.closingPoints ? '<span class="text-[10px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">CP付き</span>' : ''}
                  ${t.documentId ? '<span class="text-[10px] bg-teal-100 text-teal-600 px-1.5 py-0.5 rounded-full">提案書付き</span>' : ''}
                </div>
                <div class="text-xs text-gray-500 mt-0.5">${escapeHtml(t.scenario.substring(0, 60))}...</div>
                ${t.createdAt ? '<div class="text-[10px] text-gray-400 mt-0.5">' + new Date(t.createdAt).toLocaleDateString('ja-JP') + ' 保存</div>' : ''}
              </button>
              <button onclick="deleteTemplate(${i})" class="text-gray-400 hover:text-red-500 transition-colors p-2" title="削除">
                <i class="fas fa-trash-alt text-sm"></i>
              </button>
            </div>
          `).join('')}
          ${state.templates.length === 0 ? '<p class="text-xs text-gray-400 text-center py-2">保存済みテンプレートはありません</p>' : ''}
        </div>
      </div>

      <!-- ロープレ設定 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-cog text-blue-500"></i>ロープレ設定
          </h2>
          <button onclick="saveTemplate()" class="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
            <i class="fas fa-save"></i>テンプレート保存
          </button>
        </div>
        
        <div class="space-y-5">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-file-alt text-blue-400 mr-1"></i>シナリオ <span class="text-red-500">*</span>
            </label>
            <textarea id="scenario" rows="3" 
              class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none"
              placeholder="営業シーンの状況を記述してください...">${state.scenario}</textarea>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-semibold text-gray-700">
                <i class="fas fa-user-tie text-blue-400 mr-1"></i>顧客ペルソナ <span class="text-red-500">*</span>
              </label>
              <button onclick="generatePersona()" class="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all" id="generatePersonaBtn">
                <i class="fas fa-magic"></i>AIで自動生成
              </button>
            </div>
            <textarea id="persona" rows="3"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none"
              placeholder="顧客の役職、性格、懸念事項などを記述してください...">${state.persona}</textarea>
            <p class="text-xs text-gray-400 mt-1">AIで自動生成ボタンを押すと、シナリオに基づいたペルソナをランダムで作成します</p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-link text-blue-400 mr-1"></i>商品/サービスサイトURL
            </label>
            <input id="productURL" type="url" value="${state.productURL}"
              class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm"
              placeholder="https://example.com/product（任意）">
            <p class="text-xs text-gray-400 mt-1">営業で提案する商品・サービスの参考URLを入力するとAIが参照します</p>
          </div>

          <!-- 提案書設定 -->
          <div class="border-t border-gray-100 pt-5">
            <div class="flex items-center justify-between mb-3">
              <p class="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <i class="fas fa-file-powerpoint text-teal-500"></i>提案書設定
              </p>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" id="documentEnabled" ${state.documentEnabled ? 'checked' : ''} onchange="toggleDocumentEnabled()" class="sr-only peer">
                <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-teal-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
              </label>
            </div>

            <div id="documentDetail" class="${state.documentEnabled ? '' : 'hidden'} space-y-4">
              ${state.documents.length > 0 ? `
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-2">使用する提案書</label>
                  <select id="documentId" onchange="onDocumentSelectChange()" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white">
                    <option value="">-- 提案書を選択 --</option>
                    ${state.documents.map(d => `<option value="${d.id}" ${state.documentId === d.id ? 'selected' : ''}>${escapeHtml(d.name)}（${d.sections.length}セクション）</option>`).join('')}
                  </select>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-2">顧客の資料認知モード</label>
                  <div class="grid grid-cols-2 gap-2">
                    <button type="button" onclick="setDocumentMode('pre-shared')" id="docmode-pre-shared"
                      class="px-3 py-2.5 rounded-lg border-2 text-center transition-all text-xs font-medium
                        ${state.documentMode === 'pre-shared' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}">
                      <div class="font-bold"><i class="fas fa-eye mr-1"></i>事前共有済み</div>
                      <div class="text-[10px] mt-0.5 opacity-70">顧客は内容を把握済み</div>
                    </button>
                    <button type="button" onclick="setDocumentMode('on-the-spot')" id="docmode-on-the-spot"
                      class="px-3 py-2.5 rounded-lg border-2 text-center transition-all text-xs font-medium
                        ${state.documentMode === 'on-the-spot' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}">
                      <div class="font-bold"><i class="fas fa-eye-slash mr-1"></i>その場で説明</div>
                      <div class="text-[10px] mt-0.5 opacity-70">営業が提示するまで未知</div>
                    </button>
                  </div>
                </div>

                <div id="docPreview" class="${state.documentId ? '' : 'hidden'} space-y-1">
                  ${(() => {
                    const doc = state.documents.find(d => d.id === state.documentId);
                    if (!doc) return '';
                    return doc.sections.map(s => `
                      <details class="border border-gray-100 rounded-lg">
                        <summary class="cursor-pointer px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">${escapeHtml(s.title)}</summary>
                        <p class="px-3 py-2 text-xs text-gray-500 whitespace-pre-wrap border-t border-gray-100">${escapeHtml(s.content.substring(0, 200))}${s.content.length > 200 ? '...' : ''}</p>
                      </details>
                    `).join('');
                  })()}
                </div>
              ` : '<p class="text-xs text-gray-400">提案書がまだインポートされていません。下のライブラリ管理からインポートしてください。</p>'}

              <div class="border-t border-gray-100 pt-3">
                <div class="flex items-center justify-between mb-2">
                  <button onclick="toggleDocLibrary()" class="text-xs text-teal-600 hover:text-teal-800 font-medium flex items-center gap-1">
                    <i class="fas fa-book mr-1"></i>提案書ライブラリ管理 (${state.documents.length})
                  </button>
                  <div class="flex gap-2">
                    <button onclick="importDocument()" class="text-xs text-gray-500 hover:text-teal-600 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-teal-300 transition-all bg-white">
                      <i class="fas fa-file-import"></i>インポート
                    </button>
                    <button onclick="exportDocuments()" class="text-xs text-gray-500 hover:text-teal-600 font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-teal-300 transition-all bg-white">
                      <i class="fas fa-file-export"></i>エクスポート
                    </button>
                  </div>
                </div>
                <div id="docLibrary" class="hidden space-y-2 mt-2">
                  ${state.documents.length > 0 ? state.documents.map(d => `
                    <div class="flex items-center gap-2 p-3 rounded-xl border border-gray-200 bg-white">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 flex-wrap">
                          <span class="text-sm font-medium text-gray-800 truncate">${escapeHtml(d.name)}</span>
                          ${d.format === 'rich' ? '<span class="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full flex-shrink-0">AI変換済み</span>' : ''}
                        </div>
                        <div class="text-[10px] text-gray-400">${d.format === 'rich' ? (d.richData?.runtime_chunks?.length || 0) + 'チャンク' : (d.sections?.length || 0) + 'セクション'} | ${d.createdAt ? new Date(d.createdAt).toLocaleDateString('ja-JP') : ''}</div>
                      </div>
                      <button onclick="deleteDocument('${d.id}')" class="text-gray-400 hover:text-red-500 transition-colors p-2" title="削除">
                        <i class="fas fa-trash-alt text-sm"></i>
                      </button>
                    </div>
                  `).join('') : '<p class="text-xs text-gray-400 text-center py-2">提案書はありません</p>'}
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-400 mt-2">提案書を使ったロープレを行う場合はONにしてください。JSON形式でインポートできます。</p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-bullseye text-blue-400 mr-1"></i>ゴール設定
            </label>
            <textarea id="goal" rows="2"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none"
              placeholder="例: 次回のデモ日程を取り付ける / 上位プランの見積もり依頼を獲得する">${state.goal}</textarea>
            <p class="text-xs text-gray-400 mt-1">このロープレで営業として達成したい目標を記述してください</p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-clipboard-check text-blue-400 mr-1"></i>評価基準
            </label>
            <textarea id="criteria" rows="3"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none"
              placeholder="評価したい項目を記述してください...">${state.criteria}</textarea>
          </div>

          <!-- ペルソナ追加パラメータ -->
          <div class="border-t border-gray-100 pt-5">
            <p class="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <i class="fas fa-sliders-h text-blue-400"></i>顧客の話し方設定
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-2">話すスピード</label>
                <div class="flex gap-2">
                  ${PERSONA_SPEEDS.map(s => `
                    <button type="button" onclick="setPersonaSpeed('${s.id}')" id="speed-${s.id}"
                      class="flex-1 px-3 py-2 rounded-lg border-2 text-center transition-all text-xs font-medium
                        ${state.personaSpeed === s.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}">
                      <div class="font-bold">${s.name}</div>
                      <div class="text-[10px] mt-0.5 opacity-70">${s.desc}</div>
                    </button>
                  `).join('')}
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-2">トーン（口調）</label>
                <div class="grid grid-cols-2 gap-2">
                  ${PERSONA_TONES.map(t => `
                    <button type="button" onclick="setPersonaTone('${t.id}')" id="tone-${t.id}"
                      class="px-3 py-2 rounded-lg border-2 text-center transition-all text-xs font-medium
                        ${state.personaTone === t.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'}">
                      <div class="font-bold">${t.name}</div>
                      <div class="text-[10px] mt-0.5 opacity-70">${t.desc}</div>
                    </button>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>

          <!-- クロージングポイント -->
          <div class="border-t border-gray-100 pt-5">
            <label class="block text-sm font-semibold text-gray-700 mb-2">
              <i class="fas fa-flag-checkered text-green-500 mr-1"></i>クロージングポイント
            </label>
            <textarea id="closingPoints" rows="3"
              class="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm resize-none"
              placeholder="例:&#10;・次回のデモ日程を具体的に提示できたら&#10;・導入後のROIを数値で説明できたら&#10;・顧客が『検討します』ではなく具体的な質問をしてきたら">${state.closingPoints}</textarea>
            <p class="text-xs text-gray-400 mt-1">この言葉が言えたら・聞けたらクロージングに進めるポイントを設定。AI顧客が適切なタイミングで前向きに反応します。</p>
          </div>
        </div>
      </div>

      <!-- 音声設定 -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <i class="fas fa-volume-up text-blue-500"></i>音声設定
        </h2>
        
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-700">AIの応答を音声で読み上げる</p>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="autoSpeak" ${state.autoSpeak ? 'checked' : ''} class="sr-only peer">
              <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
            </label>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-2">TTSボイス</label>
            <select id="ttsVoice" onchange="onTtsVoiceChange()" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm bg-white">
              ${TTS_VOICES.map(v => `
                <option value="${v.id}" ${state.ttsVoice === v.id ? 'selected' : ''}>${v.name} - ${v.desc}</option>
              `).join('')}
            </select>
            <p class="text-xs text-gray-400 mt-1">OpenAI gpt-4o-mini-tts による高品質な日本語音声で読み上げます（API課金あり）</p>
          </div>
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
          ${!state.apiKey ? 'まずAPIキーを設定してください' : 'マイクへのアクセス許可が必要です（Chrome推奨）'}
        </p>
      </div>
    </main>
  </div>`;
}

// ============================================================
// テンプレート管理
// ============================================================
window.saveTemplate = () => {
  syncStateFromForm();
  const scenario = state.scenario;
  const persona = state.persona;
  const criteria = state.criteria;
  const productURL = state.productURL;
  const goal = state.goal;
  const closingPoints = state.closingPoints;

  if (!scenario.trim()) {
    showToast('シナリオを入力してからテンプレートを保存してください', 'error');
    return;
  }

  const name = prompt('テンプレート名を入力してください:', scenario.substring(0, 30) + '...');
  if (!name) return;

  state.templates.push({ name, scenario, persona, criteria, productURL, goal, personaSpeed: state.personaSpeed, personaTone: state.personaTone, closingPoints, documentId: state.documentEnabled ? state.documentId : '', documentMode: state.documentEnabled ? state.documentMode : '', createdAt: Date.now() });
  localStorage.setItem('roleplay_templates', JSON.stringify(state.templates));
  render();
  showToast(`テンプレート「${name}」を保存しました`, 'success');
};

window.loadTemplate = (index) => {
  const t = state.templates[index];
  if (!t) return;
  state.scenario = t.scenario || '';
  state.persona = t.persona || '';
  state.criteria = t.criteria || '';
  state.productURL = t.productURL || '';
  state.goal = t.goal || '';
  state.personaSpeed = t.personaSpeed || 'normal';
  state.personaTone = t.personaTone || 'business';
  state.closingPoints = t.closingPoints || '';
  // 提案書設定の復元
  state.documentId = t.documentId || '';
  state.documentMode = t.documentMode || '';
  if (state.documentId) {
    const docExists = state.documents.some(d => d.id === state.documentId);
    if (docExists) {
      state.documentEnabled = true;
    } else {
      state.documentId = '';
      state.documentMode = '';
      state.documentEnabled = false;
      showToast('テンプレートに紐付いた提案書がライブラリにありません', 'error');
    }
  } else {
    state.documentEnabled = false;
  }
  render();
  showToast(`テンプレート「${t.name}」を読み込みました`, 'success');
};

window.deleteTemplate = (index) => {
  const t = state.templates[index];
  if (!t) return;
  if (!confirm(`テンプレート「${t.name}」を削除しますか？`)) return;
  state.templates.splice(index, 1);
  localStorage.setItem('roleplay_templates', JSON.stringify(state.templates));
  render();
  showToast('テンプレートを削除しました');
};

window.toggleTemplateList = () => {
  const list = document.getElementById('templateList');
  if (list) list.classList.toggle('hidden');
};

// ===== テンプレートエクスポート/インポート =====
window.exportTemplates = () => {
  if (state.templates.length === 0) { showToast('エクスポートするテンプレートがありません', 'error'); return; }
  const data = JSON.stringify(state.templates, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const fileName = `ロープレテンプレート_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.json`;
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  showToast(`${state.templates.length}件のテンプレートをエクスポートしました`, 'success');
};

window.importTemplates = () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json'; input.style.display = 'none';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!Array.isArray(imported)) throw new Error('invalid');
        let count = 0;
        for (const t of imported) {
          if (t.scenario && t.persona) {
            // 重複チェック（同名+同シナリオはスキップ）
            const exists = state.templates.some(ex => ex.name === t.name && ex.scenario === t.scenario);
            if (!exists) { state.templates.push(t); count++; }
          }
        }
        localStorage.setItem('roleplay_templates', JSON.stringify(state.templates));
        syncStateFromForm();
        render();
        showToast(`${count}件のテンプレートをインポートしました`, 'success');
      } catch (err) {
        showToast('ファイルの読み込みに失敗しました。正しいJSONファイルを選択してください。', 'error');
      }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input); input.click();
  setTimeout(() => document.body.removeChild(input), 1000);
};

// ============================================================
// 提案書ライブラリ管理
// ============================================================
function saveDocumentsToStorage() {
  localStorage.setItem('roleplay_documents', JSON.stringify(state.documents));
}

function getDocumentContentForAPI() {
  if (!state.documentEnabled || !state.documentId) return { documentContent: '', documentMode: '' };
  const doc = state.documents.find(d => d.id === state.documentId);
  if (!doc) return { documentContent: '', documentMode: '' };
  let content;
  if (doc.format === 'rich') {
    const rd = doc.richData;
    const parts = [];
    if (rd.document_summary?.overall_theme) parts.push(`【資料概要】\n${rd.document_summary.overall_theme}`);
    if (rd.runtime_chunks?.length) {
      parts.push('【資料の主な内容】\n' + rd.runtime_chunks.map(c => `・[${c.topic}] ${c.text}`).join('\n'));
    }
    const concerns = rd.customer_side_knowledge?.customer_concerns;
    if (concerns?.length) parts.push('【顧客として気になる点】\n' + concerns.map(c => `・${c.concern}`).join('\n'));
    const questions = rd.customer_side_knowledge?.likely_customer_questions;
    if (questions?.length) parts.push('【顧客として聞きたいこと】\n' + questions.map(q => `・${q.question}`).join('\n'));
    const objections = rd.customer_side_knowledge?.customer_objections;
    if (objections?.length) parts.push('【顧客の反論・保留理由】\n' + objections.map(o => `・${o.objection}`).join('\n'));
    const unanswered = rd.customer_side_knowledge?.unanswered_questions;
    if (unanswered?.length) parts.push('【資料だけでは判断できない点】\n' + unanswered.map(u => `・${u.question}`).join('\n'));
    content = parts.join('\n\n');
  } else {
    content = doc.sections.map(s => `### ${s.title}\n${s.content}`).join('\n\n');
  }
  return {
    documentContent: `提案書: ${doc.name}\n\n${content}`,
    documentMode: state.documentMode || 'pre-shared',
  };
}

window.toggleDocumentEnabled = () => {
  const el = document.getElementById('documentEnabled');
  if (el) {
    state.documentEnabled = el.checked;
    const detail = document.getElementById('documentDetail');
    if (detail) detail.classList.toggle('hidden', !state.documentEnabled);
    if (!state.documentEnabled) {
      state.documentId = '';
      state.documentMode = '';
    }
  }
};

window.setDocumentMode = (mode) => {
  state.documentMode = mode;
  ['pre-shared', 'on-the-spot'].forEach(m => {
    const btn = document.getElementById('docmode-' + m);
    if (btn) {
      if (m === mode) { btn.className = btn.className.replace(/border-gray-200 bg-white text-gray-600 hover:border-blue-300/g, 'border-blue-500 bg-blue-50 text-blue-700'); }
      else { btn.className = btn.className.replace(/border-blue-500 bg-blue-50 text-blue-700/g, 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'); }
    }
  });
};

window.onDocumentSelectChange = () => {
  const sel = document.getElementById('documentId');
  if (sel) {
    state.documentId = sel.value;
    const preview = document.getElementById('docPreview');
    if (preview) {
      const doc = state.documents.find(d => d.id === state.documentId);
      if (doc) {
        if (doc.format === 'rich') {
          const chunks = doc.richData.runtime_chunks || [];
          preview.innerHTML = chunks.map(c => `
            <details class="border border-gray-100 rounded-lg">
              <summary class="cursor-pointer px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">${escapeHtml(c.topic)}</summary>
              <p class="px-3 py-2 text-xs text-gray-500 whitespace-pre-wrap border-t border-gray-100">${escapeHtml(c.text.substring(0, 200))}${c.text.length > 200 ? '...' : ''}</p>
            </details>
          `).join('');
        } else {
          preview.innerHTML = doc.sections.map((s) => `
            <details class="border border-gray-100 rounded-lg">
              <summary class="cursor-pointer px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">${escapeHtml(s.title)}</summary>
              <p class="px-3 py-2 text-xs text-gray-500 whitespace-pre-wrap border-t border-gray-100">${escapeHtml(s.content.substring(0, 200))}${s.content.length > 200 ? '...' : ''}</p>
            </details>
          `).join('');
        }
        preview.classList.remove('hidden');
      } else {
        preview.innerHTML = '';
        preview.classList.add('hidden');
      }
    }
  }
};

window.importDocument = () => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json'; input.style.display = 'none';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        // 単一ドキュメントまたは配列に対応
        const docs = Array.isArray(data) ? data : [data];
        let count = 0;
        for (const d of docs) {
          // AI変換済みフォーマット（document_summaryフィールドで判定）
          if (d.document_summary) {
            const docName = (d.document_summary?.title || '').trim();
            if (!docName) { showToast('AI変換済みJSON: document_summary.titleが必要です', 'error'); continue; }
            if (!Array.isArray(d.runtime_chunks) || d.runtime_chunks.length === 0) { showToast('AI変換済みJSON: runtime_chunksが必要です', 'error'); continue; }
            const exists = state.documents.some(ex => ex.name === docName && ex.format === 'rich');
            if (exists) { showToast(`「${docName}」は既に登録済みです`, 'error'); continue; }
            state.documents.push({
              id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
              name: docName, format: 'rich', richData: d, createdAt: Date.now(),
            });
            count++; continue;
          }
          // 従来フォーマット
          if (!d.name || !d.name.trim()) { showToast('資料名(name)が必要です', 'error'); continue; }
          if (!Array.isArray(d.sections) || d.sections.length === 0) { showToast('セクション(sections)が必要です', 'error'); continue; }
          const valid = d.sections.every(s => s.title && s.content);
          if (!valid) { showToast('各セクションにtitleとcontentが必要です', 'error'); continue; }
          const exists = state.documents.some(ex => ex.name === d.name && ex.sections?.[0]?.title === d.sections[0]?.title);
          if (exists) { showToast(`「${d.name}」は既に登録済みです`, 'error'); continue; }
          state.documents.push({
            id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            name: d.name,
            sections: d.sections.map(s => ({ title: s.title, content: s.content })),
            createdAt: Date.now(),
          });
          count++;
        }
        saveDocumentsToStorage();
        syncStateFromForm();
        render();
        if (count > 0) showToast(`${count}件の提案書をインポートしました`, 'success');
      } catch (err) {
        showToast('JSONファイルの読み込みに失敗しました', 'error');
      }
    };
    reader.readAsText(file);
  };
  document.body.appendChild(input); input.click();
  setTimeout(() => document.body.removeChild(input), 1000);
};

window.exportDocuments = () => {
  if (state.documents.length === 0) { showToast('エクスポートする提案書がありません', 'error'); return; }
  const data = JSON.stringify(state.documents.map(d => ({ name: d.name, sections: d.sections })), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const now = new Date();
  const fileName = `提案書ライブラリ_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.json`;
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  showToast(`${state.documents.length}件の提案書をエクスポートしました`, 'success');
};

window.downloadSampleDocument = () => {
  const sample = [{
    name: '【サンプル】クラウド業務管理システム提案書',
    sections: [
      {
        title: 'エグゼクティブサマリー',
        content: '本提案は、貴社の業務効率化を目的としたクラウド型業務管理システムの導入についてご提案するものです。現状のオンプレミス環境から移行することで、運用コスト30%削減、業務処理速度2倍向上を実現します。',
      },
      {
        title: '現状の課題と解決策',
        content: '【現状の課題】\n・レガシーシステムの保守コストが増大\n・リモートワーク対応が困難\n・データ連携に手作業が多く、ミスが発生\n\n【解決策】\n・クラウド移行により保守コストを削減\n・場所を選ばずアクセス可能なWebアプリケーション\n・API連携による自動データ同期',
      },
      {
        title: '導入スケジュールと費用',
        content: '【導入スケジュール】\nフェーズ1（1-2ヶ月）: 要件定義・設計\nフェーズ2（3-4ヶ月）: 開発・テスト\nフェーズ3（5ヶ月目）: 本番移行・研修\n\n【費用】\n初期費用: 500万円\n月額運用費: 30万円\nROI予測: 18ヶ月で投資回収',
      },
    ],
  }];
  const data = JSON.stringify(sample, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'サンプル提案書.json'; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  showToast('サンプルJSONをダウンロードしました', 'success');
};

window.deleteDocument = (id) => {
  const doc = state.documents.find(d => d.id === id);
  if (!doc) return;
  if (!confirm(`提案書「${doc.name}」を削除しますか？`)) return;
  state.documents = state.documents.filter(d => d.id !== id);
  if (state.documentId === id) { state.documentId = ''; state.documentMode = ''; }
  saveDocumentsToStorage();
  syncStateFromForm();
  render();
  showToast('提案書を削除しました');
};

window.toggleDocLibrary = () => {
  const list = document.getElementById('docLibrary');
  if (list) list.classList.toggle('hidden');
};

// ============================================================
// API設定
// ============================================================
window.saveApiSettings = () => {
  syncStateFromForm(); // フォームの入力値を保存してからrender
  state.apiKey = document.getElementById('apiKey').value.trim();
  state.baseURL = document.getElementById('baseURL').value.trim() || 'https://api.openai.com/v1';
  state.model = getSelectedModel();
  state.apiConnected = false;

  localStorage.setItem('roleplay_apiKey', state.apiKey);
  localStorage.setItem('roleplay_baseURL', state.baseURL);
  localStorage.setItem('roleplay_model', state.model);

  render();
  showToast('設定を保存しました');
};

function getSelectedModel() {
  const sel = document.getElementById('model');
  if (!sel) return state.model;
  const val = sel.value;
  if (val === 'custom') {
    const custom = document.getElementById('modelCustom');
    return (custom && custom.value.trim()) || 'gpt-4o-mini';
  }
  return val;
}

window.onModelSelectChange = () => {
  const sel = document.getElementById('model');
  const customInput = document.getElementById('modelCustom');
  if (sel && customInput) {
    customInput.classList.toggle('hidden', sel.value !== 'custom');
    if (sel.value === 'custom') customInput.focus();
  }
};

window.onTtsVoiceChange = () => {
  const sel = document.getElementById('ttsVoice');
  if (sel) {
    state.ttsVoice = sel.value;
    localStorage.setItem('roleplay_ttsVoice', sel.value);
  }
};

// ===== ペルソナパラメータ =====
window.setPersonaSpeed = (speed) => {
  state.personaSpeed = speed;
  localStorage.setItem('roleplay_personaSpeed', speed);
  PERSONA_SPEEDS.forEach(s => {
    const btn = document.getElementById('speed-' + s.id);
    if (btn) {
      if (s.id === speed) { btn.className = btn.className.replace(/border-gray-200 bg-white text-gray-600 hover:border-blue-300/g, 'border-blue-500 bg-blue-50 text-blue-700'); }
      else { btn.className = btn.className.replace(/border-blue-500 bg-blue-50 text-blue-700/g, 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'); }
    }
  });
};
window.setPersonaTone = (tone) => {
  state.personaTone = tone;
  localStorage.setItem('roleplay_personaTone', tone);
  PERSONA_TONES.forEach(t => {
    const btn = document.getElementById('tone-' + t.id);
    if (btn) {
      if (t.id === tone) { btn.className = btn.className.replace(/border-gray-200 bg-white text-gray-600 hover:border-blue-300/g, 'border-blue-500 bg-blue-50 text-blue-700'); }
      else { btn.className = btn.className.replace(/border-blue-500 bg-blue-50 text-blue-700/g, 'border-gray-200 bg-white text-gray-600 hover:border-blue-300'); }
    }
  });
};

window.testConnection = async () => {
  syncStateFromForm(); // フォームの入力値を保存してからrender
  const apiKey = document.getElementById('apiKey').value.trim();
  const baseURL = document.getElementById('baseURL').value.trim() || 'https://api.openai.com/v1';
  const model = getSelectedModel();

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
  const colors = { info: 'bg-blue-500', success: 'bg-green-500', error: 'bg-red-500' };
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-xl shadow-lg z-50 fade-in text-sm font-medium max-w-sm`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

window.applyPreset = (key) => {
  const p = PRESETS[key];
  state.scenario = p.scenario;
  state.persona = p.persona;
  state.criteria = p.criteria;
  state.productURL = '';
  state.goal = '';
  state.closingPoints = '';
  state.documentEnabled = false;
  state.documentId = '';
  state.documentMode = '';
  // DOMを直接更新（renderを呼ばずにフォーム値だけ更新）
  const el = (id) => document.getElementById(id);
  if (el('scenario')) el('scenario').value = p.scenario;
  if (el('persona')) el('persona').value = p.persona;
  if (el('criteria')) el('criteria').value = p.criteria;
  if (el('productURL')) el('productURL').value = '';
  if (el('goal')) el('goal').value = '';
  if (el('closingPoints')) el('closingPoints').value = '';
  if (el('documentEnabled')) el('documentEnabled').checked = false;
  const docDetail = document.getElementById('documentDetail');
  if (docDetail) docDetail.classList.add('hidden');
  showToast(`「${p.name}」を適用しました`);
};

window.startRoleplay = () => {
  state.scenario = document.getElementById('scenario').value;
  state.persona = document.getElementById('persona').value;
  state.criteria = document.getElementById('criteria').value;
  state.productURL = document.getElementById('productURL')?.value || '';
  state.goal = document.getElementById('goal')?.value || '';
  state.closingPoints = document.getElementById('closingPoints')?.value || '';
  state.autoSpeak = document.getElementById('autoSpeak').checked;
  // 提案書設定を読み取り
  const docToggle = document.getElementById('documentEnabled');
  state.documentEnabled = docToggle ? docToggle.checked : false;
  const docSelect = document.getElementById('documentId');
  state.documentId = docSelect ? docSelect.value : '';
  if (!state.documentEnabled) { state.documentId = ''; state.documentMode = ''; }

  if (!state.apiKey) { showToast('APIキーを設定してください', 'error'); return; }
  if (!state.scenario.trim() || !state.persona.trim()) { showToast('シナリオと顧客ペルソナは必須です', 'error'); return; }

  // モバイル: ユーザータップ直後にオーディオをアンロック
  unlockAudio();

  state.messages = [];
  state.turnCount = 0;
  state.currentScreen = 'roleplay';
  state.startTime = Date.now();
  state.elapsedSeconds = 0;
  state.showTextInput = false;
  render();
  startTimer();
  generateAIFirstMessage();
};

// ============================================================
// 画面2: ロープレ（音声会話）
// ============================================================
function renderRoleplay() {
  const mm = Math.floor(state.elapsedSeconds / 60).toString().padStart(2, '0');
  const ss = (state.elapsedSeconds % 60).toString().padStart(2, '0');

  return `
  <div class="min-h-screen bg-gray-50 flex flex-col" style="height:100vh;height:100dvh;">
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
          <span id="timer" class="font-mono font-semibold">${mm}:${ss}</span>
        </div>
        <div class="flex items-center gap-2 text-sm text-gray-500">
          <i class="fas fa-comments"></i>
          <span id="turnCount">${state.turnCount}</span>
        </div>
      </div>
    </header>

    <div id="chatArea" class="flex-1 overflow-y-auto chat-scroll px-4 py-4 space-y-3">
      ${state.messages.map((m, i) => renderChatBubble(m, i)).join('')}
      ${state.isProcessing ? renderTypingIndicator() : ''}
    </div>

    <div id="interimContainer" class="px-4 py-3 bg-blue-50 border-t border-blue-100 flex-shrink-0 ${state.interimTranscript ? '' : (state.isListening ? '' : 'hidden')}">
      ${state.interimTranscript
        ? `<p class="text-sm text-blue-700"><i class="fas fa-microphone text-blue-400 mr-1"></i><span class="font-medium">認識中:</span> ${escapeHtml(state.interimTranscript)}</p>`
        : (state.isListening ? '<p class="text-sm text-blue-400 italic"><i class="fas fa-microphone text-blue-300 mr-1"></i>話し始めてください...</p>' : '')}
    </div>

    <div class="bg-white border-t border-gray-200 px-4 py-4 flex-shrink-0">
      <div id="statusArea" class="text-center mb-3">${renderStatusText()}</div>
      <div class="flex items-center justify-center gap-4">
        <button onclick="toggleTextInput()" class="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-all" title="テキスト入力">
          <i class="fas fa-keyboard"></i>
        </button>
        ${state.isListening ? `
          <button id="sendVoiceBtn" onclick="sendVoiceMessage()"
            class="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-lg transition-all relative"
            title="発話完了・送信">
            <i class="fas fa-paper-plane text-xl"></i>
          </button>
        ` : ''}
        <button id="micBtn" onclick="toggleListening()"
          class="${state.isListening ? 'w-12 h-12' : 'w-16 h-16'} rounded-full ${state.isListening ? 'bg-red-500 hover:bg-red-600' : 'btn-primary'} text-white flex items-center justify-center shadow-lg transition-all relative"
          ${state.isProcessing || state.isSpeaking ? 'disabled' : ''}>
          ${state.isListening ? '<div class="absolute inset-0 rounded-full bg-red-400 pulse-ring"></div><i class="fas fa-microphone-slash text-lg relative z-10"></i>' : '<i class="fas fa-microphone text-xl"></i>'}
        </button>
        <button onclick="endRoleplay()" class="w-12 h-12 rounded-full bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 flex items-center justify-center transition-all" title="ロープレ終了">
          <i class="fas fa-stop-circle"></i>
        </button>
      </div>
      <div id="textInputArea" class="${state.showTextInput ? '' : 'hidden'} mt-4">
        <div class="flex gap-2">
          <input id="textInput" type="text" class="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm" placeholder="テキストで入力..." onkeydown="if(event.key==='Enter')sendText()">
          <button onclick="sendText()" class="btn-primary text-white px-6 py-3 rounded-xl font-medium text-sm">送信</button>
        </div>
      </div>
    </div>
  </div>`;
}

function renderStatusText() {
  if (state.isListening) return `<div class="flex items-center justify-center gap-2"><div class="voice-wave voice-wave-red"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div><span class="text-sm font-medium text-red-600">音声を聞いています... 話し終わったら送信ボタンを押してください</span></div>`;
  if (state.isProcessing) return `<div class="flex items-center justify-center gap-2"><div class="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div><span class="text-sm text-gray-500">考え中...</span></div>`;
  if (state.isSpeaking) return `<div class="flex items-center justify-center gap-2"><div class="voice-wave"><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div><div class="bar"></div></div><span class="text-sm font-medium text-blue-600">顧客が話しています...</span></div>`;
  return `<p class="text-sm text-gray-400">マイクボタンを押して話してください</p>`;
}

function renderChatBubble(msg, index) {
  const isUser = msg.role === 'user';
  return `<div class="flex ${isUser ? 'justify-end' : 'justify-start'} fade-in">
    ${!isUser ? `<div class="flex flex-col items-center mr-2 mt-1 flex-shrink-0"><div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center"><i class="fas fa-user-tie text-white text-xs"></i></div><span class="text-[10px] text-gray-400 mt-0.5">顧客</span></div>` : ''}
    <div class="${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'} px-4 py-3 max-w-[80%] shadow-sm"><p class="text-sm leading-relaxed whitespace-pre-wrap chat-bubble-text">${escapeHtml(msg.content)}</p></div>
    ${isUser ? `<div class="flex flex-col items-center ml-2 mt-1 flex-shrink-0"><div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"><i class="fas fa-user text-white text-xs"></i></div><span class="text-[10px] text-gray-400 mt-0.5">あなた</span></div>` : ''}
  </div>`;
}

function escapeHtml(text) {
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function renderTypingIndicator() {
  return `<div class="flex justify-start fade-in" id="typingIndicator"><div class="flex flex-col items-center mr-2 mt-1 flex-shrink-0"><div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center"><i class="fas fa-user-tie text-white text-xs"></i></div><span class="text-[10px] text-gray-400 mt-0.5">顧客</span></div><div class="chat-bubble-ai px-4 py-3 shadow-sm"><div class="flex gap-1"><div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0s"></div><div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.2s"></div><div class="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style="animation-delay:0.4s"></div></div></div></div>`;
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

// ===== DOM部分更新 =====
function appendChatBubble(msg) {
  const chatArea = document.getElementById('chatArea');
  if (!chatArea) return;
  const typing = document.getElementById('typingIndicator');
  if (typing) typing.remove();
  const div = document.createElement('div');
  div.innerHTML = renderChatBubble(msg, state.messages.length - 1);
  chatArea.appendChild(div.firstElementChild);
  scrollChatToBottom();
}

function showTypingIndicator() {
  const chatArea = document.getElementById('chatArea');
  if (!chatArea || document.getElementById('typingIndicator')) return;
  const div = document.createElement('div');
  div.innerHTML = renderTypingIndicator();
  chatArea.appendChild(div.firstElementChild);
  scrollChatToBottom();
}

function hideTypingIndicator() {
  const t = document.getElementById('typingIndicator');
  if (t) t.remove();
}

function updateStatusArea() {
  const s = document.getElementById('statusArea');
  if (s) s.innerHTML = renderStatusText();
}

function updateMicUI() {
  const micBtn = document.getElementById('micBtn');
  if (micBtn) {
    if (state.isListening) {
      micBtn.className = 'w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-all relative';
      micBtn.innerHTML = '<div class="absolute inset-0 rounded-full bg-red-400 pulse-ring"></div><i class="fas fa-microphone-slash text-lg relative z-10"></i>';
      micBtn.disabled = false;
    } else {
      micBtn.className = 'w-16 h-16 rounded-full btn-primary text-white flex items-center justify-center shadow-lg transition-all relative';
      micBtn.innerHTML = '<i class="fas fa-microphone text-xl"></i>';
      micBtn.disabled = state.isProcessing || state.isSpeaking;
    }
  }
  updateStatusArea();
}

function updateTurnCount() {
  const el = document.getElementById('turnCount');
  if (el) el.textContent = state.turnCount;
}

// ===== AI第一声 =====
async function generateAIFirstMessage() {
  state.isProcessing = true;
  showTypingIndicator();
  updateMicUI();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [], scenario: state.scenario, persona: state.persona,
        apiKey: state.apiKey, baseURL: state.baseURL, model: state.model,
        isFirstMessage: true, productURL: state.productURL, goal: state.goal,
        personaSpeed: state.personaSpeed, personaTone: state.personaTone,
        closingPoints: state.closingPoints,
        ...getDocumentContentForAPI(),
      }),
    });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'API呼び出しに失敗しました'); }

    const text = await readStreamRealtime(response, 'assistant');
    // readStreamRealtime が既にバブルを追加しているので、messagesだけ更新
    state.messages[state.messages.length - 1].content = text;
    state.isProcessing = false;
    updateMicUI();
    if (state.autoSpeak) speak(text);
  } catch (e) {
    console.error('AI first message error:', e);
    state.isProcessing = false;
    const fallback = 'はい、どちらさまでしょうか？';
    state.messages.push({ role: 'assistant', content: fallback });
    hideTypingIndicator();
    appendChatBubble(state.messages[state.messages.length - 1]);
    updateMicUI();
    if (state.autoSpeak) speak(fallback);
    if (e.message) showToast(`AIエラー: ${e.message}`, 'error');
  }
}

// ===== ストリーミング読み取り（リアルタイム表示） =====
async function readStreamRealtime(response, role) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bubbleCreated = false;

  // タイピングインジケーターを消して空のバブルを作成
  hideTypingIndicator();
  state.messages.push({ role, content: '' });
  const msgIndex = state.messages.length - 1;

  // 空のバブルをDOMに追加
  appendChatBubble(state.messages[msgIndex]);
  bubbleCreated = true;

  // バブル内のテキスト要素を取得
  const chatArea = document.getElementById('chatArea');
  const bubbles = chatArea?.querySelectorAll('.chat-bubble-text');
  const lastBubbleText = bubbles ? bubbles[bubbles.length - 1] : null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    text += chunk;
    state.messages[msgIndex].content = text;

    // リアルタイムでバブルのテキストを更新
    if (lastBubbleText) {
      lastBubbleText.textContent = text;
      scrollChatToBottom();
    }
  }
  return text.trim();
}

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

// ============================================================
// 音声認識（マイク）
// ============================================================
window.toggleListening = () => {
  // マイクボタンタップ時にもオーディオをアンロック（追加の安全策）
  unlockAudio();
  state.isListening ? stopListening() : startListening();
};

// ===== 発話完了・送信ボタン =====
window.sendVoiceMessage = () => {
  // 送信ボタンタップ時にもオーディオをアンロック
  unlockAudio();
  if (!state.isListening) return;
  const text = state._voiceTranscript || '';
  if (!text.trim()) {
    showToast('まだ音声が認識されていません。話してからボタンを押してください。', 'error');
    return;
  }
  state._voiceTranscript = '';
  updateInterimDisplay('');
  pauseListeningForResponse();
  state.isListening = false;
  updateMicUI();
  render(); // ボタン配置を再レンダリング
  sendMessage(text.trim());
};

function updateSendVoiceBtn() {
  const btn = document.getElementById('sendVoiceBtn');
  if (!btn) return;
  const hasText = !!(state._voiceTranscript && state._voiceTranscript.trim());
  btn.disabled = !hasText;
  btn.className = `w-16 h-16 rounded-full ${hasText ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-300 cursor-not-allowed'} text-white flex items-center justify-center shadow-lg transition-all relative`;
}

function createRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { showToast('お使いのブラウザは音声認識に対応していません。Chrome をお使いください。', 'error'); return null; }

  const recognition = new SR();
  recognition.lang = 'ja-JP';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalTranscript = '';
  state._voiceTranscript = '';

  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) {
        finalTranscript += e.results[i][0].transcript;
      } else {
        interim += e.results[i][0].transcript;
      }
    }
    state._voiceTranscript = finalTranscript;
    // 現在認識済みテキスト + 途中テキストを表示
    const displayText = finalTranscript + (interim ? interim : '');
    updateInterimDisplay(displayText);
    // 送信ボタンの有効/無効を更新
    updateSendVoiceBtn();
  };

  recognition.onerror = (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      showToast('マイクへのアクセスが許可されていません。', 'error');
      state.isListening = false; state.recognition = null; updateMicUI();
    } else if (e.error === 'network') {
      showToast('音声認識のネットワークエラー。', 'error');
    }
  };

  recognition.onend = () => {
    if (state.isListening && !state.isProcessing && !state.isSpeaking) {
      try { recognition.start(); } catch(err) {
        setTimeout(() => {
          if (state.isListening) { try { recognition.start(); } catch(e2) { state.isListening = false; state.recognition = null; updateMicUI(); } }
        }, 500);
      }
    }
  };

  return recognition;
}

function startListening() {
  if (state.isSpeaking || state.isProcessing) return;
  state.isSpeaking = false;
  if (state.recognition) { try { state.recognition.abort(); } catch(e) {} state.recognition = null; }

  const recognition = createRecognition();
  if (!recognition) return;

  try {
    recognition.start();
    state.recognition = recognition;
    state.isListening = true;
    state._voiceTranscript = '';
    render(); // ボタン配置を再レンダリング（送信ボタンを表示）
    scrollChatToBottom();
  } catch (e) {
    showToast('マイクの起動に失敗しました。', 'error');
  }
}

function stopListening() {
  state.isListening = false;
  state._voiceTranscript = '';
  if (state.recognition) { try { state.recognition.abort(); } catch(e) {} state.recognition = null; }
  state.interimTranscript = '';
  updateMicUI();
  updateInterimDisplay('');
  render(); // ボタン配置を再レンダリング（送信ボタンを消す）
  scrollChatToBottom();
}

function pauseListeningForResponse() {
  if (state.recognition) { try { state.recognition.abort(); } catch(e) {} state.recognition = null; }
}

function resumeListeningAfterResponse() {
  if (state.isListening && !state.recognition && !state.isSpeaking && !state.isProcessing) {
    const recognition = createRecognition();
    if (!recognition) return;
    try {
      recognition.start();
      state.recognition = recognition;
      state._voiceTranscript = '';
      render();
      scrollChatToBottom();
    } catch(e) {}
  }
}

function updateInterimDisplay(text) {
  state.interimTranscript = text;
  const c = document.getElementById('interimContainer');
  if (c) {
    if (text) {
      c.innerHTML = `<p class="text-sm text-blue-700"><i class="fas fa-microphone text-blue-400 mr-1"></i><span class="font-medium">認識中:</span> ${escapeHtml(text)}</p>`;
      c.classList.remove('hidden');
    } else if (state.isListening) {
      c.innerHTML = '<p class="text-sm text-blue-400 italic"><i class="fas fa-microphone text-blue-300 mr-1"></i>話し始めてください...</p>';
      c.classList.remove('hidden');
    } else {
      c.innerHTML = '';
      c.classList.add('hidden');
    }
  }
}

// ===== メッセージ送信 =====
async function sendMessage(text) {
  if (!text.trim() || state.isProcessing) return;

  state.messages.push({ role: 'user', content: text.trim() });
  state.turnCount++;
  state.isProcessing = true;
  appendChatBubble(state.messages[state.messages.length - 1]);
  showTypingIndicator();
  updateMicUI();
  updateTurnCount();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: state.messages, scenario: state.scenario, persona: state.persona,
        apiKey: state.apiKey, baseURL: state.baseURL, model: state.model,
        productURL: state.productURL, goal: state.goal,
        personaSpeed: state.personaSpeed, personaTone: state.personaTone,
        closingPoints: state.closingPoints,
        ...getDocumentContentForAPI(),
      }),
    });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'API呼び出しに失敗しました'); }

    const aiText = await readStreamRealtime(response, 'assistant');
    // readStreamRealtime が既にバブルを追加しているので、messagesだけ最終更新
    state.messages[state.messages.length - 1].content = aiText;
    state.isProcessing = false;
    updateMicUI();

    if (state.autoSpeak) {
      speak(aiText, () => resumeListeningAfterResponse());
    } else {
      resumeListeningAfterResponse();
    }
  } catch (e) {
    console.error('Chat error:', e);
    state.isProcessing = false;
    hideTypingIndicator();
    updateMicUI();
    showToast(`エラー: ${e.message}`, 'error');
    resumeListeningAfterResponse();
  }
}

window.toggleTextInput = () => {
  state.showTextInput = !state.showTextInput;
  const area = document.getElementById('textInputArea');
  if (area) { area.classList.toggle('hidden', !state.showTextInput); if (state.showTextInput) document.getElementById('textInput')?.focus(); }
};

window.sendText = () => {
  // テキスト送信ボタンタップ時にもオーディオをアンロック
  unlockAudio();
  const input = document.getElementById('textInput');
  if (input && input.value.trim()) { sendMessage(input.value); input.value = ''; }
};

// ============================================================
// 音声合成（TTS） - OpenAI TTS API / ブラウザ音声の切り替え
// ============================================================
let currentAudio = null;

// ===== モバイルブラウザ用オーディオアンロック =====
// iOS Safari / Android Chrome ではユーザーインタラクション時にオーディオコンテキストを
// 明示的にアンロックしないと、後続の非同期再生がブロックされる
let _audioContext = null;
let _audioUnlocked = false;
let _preloadedAudio = null;  // 事前に作成しておくAudioオブジェクト

function getAudioContext() {
  if (!_audioContext) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) _audioContext = new AC();
  }
  return _audioContext;
}

// ユーザーインタラクション時に呼ぶ: AudioContext の resume + Audio の事前再生
function unlockAudio() {
  if (_audioUnlocked) return;
  
  // 1) AudioContext をアンロック
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  
  // 2) HTMLAudioElement を事前にユーザージェスチャーで play() しておく
  //    → 以降 src を差し替えて play() しても再生許可が維持される
  if (!_preloadedAudio) {
    _preloadedAudio = new Audio();
    // 無音のdata URI（極短mp3）を再生してアンロック
    _preloadedAudio.src = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAABhgFzzzEAAAAAAAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAABhgFzzzEAAAAAAAAAAAAAAAAAAAAA';
    _preloadedAudio.volume = 0.01;  // ほぼ無音
    _preloadedAudio.play().then(() => {
      _preloadedAudio.pause();
      _preloadedAudio.currentTime = 0;
    }).catch(() => {});
  }
  
  // 3) SpeechSynthesis のアンロックは不要（ブラウザTTS削除済み）
  
  _audioUnlocked = true;
  console.log('[TTS] Audio unlocked for mobile');
}

function speak(text, onComplete) {
  speakWithAPI(text, onComplete);
}

// OpenAI TTS API 経由の音声合成
async function speakWithAPI(text, onComplete) {
  state.isSpeaking = true;
  updateMicUI();

  try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        apiKey: state.apiKey,
        baseURL: state.baseURL,
        voice: state.ttsVoice,
        instructions: '自然な日本語で話してください。ビジネスの打ち合わせで実際に話しているような口調で、適度な間や感情の起伏を含めて読み上げてください。機械的にならないよう、人間が自然に話す速度とリズムで発声してください。',
      }),
    });

    if (!response.ok) {
      console.warn('TTS API failed, status:', response.status);
      state.isSpeaking = false;
      updateMicUI();
      if (onComplete) onComplete();
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    
    // モバイル対応: 事前アンロック済みの Audio オブジェクトを再利用するか新規作成
    let audio;
    if (_preloadedAudio) {
      audio = _preloadedAudio;
      _preloadedAudio = null; // 使い切り → 次回は新規作成
    } else {
      audio = new Audio();
    }
    audio.src = url;
    audio.volume = 1.0;
    currentAudio = audio;
    
    audio.onended = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      state.isSpeaking = false;
      updateMicUI();
      if (onComplete) onComplete();
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      currentAudio = null;
      state.isSpeaking = false;
      updateMicUI();
      console.warn('Audio playback error');
      if (onComplete) onComplete();
    };
    
    // AudioContext 経由でも再生を試みる（モバイルでより確実）
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
    
    audio.play().catch((e) => {
      console.warn('Audio play() blocked:', e.message);
      state.isSpeaking = false;
      updateMicUI();
      URL.revokeObjectURL(url);
      if (onComplete) onComplete();
    });
  } catch (e) {
    console.warn('TTS API error:', e);
    state.isSpeaking = false;
    updateMicUI();
    if (onComplete) onComplete();
  }
}

function scrollChatToBottom() {
  setTimeout(() => { const el = document.getElementById('chatArea'); if (el) el.scrollTop = el.scrollHeight; }, 100);
}

// ===== ロープレ終了 =====
window.endRoleplay = () => {
  if (state.messages.length < 2) { showToast('もう少し会話を続けてからフィードバックを受けましょう', 'error'); return; }
  if (!confirm('ロープレを終了してフィードバックを受けますか？')) return;

  stopListening();
  if (currentAudio) { currentAudio.pause(); currentAudio.src = ''; currentAudio = null; }
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
        messages: state.messages, scenario: state.scenario, persona: state.persona,
        criteria: state.criteria, apiKey: state.apiKey, baseURL: state.baseURL, model: state.model,
        productURL: state.productURL, goal: state.goal,
        closingPoints: state.closingPoints,
        ...getDocumentContentForAPI(),
      }),
    });
    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'フィードバック生成に失敗'); }
    state.feedback = await response.json();
  } catch (e) {
    console.error('Feedback error:', e);
    state.feedback = { overallScore: 0, summary: `フィードバック生成に失敗: ${e.message}`, scores: [], strengths: [], improvements: [], modelAnswer: '' };
  }
  state.isFeedbackLoading = false;
  render();
}

function renderFeedback() {
  if (state.isFeedbackLoading) {
    return `<div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-lg font-semibold text-gray-700">フィードバックを生成中...</p>
        <p class="text-sm text-gray-500 mt-2">AIが会話を分析しています</p>
      </div>
    </div>`;
  }

  const fb = state.feedback || {};
  const minutes = Math.floor(state.elapsedSeconds / 60);
  const seconds = state.elapsedSeconds % 60;
  const score = typeof fb.overallScore === 'number' ? fb.overallScore : 0;
  const scoreColor = score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';
  const summary = fb.summary || 'フィードバックデータが取得できませんでした。';
  const scores = Array.isArray(fb.scores) ? fb.scores : [];
  const strengths = Array.isArray(fb.strengths) ? fb.strengths : [];
  const improvements = Array.isArray(fb.improvements) ? fb.improvements : [];
  const modelAnswer = fb.modelAnswer || '';

  // 項目別評価HTML
  let scoresHtml = '';
  if (scores.length > 0) {
    const itemsHtml = scores.map(s => {
      const sc = typeof s.score === 'number' ? s.score : 0;
      const ms = typeof s.maxScore === 'number' ? s.maxScore : 10;
      const pct = ms > 0 ? Math.min((sc / ms) * 100, 100) : 0;
      const bc = pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500';
      const tc = pct >= 70 ? 'text-green-600' : pct >= 40 ? 'text-yellow-600' : 'text-red-600';
      return `<div class="mb-3">
        <div class="flex justify-between items-center mb-1">
          <span class="text-sm font-medium text-gray-700 break-words">${escapeHtml(s.criterion || '')}</span>
          <span class="text-sm font-bold ${tc} flex-shrink-0 ml-2">${sc}/${ms}</span>
        </div>
        <div class="w-full bg-gray-100 rounded-full h-2.5 mb-1">
          <div class="${bc} h-2.5 rounded-full score-bar-fill" style="width:${pct}%"></div>
        </div>
        <p class="text-xs text-gray-500 break-words">${escapeHtml(s.comment || '')}</p>
      </div>`;
    }).join('');
    scoresHtml = `<div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 slide-in">
      <h2 class="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
        <i class="fas fa-star text-yellow-500"></i>項目別評価
      </h2>
      <div>${itemsHtml}</div>
    </div>`;
  }

  // 良かった点 / 改善ポイント
  let strengthsHtml = '';
  if (strengths.length > 0) {
    strengthsHtml = `<div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-thumbs-up text-green-500"></i>良かった点</h2>
      <ul class="space-y-2">${strengths.map(s => `<li class="flex items-start gap-2 text-sm text-gray-700">
        <i class="fas fa-check-circle text-green-400 mt-0.5 flex-shrink-0"></i>
        <span class="break-words min-w-0">${escapeHtml(s)}</span>
      </li>`).join('')}</ul>
    </div>`;
  }
  let improvementsHtml = '';
  if (improvements.length > 0) {
    improvementsHtml = `<div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-lightbulb text-orange-500"></i>改善ポイント</h2>
      <ul class="space-y-2">${improvements.map(s => `<li class="flex items-start gap-2 text-sm text-gray-700">
        <i class="fas fa-arrow-circle-up text-orange-400 mt-0.5 flex-shrink-0"></i>
        <span class="break-words min-w-0">${escapeHtml(s)}</span>
      </li>`).join('')}</ul>
    </div>`;
  }

  // 模範回答
  let modelAnswerHtml = '';
  if (modelAnswer) {
    modelAnswerHtml = `<div class="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6 slide-in">
      <h2 class="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2"><i class="fas fa-trophy text-blue-500"></i>模範的な対応例</h2>
      <p class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(modelAnswer)}</p>
    </div>`;
  }

  // 会話ログ
  const logsHtml = state.messages.map(m => `<div class="flex items-start gap-2 text-sm ${m.role === 'user' ? 'text-blue-700' : 'text-gray-700'} py-1">
    <span class="font-bold flex-shrink-0 whitespace-nowrap">${m.role === 'user' ? '営業:' : '顧客:'}</span>
    <span class="break-words min-w-0">${escapeHtml(m.content)}</span>
  </div>`).join('');

  return `
  <div class="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
    <header class="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <i class="fas fa-chart-line text-white text-lg"></i>
          </div>
          <div class="min-w-0">
            <h1 class="text-xl font-bold text-gray-800 truncate">フィードバック</h1>
            <p class="text-xs text-gray-500">ロープレ結果レポート</p>
          </div>
        </div>
        <button onclick="backToSetup()" class="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 flex-shrink-0 ml-2">
          <i class="fas fa-redo"></i>もう一度
        </button>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <!-- 総合スコア -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 slide-in overflow-hidden">
        <div class="flex flex-col sm:flex-row items-center gap-6">
          <div class="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0">
            <svg class="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#e5e7eb" stroke-width="3"/>
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#sg)" stroke-width="3" stroke-dasharray="${score}, 100" stroke-linecap="round"/>
              <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" style="stop-color:#3b82f6"/><stop offset="100%" style="stop-color:#8b5cf6"/></linearGradient></defs>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-3xl font-bold ${scoreColor}">${score}</span>
              <span class="text-xs text-gray-500">/ 100</span>
            </div>
          </div>
          <div class="flex-1 text-center sm:text-left min-w-0">
            <p class="text-gray-700 leading-relaxed break-words">${escapeHtml(summary)}</p>
            <div class="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
              <span class="text-xs bg-blue-50 text-blue-700 px-3 py-1 rounded-full whitespace-nowrap"><i class="fas fa-clock mr-1"></i>${minutes}分${seconds}秒</span>
              <span class="text-xs bg-purple-50 text-purple-700 px-3 py-1 rounded-full whitespace-nowrap"><i class="fas fa-comments mr-1"></i>${state.turnCount}ターン</span>
              ${state.goal ? `<span class="text-xs bg-amber-50 text-amber-700 px-3 py-1 rounded-full"><i class="fas fa-bullseye mr-1"></i>目標: ${escapeHtml(state.goal.substring(0, 20))}${state.goal.length > 20 ? '...' : ''}</span>` : ''}
            </div>
          </div>
        </div>
      </div>

      ${scoresHtml}

      ${(strengthsHtml && improvementsHtml) ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-6 slide-in">${strengthsHtml}${improvementsHtml}</div>` : (strengthsHtml || improvementsHtml) ? `<div class="slide-in">${strengthsHtml}${improvementsHtml}</div>` : ''}

      ${modelAnswerHtml}

      <!-- 会話ログ -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 slide-in overflow-hidden">
        <details>
          <summary class="cursor-pointer text-lg font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-scroll text-gray-500"></i>会話ログ
          </summary>
          <div class="mt-4 space-y-1 max-h-96 overflow-y-auto chat-scroll">${logsHtml}</div>
        </details>
      </div>

      <!-- ボタン -->
      <div class="text-center pb-8 slide-in flex flex-wrap justify-center gap-3">
        <button onclick="downloadFeedbackCSV()" class="bg-white border-2 border-green-500 text-green-700 hover:bg-green-50 px-6 py-3 rounded-2xl font-bold shadow-sm inline-flex items-center gap-2 transition-all text-sm">
          <i class="fas fa-file-csv"></i>CSVダウンロード
        </button>
        <button onclick="backToSetup()" class="btn-primary text-white px-8 py-3 rounded-2xl font-bold shadow-lg inline-flex items-center gap-2 text-sm">
          <i class="fas fa-redo"></i>もう一度ロープレする
        </button>
      </div>
    </main>
  </div>`;
}

// ============================================================
// CSVダウンロード
// ============================================================
window.downloadFeedbackCSV = () => {
  const fb = state.feedback;
  if (!fb) { showToast('フィードバックデータがありません', 'error'); return; }

  const minutes = Math.floor(state.elapsedSeconds / 60);
  const seconds = state.elapsedSeconds % 60;
  const now = new Date();
  const dateStr = now.toLocaleDateString('ja-JP');
  const timeStr = now.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

  // CSVエスケープ: ダブルクォート囲み + 内部のダブルクォートを二重化
  function csvEscape(val) {
    const s = String(val ?? '').replace(/\n/g, ' ');
    return '"' + s.replace(/"/g, '""') + '"';
  }

  const rows = [];

  // ヘッダーセクション
  rows.push(['セクション', '項目', '内容'].map(csvEscape).join(','));
  rows.push(['', '', ''].map(csvEscape).join(','));

  // 基本情報
  rows.push(['基本情報', '実施日', dateStr + ' ' + timeStr].map(csvEscape).join(','));
  rows.push(['基本情報', '使用モデル', state.model].map(csvEscape).join(','));
  rows.push(['基本情報', '所要時間', `${minutes}分${seconds}秒`].map(csvEscape).join(','));
  rows.push(['基本情報', 'ターン数', state.turnCount].map(csvEscape).join(','));
  rows.push(['基本情報', 'シナリオ', state.scenario].map(csvEscape).join(','));
  rows.push(['基本情報', '顧客ペルソナ', state.persona].map(csvEscape).join(','));
  if (state.productURL) rows.push(['基本情報', '商品/サービスURL', state.productURL].map(csvEscape).join(','));
  if (state.goal) rows.push(['基本情報', 'ゴール設定', state.goal].map(csvEscape).join(','));
  rows.push(['基本情報', '評価基準', state.criteria].map(csvEscape).join(','));
  rows.push(['', '', ''].map(csvEscape).join(','));

  // 総合評価
  rows.push(['総合評価', '総合スコア', fb.overallScore + ' / 100'].map(csvEscape).join(','));
  rows.push(['総合評価', '総評', fb.summary].map(csvEscape).join(','));
  rows.push(['', '', ''].map(csvEscape).join(','));

  // 項目別評価
  if (fb.scores && fb.scores.length > 0) {
    rows.push(['項目別評価', '評価基準', 'スコア', 'コメント'].map(csvEscape).join(','));
    fb.scores.forEach(s => {
      rows.push(['項目別評価', s.criterion, s.score + '/' + s.maxScore, s.comment].map(csvEscape).join(','));
    });
    rows.push(['', '', ''].map(csvEscape).join(','));
  }

  // 良かった点
  if (fb.strengths && fb.strengths.length > 0) {
    fb.strengths.forEach((s, i) => {
      rows.push(['良かった点', `${i + 1}`, s].map(csvEscape).join(','));
    });
    rows.push(['', '', ''].map(csvEscape).join(','));
  }

  // 改善ポイント
  if (fb.improvements && fb.improvements.length > 0) {
    fb.improvements.forEach((s, i) => {
      rows.push(['改善ポイント', `${i + 1}`, s].map(csvEscape).join(','));
    });
    rows.push(['', '', ''].map(csvEscape).join(','));
  }

  // 模範回答
  if (fb.modelAnswer) {
    rows.push(['模範的な対応例', '', fb.modelAnswer].map(csvEscape).join(','));
    rows.push(['', '', ''].map(csvEscape).join(','));
  }

  // 会話ログ
  rows.push(['会話ログ', '話者', '発言内容'].map(csvEscape).join(','));
  state.messages.forEach((m, i) => {
    const speaker = m.role === 'user' ? '営業（あなた）' : '顧客（AI）';
    rows.push(['会話ログ', speaker, m.content].map(csvEscape).join(','));
  });

  // BOM付きUTF-8でダウンロード（Excel対応）
  const bom = '\uFEFF';
  const csvContent = bom + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const fileName = `ロープレフィードバック_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}.csv`;

  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.style.display = 'none';
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  showToast('CSVをダウンロードしました', 'success');
};

window.backToSetup = () => {
  state.currentScreen = 'setup';
  state.messages = [];
  state.feedback = null;
  state.isFeedbackLoading = false;
  state.isProcessing = false;
  state.isSpeaking = false;
  state.isListening = false;
  state.turnCount = 0;
  render();
};

// ============================================================
// ペルソナ自動生成（ChatGPT API連携）
// ============================================================
window.generatePersona = async () => {
  syncStateFromForm();
  const scenario = state.scenario;
  if (!scenario.trim()) { showToast('先にシナリオを入力してください', 'error'); return; }
  if (!state.apiKey) { showToast('APIキーを設定してください', 'error'); return; }

  const btn = document.getElementById('generatePersonaBtn');
  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>生成中...';
  btn.disabled = true;

  try {
    const prompt = `以下の営業シナリオに登場する「顧客」のペルソナを1つ作成してください。
毎回異なるバリエーション（名前、年齢、性格、懸念事項、口調など）をランダムに生成してください。

## シナリオ
${scenario}

## 出力形式
以下の要素を含む日本語のペルソナ文（3〜5文）を返してください:
- 名前と肩書き（年齢も含む）
- 性格・経歴の特徴
- 主な懸念事項や関心事
- 会話時の特徴的な態度や口癖

ペルソナ文のみを返してください。前置きや説明は不要です。`;

    const res = await fetch('/api/generate-persona', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, apiKey: state.apiKey, baseURL: state.baseURL, model: state.model }),
    });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'APIエラー'); }
    const data = await res.json();
    if (data.persona && data.persona.trim()) {
      document.getElementById('persona').value = data.persona.trim();
      state.persona = data.persona.trim();
      showToast('ペルソナを生成しました！（再クリックで別パターン）', 'success');
    } else { throw new Error('空の応答'); }
  } catch (e) {
    console.error('Persona generation error:', e);
    showToast(`ペルソナ生成に失敗しました: ${e.message}`, 'error');
  }

  btn.innerHTML = originalHTML;
  btn.disabled = false;
};
