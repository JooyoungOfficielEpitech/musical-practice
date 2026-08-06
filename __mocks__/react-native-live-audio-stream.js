/**
 * Global jest mock for react-native-live-audio-stream — the real module builds
 * a NativeEventEmitter at import time, which crashes in the jest environment.
 */
const listeners = new Map();

module.exports = {
  __esModule: true,
  default: {
    init: jest.fn(),
    start: jest.fn(),
    stop: jest.fn(),
    on: jest.fn((event, cb) => {
      listeners.set(event, cb);
      return { remove: jest.fn(() => listeners.delete(event)) };
    }),
  },
};
