# ZeroAI v1.8 Web — GitHub Pages / Offline PWA

- 推論エンジンはユーザー自身の学習済みZeroAI（外部AI API・RAG不使用）。
- モデルデータはWeb配信しない。`manifest.json / tokenizer.json / weights.bin` を手動で端末に取り込む。
- 数学の自動検算はローカル数式パーサー。**GPT生成と明確に区別する**。
- 逆向きの質問を言い換え、複数候補を採点するが、答えの事実性は保証できない。
- WebのPython検証は限定的な構文ヒューリスティックで、Pythonコードを実行しない。
- 既存IndexedDB `zeroai-offline-v1` 内のモデルを引き継ぐ。新しい試験モデルを選ぶと置き換わる。
- Node.jsで `node --experimental-default-type=module test_v18.mjs` を実行すると単体テスト可能。
- HTTPSで配信するとService Workerがサイトを保存し、キャッシュが保持されればオフラインで再起動可能。
- 公開ソースには学習済みモデルを含めず、以前のGitHub Pagesサイトも自動変更していない。

チェックポイントの実験版を使用する場合は、別途用意された **ZeroAI_v1_8_Trial_Web_Private_Model.zip** を解凍して3ファイルを取り込む。
