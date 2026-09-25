import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import type { CameraType } from 'expo-camera';

type Props = {
  facing: CameraType;
  frozen: boolean;
  onStatus: (message: string) => void;
  onFaceCount: (count: number) => void;
};

const HTML = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #101310; }
video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
video { object-fit: cover; }
canvas { pointer-events: none; }
.mirror { transform: scaleX(-1); }
</style></head><body>
<video id="camera" autoplay muted playsinline></video><canvas id="mesh"></canvas>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.js"></script>
<script>
(function () {
  var video = document.getElementById('camera');
  var canvas = document.getElementById('mesh');
  var context = canvas.getContext('2d', { alpha: true });
  var detector = null;
  var stream = null;
  var facing = 'front';
  var frozen = false;
  var cameraVersion = 0;
  var lastInference = 0;
  var lastVideoTime = -1;
  var lastFaceAt = 0;
  var faceCount = -1;
  var report = function (type, value) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, value: value }));
  };
  var clear = function () {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
  };
  var resize = function () {
    var ratio = Math.min(window.devicePixelRatio || 1, 2);
    var width = Math.round(canvas.clientWidth * ratio);
    var height = Math.round(canvas.clientHeight * ratio);
    if (width !== canvas.width || height !== canvas.height) {
      canvas.width = width;
      canvas.height = height;
    }
  };
  window.addEventListener('resize', resize);
  resize();
  var stopCamera = function () {
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    stream = null;
    video.srcObject = null;
  };
  var startCamera = async function () {
    var version = ++cameraVersion;
    stopCamera();
    clear();
    faceCount = -1;
    report('faces', 0);
    report('status', 'カメラを起動中');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('WebView がカメラに対応していません');
      }
      var nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing === 'front' ? 'user' : 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
      });
      if (version !== cameraVersion) {
        nextStream.getTracks().forEach(function (track) { track.stop(); });
        return;
      }
      stream = nextStream;
      video.srcObject = stream;
      video.classList.toggle('mirror', facing === 'front');
      await video.play();
      lastVideoTime = -1;
      report('status', detector ? '顔をフレーム内に入れてください' : 'MediaPipe を読み込み中');
    } catch (error) {
      report('error', 'カメラを起動できません: ' + String(error));
    }
  };
  window.setFacing = function (value) {
    if (value !== facing) {
      facing = value;
      startCamera();
    }
  };
  window.setFrozen = function (value) {
    frozen = !!value;
    if (frozen) video.pause();
    else if (stream) video.play().catch(function (error) { report('error', '映像を再開できません: ' + String(error)); });
  };
  var drawEdges = function (face, edges, color, lineWidth, width, height) {
    context.beginPath();
    edges.forEach(function (edge) {
      var a = face[edge.start];
      var b = face[edge.end];
      if (!a || !b) return;
      context.moveTo(a.x * width, a.y * height);
      context.lineTo(b.x * width, b.y * height);
    });
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  };
  var drawFace = function (face, width, height, scale) {
    var landmarker = Vision.FaceLandmarker;
    var oval = landmarker.FACE_LANDMARKS_FACE_OVAL;
    var outline = oval.filter(function (_, index) { return index % 3 === 0; })
      .map(function (edge) { return edge.start; });
    var xs = outline.map(function (index) { return face[index].x; });
    var ys = outline.map(function (index) { return face[index].y; });
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys);
    var maxY = Math.max.apply(null, ys);
    var anchors = outline.slice();
    var seenAnchors = new Set(anchors);
    for (var row = 0; row < 8; row++) {
      for (var column = 0; column < 6; column++) {
        var left = minX + (maxX - minX) * column / 6;
        var right = minX + (maxX - minX) * (column + 1) / 6;
        var top = minY + (maxY - minY) * row / 8;
        var bottom = minY + (maxY - minY) * (row + 1) / 8;
        var centerX = (left + right) / 2;
        var centerY = (top + bottom) / 2;
        var best = -1;
        var distance = Infinity;
        for (var index = 0; index < Math.min(face.length, 468); index++) {
          var point = face[index];
          if (point.x < left || point.x >= right || point.y < top || point.y >= bottom) continue;
          var score = (point.x - centerX) ** 2 + (point.y - centerY) ** 2;
          if (score < distance) { best = index; distance = score; }
        }
        if (best >= 0 && !seenAnchors.has(best)) {
          anchors.push(best);
          seenAnchors.add(best);
        }
      }
    }
    var nearest = face.map(function (point) {
      var best = anchors[0];
      var distance = Infinity;
      anchors.forEach(function (index) {
        var anchor = face[index];
        var score = (point.x - anchor.x) ** 2 + (point.y - anchor.y) ** 2;
        if (score < distance) { best = index; distance = score; }
      });
      return best;
    });
    var usedEdges = new Set();
    context.beginPath();
    landmarker.FACE_LANDMARKS_TESSELATION.forEach(function (edge) {
      var a = nearest[edge.start];
      var b = nearest[edge.end];
      if (a === b || a == null || b == null) return;
      var key = Math.min(a, b) + ':' + Math.max(a, b);
      if (usedEdges.has(key)) return;
      usedEdges.add(key);
      context.moveTo(face[a].x * width, face[a].y * height);
      context.lineTo(face[b].x * width, face[b].y * height);
    });
    context.strokeStyle = 'rgba(204, 255, 101, .85)';
    context.lineWidth = 1.25 / scale;
    context.stroke();
    context.beginPath();
    var contour = oval.filter(function (_, index) { return index % 2 === 0; })
      .map(function (edge) { return edge.start; });
    contour.forEach(function (start, index) {
      var end = contour[(index + 1) % contour.length];
      context.moveTo(face[start].x * width, face[start].y * height);
      context.lineTo(face[end].x * width, face[end].y * height);
    });
    context.strokeStyle = 'rgba(255, 255, 255, .96)';
    context.lineWidth = 2.6 / scale;
    context.stroke();
    drawEdges(face, landmarker.FACE_LANDMARKS_LEFT_EYE, '#CCFF65', 2.5 / scale, width, height);
    drawEdges(face, landmarker.FACE_LANDMARKS_RIGHT_EYE, '#CCFF65', 2.5 / scale, width, height);
    drawEdges(face, landmarker.FACE_LANDMARKS_LEFT_IRIS, '#FFFFFF', 1.8 / scale, width, height);
    drawEdges(face, landmarker.FACE_LANDMARKS_RIGHT_IRIS, '#FFFFFF', 1.8 / scale, width, height);
    drawEdges(face, landmarker.FACE_LANDMARKS_LIPS, 'rgba(255, 255, 255, .8)', 1.4 / scale, width, height);
  };
  var draw = function (faces) {
    resize();
    clear();
    var width = video.videoWidth;
    var height = video.videoHeight;
    if (!width || !height) return;
    var cssWidth = canvas.clientWidth;
    var cssHeight = canvas.clientHeight;
    var ratio = canvas.width / cssWidth;
    var scale = Math.max(cssWidth / width, cssHeight / height);
    var offsetX = (cssWidth - width * scale) / 2;
    var offsetY = (cssHeight - height * scale) / 2;
    if (facing === 'front') {
      context.setTransform(-ratio * scale, 0, 0, ratio * scale, ratio * (cssWidth - offsetX), ratio * offsetY);
    } else {
      context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * offsetX, ratio * offsetY);
    }
    faces.forEach(function (face) { drawFace(face, width, height, scale); });
  };
  var tick = function (now) {
    requestAnimationFrame(tick);
    if (frozen || !detector || video.readyState < 2 || now - lastInference < 66 || video.currentTime === lastVideoTime) return;
    lastInference = now;
    lastVideoTime = video.currentTime;
    try {
      var faces = detector.detectForVideo(video, now).faceLandmarks;
      if (faces.length) {
        lastFaceAt = now;
        draw(faces);
      } else if (now - lastFaceAt > 1500) {
        clear();
      }
      if (faces.length !== faceCount) {
        faceCount = faces.length;
        report('faces', faceCount);
        report('status', faceCount ? '顔を検出中' : '顔をフレーム内に入れてください');
      }
    } catch (error) {
      report('error', '顔の解析に失敗しました: ' + String(error));
      detector = null;
    }
  };
  requestAnimationFrame(tick);
  startCamera();
  (async function () {
    try {
      if (!window.Vision) throw new Error('JavaScript を読み込めません');
      var files = await Vision.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm');
      detector = await Vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1
      });
      report('ready', true);
      if (stream) report('status', '顔をフレーム内に入れてください');
    } catch (error) {
      report('error', 'MediaPipe を読み込めません: ' + String(error));
    }
  })();
  window.addEventListener('pagehide', function () { ++cameraVersion; stopCamera(); if (detector) detector.close(); });
})();
</script></body></html>`;

const SOURCE = { html: HTML, baseUrl: 'https://localhost/' };

export default function LiveFaceCamera({ facing, frozen, onStatus, onFaceCount }: Props) {
  const webview = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (ready) webview.current?.injectJavaScript(`window.setFacing(${JSON.stringify(facing)}); true;`);
  }, [facing, ready]);
  useEffect(() => {
    if (ready) webview.current?.injectJavaScript(`window.setFrozen(${JSON.stringify(frozen)}); true;`);
  }, [frozen, ready]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') setReady(true);
      else if (message.type === 'faces') onFaceCount(Number(message.value));
      else if (message.type === 'status' || message.type === 'error') onStatus(String(message.value));
    } catch {
      onStatus('カメラの状態を読み取れませんでした');
    }
  };

  return (
    <WebView
      ref={webview}
      source={SOURCE}
      style={styles.webview}
      originWhitelist={['*']}
      javaScriptEnabled
      mediaPlaybackRequiresUserAction={false}
      scrollEnabled={false}
      onMessage={handleMessage}
      onError={() => onStatus('カメラ用 WebView を開けませんでした')}
    />
  );
}

const styles = StyleSheet.create({ webview: { flex: 1, backgroundColor: '#101310' } });
