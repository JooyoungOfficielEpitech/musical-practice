# Musical Practice App

## Overview
Mobile musical practice app built with Expo/React Native for musical actors and students. Allows users to upload sheet music images, practice with metronome, track practice sessions, and view progress statistics.

## Architecture
- **Frontend**: Expo Router (file-based routing) with React Native
- **Backend**: Express.js (serving landing page and API endpoints)
- **State**: React Context (`PracticeProvider`) + AsyncStorage for local persistence
- **Networking**: React Query with `@/lib/query-client`

## Color Palette (Accessibility AA/AAA)
- Primary accent: `#49B6FF` (used for icons, highlights, non-text elements)
- Primary dark: `#0077CC` (used for buttons/CTAs with white text - passes WCAG AA 4.56:1)
- Background: `#F0F4F8`
- Secondary: `#A0C4FF`
- Gray midtone: `#E0E6ED`
- Surface: `#FFFFFF`
- Text: `#1A1D21` (dark)
- Success: `#1A8D3E`, Warning: `#B8860B`, Error: `#CC2D26` (all AA compliant with white)
- All colors defined in `constants/colors.ts`

## Key Files
- `app/(tabs)/` - 4 tab screens: Home, Library, Practice, Profile
- `app/practice-detail.tsx` - Individual score practice screen
- `lib/practice-context.tsx` - Global state provider
- `lib/storage.ts` - AsyncStorage persistence layer
- `components/` - Reusable components (SheetCard, StatCard, Metronome, PracticeTimer, EmptyState)
- `constants/colors.ts` - Theme colors

## Navigation Structure
- Bottom tab bar with 4 tabs (Home, Library, Practice, Profile)
- Stack navigation for practice-detail screen
- NativeTabs with liquid glass for iOS 26+, classic Tabs with BlurView fallback

## Features
- Sheet music library with image upload (gallery/camera)
- Practice mode with metronome (BPM 30-240) and timer
- Practice session tracking with accuracy scores
- Weekly practice chart and statistics
- Folder-based organization and search/filter
- Favorite scores
- Pro subscription UI

## Packages
- expo-image-picker (for sheet music upload)
- expo-haptics (tactile feedback)
- expo-image (optimized image rendering)
- @react-native-async-storage/async-storage (persistence)
- expo-crypto (ID generation, pinned to 15.0.x)
