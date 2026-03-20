# Implementation Plan: Pitch Detection Latency Optimization

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
현재 pitch detection 파이프라인에 체감 ~100ms 딜레이가 존재한다.
**원인**: (1) THROTTLE_MS=100ms, (2) 매 프레임 Float32Array 할당 GC 압력, (3) 비효율적 base64 변환, (4) 프레임 드롭 방식.
**목표**: 체감 딜레이를 ~50ms 이하로 줄이고, 성능 회귀 방지 벤치마크 테스트를 추가한다.

### Success Criteria
- [ ] `THROTTLE_MS` 100→50ms (20fps)
- [ ] pitchDetector accumulator → pre-allocated ring buffer (0 allocations in hot path)
- [ ] `base64ToFloat32` 최적화 (typed array 직접 매핑)
- [ ] 슬라이딩 윈도우 오버랩으로 감지 빈도 향상 (INPUT_SIZE 2048, stride 1024)
- [ ] `detectPitch` 처리 시간 벤치마크 테스트 (< 5ms per call)
- [ ] 링 버퍼 할당 검증 테스트 (hot path에서 new Float32Array 없음)
- [ ] 전체 테스트 통과 + tsc clean

### User Impact
노래하면서 실시간으로 음정을 확인할 때 딜레이가 절반 이하로 줄어든다. 보다 자연스러운 연습 경험.

---

## Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| Ring buffer (pre-allocated) | 매 프레임 `new Float32Array()` 제거 → GC 압력 해소 | 코드 복잡도 약간 증가, 고정 메모리 사용 |
| THROTTLE_MS 100→50 | 즉각적 체감 개선, CPU 부하 미미 | 리렌더 빈도 2배 (React.memo로 완화) |
| 슬라이딩 윈도우 (stride 1024) | INPUT_SIZE 유지하며 감지 빈도 2배 | 약간의 중복 계산 |
| `base64ToFloat32` 최적화 | char-by-char 루프 대신 typed array 직접 변환 | 브라우저 호환 (atob 유지) |
| frame drop 제거 | 데이터 손실 방지, ring buffer가 자연스럽게 최신 데이터 유지 | 처리량 증가 (ring buffer로 흡수) |

---

## Dependencies

### Required Before Starting
- [x] pitchy 설치됨
- [x] react-native-live-audio-stream 설치됨
- [x] 기존 pitch detection 파이프라인 동작 중

### External Dependencies
- 추가 패키지 없음 (순수 최적화)

---

## Test Strategy

### Testing Approach
**TDD Principle**: Write tests FIRST, then implement to make them pass

### Test Pyramid for This Feature
| Test Type | Coverage Target | Purpose |
|-----------|-----------------|---------|
| **Unit Tests** | >=80% | Ring buffer, 슬라이딩 윈도우, base64 최적화 |
| **Benchmark Tests** | Perf thresholds | detectPitch < 5ms, 할당 검증 |
| **Integration Tests** | Critical paths | 전체 파이프라인 latency 특성 |

### Test File Organization
```
__tests__/
├── unit/
│   └── audio/
│       ├── pitchDetector.test.ts  (기존 + 링 버퍼 테스트 추가)
│       ├── audioStream.test.ts    (기존 + 최적화 테스트 추가)
│       └── ringBuffer.test.ts     (새로 생성)
└── benchmark/
    └── pitchLatency.bench.ts      (새로 생성)
```

---

## Implementation Phases

### Phase 1: 스로틀 감소 + Ring Buffer
**Goal**: THROTTLE_MS 50ms + pre-allocated ring buffer로 GC 제거
**Estimated Time**: 2-3 hours
**Status**: Complete

#### Tasks

**RED: Write Failing Tests First**
- [x] **Test 1.1**: Ring buffer 유닛 테스트 (13 tests)
  - File: `__tests__/unit/audio/ringBuffer.test.ts`
- [x] **Test 1.2**: pitchDetector ring buffer 통합 (기존 테스트 모두 통과)

**GREEN: Implement to Make Tests Pass**
- [x] **Task 1.3**: `client/lib/audio/ringBuffer.ts` 구현
- [x] **Task 1.4**: `pitchDetector.ts` → ring buffer 적용
- [x] **Task 1.5**: `usePitchDetection.ts` THROTTLE_MS 100→50

