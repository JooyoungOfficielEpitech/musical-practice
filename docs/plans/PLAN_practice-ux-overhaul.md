# Implementation Plan: Practice UX Overhaul + Volume Fix + Dynamic Staff

**Status**: In Progress
**Started**: 2026-03-18
**Last Updated**: 2026-03-18
**Estimated Completion**: 2026-03-18

---

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. Check off completed task checkboxes
2. Run all quality gate validation commands
3. Verify ALL quality gate items pass
4. Update "Last Updated" date above
5. Document learnings in Notes section
6. Only then proceed to next phase

**DO NOT skip quality gates or proceed with failing checks**

---

## Overview

### Feature Description
3가지 문제 해결:
1. **볼륨 드롭**: 피치 감지 시 iOS에서 MR 볼륨 감소 (`interruptionModeIOS: 1` → `0`)
2. **오선지 하드코딩**: E4-F5 고정 범위 → 유저가 오선지에서 직접 옥타브 범위 조절 + 자동 확장
3. **분산된 컨트롤**: 타이머/피치감지/메트로놈 3개 카드 → 통합 Practice Session 카드

### Success Criteria
- [ ] iOS에서 MR + 피치 감지 동시 사용 시 볼륨 유지
- [ ] 오선지에서 ◄► 버튼으로 옥타브 범위 즉시 변경 가능
- [ ] 범위 밖 음 감지 시 자동 확장
- [ ] PracticeScreen: 단일 Start/Stop으로 타이머+피치 동시 제어
- [ ] PracticeDetailScreen: 동일 통합 패턴 적용
- [ ] 메트로놈: collapsible 토글
- [ ] 모든 터치 타겟 >= 44dp
- [ ] 모든 인터랙티브 요소에 accessibilityLabel
- [ ] 빈 상태(empty state) 표시
- [ ] Android ripple 효과
- [ ] 모든 기존 + 새 테스트 통과

### UI/UX Audit Integration (P0→P1→P2)
감사 결과 14개 이슈를 Phase별로 통합:
- **P0** (Phase 2): 터치 타겟, a11y 라벨, 에러 상태
- **P1** (Phase 3): 빈 상태, 햅틱, Android ripple
- **P2** (Phase 3): 상태 전환 애니메이션

### User Impact
연습 시 하나의 버튼으로 세션 시작/종료, MR과 피치 감지 동시 사용 가능, 본인 악기/음역에 맞는 오선보 범위 설정

---

## Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| `interruptionModeIOS: 0` (MixWithOthers) | PlayAndRecord + MixWithOthers는 음악 앱 표준 | 다른 앱 오디오도 믹싱될 수 있음 |
| 동적 오선보 (범위 기반) | 8va/8vb 전치 제거, 직관적 표시 | staffMapping 리팩터링 필요 |
| 옥타브 범위 = 컴포넌트 내부 state | 악보/설정 의존 없이 즉시 조절 | 세션 간 범위 유지 안됨 (추후 개선 가능) |
| `onToggle` optional → 패시브 모드 | 통합 UI에서 독립 토글 불필요 | PracticeDetailScreen도 함께 변경 필요 |

---

## Dependencies

### Required Before Starting
- [x] 기존 237 테스트 모두 통과
- [x] `expo-av` Audio.setAudioModeAsync API 확인
- [x] react-native-svg 사용 중 확인

### External Dependencies
- expo-av: Audio session management (기존)
- react-native-svg: Staff rendering (기존)
- 새 의존성 없음

---

## Test Strategy

### Testing Approach
**TDD Principle**: Write tests FIRST, then implement to make them pass

### Test Pyramid for This Feature
| Test Type | Coverage Target | Purpose |
|-----------|-----------------|---------|
| **Unit Tests** | >=80% | `noteToStaffYDynamic`, 범위 매핑, 자동 확장 |
| **Component Tests** | Critical paths | MusicalStaff 옥타브 스위처, 패시브 모드 |
| **Integration** | Screen flows | PracticeScreen/PracticeDetailScreen 통합 동작 |

### Test File Organization
```
__tests__/
├── unit/audio/
│   └── staffMapping.test.ts        ← 동적 매핑 테스트 추가
└── components/
    └── MusicalStaff.test.tsx        ← 옥타브 스위처 + 패시브 모드 테스트
```

---

## Implementation Phases

### Phase 1: Volume Fix + staffMapping 리팩터링
**Goal**: iOS 볼륨 드롭 해결 + 동적 범위 기반 오선보 매핑 함수 구현
**Estimated Time**: 2 hours
**Status**: Pending

#### Tasks

