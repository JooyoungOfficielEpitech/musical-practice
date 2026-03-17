module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|@supabase/.*|pitchy|react-native-live-audio-stream)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/client/$1",
  },
  testMatch: ["**/__tests__/**/*.test.(ts|tsx)"],
};
