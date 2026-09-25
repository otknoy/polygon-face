# Polygon Face

Expo / React Native 製の顔メッシュカメラです。MediaPipe Face Landmarker が顔のランドマークを検出し、カメラ映像上にポリゴン状のワイヤーフレームを表示します。

## 起動

```bash
npm install
npx expo start
```

端末またはブラウザで開き、カメラへのアクセスを許可してください。中央のボタンで静止画表示とライブ表示を切り替え、左のボタンで前面・背面カメラを切り替えます。

## 現在の実装

- Android では WebView 内でカメラ映像を取得し、MediaPipe の動画モードで顔を継続的に解析して Canvas に描画します。解析は最大約 15 回/秒で、実際の速度は端末の性能によります。Web と iOS は約 750 ms ごとの静止画解析です。
- Android・iOS では MediaPipe の JavaScript、WASM、モデルを起動時に配布元から取得するため、初回の顔検出には通信が必要です。Web 版では同梱ファイルを使います。撮影画像はサーバーに送信しません。
- 中央のボタンは表示を一時停止します。端末の写真ライブラリへの保存機能はありません。

## 確認コマンド

```bash
npx expo lint
npx tsc --noEmit
```
