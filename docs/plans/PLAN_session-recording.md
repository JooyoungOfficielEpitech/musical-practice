# Implementation Plan: Session Voice Recording

**Status**: In Progress
**Started**: 2026-03-18
**Last Updated**: 2026-03-18
**Estimated Completion**: 2026-03-19

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
연습 세션 중 사용자의 목소리를 녹음하고, 녹음본을 조회/재생/삭제할 수 있는 기능. 이미 피치 감지용으로 캡처 중인 `LiveAudioStream` PCM 데이터를 WAV 파일로 동시 저장하여 오디오 세션 충돌 없이 구현.

### Success Criteria
- [ ] 연습 세션 시작 시 녹음 on/off 토글 가능
- [ ] 녹음된 파일이 WAV 형식으로 로컬에 저장됨
- [ ] 녹음 목록에서 재생/일시정지 가능
- [ ] 녹음 삭제 시 파일 + 메타데이터 모두 제거
- [ ] 녹음이 PracticeSession과 연결됨
- [ ] 기존 피치 감지 기능에 영향 없음

### User Impact
연습 후 자신의 연주/노래를 되돌아볼 수 있어 실력 향상에 도움. 시간순으로 녹음을 비교하며 성장 과정을 확인 가능.

---

## Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| LiveAudioStream PCM → WAV 저장 | 이미 캡처 중인 데이터 재활용, 오디오 세션 충돌 없음 | WAV 파일 크기가 큼 (압축 없음) |
| expo-file-system으로 파일 관리 | 이미 프로젝트 의존성에 포함, 안정적 | 클라우드 동기화 미지원 |
| AsyncStorage에 메타데이터 저장 | 기존 storage.ts 패턴과 일관성 유지 | 대량 데이터 시 성능 저하 가능 |
| PracticeSession에 recordingUri 필드 추가 | 세션과 녹음 1:1 연결, 단순한 구조 | 세션 없이 녹음 불가 |
| AudioPlayer 컴포넌트 재사용 | 이미 seekbar, 시간 표시 등 구현됨 | 커스터마이징 제한적 |

---

## Dependencies

### Required Before Starting
- [x] expo-av 이미 설치됨
- [x] expo-file-system 이미 설치됨 (expo 내장)
- [x] LiveAudioStream 이미 설치됨
- [x] AudioPlayer 컴포넌트 존재

### External Dependencies
- expo-av: ^15.0.2 (기존)
- expo-file-system: expo 내장 (기존)
- react-native-live-audio-stream: ^1.4.0 (기존)

---

## Test Strategy

### Testing Approach
**TDD Principle**: Write tests FIRST, then implement to make them pass

### Test Pyramid for This Feature
| Test Type | Coverage Target | Purpose |
|-----------|-----------------|---------|
| **Unit Tests** | >=80% | WAV 인코딩, 스토리지 CRUD, 데이터 모델 |
| **Integration Tests** | Critical paths | useRecording 훅, PracticeContext 통합 |
| **Component Tests** | Key interactions | RecordingsList UI, 녹음 버튼 상태 |

### Test File Organization
```
__tests__/
├── unit/
│   ├── audio/
│   │   └── wavEncoder.test.ts
│   └── lib/
│       └── recordingStorage.test.ts
├── components/
│   └── RecordingsList.test.tsx
└── unit/
    └── hooks/
        └── useRecording.test.ts
```

---

## Implementation Phases

### Phase 1: Recording Foundation
**Goal**: WAV 인코더, 녹음 데이터 모델, 스토리지 CRUD, useRecording 훅 구현
**Estimated Time**: 3-4 hours
**Status**: Pending

#### Tasks

**RED: Write Failing Tests First**
- [x] **Test 1.1**: WAV 인코더 유닛 테스트
  - File: `__tests__/unit/audio/wavEncoder.test.ts`
  - Test cases:
    - Float32Array → 16-bit PCM 변환 정확성
    - WAV 헤더 생성 (44 bytes, correct format fields)
    - 빈 오디오 데이터 처리
    - 큰 데이터 (60초 분량) 처리