**REFACTOR: Clean Up Code**
- [x] **Task 1.6**: 기존 accumulator 코드 제거, ring buffer 타입 정리

#### Quality Gate

- [x] TDD cycle followed (Red → Green → Refactor)
- [x] Ring buffer 테스트 전부 통과 (13/13)
- [x] 기존 pitchDetector 테스트 모두 통과
- [x] `tsc --noEmit` passes
- [x] `npm test` passes (228/228, 19 suites)
- [x] 기존 테스트 깨지지 않음

---

### Phase 2: base64 최적화 + 슬라이딩 윈도우
**Goal**: 변환 속도 향상 + 오버랩 감지로 빈도 2배
**Estimated Time**: 2-3 hours
**Status**: Complete

#### Tasks

**RED: Write Failing Tests First**
- [x] **Test 2.1**: base64ToFloat32 성능 테스트 (< 5ms per call, 1000 iterations)
- [x] **Test 2.2**: 슬라이딩 윈도우 테스트 (2048 초기 fill, 1024 이후 축적)

**GREEN: Implement to Make Tests Pass**
- [x] **Task 2.3**: `base64ToFloat32` → DataView 최적화
- [x] **Task 2.4**: 슬라이딩 윈도우 동작 확인 (기존 테스트 통과)
- [x] **Task 2.5**: audioStream frame drop 제거 (ring buffer가 backpressure 처리)

**REFACTOR: Clean Up Code**
- [x] **Task 2.6**: processing 플래그 제거, 상수 정리

#### Quality Gate

- [x] TDD cycle followed
- [x] base64 최적화 후 기존 테스트 모두 통과
- [x] 슬라이딩 윈도우 테스트 모두 통과
- [x] `tsc --noEmit` passes
- [x] `npm test` passes (231/231, 19 suites)
- [x] 기존 테스트 깨지지 않음

---

### Phase 3: 레이턴시 벤치마크 테스트
**Goal**: 성능 회귀 방지를 위한 정량적 벤치마크
**Estimated Time**: 1-2 hours
**Status**: Complete

#### Tasks

**RED: Write Failing Tests First**
- [x] **Test 3.1**: 벤치마크 테스트 스위트
  - File: `__tests__/benchmark/pitchLatency.test.ts`
  - Test cases:
    - `detectPitch` 1000회 호출 평균 < 5ms per call
    - `base64ToFloat32(4096 bytes)` 1000회 호출 평균 < 1ms per call
    - Ring buffer `write+read` 1000회 호출 평균 < 0.1ms per call
    - 전체 파이프라인 (base64→detect) 1회 < 10ms

- [x] **Test 3.2**: 할당 검증 테스트
  - File: `__tests__/unit/audio/ringBuffer.test.ts` (기존 파일에 추가)
  - Test cases:
    - ring buffer hot path (write/read) 중 `Float32Array` constructor 호출 0회
    - detectPitch hot path 중 새 배열 할당 최소화 검증

- [x] **Test 3.3**: 스로틀 간격 검증 테스트
  - File: `__tests__/benchmark/pitchLatency.test.ts` (상수 검증 포함)
  - Test cases:
    - THROTTLE_MS가 50인지 검증 (import 상수 확인)
    - INPUT_SIZE가 2048인지 검증

**GREEN: Implement to Make Tests Pass**
- [x] **Task 3.4**: 벤치마크 헬퍼 구현
  - `measureAvgMs(fn, iterations)` 유틸
  - `performance.now()` 활용
- [x] **Task 3.5**: 추가 최적화 불필요
  - 모든 벤치마크 첫 실행에서 통과

**REFACTOR: Clean Up Code**
- [x] **Task 3.6**: 전체 정리
  - [x] expo-av mock 추가 (usePitchDetection의 expo-av 의존성)
  - [x] 벤치마크 파일명 .bench.ts → .test.ts (Jest testMatch 호환)

#### Quality Gate

