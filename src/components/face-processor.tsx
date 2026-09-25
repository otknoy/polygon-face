import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';

export type FaceResult = {
  faceCount: number;
  width: number;
  height: number;
  meshPath: string;
  contourPath: string;
  eyePath: string;
  irisPath: string;
  mouthPath: string;
};

type Props = {
  image: string | null;
  onReady: () => Promise<void>;
  onResult: (result: FaceResult) => Promise<void>;
  onError: (error: string) => Promise<void>;
};

const HTML = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.js"></script>
<script>
(function () {
  var send = function (message) {
    window.ReactNativeWebView.postMessage(JSON.stringify(message));
  };
  if (!window.Vision) {
    send({ type: 'error', message: 'MediaPipe の JavaScript を読み込めません' });
    return;
  }
  var detector = null;
  var busy = false;
  var coord = function (point, width, height) {
    return (point.x * width).toFixed(1) + ' ' + (point.y * height).toFixed(1);
  };
  var coarsePaths = function (faces, width, height) {
    var mesh = [];
    var contours = [];
    var eyes = [];
    var irises = [];
    var mouths = [];
    var oval = Vision.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL;
    var edges = Vision.FaceLandmarker.FACE_LANDMARKS_TESSELATION;
    var appendEdges = function (parts, face, connections) {
      connections.forEach(function (edge) {
        var a = face[edge.start];
        var b = face[edge.end];
        if (a && b) parts.push('M' + coord(a, width, height) + 'L' + coord(b, width, height));
      });
    };
    faces.forEach(function (face) {
      var outline = oval.filter(function (_, index) { return index % 3 === 0; })
        .map(function (edge) { return edge.start; });
      var contourOutline = oval.filter(function (_, index) { return index % 2 === 0; })
        .map(function (edge) { return edge.start; });
      var xs = outline.map(function (index) { return face[index].x; });
      var ys = outline.map(function (index) { return face[index].y; });
      var minX = Math.min.apply(null, xs);
      var maxX = Math.max.apply(null, xs);
      var minY = Math.min.apply(null, ys);
      var maxY = Math.max.apply(null, ys);
      var anchors = outline.slice();
      var seenAnchors = new Set(anchors);
      var columns = 6;
      var rows = 8;
      for (var row = 0; row < rows; row++) {
        for (var column = 0; column < columns; column++) {
          var left = minX + (maxX - minX) * column / columns;
          var right = minX + (maxX - minX) * (column + 1) / columns;
          var top = minY + (maxY - minY) * row / rows;
          var bottom = minY + (maxY - minY) * (row + 1) / rows;
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
      edges.forEach(function (edge) {
        var start = nearest[edge.start];
        var end = nearest[edge.end];
        if (start === end || start == null || end == null) return;
        var key = Math.min(start, end) + ':' + Math.max(start, end);
        if (usedEdges.has(key)) return;
        usedEdges.add(key);
        mesh.push('M' + coord(face[start], width, height) + 'L' + coord(face[end], width, height));
      });
      contourOutline.forEach(function (start, index) {
        var end = contourOutline[(index + 1) % contourOutline.length];
        contours.push('M' + coord(face[start], width, height) + 'L' + coord(face[end], width, height));
      });
      appendEdges(eyes, face, Vision.FaceLandmarker.FACE_LANDMARKS_LEFT_EYE);
      appendEdges(eyes, face, Vision.FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE);
      appendEdges(irises, face, Vision.FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS);
      appendEdges(irises, face, Vision.FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS);
      appendEdges(mouths, face, Vision.FaceLandmarker.FACE_LANDMARKS_LIPS);
    });
    return {
      meshPath: mesh.join(''),
      contourPath: contours.join(''),
      eyePath: eyes.join(''),
      irisPath: irises.join(''),
      mouthPath: mouths.join('')
    };
  };
  window.processFrame = function (source) {
    if (!detector || busy) return;
    busy = true;
    var picture = new Image();
    picture.onload = function () {
      try {
        var faces = detector.detect(picture).faceLandmarks;
        var width = picture.naturalWidth;
        var height = picture.naturalHeight;
        var paths = coarsePaths(faces, width, height);
        send({ type: 'result', result: {
          faceCount: faces.length,
          width: width,
          height: height,
          meshPath: paths.meshPath,
          contourPath: paths.contourPath,
          eyePath: paths.eyePath,
          irisPath: paths.irisPath,
          mouthPath: paths.mouthPath
        }});
      } catch (error) {
        send({ type: 'error', message: '顔の解析に失敗しました: ' + String(error) });
      } finally {
        busy = false;
      }
    };
    picture.onerror = function () {
      busy = false;
      send({ type: 'error', message: '画像を読み込めませんでした' });
    };
    picture.src = source;
  };
  (async function () {
    try {
      var files = await Vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
      );
      detector = await Vision.FaceLandmarker.createFromOptions(files, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'CPU'
        },
        runningMode: 'IMAGE',
        numFaces: 2
      });
      send({ type: 'ready' });
    } catch (error) {
      send({ type: 'error', message: 'MediaPipe を読み込めません: ' + String(error) });
    }
  })();
})();
</script></body></html>`;

export default function FaceProcessor({ image, onReady, onResult, onError }: Props) {
  const webview = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready || !image) return;
    webview.current?.injectJavaScript(`window.processFrame(${JSON.stringify(image)}); true;`);
  }, [image, ready]);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      if (message.type === 'ready') {
        setReady(true);
        void onReady();
      } else if (message.type === 'result') {
        void onResult(message.result as FaceResult);
      } else if (message.type === 'error') {
        void onError(String(message.message));
      }
    } catch {
      void onError('解析結果を読み取れませんでした');
    }
  };

  return (
    <WebView
      ref={webview}
      source={{ html: HTML, baseUrl: 'https://localhost/' }}
      originWhitelist={['*']}
      javaScriptEnabled
      onMessage={handleMessage}
      onError={() => { void onError('解析用 WebView を開けませんでした'); }}
      scrollEnabled={false}
      style={styles.webview}
    />
  );
}

const styles = StyleSheet.create({
  webview: { width: 1, height: 1, position: 'absolute', left: 0, top: 0, backgroundColor: 'transparent' },
});
