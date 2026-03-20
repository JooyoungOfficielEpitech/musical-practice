# PLAN: Reference Track Sync + Volume Fix

**Status**: In Progress
**Last Updated**: 2026-03-18

## Overview
1. Reference track 재생이 pitch detection과 동기화 (시작/정지 함께)
2. LiveAudioStream의 `DuckOthers` 옵션으로 인한 볼륨 저하 문제 해결

## Phase 1: Reference Track ↔ Pitch Detection 동기화

### RED
- [x] `useAudioPlayer` play/pause/seekTo 동작 테스트 작성
- [x] Timer lifecycle 시뮬레이션 테스트 (start→play, stop→pause+seek(0))

### GREEN
- [x] `AudioPlayer` 컴포넌트에 `externalPlayer` prop 추가 (controlled mode)
- [x] `PracticeDetailScreen`에서 `useAudioPlayer` 직접 호출
- [x] `handleTimerStart`에서 `seekTo(0)` + `play()` 호출
- [x] `handleSessionStop`에서 `pause()` 호출

### Quality Gate
- [x] tsc --noEmit 통과
- [x] 71개 integration tests 통과

## Phase 2: 볼륨 Ducking 해결

### 원인 분석
- `AVAudioSessionCategoryOptionDuckOthers`: iOS가 다른 오디오 볼륨을 자동 감소
- `AVAudioSessionModeVoiceChat`: 음성 통화 최적화 (음악에 부적합)

### GREEN
- [x] 네이티브 패치: `DuckOthers` → `DefaultToSpeaker`
- [x] 네이티브 패치: `VoiceChat` → `Default`
- [x] `setActive:YES` 유지 (오디오 세션 활성화)
- [x] patch-package 재생성

### Quality Gate
- [x] tsc --noEmit 통과
- [x] 71개 integration tests 통과
- [ ] `npx expo run:ios` 네이티브 리빌드 후 실기기 검증 필요

## Phase 3: 실기기 검증 (사용자)
- [ ] `npx expo run:ios`로 리빌드
- [ ] Timer 시작 → reference track 자동 재생 확인
- [ ] Timer 정지 → reference track 자동 정지 확인
- [ ] 볼륨 ducking 없이 원본 볼륨 유지 확인
- [ ] 녹음 정상 동작 확인 (0 chunks 아님)
