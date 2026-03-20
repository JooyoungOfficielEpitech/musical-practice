# Implementation Plan: File Persistence Fix

**Status**: In Progress
**Started**: 2026-03-20
**Last Updated**: 2026-03-20
**Estimated Completion**: 2026-03-20

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
ImagePicker/DocumentPicker가 반환하는 캐시 URI를 그대로 AsyncStorage에 저장하고 있어, OS가 캐시를 정리하면 이미지/MP3 파일이 사라지는 버그 수정. `copyToLocalStorage()`를 활용해 `Paths.document`(영구 저장소)에 파일을 복사하도록 변경.

### Success Criteria
- [ ] 새로 추가하는 시트의 이미지/오디오가 영구 저장소에 복사됨
- [ ] 기존 캐시 URI 시트가 앱 시작 시 마이그레이션됨
- [ ] 파일이 없는 경우 UI에서 적절히 처리됨
- [ ] 앱 업데이트/시간 경과 후에도 파일이 유지됨

### User Impact
앱 업데이트나 시간 경과 후에도 악보 이미지와 MP3 파일이 사라지지 않음

---

## Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| `Paths.document`에 복사 | OS가 삭제하지 않는 영구 저장소 | 디스크 사용량 증가 |
| addSheet/editSheet 시점에 복사 | 가장 단순하고 확실한 시점 | 저장 시 약간의 지연 |
| 기존 데이터 앱 시작 시 마이그레이션 | 기존 사용자 데이터 보호 | 이미 삭제된 캐시는 복구 불가 |

---

## Dependencies

### External Dependencies
- expo-file-system: ~19.0.21 (File, Directory, Paths API)
- expo-image-picker: ~17.0.10
- expo-document-picker: ~14.0.8

---

## Test Strategy

### Test Pyramid for This Feature
| Test Type | Coverage Target | Purpose |
|-----------|-----------------|---------|
| **Unit Tests** | >=80% | fileStorage 유틸 함수들 |
| **Integration Tests** | Critical paths | addSheet → 파일 복사 → 저장 흐름 |

### Test File Organization
```
__tests__/
├── unit/
│   └── lib/fileStorage.test.ts
└── integration/
    └── filePersistence.test.ts
```

---

## Implementation Phases

### Phase 1: fileStorage 유틸 테스트 + 강화
**Goal**: 파일 복사/검증 유틸리티의 테스트 커버리지 확보 및 배열 복사 헬퍼 추가
**Estimated Time**: 1 hour
**Status**: Pending

#### Tasks

**RED: Write Failing Tests First**
- [ ] **Test 1.1**: `copyToLocalStorage` 단위 테스트
  - File: `__tests__/unit/lib/fileStorage.test.ts`
  - Test cases: 정상 복사, sourceUri 빈 값, 복사 실패 시 null 반환
- [ ] **Test 1.2**: `copyImagesToStorage` 배열 복사 헬퍼 테스트
  - Test cases: 여러 이미지 복사, 빈 배열, 일부 실패 시 성공한 것만 반환
- [ ] **Test 1.3**: `fileExists` 유틸 테스트
  - Test cases: 존재하는 파일, 존재하지 않는 파일

**GREEN: Implement to Make Tests Pass**
- [ ] **Task 1.4**: `copyImagesToStorage` 헬퍼 구현 (`fileStorage.ts`)
- [ ] **Task 1.5**: `fileExists` 유틸 구현 (`fileStorage.ts`)

**REFACTOR: Clean Up Code**
- [ ] **Task 1.6**: 에러 핸들링 일관성 확인

#### Quality Gate

**STOP: Do NOT proceed to Phase 2 until ALL checks pass**

- [ ] Tests written FIRST and initially failed
- [ ] Production code written to make tests pass
- [ ] `tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `npx expo lint` passes

---

### Phase 2: addSheet/editSheet 영구 복사 통합
**Goal**: 시트 추가/수정 시 파일을 영구 저장소로 복사
**Estimated Time**: 1.5 hours
**Status**: Pending

#### Tasks

**RED: Write Failing Tests First**
- [ ] **Test 2.1**: addSheet 통합 테스트 - 파일이 document 디렉토리로 복사되는지 검증
  - File: `__tests__/integration/filePersistence.test.ts`
- [ ] **Test 2.2**: editSheet 시 새 파일만 복사되는지 검증

**GREEN: Implement to Make Tests Pass**
- [ ] **Task 2.3**: `PracticeContext.addSheet`에서 `copyImagesToStorage` + `copyToLocalStorage` 호출
- [ ] **Task 2.4**: `PracticeContext.editSheet`에서 새 URI만 복사 처리

**REFACTOR: Clean Up Code**
- [ ] **Task 2.5**: 불필요한 중복 로직 제거

#### Quality Gate

**STOP: Do NOT proceed to Phase 3 until ALL checks pass**

- [ ] TDD cycle followed
- [ ] `tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `npx expo lint` passes

---

### Phase 3: 기존 데이터 마이그레이션 + 무결성 검증
**Goal**: 기존 캐시 URI 시트를 영구 저장소로 마이그레이션, 깨진 참조 처리
**Estimated Time**: 1 hour
**Status**: Pending

#### Tasks

**RED: Write Failing Tests First**
- [ ] **Test 3.1**: `migrateFileUris` 함수 테스트 - 캐시 URI 감지 및 복사
- [ ] **Test 3.2**: 파일이 이미 document에 있으면 스킵하는지 검증
- [ ] **Test 3.3**: 파일이 없는 경우 URI를 빈 문자열로 처리하는지 검증

**GREEN: Implement to Make Tests Pass**
- [ ] **Task 3.4**: `migrateFileUris` 함수 구현 (`migration.ts`)
- [ ] **Task 3.5**: `PracticeProvider`에서 앱 시작 시 마이그레이션 호출
- [ ] **Task 3.6**: 이미지/오디오 UI에서 파일 없는 경우 fallback 처리

**REFACTOR: Clean Up Code**
- [ ] **Task 3.7**: 마이그레이션 로직 정리

#### Quality Gate

- [ ] TDD cycle followed
- [ ] `tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `npx expo lint` passes
- [ ] Manual: 새 시트 추가 → 앱 재시작 → 파일 유지 확인

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| 이미 삭제된 캐시 파일 복구 불가 | High | Medium | UI에서 "파일 없음" 표시, 재업로드 유도 |
| 파일 복사 중 디스크 공간 부족 | Low | Medium | 에러 핸들링으로 graceful fail |
| expo-file-system API 차이 | Low | High | 공식 문서 기반 구현 |

---

## Rollback Strategy

### If Phase 1 Fails
- Undo: `__tests__/unit/lib/fileStorage.test.ts`, `client/lib/fileStorage.ts` 변경 복원

### If Phase 2 Fails
- Restore: `client/context/PracticeContext.tsx` 원복

### If Phase 3 Fails
- Restore to Phase 2 state, `client/lib/migration.ts` 원복

---

## Progress Tracking

### Completion Status
- **Phase 1**: 100%
- **Phase 2**: 100%
- **Phase 3**: 100%

**Overall Progress**: 100% complete

---

## Notes & Learnings

### Implementation Notes
- `copyToLocalStorage()`가 이미 존재하지만 호출되지 않았던 것이 근본 원인
- expo-file-system v19는 `File`, `Directory`, `Paths` 클래스 기반 API 사용

---

**Plan Status**: Complete
**Next Action**: None
**Blocked By**: None