- [x] TDD cycle followed
- [x] 벤치마크 테스트 모두 통과
- [x] `tsc --noEmit` passes
- [x] `npm test` passes (237/237, 20 suites)
- [x] 성능 목표 충족:
  - [x] detectPitch < 5ms
  - [x] base64ToFloat32 < 1ms
  - [x] ring buffer ops < 0.1ms
  - [x] 전체 파이프라인 < 10ms

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Ring buffer 오버플로우 | Low | Medium | capacity 8192 = 4x INPUT_SIZE, 충분한 여유 |
| THROTTLE 줄이면 CPU 과부하 | Low | Medium | 50ms(20fps)는 React Native에서 안전한 수준 |
| 슬라이딩 윈도우 정확도 저하 | Low | Low | INPUT_SIZE 유지, 오버랩으로 정확도 동일 또는 향상 |
| base64 최적화가 플랫폼별 차이 | Medium | Low | atob 유지, typed array 구간만 최적화 |
| 기존 테스트 깨짐 | Medium | High | 기존 테스트 먼저 확인, 인터페이스 유지 |

---

## Rollback Strategy

### If Phase 1 Fails
- `git checkout -- client/lib/audio/pitchDetector.ts client/hooks/usePitchDetection.ts`
- `ringBuffer.ts` 삭제, 테스트 파일 삭제
- 기존 accumulator 방식으로 복원

### If Phase 2 Fails
- `git checkout -- client/lib/audio/audioStream.ts client/lib/audio/pitchDetector.ts`
- Phase 1 상태로 복원 (ring buffer + throttle 50ms는 유지)

### If Phase 3 Fails
- 벤치마크 테스트 파일만 삭제
- Phase 2 상태로 복원 (기능은 그대로)

---

## File Summary

### 수정할 파일 (3개)
| 파일 | 변경 내용 |
|------|----------|
| `client/lib/audio/pitchDetector.ts` | accumulator → ring buffer + 슬라이딩 윈도우 |
| `client/lib/audio/audioStream.ts` | base64 최적화 + frame drop 제거 |
| `client/hooks/usePitchDetection.ts` | THROTTLE_MS 100→50 |

### 새로 생성할 파일 (1개)
| 파일 | 목적 |
|------|------|
| `client/lib/audio/ringBuffer.ts` | Pre-allocated circular buffer |

### 테스트 파일 (기존 수정 2개 + 새로 생성 2개)
| 파일 | 변경 |
|------|------|
| `__tests__/unit/audio/pitchDetector.test.ts` | 슬라이딩 윈도우 + 스로틀 테스트 추가 |
| `__tests__/unit/audio/audioStream.test.ts` | base64 최적화 성능 테스트 추가 |
| `__tests__/unit/audio/ringBuffer.test.ts` | **새로 생성** — ring buffer 유닛 테스트 |
| `__tests__/benchmark/pitchLatency.test.ts` | **새로 생성** — 레이턴시 벤치마크 |

---

## Progress Tracking

### Completion Status
- **Phase 1**: 100% ✅
- **Phase 2**: 100% ✅
- **Phase 3**: 100% ✅

**Overall Progress**: 100% complete

---

## Notes & Learnings

### Implementation Notes
- Ring buffer capacity = 8192 (4x INPUT_SIZE) — 충분한 버퍼링
- THROTTLE_MS 50ms = 20fps — 음악 앱 기준 적절한 업데이트 빈도
- 슬라이딩 윈도우 1024 stride → 초기 2048 충전 후 ~23ms 주기로 감지 가능

### Blockers Encountered
- expo-av native module (`ExponentAV`) not available in Jest test environment — resolved by adding `jest.mock("expo-av")`
- `.bench.ts` file extension not matched by Jest `testMatch` — renamed to `.test.ts`

### Improvements for Future Plans
- 벤치마크 파일은 Jest testMatch 패턴에 맞게 `.test.ts` 확장자 사용
- native module 의존성 있는 hook에서 상수를 export할 때, 벤치마크 테스트에서 해당 native module mock 필요

---

## Final Checklist

**Before marking plan as COMPLETE**:
- [x] All phases completed with quality gates passed
- [x] Full integration testing performed
- [x] Performance benchmarks meet targets
- [x] 기존 테스트 전부 통과 (regression 없음) — 237/237, 20 suites
- [x] Plan document archived for future reference

---

**Plan Status**: Complete
**Completed**: 2026-03-18
**Blocked By**: None
