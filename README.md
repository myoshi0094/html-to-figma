# html-to-figma

HTMLをFigmaのデザインに変換するFigmaプラグインです。

## 機能

- HTMLの構造をFigmaのフレーム・テキスト・図形に変換
- React + TypeScript で構築されたプラグインUI

## 技術スタック

- **UI**: React 18 + TypeScript
- **ビルドツール**: Vite
- **型定義**: @figma/plugin-typings

## セットアップ

### 依存パッケージのインストール

```bash
yarn install
```

### 開発

```bash
yarn dev
```

### ビルド

```bash
yarn build
```

## Figmaへの読み込み方

1. `yarn build` を実行して `dist/` フォルダを生成
2. Figmaデスクトップアプリを開く
3. メニュー → Plugins → Development → Import plugin from manifest...
4. `manifest.json` を選択
