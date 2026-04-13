/**
 * Manual mock for react-native-reanimated.
 * Bypasses native worklets initialization which requires a running native module.
 */
const React = require("react");
const { View } = require("react-native");

const stub = () => {};
const noop = () => ({ remove: stub });

module.exports = {
  __esModule: true,
  default: {
    View,
    Text: View,
    Image: View,
    ScrollView: View,
    FlatList: View,
    createAnimatedComponent: (Component) => Component,
  },
  Animated: {
    View,
    Text: View,
    Image: View,
    ScrollView: View,
    FlatList: View,
    createAnimatedComponent: (Component) => Component,
  },
  useSharedValue: (init) => ({ value: init }),
  useAnimatedStyle: (fn) => ({}),
  useAnimatedScrollHandler: () => stub,
  useAnimatedRef: () => ({ current: null }),
  useDerivedValue: (fn) => ({ value: fn() }),
  useAnimatedGestureHandler: () => stub,
  useAnimatedProps: (fn) => ({}),
  useAnimatedReaction: stub,
  withSpring: (val) => val,
  withTiming: (val) => val,
  withDecay: (val) => val,
  withDelay: (_, val) => val,
  withSequence: (...vals) => vals[vals.length - 1],
  withRepeat: (val) => val,
  interpolate: (val, input, output) => output[0],
  Extrapolate: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
  Easing: {
    linear: (t) => t,
    ease: (t) => t,
    inOut: (fn) => fn,
    out: (fn) => fn,
    in: (fn) => fn,
    bezier: () => (t) => t,
    poly: () => (t) => t,
    exp: (t) => t,
    circle: (t) => t,
    elastic: () => (t) => t,
    bounce: (t) => t,
    back: () => (t) => t,
  },
  useEvent: () => stub,
  addWhitelistedNativeProps: stub,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  cancelAnimation: stub,
  measure: () => ({}),
  scrollTo: stub,
  FadeIn: { duration: () => FadeIn },
  FadeOut: { duration: () => FadeOut },
  Layout: { duration: () => Layout },
  SlideInLeft: {},
  SlideOutRight: {},
  createAnimatedComponent: (Component) => Component,
};
