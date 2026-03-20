module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|@supabase/.*|pitchy|react-native-live-audio-stream)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/client/$1",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js",
  },
  setupFiles: [
    "./node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js",
  ],
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
};
