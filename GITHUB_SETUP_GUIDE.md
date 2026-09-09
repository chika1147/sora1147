# GitHubでこのゲーム企画を作る手順（やさしい版）

このページは、
**「1年生〜高校生向け 旅すごろくタイピングゲーム」**を
GitHubで管理するための、やさしい手順書です。

---

## 0. まず準備するもの

- GitHubアカウント
- パソコン（Windows / Mac どちらでもOK）
- VS Code（無料エディタ）
- Git（バージョン管理ツール）

---

## 1. GitHubでリポジトリを作る

1. GitHubにログイン
2. 右上の **「+」→「New repository」** を押す
3. Repository name に `travel-typing-game` と入力
4. Public（公開）か Private（非公開）を選ぶ
5. **Create repository** を押す

> ここまでで「入れ物（リポジトリ）」完成です。

---

## 2. ローカルにプロジェクトを作る（最小構成）

以下の構成でファイルを作ります。

```text
travel-typing-game/
  index.html
  style.css
  app.js
  GAME_UI_REDESIGN.md
  GITHUB_SETUP_GUIDE.md
```

---

## 3. コマンドでGitHubにアップする

ターミナルで次を順番に実行します。

```bash
mkdir travel-typing-game
cd travel-typing-game

# 既存ファイルをここに入れる（index.html, style.css, app.js など）

git init
git branch -M main
git add .
git commit -m "Initial commit: travel typing game scaffold"

git remote add origin https://github.com/<あなたのID>/travel-typing-game.git
git push -u origin main
```

`<あなたのID>` は自分のGitHubユーザー名に変えてください。

---

## 4. 開発の進め方（おすすめ）

### 4-1. 機能ごとにブランチを切る

```bash
git checkout -b feature/typing-ui
```

### 4-2. 変更を保存してコミット

```bash
git add .
git commit -m "Add typing input panel with combo feedback"
```

### 4-3. GitHubへ送る

```bash
git push -u origin feature/typing-ui
```

### 4-4. Pull Requestを作る

- GitHub画面で **Compare & pull request** を押す
- タイトルと説明を書く
- **Create pull request** を押す
- レビュー後に **Merge**

---

## 5. GitHub Pagesで公開する（HTMLゲーム向け）

1. リポジトリの **Settings** を開く
2. 左メニューの **Pages** を押す
3. Source を **Deploy from a branch**
4. Branch を **main / (root)**
5. Save

数分後、公開URLが表示されます。

例: `https://<あなたのID>.github.io/travel-typing-game/`

---

## 6. このゲーム向けのIssueテンプレ（運用しやすい）

### 6-1. 追加すると良いラベル

- `ui`
- `typing`
- `map`
- `character`
- `good first issue`
- `grade-g1-2`
- `grade-g3-6`
- `grade-jh-hs`

### 6-2. Issueの書き方

- 何を作るか（例: ひらがな専用プロンプトUI）
- できた状態の定義（完了条件）
- 対象学年（小1-2 / 小3-6 / 中高）
- 参考画像や仕様リンク

---

## 7. 学年別データの置き場所（おすすめ）

```text
data/
  grade_g1_2.json
  grade_g3_4.json
  grade_g5_6.json
  grade_junior.json
  grade_senior.json
```

- `grade_g1_2.json` はひらがな中心
- `grade_g3_4.json` はカタカナ導入
- `grade_g5_6.json` から漢字+ふりがな
- 中高は漢字比率を上げる

---

## 8. よくあるエラーと直し方

### エラー1: `remote origin already exists`

```bash
git remote remove origin
git remote add origin https://github.com/<あなたのID>/travel-typing-game.git
```

### エラー2: `failed to push some refs`

```bash
git pull --rebase origin main
git push origin main
```

### エラー3: Pagesが表示されない

- `index.html` がルートにあるか確認
- PagesのBranch設定が `main / (root)` か確認
- 反映まで数分待つ

---

## 9. 最初に作ると良い3タスク

1. **ひらがな専用のタイピング画面**（小1-2）
2. **学年選択カードUI**（タイトル画面）
3. **マップ前進演出**（成功時の気持ちよさ）

---

## 10. まとめ

- GitHubは「作品を安全に育てるノート」です。
- 1つずつ、
  - Issueを作る
  - ブランチで作る
  - PRで確認する
  - Mergeする
  の流れで進めると失敗しにくいです。

困ったら、この順番だけ覚えてください：

**Issue → Branch → Commit → Push → PR → Merge**

---

## 11. 「PR作成ツール」って何？

かんたんに言うと、  
**Pull Request（変更提案）を作るための道具**です。

### PRって何？

- PR = 「この変更をmainに入れていいですか？」という申請書
- 変更内容、理由、テスト結果をまとめてレビューしてもらう
- OKならマージされる

### PR作成ツールでできること

1. PRタイトルを作る  
2. PR本文（何を変えたか）を作る  
3. 変更理由や確認内容を整理する  

### このリポジトリでの考え方

- まず `git commit` する
- その後にPR作成ツールでタイトル/本文を登録する
- これでレビューしやすくなる

### GitHub画面だけで作る場合

- `Compare & pull request` を押して同じことを手入力でもOK

つまり、**PR作成ツールは「PRを書くのを手伝うアシスタント」**です。
