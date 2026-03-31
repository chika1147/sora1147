# 今作ったものをプレビューする方法（1分版）

このプロジェクトは、**ローカルサーバー**を立てるとすぐ見られます。

---

## 1) ターミナルでこのフォルダに移動

```bash
cd /workspace/sora1147
```

## 2) プレビュー起動（かんたん）

```bash
./preview.sh
```

> 別ポートにしたいときは `./preview.sh 8080`

---

## 3) ブラウザで開くURL

- トップページ: `http://localhost:8000/index.html`
- UI再設計ドキュメント: `http://localhost:8000/GAME_UI_REDESIGN.md`
- GitHub手順ガイド: `http://localhost:8000/GITHUB_SETUP_GUIDE.md`

---

## 4) 終わるとき

ターミナルで **Ctrl + C** を押すだけです。

---

## うまく表示されないとき

### ケース1: `Address already in use`

ポートが使われています。次で起動してください。

```bash
./preview.sh 8080
```

### ケース2: `./preview.sh: Permission denied`

実行権限を付けます。

```bash
chmod +x preview.sh
./preview.sh
```

### ケース3: 文字化けする

- ブラウザを再読み込み（Ctrl + F5）
- `index.html` の `<meta charset="utf-8">` を確認

---

## ワンポイント

GitHubに上げたあと、**GitHub Pages** でも同じように見られます。
`GITHUB_SETUP_GUIDE.md` の Pages手順に沿って公開してください。
