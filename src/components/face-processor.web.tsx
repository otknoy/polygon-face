'use dom';

import { useEffect, useRef } from 'react';
import type { FaceLandmarker as FaceLandmarkerType } from '@mediapipe/tasks-vision';
import type { DOMProps } from 'expo/dom';

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
  dom?: DOMProps;
};

type VisionModule = typeof import('@mediapipe/tasks-vision');
let visionPromise: Promise<VisionModule> | null = null;
let detectorPromise: Promise<FaceLandmarkerType> | null = null;
// In development the DOM document lives at /_expo/@dom while public files live at /.
const assetBase = `${typeof window !== 'undefined' && window.location.pathname.startsWith('/_expo/@dom')
  ? '/'
  : (process.env.EXPO_BASE_URL ?? '/') }mediapipe/`;
const remoteBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/';
const remoteModel = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

function loadVisionScript(source: string) {
  return new Promise<VisionModule>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = source;
    script.onload = () => {
      const vision = (window as typeof window & { Vision?: VisionModule }).Vision;
      if (vision) resolve(vision);
      else reject(new Error('MediaPipe bundle unavailable'));
    };
    script.onerror = () => reject(new Error('MediaPipe bundle failed to load'));
    document.head.appendChild(script);
  });
}

function getVision() {
  visionPromise ??= loadVisionScript(`${assetBase}vision_bundle.js`)
    .catch(() => loadVisionScript(`${remoteBase}vision_bundle.js`));
  return visionPromise;
}

function getDetector() {
  detectorPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await getVision();
    const create = async (wasmPath: string, modelPath: string) => {
      const files = await FilesetResolver.forVisionTasks(wasmPath);
      return FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' },
        runningMode: 'IMAGE',
        numFaces: 2,
      });
    };
    try {
      return await create(`${assetBase}wasm`, `${assetBase}face_landmarker.task`);
    } catch {
      return create(`${remoteBase}wasm`, remoteModel);
    }
  })();
  return detectorPromise;
}

function buildPaths(faces: ReturnType<FaceLandmarkerType['detect']>['faceLandmarks'], width: number, height: number, vision: VisionModule) {
  const coordinate = (point: { x: number; y: number }) =>
    `${(point.x * width).toFixed(1)} ${(point.y * height).toFixed(1)}`;
  const mesh: string[] = [];
  const contours: string[] = [];
  const eyes: string[] = [];
  const irises: string[] = [];
  const mouths: string[] = [];
  const oval = vision.FaceLandmarker.FACE_LANDMARKS_FACE_OVAL;
  const appendEdges = (
    parts: string[],
    face: ReturnType<FaceLandmarkerType['detect']>['faceLandmarks'][number],
    connections: { start: number; end: number }[],
  ) => {
    for (const edge of connections) {
      const start = face[edge.start];
      const end = face[edge.end];
      if (start && end) parts.push(`M${coordinate(start)}L${coordinate(end)}`);
    }
  };
  for (const face of faces) {
    const outline = oval.filter((_, index) => index % 3 === 0).map(edge => edge.start);
    const contourOutline = oval.filter((_, index) => index % 2 === 0).map(edge => edge.start);
    const xs = outline.map(index => face[index].x);
    const ys = outline.map(index => face[index].y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const anchors = [...outline];
    const seenAnchors = new Set(anchors);
    const columns = 6;
    const rows = 8;
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const left = minX + (maxX - minX) * column / columns;
        const right = minX + (maxX - minX) * (column + 1) / columns;
        const top = minY + (maxY - minY) * row / rows;
        const bottom = minY + (maxY - minY) * (row + 1) / rows;
        const centerX = (left + right) / 2;
        const centerY = (top + bottom) / 2;
        let best = -1;
        let distance = Infinity;
        for (let index = 0; index < Math.min(face.length, 468); index++) {
          const point = face[index];
          if (point.x < left || point.x >= right || point.y < top || point.y >= bottom) continue;
          const score = (point.x - centerX) ** 2 + (point.y - centerY) ** 2;
          if (score < distance) { best = index; distance = score; }
        }
        if (best >= 0 && !seenAnchors.has(best)) {
          anchors.push(best);
          seenAnchors.add(best);
        }
      }
    }
    const nearest = face.map(point => {
      let best = anchors[0];
      let distance = Infinity;
      for (const index of anchors) {
        const anchor = face[index];
        const score = (point.x - anchor.x) ** 2 + (point.y - anchor.y) ** 2;
        if (score < distance) { best = index; distance = score; }
      }
      return best;
    });
    const usedEdges = new Set<string>();
    for (const edge of vision.FaceLandmarker.FACE_LANDMARKS_TESSELATION) {
      const start = nearest[edge.start];
      const end = nearest[edge.end];
      if (start === end || start == null || end == null) continue;
      const key = `${Math.min(start, end)}:${Math.max(start, end)}`;
      if (usedEdges.has(key)) continue;
      usedEdges.add(key);
      mesh.push(`M${coordinate(face[start])}L${coordinate(face[end])}`);
    }
    for (let index = 0; index < contourOutline.length; index++) {
      const start = face[contourOutline[index]];
      const end = face[contourOutline[(index + 1) % contourOutline.length]];
      contours.push(`M${coordinate(start)}L${coordinate(end)}`);
    }
    appendEdges(eyes, face, vision.FaceLandmarker.FACE_LANDMARKS_LEFT_EYE);
    appendEdges(eyes, face, vision.FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE);
    appendEdges(irises, face, vision.FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS);
    appendEdges(irises, face, vision.FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS);
    appendEdges(mouths, face, vision.FaceLandmarker.FACE_LANDMARKS_LIPS);
  }
  return {
    meshPath: mesh.join(''),
    contourPath: contours.join(''),
    eyePath: eyes.join(''),
    irisPath: irises.join(''),
    mouthPath: mouths.join(''),
  };
}

export default function FaceProcessor({ image, onReady, onResult, onError }: Props) {
  const callbacks = useRef({ onReady, onResult, onError });
  useEffect(() => {
    callbacks.current = { onReady, onResult, onError };
  });

  useEffect(() => {
    let mounted = true;
    getDetector().then(() => {
      if (mounted) void callbacks.current.onReady();
    }).catch((error: unknown) => {
      detectorPromise = null;
      visionPromise = null;
      if (mounted) void callbacks.current.onError(
        `MediaPipe を読み込めません: ${error instanceof Error ? error.message : '不明なエラー'}`,
      );
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    const picture = new window.Image();
    picture.onload = async () => {
      try {
        const detector = await getDetector();
        if (cancelled) return;
        const faces = detector.detect(picture).faceLandmarks;
        const paths = buildPaths(faces, picture.naturalWidth, picture.naturalHeight, await getVision());
        await callbacks.current.onResult({
          faceCount: faces.length,
          width: picture.naturalWidth,
          height: picture.naturalHeight,
          ...paths,
        });
      } catch (error) {
        if (!cancelled) await callbacks.current.onError(
          `顔の解析に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`,
        );
      }
    };
    picture.onerror = () => { if (!cancelled) void callbacks.current.onError('画像を読み込めませんでした'); };
    picture.src = image;
    return () => { cancelled = true; };
  }, [image]);

  return <div />;
}