**RED: Write Failing Tests First**
- [ ] **Test 1.1**: `staffMapping.test.ts`에 `noteToStaffYDynamic` 테스트 추가
  - File: `__tests__/unit/audio/staffMapping.test.ts`
  - Test cases:
    - 범위 3~5에서 C3 = 최하단, B5 = 최상단
    - 범위 4~4에서 C4~B4가 오선보 내에 위치
    - 높은 음 → 낮은 Y값 (SVG convention 유지)
    - `outOfRange: true` for 범위 밖 음
    - accidental 처리 유지
    - 오선보 라인 수 = 범위에 따라 동적
    - 기존 `noteToStaffY` 테스트는 유지 (하위 호환)

**GREEN: Implement to Make Tests Pass**
- [ ] **Task 1.2**: `staffMapping.ts`에 `noteToStaffYDynamic` 함수 구현
  - File: `client/lib/audio/staffMapping.ts`
  - `StaffPosition`에 `outOfRange?: boolean` 추가
  - 새 `StaffConfig` interface + `noteToStaffYDynamic` 함수
  - `getStaffLineCount(config)`: 범위에 따른 라인 수 계산
  - 기존 `noteToStaffY`, `noteToStaffYClamped` 유지 (하위 호환)

- [ ] **Task 1.3**: 볼륨 드롭 수정
  - `client/hooks/usePitchDetection.ts:52` → `interruptionModeIOS: 0`
  - `client/hooks/useAudioPermission.ts:19` → `interruptionModeIOS: 0`

**REFACTOR: Clean Up Code**
- [ ] **Task 1.4**: 기존 `noteToStaffYClamped` 테스트 유지 확인, 코드 정리

#### Quality Gate

**STOP: Do NOT proceed to Phase 2 until ALL checks pass**

**TDD Compliance**:
- [ ] Tests were written FIRST and initially failed
- [ ] Production code written to make tests pass
- [ ] Code improved while tests still pass

**Build & Tests**:
- [ ] `tsc --noEmit` passes
- [ ] `npm test` passes (기존 + 새 테스트)
- [ ] `npx expo lint` passes

---

### Phase 2: MusicalStaff 옥타브 스위처 + 패시브 모드 + P0 수정
**Goal**: 오선지 옥타브 범위 조절 UI + 자동 확장 + 패시브 모드 + P0 접근성/터치 수정
**Estimated Time**: 3 hours
**Status**: Pending

#### Tasks

**RED: Write Failing Tests First**
- [ ] **Test 2.1**: MusicalStaff 패시브 모드 테스트
  - File: `__tests__/components/MusicalStaff.test.tsx`
  - Test cases:
    - `onToggle` 없을 때 mic 버튼 없음
    - `onToggle` 없을 때 stop 버튼 없음
    - `onToggle` 있을 때 기존 동작 유지

- [ ] **Test 2.2**: 옥타브 스위처 UI 테스트
  - File: `__tests__/components/MusicalStaff.test.tsx`
  - Test cases:
    - 기본 범위 3~5 표시
    - ► 버튼 → high octave 증가
    - ◄ 버튼 → low octave 감소
    - low >= high 방지 (최소 1 옥타브 차이)
    - 범위 1~8 제약

- [ ] **Test 2.3**: 자동 범위 확장 테스트
  - Test cases:
    - 범위 3~5에서 C6 감지 → high가 6으로 확장
    - 범위 3~5에서 C2 감지 → low가 2로 확장

**GREEN: Implement to Make Tests Pass**
- [ ] **Task 2.4**: MusicalStaff `onToggle` optional + 패시브 모드
  - File: `client/components/MusicalStaff.tsx`
  - `onToggle?: () => void`
  - `onToggle` 없으면 mic/stop 버튼 숨김

- [ ] **Task 2.5**: 옥타브 스위처 UI 구현
  - File: `client/components/MusicalStaff.tsx`
  - `useState(3)` lowOctave, `useState(5)` highOctave
  - ◄► Pressable 버튼 (Ionicons `chevron-back`/`chevron-forward`)
  - 범위 표시: `[3] ◄ Octave ► [5]`
  - `noteToStaffYDynamic` 사용하여 음표 위치 계산
  - 동적 라인 수로 오선보 렌더링

- [ ] **Task 2.6**: 자동 범위 확장 로직
  - `outOfRange` 감지 시 `setLowOctave`/`setHighOctave` 자동 조절
  - `useEffect`로 currentPitch 변경 시 범위 체크

- [ ] **Task 2.7 (P0)**: 터치 타겟 + 접근성 수정
  - MusicalStaff stop 버튼: 36x36 → 44x44
  - Metronome bpmBtnSmall: 32x32 → 44x44 (또는 hitSlop)
  - PracticeTimer: Play/Pause/Stop에 accessibilityLabel 추가
  - Metronome: 모든 버튼에 accessibilityLabel + accessibilityRole 추가
  - AudioPlayer: accessibilityLabel 보강
  - 옥타브 스위처 버튼: accessibilityLabel 추가 (e.g., "Lower octave range", "Raise octave range")

**REFACTOR: Clean Up Code**
- [ ] **Task 2.8**: 기존 MusicalStaff 테스트 업데이트 (onToggle 전달 확인)

