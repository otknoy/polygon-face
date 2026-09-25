import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCameraPermissions, type CameraType } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import LiveFaceCamera from '@/components/live-face-camera';

const lime = '#CCFF65';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('front');
  const [frozen, setFrozen] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [message, setMessage] = useState('カメラを起動中');
  const handleStatus = useCallback((next: string) => setMessage(next), []);
  const handleFaceCount = useCallback((count: number) => setFaceCount(count), []);

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
        <View style={styles.pill}><View style={styles.dot} /><Text style={styles.pillText}>{frozen ? 'STILL' : 'LIVE'}</Text></View>
      </View>
      <View style={styles.preview}>
        <LiveFaceCamera facing={facing} frozen={frozen} onStatus={handleStatus} onFaceCount={handleFaceCount} />
        <View style={styles.guide} pointerEvents="none">
          <View style={[styles.corner, styles.tl]} /><View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} /><View style={[styles.corner, styles.br]} />
        </View>
      </View>
      <View style={styles.bottom}>
        <View style={styles.status}><View style={styles.dot} /><Text style={styles.statusText}>{frozen ? '映像を一時停止中' : message}</Text></View>
        <View style={styles.controls}>
          <Pressable style={styles.smallButton} disabled={frozen} accessibilityLabel="カメラを切り替え" onPress={() => {
            setFaceCount(0);
            setFacing(value => value === 'front' ? 'back' : 'front');
          }}><Text style={styles.flip}>↻</Text></Pressable>
          <Pressable style={styles.shutter} accessibilityLabel={frozen ? '映像を再開' : '映像を一時停止'} onPress={() => setFrozen(value => !value)}><View style={[styles.shutterCore, frozen && styles.shutterStop]} /></Pressable>
          <View style={styles.smallButton}><Text style={styles.count}>{faceCount}<Text style={styles.countLabel}> FACE</Text></Text></View>
        </View>
        <Text style={styles.footer}>MEDIAPIPE  ·  ON DEVICE FACE LANDMARKS</Text>
      </View>
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
