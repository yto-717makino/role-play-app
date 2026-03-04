# AI営業ロープレ — 完全再現プロンプト

以下のプロンプトをAI開発アシスタントに投げることで、このプロジェクトを一発で再現できます。

---

## プロンプト本文

```
以下の仕様に従って「AI営業ロープレ」Webアプリケーションを作成してください。

# ============================
# プロジェクト概要
# ============================

AIが顧客役を演じ、ユーザー（営業担当）が音声またはテキストで会話しながら営業スキルを練習できるWebアプリ。
セッション終了後にAIが会話を分析し、スコア付きのフィードバックを生成する。

# ============================
# 技術スタック
# ============================

- バックエンド: Node.js + Express（server.mjs）— APIプロキシサーバー
- フロントエンド: Vanilla JS（public/static/app.js）+ Tailwind CSS (CDN) + FontAwesome (CDN) + Noto Sans JP (Google Fonts)
- AI API: OpenAI Responses API（POST /v1/responses）
- 音声認識: Web Speech API（SpeechRecognition）
- 音声合成: OpenAI TTS API（gpt-4o-mini-tts）+ ブラウザ SpeechSynthesis（フォールバック）
- 別途 GitHub Pages 版: docs/index.html（サーバーレス・単一HTMLファイル、ブラウザから直接APIを呼ぶ）

# ============================
# ファイル構成
# ============================

webapp/
├── server.mjs              # Express APIプロキシサーバー（メイン実行ファイル）
├── public/
│   └── static/
│       ├── app.js          # フロントエンド全ロジック（サーバー版）
│       └── style.css       # 最小限のカスタムCSS（実質空）
├── docs/
│   └── index.html          # GitHub Pages版（サーバーレス・単一HTML）
├── src/
│   └── index.tsx           # Hono/Cloudflare Pages版（未使用・初期テンプレ残り）
├── ecosystem.config.cjs    # PM2設定
├── package.json
├── wrangler.jsonc
├── vite.config.ts
├── tsconfig.json
├── .gitignore
└── README.md

※実際に使うのは server.mjs + public/static/app.js（サーバー版）と docs/index.html（GitHub Pages版）の2パターン。

# ============================
# アーキテクチャ（2つのデプロイモード）
# ============================

## モード1: サーバー版（server.mjs + app.js）
- Express サーバーが API プロキシとして動作
- フロントエンド（app.js）→ Express API（/api/chat, /api/feedback, /api/tts, /api/test-connection）→ OpenAI API
- ユーザーの API キーをリクエストbodyで受け取り、サーバーから OpenAI に転送
- メリット: CORSの問題なし、TTS音声のプロキシが可能

## モード2: GitHub Pages版（docs/index.html）
- サーバー不要。ブラウザから直接 OpenAI Responses API を呼び出す
- 単一HTMLファイルに全ロジック内蔵
- ユーザーがAPIキーをブラウザに入力し、フロントエンドから直接APIコール

# ============================
# 画面構成（3画面・SPA）
# ============================

## 画面1: ロープレ設定（setup）
### API設定セクション
- APIキー入力（type=password）、ベースURL入力（デフォルト: https://api.openai.com/v1）
- モデル選択ドロップダウン（カテゴリ別 optgroup）:
  - GPT-5.2系: gpt-5.2（デフォルト）, gpt-5.2-pro
  - GPT-5.1系: gpt-5.1
  - GPT-5系: gpt-5, gpt-5-mini, gpt-5-nano
  - GPT-4o系: gpt-4o, gpt-4o-mini
  - GPT-4.1系: gpt-4.1, gpt-4.1-mini, gpt-4.1-nano
  - o系: o4-mini, o3, o3-pro, o3-mini
  - 旧モデル: gpt-3.5-turbo
  - カスタムモデル名入力欄（custom選択時に表示）
- 保存ボタン、接続テストボタン
- 接続状態表示（接続済み/未テスト/未設定）

### シナリオ選択セクション
- 3種のプリセットボタン（カード形式）:
  1. 新規法人開拓（IT→製造業DX提案、田中部長52歳）
  2. 既存顧客アップセル（SaaS→EC会社上位プラン、鈴木マネージャー38歳）
  3. クレーム対応（システム障害→重要顧客、山田常務58歳）
- 保存済みテンプレート一覧（展開/折りたたみ）
- テンプレートエクスポート/インポートボタン（JSON形式）

### ロープレ設定セクション
- シナリオ textarea（必須）
- 顧客ペルソナ textarea（必須）
- 商品/サービスサイトURL input（任意）
- ゴール設定 textarea（任意）
- 評価基準 textarea
- 「テンプレート保存」ボタン

### 顧客の話し方設定（ペルソナ追加パラメータ）
- 話すスピード: 3つのボタン切り替え
  - ゆっくり（慎重に考えながら話す）
  - 普通（標準的なテンポ）※デフォルト
  - 早口（テンポよく短く話す）
- トーン（口調）: 4つのボタン切り替え（2x2グリッド）
  - 穏やか（柔らかく丁寧な口調）
  - 固め（堅実で厳格な口調）
  - フレンドリー（親しみやすい口調）
  - ビジネスライク（簡潔で効率的な口調）※デフォルト
- 選択状態は border-blue-500 bg-blue-50 で視覚的に強調
- localStorage に保存し、次回起動時に復元

### クロージングポイント設定
- textarea（任意）
- プレースホルダー例:
  - 次回のデモ日程を具体的に提示できたら
  - 導入後のROIを数値で説明できたら
  - 顧客が『検討します』ではなく具体的な質問をしてきたら
- 説明テキスト: 「この言葉が言えたら・聞けたらクロージングに進めるポイントを設定。AI顧客が適切なタイミングで前向きに反応します。」

### 音声設定セクション
- AIの応答を音声で読み上げるトグルスイッチ
- 読み上げ方式: 2択ラジオボタン（カード形式）
  - OpenAI TTS（推奨・gpt-4o-mini-tts）
  - ブラウザ音声（無料・機械的）
- TTSボイス選択（OpenAI TTS選択時のみ表示）:
  coral, sage, alloy, ash, ballad, echo, fable, nova, onyx, shimmer, marin, cedar

### 開始ボタン
- APIキー未設定時は disabled + opacity-50

## 画面2: ロープレ実行（roleplay）
### ヘッダー
- 経過時間（mm:ss）、ターン数表示

### チャットエリア
- ユーザー発言: 右寄せ・青グラデーションバブル
- AI発言: 左寄せ・グレーバブル、顧客アイコン付き
- ストリーミング表示（文字が逐次追加される）
- タイピングインジケーター（3つのドットがバウンス）

### 音声認識中表示
- 認識中テキストのリアルタイム表示
- 「話し始めてください...」プレースホルダー

### 操作ボタン（下部固定）
- キーボードボタン（テキスト入力モード切り替え）
- 送信ボタン（マイクON時のみ表示、緑色、紙飛行機アイコン）← **重要: 手動送信**
- マイクボタン（ON: 赤・小サイズ / OFF: 青グラデ・大サイズ）
- 停止ボタン（ロープレ終了）
- テキスト入力欄（展開時のみ表示）

### 音声認識の動作
- **自動送信は無効**。ユーザーがマイクON→話す→緑の送信ボタンを押す、という手動フロー
- SpeechRecognition: continuous=true, interimResults=true, lang='ja-JP'
- finalTranscript を蓄積し、送信ボタン押下時にまとめて送信
- 認識中テキストをリアルタイム表示
- AI応答中はマイクを一時停止し、応答完了後に再開

### AI応答のストリーミング
- Responses API の SSE イベント `response.output_text.delta` からテキストデルタを抽出
- バブルのテキストをリアルタイム更新（DOM部分更新、全体re-renderしない）
- 応答完了後、autoSpeak が ON なら TTS で読み上げ

## 画面3: フィードバック（feedback）
### ローディング
- スピナー + 「フィードバックを生成中...」

### 総合スコア
- SVGドーナツチャート（0-100点）、スコアに応じた色（緑/黄/赤）
- 総評テキスト
- 経過時間バッジ、ターン数バッジ、目標バッジ（あれば）

### 項目別評価
- 各基準名 + スコア（x/10）+ プログレスバー（色付き）+ コメント

### 良かった点 / 改善ポイント
- 2カラムグリッド表示
- チェックアイコン（緑）/ 矢印アイコン（オレンジ）

### 模範的な対応例
- 青グラデーション背景のカード

### 会話ログ
- `<details>` で折りたたみ
- 営業: 青 / 顧客: グレー

### アクションボタン
- CSVダウンロードボタン（緑枠）
- もう一度ロープレするボタン（青グラデ）

### UI崩れ防止対策（重要）
- 全カードに `overflow-hidden` を付与
- テキスト要素に `break-words min-w-0` を付与
- アイコン等に `flex-shrink-0` を付与
- ヘッダーの「もう一度」ボタンに `flex-shrink-0 ml-2`

# ============================
# CSVダウンロード機能
# ============================

- BOM付きUTF-8（Excelで文字化けしない）
- ファイル名: `ロープレフィードバック_YYYYMMDD_HHMM.csv`
- セクション構成:
  1. ヘッダー行（セクション, 項目, 内容）
  2. 基本情報（実施日, モデル, 所要時間, ターン数, シナリオ, ペルソナ, URL, ゴール, 評価基準）
  3. 総合評価（スコア, 総評）
  4. 項目別評価（基準名, スコア, コメント）← 4列
  5. 良かった点
  6. 改善ポイント
  7. 模範的な対応例
  8. 会話ログ（話者, 発言内容）
- CSVエスケープ: ダブルクォート囲み + 内部ダブルクォート二重化 + 改行→スペース

# ============================
# テンプレート管理
# ============================

- localStorage に `roleplay_templates` キーで JSON 配列を保存
- テンプレートに含まれるフィールド:
  name, scenario, persona, criteria, productURL, goal, personaSpeed, personaTone, closingPoints, createdAt
- エクスポート: JSON ファイルとしてダウンロード
- インポート: JSON ファイルを読み込み、重複（同名+同シナリオ）はスキップ
- テンプレート一覧にバッジ表示: URL付き、目標付き、CP付き（クロージングポイント）

# ============================
# OpenAI Responses API 仕様
# ============================

## エンドポイント
POST {baseURL}/responses

## リクエスト（ストリーミング会話）
{
  "model": "gpt-5.2",
  "input": [{ "role": "user", "content": "..." }, { "role": "assistant", "content": "..." }, ...],
  "instructions": "システムプロンプト（顧客役の指示）",
  "reasoning": { "effort": "none" },
  "temperature": 0.8,
  "max_output_tokens": 300,
  "store": false,
  "stream": true
}

## SSE ストリーミングイベント
event: response.output_text.delta
data: {"delta": "テキスト断片"}

## 非ストリーミングレスポンス（フィードバック用）
{
  "output": [{
    "type": "message",
    "content": [{ "type": "output_text", "text": "完全テキスト" }]
  }]
}

## テキスト抽出ロジック
responseData.output → type=message → content → type=output_text → .text
フォールバック: responseData.output_text

# ============================
# システムプロンプト（buildSystemPrompt）
# ============================

顧客役AIへの指示。以下のパラメータを動的に埋め込む:

- シナリオ、ペルソナ（必須）
- 応答スタイル:
  - スピード: slow→「ゆっくり慎重に」/ normal→「2-4文」/ fast→「テンポよく1-2文」
  - トーン: gentle→「〜ですね」/ firm→「厳格」/ friendly→「カジュアル」/ business→「簡潔」
- 商品/サービスURL（あれば）: 顧客として質問・疑問を投げかける
- ゴール設定（あれば）: 営業の目標。顧客として簡単には達成させない
- クロージングポイント（あれば）: 条件を満たす発言があれば段階的に前向きに反応

ルール:
- 日本語で応答
- 絶対に営業担当の立場で話さない。常に顧客としてのみ発言
- 簡単には承諾せず質問・懸念を出す
- 1回2-4文。間延びしない
- 良い提案には段階的に前向き
- 感情的反応を含める
- メタ発言禁止
- ペルソナの名前・肩書きで自己紹介

# ============================
# フィードバック生成プロンプト
# ============================

- 営業研修の専門コーチとして会話を分析
- クロージングポイントへの到達度も評価に含める
- JSON形式で返却:
  {
    "overallScore": 1-100,
    "summary": "総評2-3文",
    "scores": [{ "criterion": "名前", "score": 1-10, "maxScore": 10, "comment": "..." }],
    "strengths": ["..."],
    "improvements": ["..."],
    "modelAnswer": "模範対応例3-5文"
  }
- temperature: 0.4, max_output_tokens: 2000
- JSON パース失敗時: 正規表現で { } ブロックを抽出してリトライ

# ============================
# server.mjs（Express プロキシ）
# ============================

## APIエンドポイント

### POST /api/chat
- body: { messages, scenario, persona, apiKey, baseURL, model, isFirstMessage, productURL, goal, personaSpeed, personaTone, closingPoints }
- isFirstMessage=true の場合、input に「営業が到着した」という導入文を入れてAIに第一声を出させる
- Responses API をストリーミングで呼び出し、SSEイベントからテキストデルタだけを抽出してプレーンテキストとして返す
- Content-Type: text/plain; charset=utf-8, Transfer-Encoding: chunked

### POST /api/feedback
- body: { messages, scenario, persona, criteria, apiKey, baseURL, model, productURL, goal, closingPoints }
- Responses API を非ストリーミングで呼び出し、JSONレスポンスをパースして返す

### POST /api/test-connection
- body: { apiKey, baseURL, model }
- 簡易テストプロンプトを送信して接続確認

### POST /api/tts
- body: { text, apiKey, baseURL, voice, instructions }
- OpenAI TTS API (POST {baseURL}/audio/speech) を呼び出し
- model: gpt-4o-mini-tts, response_format: mp3
- 音声バイナリをストリーミングで返す

### GET /
- HTMLテンプレートを返す（<script src="/static/app.js">を読み込む）

### 静的ファイル
- /static/* → public/static/ をサーブ

## HTMLテンプレート（server.mjsの mainPageHTML()）
- Tailwind CSS (CDN), FontAwesome (CDN), Noto Sans JP (Google Fonts)
- CSSアニメーション: voice-wave, pulse-ring, fade-in, slide-in, score-bar-fill
- チャットバブル: user=青グラデ右丸め、ai=グレー左丸め
- btn-primary: 青グラデ + ホバーで浮き上がり

# ============================
# docs/index.html（GitHub Pages版）
# ============================

サーバー版と同一の機能を単一HTMLファイルで実装。

違い:
- /api/* を呼ばず、ブラウザからOpenAI APIを直接呼び出す
- callResponsesAPI() でfetch→ Responses API
- TTS も直接 /audio/speech を呼び出す
- SSEストリーミングの読み取りは readStreamRealtimeSSE() で行う（event:行とdata:行をパース）

# ============================
# 状態管理（state オブジェクト）
# ============================

const state = {
  currentScreen: 'setup' | 'roleplay' | 'feedback',
  apiKey, baseURL, model, apiConnected,
  scenario, persona, criteria, productURL, goal,
  personaSpeed: 'slow'|'normal'|'fast',  // デフォルト 'normal'
  personaTone: 'gentle'|'firm'|'friendly'|'business',  // デフォルト 'business'
  closingPoints: '',
  messages: [{ role: 'user'|'assistant', content: string }],
  isListening, isSpeaking, isProcessing,
  startTime, elapsedSeconds, timerInterval, turnCount,
  recognition, synthesis, selectedVoice,
  ttsMode: 'api'|'browser', ttsVoice,
  feedback, isFeedbackLoading,
  autoSpeak, interimTranscript, showTextInput,
  templates: [],
}

localStorage キー:
- roleplay_apiKey, roleplay_baseURL, roleplay_model
- roleplay_ttsMode, roleplay_ttsVoice
- roleplay_personaSpeed, roleplay_personaTone
- roleplay_templates (JSON配列)

# ============================
# UI/UXの重要な設計ポイント
# ============================

1. **手動送信方式**: マイクON中に蓄積された音声テキストを、緑色の送信ボタンで手動送信。自動送信はしない。
2. **DOM部分更新**: ロープレ中の会話表示はDOM部分更新（appendChatBubble, showTypingIndicator等）で行い、render()による全体再レンダリングは避ける。これによりマイクの音声認識が中断しない。
3. **ストリーミング表示**: AIの応答テキストが1文字ずつバブル内に追加表示される。
4. **TTS自動フォールバック**: OpenAI TTS APIが失敗した場合、自動的にブラウザ内蔵音声合成に切り替える。
5. **フォーム値の保持**: setup画面で render() を呼ぶ前に syncStateFromForm() でフォームの入力値をstateに同期し、再レンダリング後も値が消えないようにする。
6. **フィードバックUI崩れ防止**: overflow-hidden, break-words, min-w-0, flex-shrink-0 を適切に配置。

# ============================
# ecosystem.config.cjs
# ============================

module.exports = {
  apps: [{
    name: 'webapp',
    script: 'server.mjs',
    cwd: '/home/user/webapp',
    env: { NODE_ENV: 'development', PORT: 3000 },
    watch: false, instances: 1, exec_mode: 'fork'
  }]
}

# ============================
# package.json の dependencies
# ============================

dependencies: express, hono
devDependencies: @hono/vite-build, @hono/vite-dev-server, vite, wrangler

※ server.mjs は Express のみ使用。Hono/vite は Cloudflare Pages デプロイ用の初期テンプレート残り。

# ============================
# 実装の優先順位
# ============================

1. server.mjs を作成（Express + 4つのAPIエンドポイント + HTMLテンプレート + 静的ファイル配信）
2. public/static/app.js を作成（全フロントエンドロジック）
3. docs/index.html を作成（GitHub Pages版・単一HTML）
4. PM2で起動確認
5. GitHubにプッシュ

以上の仕様に基づいて、完全に動作するアプリケーションを作成してください。
```

---

上記プロンプトをそのまま使用すれば、同等のアプリケーションが一発で再現できます。
