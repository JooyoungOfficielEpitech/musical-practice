/**
 * Manual mock for react-native-gesture-handler.
 * Bypasses native gesture handler initialization in tests.
 */
const React = require("react");
const { View } = require("react-native");

const stub = () => {};
const createGesture = () => ({
  numberOfTaps: () => createGesture(),
  onEnd: () => createGesture(),
  onStart: () => createGesture(),
  onUpdate: () => createGesture(),
  onFinalize: () => createGesture(),
  enabled: () => createGesture(),
  simultaneousWithExternalGesture: () => createGesture(),
  requireExternalGestureToFail: () => createGesture(),
});

module.exports = {
  __esModule: true,
  GestureDetector: ({ children }) => children,
  GestureHandlerRootView: View,
  Gesture: {
    Tap: createGesture,
    Pan: createGesture,
    Pinch: createGesture,
    Rotation: createGesture,
    Fling: createGesture,
    LongPress: createGesture,
    Simultaneous: createGesture,
    Race: createGesture,
    Exclusive: createGesture,
  },
  State: {
    UNDETERMINED: 0,
    FAILED: 1,
    BEGAN: 2,
    CANCELLED: 3,
    ACTIVE: 4,
    END: 5,
  },
  Directions: {
    RIGHT: 1,
    LEFT: 2,
    UP: 4,
    DOWN: 8,
  },
  PanGestureHandler: View,
  TapGestureHandler: View,
  PinchGestureHandler: View,
  RotationGestureHandler: View,
  FlingGestureHandler: View,
  LongPressGestureHandler: View,
  ScrollView: View,
  FlatList: View,
  Switch: View,
  TextInput: View,
  DrawerLayoutAndroid: View,
  TouchableHighlight: View,
  TouchableNativeFeedback: View,
  TouchableOpacity: View,
  TouchableWithoutFeedback: View,
};
