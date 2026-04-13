/** Global auto-mock for expo-audio. Prevents native module initialization errors in tests. */

export const createAudioPlayer = jest.fn(() => ({
  isLoaded: false,
  duration: null as number | null,
  play: jest.fn(),
  pause: jest.fn(),
  seekTo: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
}));

export const getRecordingPermissionsAsync = jest
  .fn()
  .mockResolvedValue({ status: "undetermined" });

export const requestRecordingPermissionsAsync = jest
  .fn()
  .mockResolvedValue({ status: "undetermined" });

export const setAudioModeAsync = jest.fn().mockResolvedValue(undefined);
