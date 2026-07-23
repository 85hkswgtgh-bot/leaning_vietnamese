# ベト単

iPhoneで使える、個人用のベトナム語一問一答PWAです。208枚のカード、自己採点、任意のベトナム語入力判定、誤答の再出題、端末内の学習履歴、バックアップ／復元、完全オフライン動作に対応します。

本番コードはHTML、CSS、Vanilla JavaScriptだけで、外部API、CDN、フォント、解析、広告、npm本番依存関係を使用しません。

## ローカルで起動

Service WorkerとJSON読み込みにはHTTP配信が必要です。リポジトリ直下で、利用できる方を実行します。

```sh
python -m http.server 8000
```

または:

```sh
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開きます。`index.html` の直接起動（`file://`）ではオフライン機能を確認できません。

## テスト

Node.js 20以降で、追加パッケージなしに実行できます。

```sh
node --test
```

`npm test` でも同じテストを実行できますが、`npm install` は不要です。データ、出題、入力判定、履歴、Manifest、Service Worker、相対パスを検証します。

## GitHub Pagesで公開

1. このリポジトリをGitHubへpushする。
2. GitHubのリポジトリで **Settings → Pages** を開く。
3. **Build and deployment** のSourceを **Deploy from a branch** にする。
4. 公開ブランチ（通常は `main`）と `/ (root)` を選び、保存する。
5. 表示された `https://ユーザー名.github.io/リポジトリ名/` を開く。

すべてのパス、Manifestの `start_url` と `scope` は相対指定なので、プロジェクトサブディレクトリで動作します。HTTPS配信のためService Workerも利用できます。

## iPhoneのホーム画面へ追加

1. 公開URLをSafariで開く。
2. 共有ボタンをタップする。
3. **ホーム画面に追加** を選ぶ。
4. 名前を確認し、**追加** をタップする。
5. ホーム画面の「ベト単」アイコンから起動する。

standalone表示、縦向き、ノッチとホームインジケーターのsafe areaに対応しています。

## オフライン動作を確認

1. オンラインで一度アプリを最後まで読み込む。
2. iPhoneを機内モードにするか、開発者ツールでOfflineを選ぶ。
3. ホーム画面のアイコンまたは同じURLから再度開く。
4. 画面上部が「オフライン」になり、出題と履歴保存が使えることを確認する。

初回アクセス前のオフライン起動はできません。

## 単語データを更新

1. 正本の `data/words.json` をUTF-8で編集する。
2. ID、元番号、セット、表示・許容回答、注記など既存スキーマを維持する。
3. CSVを再生成する。

```sh
node scripts/generate-csv.mjs
```

4. `node --test` を実行する。
5. `sw.js` の `CACHE_VERSION` を上げる。

判断を伴う統合・分割や地域差は `DATA_REVIEW.md` に追記します。

## 学習履歴のバックアップと復元

設定画面で **履歴を書き出す** を押すとJSONを保存できます。復元時は **履歴を復元する** からそのJSONを選びます。不正な形式は取り込まず、エラーを表示します。

履歴はSafariの `localStorage` にのみ保存されます。Safariのサイトデータ削除、プライベートブラウズ、端末初期化では失われるため、必要に応じて書き出してください。

## Service Worker更新時の注意

静的ファイルや単語データを変更したら、`sw.js` の `CACHE_VERSION`（例: `v1` → `v2`）を必ず変更します。新バージョン検出時はアプリ内に更新案内が表示されます。更新すると旧キャッシュはactivate時に削除されます。

公開直後に旧表示が残る場合は、アプリをいったん終了して再起動し、更新案内から更新してください。

## 構成

- `index.html` / `styles.css` / `app.js`: 画面と操作
- `quiz.js`: 出題・再出題・入力判定
- `storage.js`: 履歴と設定の端末保存、書き出し、復元
- `data/words.json`: 単語データの正本
- `data/words.csv`: 参照・編集支援用CSV
- `manifest.webmanifest` / `sw.js` / `icons/`: PWAとオフライン
- `tests/`: Node.js標準テスト
- `SPEC.md`: 仕様
- `DATA_REVIEW.md`: データ正規化の判断記録
