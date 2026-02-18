# AI営業ロープレ

## Project Overview
- **Name**: AI営業ロープレ
- **Goal**: AIと対話しながら営業スキルを磨くためのWebアプリケーション
- **API**: **OpenAI Responses API** (`POST /v1/responses`) — 最新の推奨API
- **Default Model**: **gpt-5.2** (reasoning_effort: none)

## 主な機能

### 1. ロープレ設定画面
- OpenAI APIキー・ベースURL・モデルを自由に設定
- **GPTモデルをドロップダウンから選択可能**
  - GPT-5.2系（gpt-5.2, gpt-5.2-pro） — 最新フラッグシップ
  - GPT-5.1系（gpt-5.1）
  - GPT-5系（gpt-5, gpt-5-mini, gpt-5-nano）
  - GPT-4o系（gpt-4o, gpt-4o-mini）
  - GPT-4.1系（gpt-4.1, gpt-4.1-mini, gpt-4.1-nano）
  - o系推論モデル（o4-mini, o3, o3-pro, o3-mini）
  - 旧モデル（gpt-3.5-turbo）
  - カスタムモデル名入力
- シナリオ（営業場面の状況）を自由に設定
- 顧客ペルソナ（役職、性格、懸念事項等）を定義
- **商品/サービスサイトURL**入力欄（AIが参照）
- **ゴール設定（自由記述）**（営業目標を定義）
- 評価基準を事前に設定
- プリセットシナリオ3種（新規法人開拓、既存顧客アップセル、クレーム対応）
- **テンプレート保存/読み込み/削除**（設定をlocalStorageに保存）

### 2. 音声設定
- **OpenAI TTS API（推奨）**: gpt-4o-mini-tts による高品質な自然音声
  - 12種類のボイス選択
  - API失敗時はブラウザTTSに自動フォールバック
- **ブラウザ音声**: ブラウザ内蔵の音声合成（無料）

### 3. リアルタイム音声会話
- Web Speech API による音声認識（日本語対応）
- continuous mode + 無音検出（2秒）で自然な会話テンポ
- DOM部分更新方式によりマイク認識が途切れない
- ストリーミングレスポンス（Responses API SSEイベント）で高速応答

### 4. AI顧客役
- AIは「顧客」として一貫して応答
- `instructions` パラメータでシステムプロンプトを設定（Responses API方式）
- 商品URLやゴール設定をAIが理解して会話に反映

### 5. テンプレート管理
- ロープレ設定をテンプレートとして保存・読み込み・削除
- URL付き・目標付きのバッジ表示、保存日時表示

### 6. フィードバック
- 総合スコア（100点満点）、項目別評価
- 良かった点・改善ポイント・模範的な対応例
- 会話ログの閲覧

## 技術スタック
- **バックエンド**: Node.js + Express（APIプロキシサーバー）
- **フロントエンド**: Vanilla JS + Tailwind CSS (CDN) + FontAwesome
- **AI API**: **OpenAI Responses API** (`POST /v1/responses`)
  - ストリーミング: SSE (`response.output_text.delta` イベント)
  - パラメータ: `reasoning.effort: "none"`, `store: false`
  - `instructions` でシステムプロンプトを分離
- **音声認識**: Web Speech API (SpeechRecognition)
- **音声合成**: OpenAI TTS API (gpt-4o-mini-tts) + ブラウザ SpeechSynthesis

## Responses API 仕様

### リクエスト形式
```json
{
  "model": "gpt-5.2",
  "input": [
    { "role": "user", "content": "..." }
  ],
  "instructions": "システムプロンプト",
  "reasoning": { "effort": "none" },
  "temperature": 0.8,
  "max_output_tokens": 500,
  "store": false,
  "stream": true
}
```

### ストリーミングSSEイベント
```
event: response.output_text.delta
data: {"delta": "テキストの一部"}
```

### 非ストリーミングレスポンス
```json
{
  "output": [
    {
      "type": "message",
      "content": [
        { "type": "output_text", "text": "完全なテキスト" }
      ]
    }
  ]
}
```

## API エンドポイント
| パス | メソッド | 説明 |
|------|---------|------|
| `/` | GET | メインページ |
| `/static/*` | GET | 静的ファイル |
| `/api/chat` | POST | 会話API（Responses APIストリーミング） |
| `/api/feedback` | POST | フィードバック生成（Responses API非ストリーミング） |
| `/api/test-connection` | POST | API接続テスト |
| `/api/tts` | POST | テキスト→音声変換（OpenAI TTS API） |

## ローカル開発
```bash
npm install
pm2 start ecosystem.config.cjs
# → http://localhost:3000
```

## 使い方
1. APIキーを設定（OpenAI APIキーが必要）
2. モデルをドロップダウンから選択（gpt-5.2がデフォルト・推奨）
3. 接続テストで動作確認
4. シナリオ・ペルソナ・評価基準を設定
5. 必要に応じて「商品/サービスURL」と「ゴール設定」を入力
6. 音声設定で読み上げ方式を選択
7. 「ロープレを開始する」ボタンで開始
8. マイクボタンで音声入力、またはテキスト入力
9. 終了ボタンでフィードバックを受け取る

## GPT-5.2 reasoning_effort について
- `none`（デフォルト）: 推論なし、最速レスポンス。ロープレの会話に最適
- `low` / `medium` / `high` / `xhigh`: 推論深度を上げる
- `temperature` は `reasoning_effort: none` の時のみ有効

## 今後の実装予定
- [ ] Cloudflare Pages/Workers へのデプロイ対応
- [ ] 会話履歴の保存・閲覧機能
- [ ] reasoning effort をUI上で切替可能にする
- [ ] previous_response_id によるマルチターン最適化

## 注意事項
- 音声認識はChrome/Edgeブラウザ推奨（HTTPS環境必須）
- APIキーはブラウザのローカルストレージに保存
- Responses APIを使用するため、OpenAI APIキーが必要（互換APIでResponses APIに対応している必要あり）

## 更新履歴
- **2026-02-18（v4）**: **Chat Completions API → Responses API に全面移行**、デフォルトモデルをgpt-5.2に変更、reasoning_effort=none、SSEストリーミング対応、instructionsパラメータ活用
- **2026-02-18（v3）**: GPT-5.2-pro追加、o3/o3-pro追加、TTS自然化、テンプレートUX改善
- **2026-02-18（v2）**: OpenAI TTS API統合、テンプレート保存機能、商品URL・ゴール設定追加
- **2026-02-18（v1）**: モデル選択ドロップダウン追加、マイクエラー修正、役割混同修正
- **2026-02-17**: 初期バージョンリリース

## Last Updated
2026-02-18