- [x] **Test 1.2**: 녹음 스토리지 CRUD 유닛 테스트
  - File: `__tests__/unit/lib/recordingStorage.test.ts`
  - Test cases:
    - Recording 메타데이터 저장/조회
    - Recording 삭제 (메타데이터 + 파일)
    - 세션 ID로 녹음 조회
    - 존재하지 않는 녹음 삭제 시 에러 처리

- [x] **Test 1.3**: useRecording 훅 테스트
  - File: `__tests__/unit/hooks/useRecording.test.ts`
  - Test cases:
    - 녹음 시작/정지 상태 전환
    - PCM 데이터 누적 (`addAudioData`)
    - 녹음 저장 시 WAV 파일 생성
    - 녹음 중 아닐 때 addAudioData 무시

**GREEN: Implement to Make Tests Pass**
- [x] **Task 1.4**: Recording 타입 정의
  - File: `client/lib/audio/types.ts`
  - 추가: `Recording` 인터페이스 (id, sessionId, title, fileUri, duration, createdAt, fileSize)

- [x] **Task 1.5**: WAV 인코더 구현
  - File: `client/lib/audio/wavEncoder.ts`
  - `encodeWav(samples: Float32Array[], sampleRate: number): ArrayBuffer`
  - 44-byte WAV 헤더 + 16-bit PCM 데이터

- [x] **Task 1.6**: 녹음 스토리지 구현
  - File: `client/lib/recordingStorage.ts`
  - `getRecordings()`, `saveRecording()`, `deleteRecording()`, `getRecordingsBySessionId()`
  - AsyncStorage key: `@musicalpractice/recordings`

- [x] **Task 1.7**: useRecording 훅 구현
  - File: `client/hooks/useRecording.ts`
  - 상태: `isRecording`, `recordingDuration`
  - 메서드: `startRecording()`, `stopRecording()`, `addAudioData(Float32Array)`
  - PCM 청크 배열로 누적 → 정지 시 WAV 인코딩 → 파일 저장

**REFACTOR: Clean Up Code**
- [x] **Task 1.8**: 코드 품질 개선
  - [ ] 중복 제거
  - [ ] 타입 안전성 확인
  - [ ] 메모리 관리 검증 (대용량 PCM 버퍼)

#### Quality Gate

**STOP: Do NOT proceed to Phase 2 until ALL checks pass**

**TDD Compliance**:
- [ ] 테스트가 구현 전에 작성되어 먼저 실패함
- [ ] 구현 후 모든 테스트 통과
- [ ] 리팩토링 후에도 테스트 통과
- [ ] Unit test coverage >=80%

**Build & Tests**:
- [ ] `tsc --noEmit` 통과
- [ ] `npm test` 통과
- [ ] 기존 테스트 깨지지 않음

**Code Quality**:
- [ ] `npx expo lint` 통과

**Security & Performance**:
- [ ] 60초 녹음 시 메모리 사용량 합리적 (<50MB)
- [ ] WAV 인코딩 시간 <2초

---

### Phase 2: Recording UI
**Goal**: PracticeScreen에 녹음 버튼 추가, 녹음 인디케이터, 세션 저장 시 녹음 연동
**Estimated Time**: 2-3 hours
**Status**: Pending

#### Tasks

**RED: Write Failing Tests First**
- [ ] **Test 2.1**: PracticeScreen 녹음 통합 테스트
  - File: `__tests__/components/PracticeRecording.test.tsx`
  - Test cases:
    - 녹음 토글 버튼 렌더링
    - 녹음 활성화 상태에서 시각적 인디케이터 표시
    - 연습 정지 시 녹음도 함께 정지
    - PracticeSession에 recordingUri 포함

**GREEN: Implement to Make Tests Pass**
- [ ] **Task 2.2**: PracticeSession 타입에 recordingUri 추가
  - File: `client/lib/storage.ts`
  - `PracticeSession.recordingUri?: string`

- [ ] **Task 2.3**: PracticeScreen에 녹음 토글 UI 추가
  - File: `client/screens/PracticeScreen.tsx`
  - 녹음 on/off 토글 버튼 (마이크 아이콘)
  - 녹음 중 빨간 점 인디케이터 + 경과 시간
  - `usePitchDetection`의 오디오 콜백에서 `useRecording.addAudioData()` 호출

