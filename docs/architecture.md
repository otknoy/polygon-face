# アプリケーション構成

## 概要

Polygon Face は Expo SDK 57 / React Native / Expo Router 製の顔メッシュカメラです。ホーム画面でカメラ画像を MediaPipe Face Landmarker に渡し、検出したランドマークをプラットフォーム別の表現で描画します。解析は端末またはブラウザ内で行い、画像を保存・送信するアプリ内の処理や独自のバックエンドはありません。ただし、Android と iOS は MediaPipe の実行ファイルとモデルを起動時に外部配布元から取得します。

## 入口と画面

```text
package.json (main: expo-router/entry)
└─ src/app/_layout.tsx       StatusBar + ヘッダー非表示の Stack
   └─ src/app/index.tsx      ホーム。CameraScreen を表示
```

Expo Router のルートは `src/app/` に置き、画面以外のコードは `src/components/` に置いています。現在の画面はホームのみです。`src/app/index.tsx` は `@/components/camera-screen` を読み込み、プラットフォーム拡張子によって実体が切り替わります。

| 対象 | 選択される画面 | 顔の処理と表示 |
| --- | --- | --- |
| Android | `camera-screen.tsx` | `live-face-camera.tsx` の WebView 内で動画を解析し、黒い背景にローポリゴンの顔と口のエフェクトを Canvas 描画 |
| iOS | `camera-screen.ios.tsx` → `camera-screen.still.tsx` | `CameraView` の画像を定期的に解析し、カメラ映像の上に SVG のワイヤーフレームを表示 |
| Web | `camera-screen.web.tsx` → `camera-screen.still.tsx` | iOS と同じ画面を使い、ブラウザ用の `face-processor.web.tsx` で解析 |

`src/app/_layout.tsx` は Stack を使用しています。

## 顔解析の流れ

### Android

1. `camera-screen.tsx` が `expo-camera` でカメラ権限を要求し、向き・一時停止・顔の数・状態メッセージを管理します。
2. `live-face-camera.tsx` は HTML を `react-native-webview` に読み込みます。WebView 内の `getUserMedia` が映像を取得します。
3. MediaPipe Face Landmarker を `VIDEO` モード、最大 1 顔で動かします。`requestAnimationFrame` のループで最大約 15 回/秒の解析を試みます。
4. ランドマークから顔のポリゴンを Canvas に描きます。口の開閉を検出すると、口元から飛ぶ板のエフェクトを別の Canvas に描きます。カメラ映像自体は透明化されています。
5. WebView は `postMessage` で顔の数と状態を React Native 側へ返します。カメラ切替と一時停止は `injectJavaScript` で WebView に伝えます。

### iOS・Web

1. `camera-screen.still.tsx` が `expo-camera` の `CameraView` とカメラ権限を管理します。
2. 約 750 ms ごとに静止画を撮り、`expo-image-manipulator` で幅 360 px に縮小して JPEG の data URL を作ります。前回分の解析中や一時停止中は次の取得をスキップします。
3. `FaceProcessor` が MediaPipe Face Landmarker を `IMAGE` モード、最大 2 顔で実行します。ランドマークからメッシュ、輪郭、目、虹彩、口の SVG パスを作り、顔の数・画像サイズとともに画面へ返します。
4. 画面は `react-native-svg` でパスをカメラ映像の上に描きます。中央の操作で静止画表示とライブ表示を切り替え、左の操作でカメラの向きを切り替えます。

iOS の `face-processor.tsx` は非表示の WebView 内で解析し、`injectJavaScript` と `postMessage` で結果を受け渡します。Web の `face-processor.web.tsx` は `use dom` を付けた DOM コンポーネントで同じ役割を担います。後者は `public/mediapipe/` の同梱ファイルを優先し、読み込みに失敗した場合は CDN と公開モデルへフォールバックします。両実装は `FaceResult` 相当の同じデータ形状を画面へ返します。

## 主なディレクトリと設定

| パス | 役割 |
| --- | --- |
| `src/components/` | カメラ画面、顔解析、描画。`.ios.tsx` / `.web.tsx` がプラットフォーム別実装 |
| `public/mediapipe/` | Web 版が優先して使う MediaPipe の JS、WASM、顔モデル。Web の静的出力にもコピーされる |
| `assets/` | アプリアイコン、スプラッシュ、Web favicon |
| `app.json` | アプリ名、カメラ権限文言、プラグイン、Web の `static` 出力など |
| `tsconfig.json` | strict TypeScript と `@/` → `src/` のパス別名 |
| `__tests__/camera-screen-test.tsx` | Android の権限・停止・カメラ切替 UI のテスト |
| `.github/workflows/checks.yml` | push / pull request 時の依存関係確認、lint、型チェック、Jest |

Android・iOS の MediaPipe JS / WASM / モデルはコード中の CDN と公開モデル URL を参照します。Web では `public/mediapipe/` を優先するため、Web 配信時はこのディレクトリも含む `dist/` 全体を公開します。

## 開発とビルド

`package-lock.json` を使う npm プロジェクトです。`npm ci` 後に `npx expo start` で開発サーバーを起動し、`npm run web` で Web を開けます。Web の静的ビルドは `npx expo export --platform web` で、出力先は `dist/` です。`ios/` と `android/` はリポジトリに含まれず、Expo の生成対象です。

確認コマンドは `npx expo lint`、`npx tsc --noEmit`、`npm test -- --ci` です。CI はこれらに加えて `npx expo install --check` を実行します。
