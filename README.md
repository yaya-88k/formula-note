# FormulaNote

メモ帳のように計算式を縦に並べて結果を見られる、CalcNote風のPWA電卓アプリ。

## 特徴

- **行ごとに式を入力**、右側に結果が表示される
- **変数定義**: `a = 12` のように書くと、以降の行で `a` を使える。同じ名前を後の行で再定義すると、それより下の行に反映される
- **暗黙の乗算**: `512a` = `512 × a` のように記述可能
- **多機能関数**: sin / cos / tan / log / exp / mod / round / abs / √ / π など
- **コメント**: `//` 以降は注釈として無視される
- **カスタムキーボード**: 数字 / 変数 / 関数の3ページをスワイプで切替
- **上下スワイプ補助**: 例 `sin` ボタンを上にスワイプで `asin`、下にスワイプで `sinh`
- **OSキーボードへの切替**: `ABC` ボタンで自由テキスト（Simejiなど）入力
- **複数メモ管理**: ノートを複数作成・切替・削除（localStorage保存）
- **ライト/ダークテーマ**
- **PWA**: スマホのホーム画面に追加すれば、ネイティブアプリ同様に全画面で起動

## 使い方

1. https://yaya-88k.github.io/formula-note/ にアクセス
2. ブラウザの「ホーム画面に追加」でPWAインストール
3. ホーム画面のアイコンから起動

## ローカル開発

```sh
# このリポジトリで簡易サーバーを起動
npx serve .
# または
python -m http.server 8000
```

ブラウザで http://localhost:8000 にアクセス。

## ファイル構成

```
formula-note/
├── index.html
├── manifest.webmanifest
├── service-worker.js
├── css/style.css
├── js/
│   ├── app.js           # メインアプリ
│   ├── parser.js        # 式パーサー
│   ├── keyboard.js      # カスタムキーボード
│   ├── storage.js       # localStorage
│   └── format.js        # 数値フォーマット
└── icons/
```

## ライセンス

MIT