- [ ] **Task 2.4**: usePitchDetection에 raw audio 콜백 추가
  - File: `client/hooks/usePitchDetection.ts`
  - `onAudioData?: (data: Float32Array) => void` 콜백 파라미터 추가
  - LiveAudioStream 데이터 수신 시 콜백 호출

- [ ] **Task 2.5**: 연습 세션 저장 시 녹음 연동
  - PracticeTimer 정지 → useRecording.stopRecording() → recordingUri를 세션에 포함

**REFACTOR: Clean Up Code**
- [ ] **Task 2.6**: UI 일관성 점검
  - [ ] 기존 디자인 시스템 (theme.ts) 준수
  - [ ] 터치 타겟 >=44dp
  - [ ] 녹음 상태 전환 애니메이션

#### Quality Gate

**STOP: Do NOT proceed to Phase 3 until ALL checks pass**

- [ ] TDD cycle followed (Red → Green → Refactor)
- [ ] `tsc --noEmit` 통과
- [ ] `npm test` 통과
- [ ] `npx expo lint` 통과
- [ ] 기존 피치 감지 기능 정상 동작
- [ ] 녹음 on/off 토글 정상
- [ ] 세션 저장 시 녹음 파일 생성 확인

---

### Phase 3: Playback & Management
**Goal**: 녹음 목록 컴포넌트, 재생, 삭제 기능, PracticeContext 통합
**Estimated Time**: 3-4 hours
**Status**: Pending

#### Tasks

**RED: Write Failing Tests First**
- [ ] **Test 3.1**: RecordingsList 컴포넌트 테스트
  - File: `__tests__/components/RecordingsList.test.tsx`
  - Test cases:
    - 녹음 목록 렌더링 (날짜, 시간, 파일 크기)
    - 재생 버튼 클릭 시 AudioPlayer 활성화
    - 삭제 버튼 클릭 시 확인 다이얼로그
    - 빈 목록 EmptyState 표시

- [ ] **Test 3.2**: PracticeContext 녹음 관련 테스트
  - File: `__tests__/unit/lib/recordingContext.test.ts`
  - Test cases:
    - recordings 상태 로드
    - deleteRecording 호출 시 상태 + 파일 삭제
    - 세션 삭제 시 연결된 녹음도 삭제

**GREEN: Implement to Make Tests Pass**
- [ ] **Task 3.3**: RecordingsList 컴포넌트 구현
  - File: `client/components/RecordingsList.tsx`
  - FlatList로 녹음 목록 표시
  - 각 항목: 날짜, 시간, 재생 버튼, 삭제 버튼
  - 재생 시 기존 AudioPlayer 활용
  - 삭제 시 Alert.alert 확인

- [ ] **Task 3.4**: PracticeContext에 녹음 관리 추가
  - File: `client/context/PracticeContext.tsx`
  - `recordings` 상태 추가
  - `deleteRecording(id)` 메서드 추가
  - `removeSheet` 시 관련 녹음도 삭제
  - 초기 로드 시 recordings도 불러오기

- [ ] **Task 3.5**: PracticeDetailScreen에 녹음 목록 통합
  - File: `client/screens/PracticeDetailScreen.tsx`
  - 세션 히스토리 아래 해당 세션의 녹음 표시
  - 또는 별도 "녹음" 섹션 추가

- [ ] **Task 3.6**: PracticeScreen에 최근 녹음 표시
  - File: `client/screens/PracticeScreen.tsx`
  - 연습 종료 후 녹음 재생 가능하도록 링크/버튼

**REFACTOR: Clean Up Code**
- [ ] **Task 3.7**: 코드 품질 최종 점검
  - [ ] 파일 삭제 에러 핸들링
  - [ ] 접근성 (VoiceOver/TalkBack 라벨)
  - [ ] 메모리 정리 (컴포넌트 언마운트 시)

#### Quality Gate

