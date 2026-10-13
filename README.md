# hondana-app

hondana の **推薦棚**・**知識の棚卸し**・**ことばの在庫** を、iPhone のホーム画面からアプリのようにひらくための入れ物。

- 推薦棚：https://peirin1230-ship-it.github.io/hondana-app/shelf/
- 知識の棚卸し：https://peirin1230-ship-it.github.io/hondana-app/quiz/
- ことばの在庫：https://peirin1230-ship-it.github.io/hondana-app/kotoba/

## しくみ

このリポジトリ（公開）には **画面の入れ物だけ** を置く。本・読書メモ・クイズの記録は非公開の `hondana` リポジトリにあり、
ひらいた端末に貼った GitHub のトークンで、GitHub API から直接読み書きする。

| 何を | どこから／どこへ |
|---|---|
| クイズの画面とカード | `hondana` の `site/quiz.html`（`scripts/build_quiz.py` が作る） |
| 推薦棚の画面 | `hondana` の `site/index.html`（`scripts/build_site.py` と表紙の Actions が作る） |
| クイズの記録（間隔・正解・メモ・深掘りの依頼） | `hondana` の **`app-data` ブランチ** の `quiz/state.json` |
| 推薦棚で押した反応 | `hondana` の `main` の `recommendations.md`（「**反応**」の行を書き換える） |
| ことばの在庫の画面と問い・壁打ち | `hondana` の `site/kotoba.html`（`scripts/build_kotoba.py` が作る） |
| ことばの在庫のメモと記録 | `hondana` の **`app-data` ブランチ** の `kotoba/memos/YYYY-MM.json` と `kotoba/state.json` |

読み込んだ画面はその端末にとっておき、次からはすぐひらく。裏で新しい版が出ていないかを確かめ、
出ていれば「ひらき直す」を出す。電波がないときも、とっておいた版でひらける（記録はつながったときに送る）。

## トークン（端末ごとに 1 回）

[トークンを作る画面](https://github.com/settings/personal-access-tokens/new?name=hondana-app&target_name=peirin1230-ship-it&expires_in=365&contents=write)
（名前・期限・Contents: Read and write が入った状態でひらく）で、

- Repository access: **Only select repositories → hondana**
- いちばん下の「Generate token」

出てきた `github_pat_…` を、アプリの最初の画面に貼る。トークンはその端末にだけ保存され、api.github.com 以外には送られない。
iPhone では、ホーム画面のアプリごとに保存場所が分かれるので、推薦棚・知識の棚卸し・ことばの在庫のそれぞれに貼る（同じトークンでよい）。

## 変えたいとき

- **本の画面・クイズ・ことばの在庫の中身** は `hondana` 側で直す（`quiz/app.html`・`quiz/cards/`・`kotoba/app.html`・`scripts/build_site.py`）。`main` に入れば、アプリが次にひらいたときに読み込む
- **アイコン・名前・色・トークンの画面** はこのリポジトリで直す（`quiz/`・`shelf/`・`kotoba/`・`shell.js`・`shell.css`）。`main` に push すると `pages` ワークフローが `gh-pages` に置き直す

ここには個人のデータを置かない。
