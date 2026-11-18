# ZeroAI Offline Web
ZeroAIのブラウザ推論版（Windows/iPhone対応）。

## 注意
- 公開するのはアプリのソースコードだけです。
- `v15_best.pt`、`weights.bin`、`manifest.json`、`tokenizer.json`をGitHubに公開しないでください。
- 学習済みモデルはブラウザで選択して読み込み、端末内のIndexedDBに保存します。
- 推論には外部AI API、RAG、通信を使いません。
- 初回のページ取得はオンラインで行い、以後のオフライン起動はブラウザのキャッシュ状況に依存します。
- iPhone実機での動作は未検証です。
- Windows向けZeroAI v1.6のすべての機能を移したアプリではありません。

## GitHub Pages公開設定
Settings → Pages → Build and deployment → Deploy from a branch → gh-pages → /(root) → Save。