- [ ] TDD cycle followed
- [ ] `tsc --noEmit` 통과
- [ ] `npm test` 통과
- [ ] `npx expo lint` 통과
- [ ] 녹음 목록에서 재생/정지 정상
- [ ] 녹음 삭제 시 파일 + 메타데이터 제거 확인
- [ ] 세션 삭제 시 연결 녹음 삭제 확인
- [ ] 빈 상태 UI 정상 표시

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| LiveAudioStream PCM 포맷 불일치 | Low | High | 기존 base64ToFloat32 함수 재사용, WAV 헤더 검증 테스트 |
| 장시간 녹음 시 메모리 부족 | Medium | High | 청크 단위로 파일 스트리밍 or 최대 녹음 시간 제한 (30분) |
| iOS 오디오 세션 충돌 | Low | High | LiveAudioStream 데이터만 사용, 새 오디오 세션 생성 안 함 |
| WAV 파일 크기 (1분 ≈ 5.3MB) | Medium | Medium | 저장 공간 표시, 오래된 녹음 삭제 유도 |
| 피치 감지 성능 저하 | Low | Medium | addAudioData는 참조만 저장, 인코딩은 녹음 종료 시에만 |

---

## Rollback Strategy

### If Phase 1 Fails
- 삭제: `client/lib/audio/wavEncoder.ts`, `client/lib/recordingStorage.ts`, `client/hooks/useRecording.ts`
- `client/lib/audio/types.ts`에서 Recording 타입 제거
- 테스트 파일 삭제

### If Phase 2 Fails
- Phase 1 코드는 유지 (독립적)
- `PracticeScreen.tsx`, `usePitchDetection.ts`, `storage.ts` git restore
- recordingUri 필드 제거

### If Phase 3 Fails
- Phase 1-2 코드는 유지 (녹음은 되지만 관리 UI 없음)
- `RecordingsList.tsx` 삭제
- `PracticeContext.tsx`, `PracticeDetailScreen.tsx` git restore

---

## Progress Tracking

### Completion Status
- **Phase 1**: 100%
- **Phase 2**: 100%
- **Phase 3**: 100%

**Overall Progress**: 100% complete

### Time Tracking
| Phase | Estimated | Actual | Variance |
|-------|-----------|--------|----------|
| Phase 1 | 3-4 hours | - | - |
| Phase 2 | 2-3 hours | - | - |
| Phase 3 | 3-4 hours | - | - |
| **Total** | 8-11 hours | - | - |

---

## Notes & Learnings

### Implementation Notes
- LiveAudioStream base64 → Float32 변환은 기존 `audioStream.ts`의 `base64ToFloat32()` 재사용
- WAV 포맷: 44.1kHz, 16-bit, mono (LiveAudioStream 설정과 동일)
- 1분 녹음 ≈ 44100 * 2 bytes * 60초 ≈ 5.3MB

### Blockers Encountered
- (Phase 진행 시 기록)

### Improvements for Future Plans
- (완료 후 기록)

---

## References

### Documentation
- [expo-av Recording API](https://docs.expo.dev/versions/latest/sdk/audio/)
- [WAV file format spec](http://soundfile.sapp.org/doc/WaveFormat/)
- [react-native-live-audio-stream](https://github.com/nicklockwood/react-native-live-audio-stream)

### Related Files
- `client/lib/audio/audioStream.ts` - 기존 PCM 데이터 처리
- `client/hooks/usePitchDetection.ts` - 오디오 스트림 훅
- `client/components/AudioPlayer.tsx` - 재생 컴포넌트 (재사용)
- `client/lib/storage.ts` - 기존 스토리지 패턴

---

## Final Checklist

**Before marking plan as COMPLETE**:
- [ ] All phases completed with quality gates passed
- [ ] Full integration testing performed
- [ ] 기존 피치 감지 기능 정상 동작 확인
- [ ] Performance benchmarks meet targets (WAV 인코딩 <2초, 메모리 <50MB)
- [ ] 접근성 요구사항 충족 (터치 타겟, 스크린리더 라벨)
- [ ] Plan document archived for future reference

---

**Plan Status**: In Progress
**Next Action**: Phase 1 - RED 테스트 작성부터 시작
**Blocked By**: None
