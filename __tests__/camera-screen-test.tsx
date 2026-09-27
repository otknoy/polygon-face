import { fireEvent, render, screen } from '@testing-library/react-native';
import { useCameraPermissions } from 'expo-camera';

import CameraScreen from '@/components/camera-screen';

jest.mock('expo-camera', () => ({
  useCameraPermissions: jest.fn(),
}));

jest.mock('@/components/live-face-camera', () => {
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return function MockLiveFaceCamera({ facing, frozen, onFaceCount }: {
    facing: string;
    frozen: boolean;
    onFaceCount: (count: number) => void;
  }) {
    return (
      <Pressable accessibilityLabel="顔を検出" onPress={() => onFaceCount(1)}>
        <Text testID="camera-state">{facing}:{frozen ? 'paused' : 'live'}</Text>
      </Pressable>
    );
  };
});

const mockPermissions = jest.mocked(useCameraPermissions);
const requestPermission = jest.fn();
type CameraPermission = NonNullable<ReturnType<typeof useCameraPermissions>[0]>;

function setPermission(granted: boolean, canAskAgain = true) {
  const permission = { granted, canAskAgain } as CameraPermission;
  mockPermissions.mockReturnValue([permission, requestPermission, jest.fn()]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('カメラ権限を要求できる', async () => {
  setPermission(false);

  await render(<CameraScreen />);
  await fireEvent.press(screen.getByText(/スタート/));

  expect(requestPermission).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/端末の設定から/)).toBeNull();
});

test('再要求できない場合は設定の案内を表示する', async () => {
  setPermission(false, false);

  await render(<CameraScreen />);

  expect(screen.getByText(/端末の設定からカメラへのアクセスを許可/)).toBeTruthy();
});

test('停止中はカメラを切り替えず、再開後は切り替えられる', async () => {
  setPermission(true);

  await render(<CameraScreen />);
  expect(screen.getByText('front:live')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('顔を検出'));
  expect(screen.getByText('LOCK ON!')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('映像を一時停止'));
  expect(screen.getByText('front:paused')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('カメラを切り替え'));
  expect(screen.getByText('front:paused')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('映像を再開'));
  await fireEvent.press(screen.getByLabelText('カメラを切り替え'));
  expect(screen.getByText('back:live')).toBeTruthy();
  expect(screen.getByText('SEARCH...')).toBeTruthy();
});
