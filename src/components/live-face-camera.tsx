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
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #050711; }
body { background-image: radial-gradient(circle at 50% 42%, #23203a 0%, #0d1022 48%, #050711 100%); }
#space { position: absolute; inset: 0; background-image: radial-gradient(circle at 13% 18%, #ffffff99 0 1px, transparent 2px), radial-gradient(circle at 83% 11%, #ffffff77 0 1px, transparent 2px), radial-gradient(circle at 72% 69%, #ffffff88 0 1px, transparent 2px), radial-gradient(circle at 24% 78%, #ffffff77 0 1px, transparent 2px), radial-gradient(circle at 90% 43%, #ffffff55 0 1px, transparent 2px), radial-gradient(circle at 7% 52%, #ffffff66 0 1px, transparent 2px); }
#space::after { content: ''; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent 0 3px, #00000018 4px); }
video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
video { object-fit: cover; opacity: 0; }
canvas { pointer-events: none; }
.mirror { transform: scaleX(-1); }
</style></head><body><div id="space"></div>
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
  var framing = null;
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
    framing = null;
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
  var px = function (point, width) { return point.x * width; };
  var py = function (point, height) { return point.y * height; };
  var polygon = function (face, indices, width, height) {
    context.beginPath();
    indices.forEach(function (index, position) {
      var point = face[index];
      if (position === 0) context.moveTo(px(point, width), py(point, height));
      else context.lineTo(px(point, width), py(point, height));
    });
    context.closePath();
  };
  var drawEdges = function (face, edges, color, lineWidth, width, height) {
    context.beginPath();
    edges.forEach(function (edge) {
      var a = face[edge.start];
      var b = face[edge.end];
      if (!a || !b) return;
      context.moveTo(px(a, width), py(a, height));
      context.lineTo(px(b, width), py(b, height));
    });
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
  };
  var anchors = [
    10, 297, 284, 389, 454, 361, 397, 379, 400, 152, 176, 150, 172, 132, 234, 162, 54, 67,
    151, 9, 168, 6, 1, 4, 2, 50, 280, 205, 425, 116, 345, 33, 133, 362, 263,
    70, 300, 61, 291, 0, 17, 78, 308, 123, 352, 187, 411
  ];
  var palette = ['#555066', '#686078', '#79647a', '#8d6c72', '#a47672', '#6e687b', '#9a7b75', '#b18676'];
  var leftEye = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
  var rightEye = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
  var innerMouth = [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191];
  var drawEye = function (face, indices, iris, width, height, scale) {
    polygon(face, indices, width, height);
    context.fillStyle = '#100d1d';
    context.fill();
    context.strokeStyle = '#ed7766';
    context.lineWidth = 2.2 / scale;
    context.stroke();
    var irisPoints = iris.map(function (edge) { return face[edge.start]; }).filter(Boolean);
    var centerX = irisPoints.length ? 0 : (px(face[indices[0]], width) + px(face[indices[8]], width)) / 2;
    var centerY = irisPoints.length ? 0 : (py(face[indices[0]], height) + py(face[indices[8]], height)) / 2;
    irisPoints.forEach(function (point) { centerX += px(point, width); centerY += py(point, height); });
    if (irisPoints.length) { centerX /= irisPoints.length; centerY /= irisPoints.length; }
    var eyeWidth = Math.abs(px(face[indices[0]], width) - px(face[indices[8]], width));
    var radius = Math.max(eyeWidth * 0.18, 2 / scale);
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.fillStyle = '#f47b50';
    context.fill();
    context.beginPath();
    context.arc(centerX, centerY, radius * 0.52, 0, Math.PI * 2);
    context.fillStyle = '#fff0ae';
    context.fill();
  };
  var drawFace = function (face, width, height, scale) {
    var landmarker = Vision.FaceLandmarker;
    var oval = landmarker.FACE_LANDMARKS_FACE_OVAL.map(function (edge) { return edge.start; });
    polygon(face, oval, width, height);
    context.fillStyle = '#312d45';
    context.fill();
    context.shadowColor = '#d44b53';
    context.shadowBlur = 18 / scale;
    context.strokeStyle = '#c76c66';
    context.lineWidth = 3 / scale;
    context.stroke();
    context.shadowBlur = 0;

    context.save();
    polygon(face, oval, width, height);
    context.clip();
    var nearest = face.slice(0, 468).map(function (point) {
      var best = anchors[0];
      var distance = Infinity;
      anchors.forEach(function (index) {
        var anchor = face[index];
        var score = (point.x - anchor.x) ** 2 + (point.y - anchor.y) ** 2;
        if (score < distance) { best = index; distance = score; }
      });
      return best;
    });
    var used = new Set();
    var triangles = landmarker.FACE_LANDMARKS_TESSELATION;
    for (var index = 0; index < triangles.length; index += 3) {
      var a = nearest[triangles[index].start];
      var b = nearest[triangles[index].end];
      var c = nearest[triangles[index + 1].end];
      if (a === b || b === c || c === a || a == null || b == null || c == null) continue;
      var key = [a, b, c].sort(function (x, y) { return x - y; }).join(':');
      if (used.has(key)) continue;
      used.add(key);
      polygon(face, [a, b, c], width, height);
      context.fillStyle = palette[(a * 3 + b * 7 + c * 11) % palette.length];
      context.fill();
      context.strokeStyle = 'rgba(22, 19, 38, .65)';
      context.lineWidth = 1 / scale;
      context.stroke();
    }
    context.restore();

    drawEdges(face, landmarker.FACE_LANDMARKS_LEFT_EYEBROW, '#392b43', 5 / scale, width, height);
    drawEdges(face, landmarker.FACE_LANDMARKS_RIGHT_EYEBROW, '#392b43', 5 / scale, width, height);
    drawEye(face, leftEye, landmarker.FACE_LANDMARKS_LEFT_IRIS, width, height, scale);
    drawEye(face, rightEye, landmarker.FACE_LANDMARKS_RIGHT_IRIS, width, height, scale);
    polygon(face, innerMouth, width, height);
    context.fillStyle = '#130b1d';
    context.fill();
    context.strokeStyle = '#d37a72';
    context.lineWidth = 2 / scale;
    context.stroke();
    drawEdges(face, [{ start: 168, end: 6 }, { start: 6, end: 1 }, { start: 1, end: 4 }], '#d8a18a', 2.5 / scale, width, height);
  };
  var draw = function (faces) {
    resize();
    clear();
    var width = video.videoWidth;
    var height = video.videoHeight;
    if (!width || !height) return;
    var face = faces[0];
    var oval = Vision.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL;
    var xs = oval.map(function (edge) { return px(face[edge.start], width); });
    var ys = oval.map(function (edge) { return py(face[edge.start], height); });
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys);
    var maxY = Math.max.apply(null, ys);
    var cssWidth = canvas.clientWidth;
    var cssHeight = canvas.clientHeight;
    var ratio = canvas.width / cssWidth;
    var targetScale = Math.min(cssWidth * 0.78 / (maxX - minX), cssHeight * 0.78 / (maxY - minY));
    var targetX = (minX + maxX) / 2;
    var targetY = (minY + maxY) / 2;
    if (!framing) framing = { scale: targetScale, x: targetX, y: targetY };
    else {
      framing.scale += (targetScale - framing.scale) * 0.22;
      framing.x += (targetX - framing.x) * 0.22;
      framing.y += (targetY - framing.y) * 0.22;
    }
    var scale = framing.scale;
    var centerX = framing.x;
    var centerY = framing.y;
    var horizontal = facing === 'front' ? -ratio * scale : ratio * scale;
    context.setTransform(horizontal, 0, 0, ratio * scale, ratio * cssWidth / 2 - horizontal * centerX, ratio * cssHeight / 2 - ratio * scale * centerY);
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
        framing = null;
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
