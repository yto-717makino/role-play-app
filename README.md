# AI営業ロープレ

## Project Overview
- **Name**: AI営業ロープレ
- **Goal**: AIと対話しながら営業スキルを磨くためのWebアプリケーション
- **Features**: 音声/テキスト対話、シナリオ設定、リアルタイム会話、AIフィードバック

## 主な機能

### 1. ロープレ設定画面
- シナリオ（営業場面の状況）を自由に設定
- 顧客ペルソナ（役職、性格、懸念事項等）を定義
- 評価基準を事前に設定
- プリセットシナリオ3種（新規法人開拓、既存顧客アップセル、クレーム対応）
- AIの音声読み上げON/OFF切替

### 2. リアルタイム音声会話
- Web Speech API による音声認識（日本語対応）
- リアルタイムの中間テキスト表示
- AIの応答を音声合成で読み上げ
- テキスト入力モードも切替可能
- ストリーミングレスポンスで高速応答
- 経過時間・ターン数の表示

### 3. フィードバック
- 総合スコア（100点満点）
- 項目別評価（各10点満点のバースコア）
- 良かった点のリスト
- 改善ポイントのリスト
- 模範的な対応例
- 会話ログの閲覧

## 技術スタック
- **バックエンド**: Node.js + Express（APIプロキシサーバー）
- **フロントエンド**: Vanilla JS + Tailwind CSS (CDN) + FontAwesome
- **AI対話**: OpenAI API互換（ストリーミング対応）
- **音声**: Web Speech API (SpeechRecognition + SpeechSynthesis)

## API設定
ユーザーがブラウザ上でAPIキーを設定します（ローカルストレージに保存）。
- OpenAI API (`https://api.openai.com/v1`)
- その他OpenAI互換API（Azure OpenAI, Groq, Together AI等）

## API エンドポイント
| パス | メソッド | 説明 |
|------|---------|------|
| `/` | GET | メインページ |
| `/static/*` | GET | 静的ファイル |
| `/api/chat` | POST | 会話API（ストリーミング） |
| `/api/feedback` | POST | フィードバック生成 |
| `/api/test-connection` | POST | API接続テスト |

## ローカル開発
```bash
npm install
pm2 start ecosystem.config.cjs
# → http://localhost:3000
```

## ファイル構成
```
webapp/
├── server.mjs              # Node.js Express サーバー
├── ecosystem.config.cjs     # PM2 設定
├── package.json
├── public/
│   └── static/
│       └── app.js          # フロントエンド JavaScript
├── src/
│   └── index.tsx           # Cloudflare Pages版（将来用）
├── vite.config.ts
├── wrangler.jsonc
└── .dev.vars               # 環境変数（git管理外）
```

## 使い方
1. APIキーを設定（OpenAI等のAPIキーが必要）
2. 接続テストで動作確認
3. シナリオ・ペルソナ・評価基準を設定（プリセット選択も可）
4. 「ロープレを開始する」ボタンで開始
5. マイクボタンで音声入力、またはテキスト入力
6. 終了ボタンで会話を終了し、AIフィードバックを受け取る

## 今後の実装予定
- [ ] Cloudflare Pages/Workers へのデプロイ対応
- [ ] 会話履歴の保存・閲覧機能
- [ ] 複数ロープレ結果の比較分析
- [ ] カスタムプリセットの保存
- [ ] OpenAI TTS API による高品質音声合成

## 注意事項
- 音声認識はChrome/Edgeブラウザ推奨
- APIキーはブラウザのローカルストレージに保存されます
- サーバーサイドではAPIキーを永続化しません（リクエスト毎に受け渡し）

## Last Updated
2026-02-17
