import { memo, useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { ImageManipulator } from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import FaceProcessor, { type FaceResult } from '@/components/face-processor';

const lime = '#CCFF65';

const CameraPreview = memo(function CameraPreview({
  camera,
  facing,
  onReady,
  onError,
}: {
  camera: RefObject<CameraView | null>;
  facing: CameraType;
  onReady: () => void;
  onError: () => void;
}) {
  return (
    <CameraView
      ref={camera}
      style={StyleSheet.absoluteFill}
      facing={facing}
      mirror={facing === 'front'}
      animateShutter={false}
      onCameraReady={onReady}
      onMountError={onError}
    />
  );
});

export default function CameraScreen() {
  const camera = useRef<CameraView>(null);
  const cameraReady = useRef(false);
  const processorReady = useRef(false);
  const processing = useRef(false);
  const processingStartedAt = useRef(0);
  const lastFaceAt = useRef(0);
  const frozen = useRef(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [frame, setFrame] = useState<string | null>(null);
  const [result, setResult] = useState<FaceResult | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState('MediaPipe を読み込み中');
  const handleCameraReady = useCallback(() => { cameraReady.current = true; }, []);
  const handleCameraError = useCallback(() => { setMessage('カメラを起動できません'); }, []);

  const scan = useCallback(async () => {
    if (processing.current && Date.now() - processingStartedAt.current > 5000) {
      processing.current = false;
    }
    if (!cameraReady.current || !processorReady.current || processing.current || frozen.current) return;
    processing.current = true;
    processingStartedAt.current = Date.now();
    try {
      const image = await camera.current?.takePictureAsync({ quality: 0.35, shutterSound: false });
      if (!image?.uri) {
        processing.current = false;
        return;
      }
      const resized = await ImageManipulator.manipulate(image.uri)
        .resize({ width: 360, height: null })
        .renderAsync();
      const compact = await resized.saveAsync({ base64: true, compress: 0.55 });
      if (compact.base64) setFrame(`data:image/jpeg;base64,${compact.base64}`);
      else processing.current = false;
    } catch {
      processing.current = false;
      setMessage('カメラのフレームを取得できません');
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(scan, 750);
    return () => clearInterval(timer);
  }, [scan]);

  const handleResult = useCallback(async (next: FaceResult) => {
    processing.current = false;
    if (next.faceCount > 0) {
      lastFaceAt.current = Date.now();
      setResult(next);
    } else if (Date.now() - lastFaceAt.current > 1500) {
      setResult(next);
    }
    if (!frozen.current) setMessage(next.faceCount ? `${next.faceCount} 人の顔を検出中` : '顔をフレーム内に入れてください');
  }, []);

  const handleReady = useCallback(async () => {
    processorReady.current = true;
    setMessage('顔をフレーム内に入れてください');
  }, []);

  const handleError = useCallback(async (error: string) => {
    processing.current = false;
    setMessage(error);
  }, []);

  const toggleCapture = async () => {
    if (frozen.current) {
      frozen.current = false;
      setPhoto(null);
      return;
    }
    try {
      frozen.current = true;
      const image = await camera.current?.takePictureAsync({ quality: 0.9, shutterSound: false });
      if (image?.uri) {
        const resized = await ImageManipulator.manipulate(image.uri)
          .resize({ width: 360, height: null })
          .renderAsync();
        const compact = await resized.saveAsync({ base64: true, compress: 0.65 });
        if (compact.base64) setFrame(`data:image/jpeg;base64,${compact.base64}`);
        frozen.current = true;
        setPhoto(image.uri);
        setMessage('撮影したフレーム');
      } else {
        frozen.current = false;
      }
    } catch {
      frozen.current = false;
      setMessage('撮影できませんでした');
    }
  };

  if (!permission) return <View style={styles.root} />;
  if (!permission.granted) return (
    <SafeAreaView style={styles.permission}>
      <Text style={styles.logo}>◈</Text>
      <Text style={styles.introTitle}>顔を、ポリゴンに。</Text>
      <Text style={styles.introText}>カメラの映像から顔の形を検出し、ポリゴンメッシュで描画します。画像は端末内で処理します。</Text>
      <Pressable style={styles.start} onPress={requestPermission}><Text style={styles.startText}>カメラをはじめる  ↗</Text></Pressable>
      {!permission.canAskAgain && <Text style={styles.hint}>端末の設定からカメラへのアクセスを許可してください。</Text>}
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <View><Text style={styles.eyebrow}>LIVE FACE MESH</Text><Text style={styles.title}>POLYGON<Text style={styles.titleAccent}> / FACE</Text></Text></View>
        <View style={styles.pill}><View style={styles.dot} /><Text style={styles.pillText}>{photo ? 'STILL' : 'LIVE'}</Text></View>
      </View>
      <View style={styles.preview}>
        <CameraPreview
          camera={camera}
          facing={facing}
          onReady={handleCameraReady}
          onError={handleCameraError}
        />
        {photo && <Image source={{ uri: photo }} resizeMode="cover" style={StyleSheet.absoluteFill} />}
        {!!result?.meshPath && (
          <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${result.width} ${result.height}`} preserveAspectRatio="xMidYMid slice" pointerEvents="none">
            <Path d={result.meshPath} stroke={lime} strokeWidth={1.25} strokeOpacity={0.85} fill="none" />
            <Path d={result.contourPath} stroke="#fff" strokeWidth={2.6} strokeOpacity={0.96} fill="none" />
            <Path d={result.eyePath} stroke={lime} strokeWidth={2.5} fill="none" />
            <Path d={result.irisPath} stroke="#fff" strokeWidth={1.8} fill="none" />
            <Path d={result.mouthPath} stroke="#fff" strokeWidth={1.4} strokeOpacity={0.8} fill="none" />
          </Svg>
        )}
        <View style={styles.guide} pointerEvents="none">
          <View style={[styles.corner, styles.tl]} /><View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} /><View style={[styles.corner, styles.br]} />
        </View>
      </View>
      <View style={styles.bottom}>
        <View style={styles.status}><View style={styles.dot} /><Text style={styles.statusText}>{message}</Text></View>
        <View style={styles.controls}>
          <Pressable style={styles.smallButton} disabled={!!photo} accessibilityLabel="カメラを切り替え" onPress={() => {
            cameraReady.current = false;
            setResult(null);
            setFacing(value => value === 'front' ? 'back' : 'front');
          }}><Text style={styles.flip}>↻</Text></Pressable>
          <Pressable style={styles.shutter} accessibilityLabel={photo ? '撮影を再開' : '撮影'} onPress={toggleCapture}><View style={[styles.shutterCore, !!photo && styles.shutterStop]} /></Pressable>
          <View style={styles.smallButton}><Text style={styles.count}>{result?.faceCount ?? 0}<Text style={styles.countLabel}> FACE</Text></Text></View>
        </View>
        <Text style={styles.footer}>MEDIAPIPE  ·  ON DEVICE FACE LANDMARKS</Text>
      </View>
      <FaceProcessor
        image={frame}
        onReady={handleReady}
        onResult={handleResult}
        onError={handleError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101310' },
  preview: { flex: 1, overflow: 'hidden' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 26, paddingVertical: 16 },
  eyebrow: { color: lime, fontSize: 10, fontWeight: '700', letterSpacing: 3, marginBottom: 7 },
  title: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -1.3 },
  titleAccent: { color: lime, fontWeight: '300' },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, borderWidth: 1, borderColor: '#FFFFFF55', borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 },
  pillText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: lime },
  guide: { position: 'absolute', top: '12%', left: '10%', width: '80%', height: '76%' },
  corner: { position: 'absolute', width: 23, height: 23, borderColor: '#FFFFFFB5' },
  tl: { top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1 },
  tr: { top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1 },
  br: { bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1 },
  bottom: { backgroundColor: '#101310', paddingTop: 16, paddingBottom: 12, paddingHorizontal: 26 },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusText: { color: '#DEE6DA', fontSize: 12, letterSpacing: 0.5 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 23, marginBottom: 17 },
  smallButton: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFFFFF1F', justifyContent: 'center', alignItems: 'center' },
  flip: { color: '#fff', fontSize: 27, lineHeight: 30 },
  count: { color: lime, fontSize: 15, fontWeight: '700' },
  countLabel: { color: '#fff', fontSize: 8 },
  shutter: { width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterCore: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff' },
  shutterStop: { width: 24, height: 24, borderRadius: 4, backgroundColor: lime },
  footer: { color: '#FFFFFF77', textAlign: 'center', fontSize: 9, letterSpacing: 1.7 },
  permission: { flex: 1, backgroundColor: '#101310', justifyContent: 'center', paddingHorizontal: 34 },
  logo: { color: lime, fontSize: 54, marginBottom: 44 },
  introTitle: { color: '#fff', fontSize: 32, fontWeight: '800', marginBottom: 17 },
  introText: { color: '#ADB8A8', fontSize: 15, lineHeight: 26, marginBottom: 42 },
  start: { backgroundColor: lime, paddingVertical: 19, alignItems: 'center' },
  startText: { color: '#101310', fontSize: 15, fontWeight: '800' },
  hint: { color: '#ADB8A8', fontSize: 12, marginTop: 18 },
});
