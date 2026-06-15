import { renderHook, act } from '@testing-library/react-native';
import { useTimer } from '@/hooks/useTimer';

describe('useTimer', () => {
  let appStateCallback: ((state: string) => void) | null = null;
  let mockAppStateRemove: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAppStateRemove = jest.fn();

    // Capture the AppState callback so tests can trigger it
    const mockAppState = require('react-native').AppState;
    mockAppState.addEventListener.mockImplementation(
      (_: string, cb: (state: string) => void) => {
        appStateCallback = cb;
        return { remove: mockAppStateRemove };
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('should track elapsed time accurately during normal operation', () => {
    const { result } = renderHook(() => useTimer());

    act(() => {
      result.current.start();
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.seconds).toBe(0);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.seconds).toBe(3);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.seconds).toBe(5);
  });

  test('should pause interval when app goes to background', () => {
    const { result } = renderHook(() => useTimer());

    act(() => {
      result.current.start();
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.seconds).toBe(3);

    // Simulate app going to background
    act(() => {
      if (appStateCallback) {
        appStateCallback('background');
      }
    });

    // Check that interval has paused
    expect(result.current.isRunning).toBe(false);

    // Advance time while backgrounded
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Time should NOT have advanced while backgrounded
    expect(result.current.seconds).toBe(3);
  });

  test('should resume timer when app comes to foreground', () => {
    const { result } = renderHook(() => useTimer());

    act(() => {
      result.current.start();
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.seconds).toBe(3);

    // Go to background
    act(() => {
      if (appStateCallback) {
        appStateCallback('background');
      }
    });

    expect(result.current.isRunning).toBe(false);

    // Come back to foreground
    act(() => {
      if (appStateCallback) {
        appStateCallback('active');
      }
    });

    expect(result.current.isRunning).toBe(true);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.seconds).toBe(5);
  });

  test('should not resume if user manually paused before backgrounding', () => {
    const { result } = renderHook(() => useTimer());

    act(() => {
      result.current.start();
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.seconds).toBe(3);

    // User pauses manually
    act(() => {
      result.current.pause();
    });

    expect(result.current.isRunning).toBe(false);

    // Go to background
    act(() => {
      if (appStateCallback) {
        appStateCallback('background');
      }
    });

    // Come back to foreground
    act(() => {
      if (appStateCallback) {
        appStateCallback('active');
      }
    });

    // Should remain paused because user manually paused
    expect(result.current.isRunning).toBe(false);
  });

  test('should not accumulate background time in seconds count', () => {
    const { result } = renderHook(() => useTimer());

    act(() => {
      result.current.start();
    });

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.seconds).toBe(2);

    // Go to background
    act(() => {
      if (appStateCallback) {
        appStateCallback('background');
      }
    });

    // Simulate 10 seconds passing in background
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Resume
    act(() => {
      if (appStateCallback) {
        appStateCallback('active');
      }
    });

    // Total elapsed should still be 2 seconds (background time not counted)
    expect(result.current.seconds).toBe(2);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.seconds).toBe(5);
  });
});