#### Quality Gate

**STOP: Do NOT proceed to Phase 3 until ALL checks pass**

- [ ] TDD cycle followed (Red -> Green -> Refactor)
- [ ] `tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `npx expo lint` passes
- [ ] 모든 터치 타겟 >= 44dp
- [ ] 모든 버튼에 accessibilityLabel 존재

---

### Phase 3: Screen 통합 + P1/P2 Polish
**Goal**: 두 화면 타이머+피치 통합 + collapsible 메트로놈 + P1/P2 이슈 수정
**Estimated Time**: 3 hours
**Status**: Pending

#### Tasks

**GREEN: Implement**
- [ ] **Task 3.1**: PracticeScreen 통합
  - File: `client/screens/PracticeScreen.tsx`
  - 타이머 카드(105-112) + 피치 카드(115-134) → 하나의 "Practice Session" 카드
  - MusicalStaff에 `onToggle` 전달하지 않음 (패시브 모드)
  - `handlePitchToggle` 함수 제거
  - 메트로놈 카드(136-144) → collapsible 토글 (PracticeDetailScreen 패턴)
  - `useState(false)` showMetronome + Pressable 토글

- [ ] **Task 3.2**: PracticeDetailScreen 통합
  - File: `client/screens/PracticeDetailScreen.tsx`
  - timerSection(190-192) + pitchSection(194-207) → 하나의 카드
  - MusicalStaff에 `onToggle` 전달하지 않음
  - `handlePitchToggle` 함수 제거
  - 기존 collapsible 메트로놈(209-227) 유지

- [ ] **Task 3.3 (P1)**: Empty state + 에러 처리
  - PracticeDetailScreen: 연습 기록 없을 때 empty state 추가
  - PracticeDetailScreen: 데이터 로딩 에러 상태 개선

- [ ] **Task 3.4 (P1)**: Android ripple + 햅틱 피드백
  - Metronome, PracticeTimer, AudioPlayer: `android_ripple` 추가
  - AudioPlayer: Play/Pause에 햅틱 피드백 추가

- [ ] **Task 3.5 (P2)**: MusicalStaff 상태 전환 애니메이션
  - not listening → listening → pitch detected 전환 시 FadeIn/Out
  - react-native-reanimated `FadeIn`, `FadeOut` 사용 (이미 의존성 있음)

**REFACTOR: Clean Up Code**
- [ ] **Task 3.6**: 불필요한 import/함수 정리, 하드코딩 상수 정리

#### Quality Gate

**STOP: Verify ALL checks pass**

- [ ] `tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `npx expo lint` passes
- [ ] PracticeScreen 레이아웃 확인 (수동)
- [ ] PracticeDetailScreen 레이아웃 확인 (수동)
- [ ] Start → 타이머+피치 동시 시작 확인
- [ ] Stop → 둘 다 종료 + 세션 저장 확인
- [ ] Empty state 표시 확인
- [ ] Android ripple 작동 확인

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| MixWithOthers로 변경 시 iOS 오디오 라우팅 변경 | Low | Medium | 기본 스피커 출력 테스트, 이어폰 테스트 |
| 동적 오선보 라인 수 과다 (넓은 범위) | Medium | Low | 자동 확장 시 최대 범위 제한 (1~8) |
| 기존 staffMapping 테스트 호환성 | Low | High | 기존 함수 유지, 새 함수 추가 방식 |

---

## Rollback Strategy

### If Phase 1 Fails
- `interruptionModeIOS` 다시 `1`로 복원
- `noteToStaffYDynamic` 추가분만 제거, 기존 함수 영향 없음

### If Phase 2 Fails
- MusicalStaff를 git stash로 원복
- `onToggle` 다시 required로

### If Phase 3 Fails
- PracticeScreen/PracticeDetailScreen git stash 원복
- 기존 3카드 레이아웃 복원

---

## Progress Tracking

### Completion Status
- **Phase 1**: 0%
- **Phase 2**: 0%
- **Phase 3**: 0%

**Overall Progress**: 0% complete

### Time Tracking
| Phase | Estimated | Actual | Variance |
|-------|-----------|--------|----------|
| Phase 1 | 2 hours | - | - |
| Phase 2 | 3 hours | - | - |
| Phase 3 | 2 hours | - | - |
| **Total** | 7 hours | - | - |

---

## Notes & Learnings

### Implementation Notes
- (작성 예정)

---

## Final Checklist

**Before marking plan as COMPLETE**:
- [ ] All phases completed with quality gates passed
- [ ] Full integration testing performed
- [ ] Performance benchmarks meet targets
- [ ] Accessibility requirements met (labels on octave switcher)
- [ ] Plan document archived for future reference

---

**Plan Status**: In Progress
**Next Action**: Phase 1 - RED (테스트 작성)
**Blocked By**: None
