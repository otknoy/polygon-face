import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCameraPermissions, type CameraType } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import LiveFaceCamera from '@/components/live-face-camera';

const accent = '#F7D47A';
const coral = '#E66B59';

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
      <Text style={styles.logo}>▦</Text>
      <Text style={styles.introTitle}>POLYGON FACE</Text>
      <Text style={styles.introText}>カメラで表情を検出し、8 ビットゲーム風の画面にローポリゴンの顔を映します。画像は端末内で処理します。</Text>
      <Pressable style={styles.start} onPress={requestPermission}><Text style={styles.startText}>▶  スタート</Text></Pressable>
      {!permission.canAskAgain && <Text style={styles.hint}>端末の設定からカメラへのアクセスを許可してください。</Text>}
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <View><Text style={styles.eyebrow}>STAGE 01  /  FACE BOSS</Text><Text style={styles.title}>POLYGON<Text style={styles.titleAccent}> FACE</Text></Text></View>
        <View style={styles.pill}><View style={styles.dot} /><Text style={styles.pillText}>{frozen ? 'PAUSE' : 'LIVE'}</Text></View>
      </View>
      <View style={styles.preview}>
        <LiveFaceCamera facing={facing} frozen={frozen} onStatus={handleStatus} onFaceCount={handleFaceCount} />
        <View style={styles.bossHud} pointerEvents="none">
          <View style={styles.bossLine}><Text style={styles.bossLabel}>BOSS SIGNAL</Text><Text style={styles.bossLabel}>{faceCount ? 'LOCK ON!' : 'SEARCH...'}</Text></View>
          <View style={styles.healthTrack}>{Array.from({ length: 10 }, (_, index) => (
            <View key={index} style={[styles.healthSegment, index < (faceCount ? 8 : 2) && styles.healthSegmentOn]} />
          ))}</View>
        </View>
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
          }}><Text style={styles.buttonLetter}>B</Text><Text style={styles.buttonHint}>FLIP</Text></Pressable>
          <Pressable style={styles.shutter} accessibilityLabel={frozen ? '映像を再開' : '映像を一時停止'} onPress={() => setFrozen(value => !value)}><View style={[styles.shutterCore, frozen && styles.shutterStop]}><Text style={styles.shutterLetter}>A</Text></View></Pressable>
          <View style={styles.smallButton}><Text style={styles.count}>{faceCount}</Text><Text style={styles.buttonHint}>FACE</Text></View>
        </View>
        <Text style={styles.footer}>OPEN MOUTH: FIRE x5   A: PAUSE   B: FLIP</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A1024' },
  preview: { flex: 1, overflow: 'hidden', borderTopWidth: 3, borderBottomWidth: 3, borderColor: '#7A83AA' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#0A1024' },
  eyebrow: { color: accent, fontFamily: 'monospace', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 7 },
  title: { color: '#FFF0BA', fontFamily: 'monospace', fontSize: 23, fontWeight: '900', letterSpacing: -1 },
  titleAccent: { color: coral },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, borderWidth: 2, borderColor: '#7A83AA', paddingHorizontal: 8, paddingVertical: 6 },
  pillText: { color: '#FFF0BA', fontFamily: 'monospace', fontSize: 10, fontWeight: '700' },
  dot: { width: 7, height: 7, backgroundColor: coral },
  bossHud: { position: 'absolute', top: 17, left: 18, right: 18 },
  bossLine: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 7 },
  bossLabel: { color: '#FFF0BA', fontFamily: 'monospace', fontSize: 10, fontWeight: '800' },
  healthTrack: { flexDirection: 'row', height: 14, gap: 3, borderWidth: 2, borderColor: '#7A83AA', backgroundColor: '#0A1024', padding: 2 },
  healthSegment: { flex: 1, backgroundColor: '#303653' },
  healthSegmentOn: { backgroundColor: coral },
  guide: { position: 'absolute', top: '17%', left: '8%', width: '84%', height: '69%' },
  corner: { position: 'absolute', width: 19, height: 19, borderColor: '#F7D47A' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  bottom: { backgroundColor: '#0A1024', paddingTop: 15, paddingBottom: 12, paddingHorizontal: 20 },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  statusText: { color: '#FFF0BA', fontFamily: 'monospace', fontSize: 11 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 14 },
  smallButton: { width: 64, height: 58, borderWidth: 3, borderColor: '#7A83AA', backgroundColor: '#252C4B', justifyContent: 'center', alignItems: 'center' },
  buttonLetter: { color: '#FFF0BA', fontFamily: 'monospace', fontSize: 19, fontWeight: '900' },
  buttonHint: { color: '#BFC5DF', fontFamily: 'monospace', fontSize: 9, fontWeight: '700' },
  count: { color: accent, fontFamily: 'monospace', fontSize: 20, fontWeight: '900' },
  shutter: { width: 76, height: 76, borderWidth: 3, borderColor: accent, alignItems: 'center', justifyContent: 'center' },
  shutterCore: { width: 58, height: 58, backgroundColor: accent, justifyContent: 'center', alignItems: 'center' },
  shutterStop: { backgroundColor: coral },
  shutterLetter: { color: '#17172C', fontFamily: 'monospace', fontSize: 24, fontWeight: '900' },
  footer: { color: '#8F9ABB', textAlign: 'center', fontFamily: 'monospace', fontSize: 9 },
  permission: { flex: 1, backgroundColor: '#0A1024', justifyContent: 'center', paddingHorizontal: 34 },
  logo: { color: accent, fontSize: 54, marginBottom: 44 },
  introTitle: { color: '#FFF0BA', fontFamily: 'monospace', fontSize: 30, fontWeight: '800', marginBottom: 17 },
  introText: { color: '#BFC5DF', fontSize: 15, lineHeight: 26, marginBottom: 42 },
  start: { backgroundColor: accent, borderWidth: 3, borderColor: '#FFF0BA', paddingVertical: 17, alignItems: 'center' },
  startText: { color: '#17172C', fontFamily: 'monospace', fontSize: 16, fontWeight: '800' },
  hint: { color: '#BFC5DF', fontSize: 12, marginTop: 18 },
});
