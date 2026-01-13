# 월드인포 벡터 저장소 동기화 구현 계획

## 📋 개요

월드인포(World Info)의 벡터 기반 검색 기능을 위해 월드인포 엔트리를 벡터 저장소에 동기화하는 기능을 구현합니다. 벡터 저장소는 월드인포 엔트리의 내용을 벡터 임베딩으로 변환하여 저장하고, 채팅 내용과의 유사도 검색을 통해 관련 엔트리를 활성화합니다.

## 🎯 목표

- 월드인포 엔트리를 벡터 저장소에 자동으로 동기화
- 월드인포 파일이 변경되면 벡터 저장소도 자동으로 업데이트
- 벡터 검색을 통한 월드인포 엔트리 활성화
- 성능 최적화: 불필요한 동기화 방지 및 배치 처리

## ✅ 현재 상태

### 구현 완료
- [x] 벡터 검색 기능 (`checkVectorizedWorldInfo`): 채팅 내용과 유사한 월드인포 엔트리 활성화
- [x] 벡터 저장소 기본 함수 (`vectors.js`):
  - [x] `insertVectorItems`: 벡터 아이템 삽입
  - [x] `deleteVectorItems`: 벡터 아이템 삭제
  - [x] `getSavedHashes`: 저장된 해시 목록 조회
  - [x] `multiQueryCollection`: 여러 컬렉션 동시 검색
  - [x] `getSourceSettings`: 벡터 소스 설정 로드
- [x] 벡터화된 엔트리 분리: 키워드 기반 엔트리와 벡터화된 엔트리 분리 처리
- [x] 벡터 검색 점수 로깅: 터미널에서 유사도 점수 확인 가능

### 미구현
- [x] 월드인포 엔트리 그룹화 (`groupEntriesByWorld`): 월드별로 엔트리 그룹화 ✅
- [x] 월드별 저장된 해시 조회 (`getSavedHashesForWorld`): 특정 월드의 벡터 저장소 해시 조회 ✅
- [x] 벡터 동기화 메인 함수 (`syncWorldInfoVectors`): 월드인포 엔트리와 벡터 저장소 동기화 ✅
- [ ] 동기화 트리거: 월드인포 파일 변경 시 자동 동기화
- [ ] 동기화 최적화: 변경된 엔트리만 동기화 (추가/삭제 감지)
- [ ] 동기화 상태 관리: 동기화 진행 중 중복 실행 방지

## 🔍 기술적 분석

### 벡터 저장소 구조

월드인포 엔트리는 월드(World)별로 컬렉션에 저장됩니다:

- **컬렉션 ID**: `world_{hash(worldName)}`
  - 예: `world_1234567890` (월드 이름 "큐비 정보"의 해시)
- **아이템 구조**:
  - `hash`: 엔트리 내용의 해시 값 (`getStringHash(entry.content)`)
  - `text`: 엔트리 내용 (`entry.content`)
  - `index`: 엔트리 UID (`entry.uid`)
  - `vector`: 벡터 임베딩 (자동 생성)

### 동기화 프로세스

1. **엔트리 수집**
   - `getSortedEntries`로 모든 월드인포 엔트리 수집
   - 벡터화 설정 확인 (`vectorized === true` 또는 `enabled_for_all === true`)

2. **월드별 그룹화**
   - 월드 이름(`entry.world`)별로 엔트리 그룹화
   - 유효한 엔트리만 필터링 (비활성화, 내용 없음 제외)

3. **변경 감지**
   - 각 월드의 현재 엔트리 해시 계산
   - 벡터 저장소에서 기존 해시 조회
   - 추가/삭제된 엔트리 식별

4. **동기화 실행**
   - 새 엔트리: 벡터 저장소에 추가
   - 삭제된 엔트리: 벡터 저장소에서 제거
   - 변경된 엔트리: 기존 항목 삭제 후 새로 추가 (해시 기반)

5. **에러 처리**
   - 개별 월드 동기화 실패 시 다른 월드는 계속 진행
   - 로깅 및 에러 보고

### 동기화 타이밍 옵션

1. **즉시 동기화** (현재 구현)
   - `prepare-messages` 호출 시마다 동기화
   - 장점: 항상 최신 상태 유지
   - 단점: 성능 오버헤드 (비동기 처리로 완화)

2. **파일 변경 감지** (향후 구현)
   - 월드인포 파일 변경 시에만 동기화
   - 장점: 성능 최적화
   - 단점: 파일 시스템 감시 필요

3. **수동 동기화** (향후 구현)
   - API 엔드포인트를 통한 수동 동기화
   - 장점: 사용자 제어 가능
   - 단점: 사용자 개입 필요

### 성능 고려사항

- **비동기 처리**: 동기화는 응답을 블로킹하지 않음
- **배치 처리**: 여러 엔트리를 한 번에 처리
- **중복 방지**: 동시에 여러 동기화 요청이 들어와도 하나만 실행
- **캐싱**: 동일한 엔트리는 재동기화하지 않음 (해시 기반)

## 📝 구현 계획

### Phase 1: 기본 헬퍼 함수 구현

#### 1.1 `groupEntriesByWorld` 함수 구현 ✅
**목표**: 월드인포 엔트리를 월드별로 그룹화

**구현 완료**: `src/endpoints/worldinfo.js`에 구현됨

**구현 내용**:
```javascript
/**
 * Groups World Info entries by world name
 * Filters entries based on vectorization settings and validity
 * @param {Array<object>} entries Array of World Info entries
 * @param {boolean} enabledForAll Whether all entries should be vectorized
 * @returns {object} Object with world names as keys and arrays of entries as values
 */
function groupEntriesByWorld(entries, enabledForAll = false) {
    // 1. 엔트리 필터링 (world 필드, disable, content 확인)
    // 2. vectorized 플래그 확인 (enabledForAll 고려)
    // 3. 월드별로 그룹화
    // 4. 반환
}
```

**필터링 조건**:
- `entry.world` 필드가 있어야 함
- `entry.disable !== true`
- `entry.content`가 비어있지 않아야 함
- `entry.vectorized === true` 또는 `enabledForAll === true`

**예상 작업 시간**: 1시간

#### 1.2 `getSavedHashesForWorld` 함수 구현 ✅
**목표**: 특정 월드의 벡터 저장소에 저장된 해시 목록 조회

**구현 완료**: `src/endpoints/worldinfo.js`에 구현됨

**구현 내용**:
```javascript
/**
 * Gets saved hashes from vector index for a specific world
 * @param {string} world World name
 * @param {string} vectorSource Vector source (e.g., 'transformers')
 * @param {object} sourceSettings Source settings for vector API
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @returns {Promise<number[]>} Array of saved hashes
 */
async function getSavedHashesForWorld(world, vectorSource, sourceSettings, directories) {
    // 1. 컬렉션 ID 생성: `world_${getStringHash(world)}`
    // 2. vectors.js의 getSavedHashes 호출
    // 3. 해시 배열 반환
    // 4. 에러 처리 (빈 배열 반환)
}
```

**예상 작업 시간**: 1시간

**Phase 1 총 예상 시간**: 2시간 ✅ 완료

### Phase 2: 동기화 메인 함수 구현

#### 2.1 `syncWorldInfoVectors` 함수 구현 ✅
**목표**: 월드인포 엔트리와 벡터 저장소 동기화

**구현 완료**: `src/endpoints/worldinfo.js`에 구현됨

**구현 내용**:
```javascript
/**
 * Synchronizes World Info entries with vector index
 * Adds new entries and removes deleted entries from the vector index
 * @param {Array<object>} entries All World Info entries (from getSortedEntries)
 * @param {object} vectorSettings Vector extension settings
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {import('express').Request} request Express request object (for vector API call)
 * @returns {Promise<object>} Object with synchronization results
 */
export async function syncWorldInfoVectors(entries, vectorSettings, directories, request) {
    // 1. 벡터 설정 확인 (enabled_world_info)
    // 2. 엔트리 그룹화 (groupEntriesByWorld)
    // 3. 각 월드별로:
    //    a. 기존 해시 조회 (getSavedHashesForWorld)
    //    b. 현재 엔트리 해시 계산
    //    c. 추가/삭제된 엔트리 식별
    //    d. insertVectorItems / deleteVectorItems 호출
    // 4. 결과 반환 및 로깅
}
```

**반환 값**:
```javascript
{
    synced: number,      // 동기화된 월드 수
    added: number,      // 추가된 엔트리 수
    deleted: number     // 삭제된 엔트리 수
}
```

**에러 처리**:
- 개별 월드 동기화 실패 시 다른 월드는 계속 진행
- 에러 로깅 및 경고 메시지

**예상 작업 시간**: 3-4시간

**Phase 2 총 예상 시간**: 3-4시간 ✅ 완료

### Phase 3: 통합 및 트리거

#### 3.1 `chats.js`에 동기화 호출 추가
**목표**: `prepare-messages` 엔드포인트에서 벡터 동기화 실행

**구현 위치**: `src/endpoints/chats.js`의 `prepare-messages` 엔드포인트

**구현 내용**:
```javascript
// getSortedEntries 호출 후
if (vectorSettings && vectorSettings.enabled_world_info && sortedEntries && sortedEntries.length > 0) {
    // 비동기로 동기화 실행 (응답 블로킹하지 않음)
    syncWorldInfoVectors(sortedEntries, vectorSettings, request.user.directories, request)
        .catch(error => console.error('[WI] Async vector synchronization failed:', error));
}
```

**주의사항**:
- 비동기 처리: `await` 없이 실행 (응답 지연 방지)
- 에러 처리: `.catch()`로 에러 로깅만 수행

**예상 작업 시간**: 1시간

#### 3.2 동기화 상태 관리 (선택사항)
**목표**: 동시에 여러 동기화 요청이 들어와도 하나만 실행

**구현 내용**:
- 동기화 진행 중 플래그 (`isSyncing`)
- 동기화 대기 큐 (선택사항)

**예상 작업 시간**: 1-2시간

**Phase 3 총 예상 시간**: 2-3시간

### Phase 4: 최적화 및 에러 처리

#### 4.1 동기화 최적화
**목표**: 불필요한 동기화 방지

**구현 내용**:
- 마지막 동기화 시간 추적
- 일정 시간 내 재동기화 방지 (선택사항)
- 변경 감지 개선 (해시 비교)

**예상 작업 시간**: 2-3시간

#### 4.2 에러 처리 개선
**목표**: 더 나은 에러 처리 및 복구

**구현 내용**:
- 상세한 에러 로깅
- 부분 실패 처리 (일부 월드만 실패해도 계속 진행)
- 재시도 로직 (선택사항)

**예상 작업 시간**: 1-2시간

**Phase 4 총 예상 시간**: 3-5시간

## 🧪 테스트 계획

### 단위 테스트

1. **`groupEntriesByWorld` 테스트**
   - 월드별 그룹화 확인
   - 필터링 조건 확인 (disable, content, vectorized)
   - `enabledForAll` 플래그 동작 확인

2. **`getSavedHashesForWorld` 테스트**
   - 컬렉션 ID 생성 확인
   - 해시 목록 조회 확인
   - 에러 처리 확인 (존재하지 않는 컬렉션)

3. **`syncWorldInfoVectors` 테스트**
   - 새 엔트리 추가 확인
   - 삭제된 엔트리 제거 확인
   - 변경된 엔트리 업데이트 확인
   - 여러 월드 동기화 확인

### 통합 테스트

1. **`prepare-messages` 통합 테스트**
   - 벡터 설정 활성화 시 동기화 실행 확인
   - 비동기 처리 확인 (응답 지연 없음)
   - 에러 발생 시에도 응답 정상 반환 확인

2. **벡터 검색 통합 테스트**
   - 동기화 후 벡터 검색 작동 확인
   - 새로 추가된 엔트리가 검색되는지 확인
   - 삭제된 엔트리가 검색되지 않는지 확인

### 시나리오 테스트

1. **시나리오 1: 새 월드인포 엔트리 추가**
   - 월드인포 파일에 새 엔트리 추가
   - `prepare-messages` 호출
   - 벡터 저장소에 새 엔트리 추가 확인
   - 벡터 검색으로 새 엔트리 활성화 확인

2. **시나리오 2: 월드인포 엔트리 삭제**
   - 월드인포 파일에서 엔트리 삭제
   - `prepare-messages` 호출
   - 벡터 저장소에서 엔트리 제거 확인
   - 벡터 검색에서 해당 엔트리 비활성화 확인

3. **시나리오 3: 월드인포 엔트리 내용 변경**
   - 월드인포 엔트리 내용 수정
   - `prepare-messages` 호출
   - 벡터 저장소에서 기존 항목 삭제 및 새 항목 추가 확인
   - 변경된 내용으로 벡터 검색 작동 확인

4. **시나리오 4: 여러 월드 동기화**
   - 여러 월드에 벡터화된 엔트리 존재
   - `prepare-messages` 호출
   - 모든 월드가 동기화되는지 확인
   - 일부 월드 실패 시에도 다른 월드는 정상 동기화되는지 확인

## 📊 예상 작업 시간

| Phase | 작업 | 예상 시간 |
|-------|------|----------|
| Phase 1 | 기본 헬퍼 함수 구현 | 2시간 |
| Phase 2 | 동기화 메인 함수 구현 | 3-4시간 |
| Phase 3 | 통합 및 트리거 | 2-3시간 |
| Phase 4 | 최적화 및 에러 처리 | 3-5시간 |
| **총계** | | **10-14시간** |

## 🚧 기술적 고려사항

### 1. 벡터 저장소 구조
- 월드별 컬렉션 분리로 관리 용이
- 컬렉션 ID는 월드 이름의 해시로 생성 (일관성 유지)

### 2. 해시 기반 변경 감지
- 엔트리 내용의 해시로 변경 감지
- 내용 변경 시 해시 변경 → 삭제 후 재추가

### 3. 비동기 처리
- 동기화는 응답을 블로킹하지 않음
- 사용자 경험 개선 (응답 지연 없음)

### 4. 에러 처리
- 개별 월드 실패 시에도 다른 월드는 계속 진행
- 상세한 로깅으로 디버깅 용이

### 5. 성능 최적화
- 배치 처리로 여러 엔트리 한 번에 처리
- 불필요한 재동기화 방지 (향후 구현)

## 📌 다음 단계

1. **Phase 1 시작**: 기본 헬퍼 함수 구현 (`groupEntriesByWorld`, `getSavedHashesForWorld`)
2. **Phase 2 진행**: 동기화 메인 함수 구현 (`syncWorldInfoVectors`)
3. **Phase 3 통합**: `chats.js`에 동기화 호출 추가
4. **테스트**: 각 Phase마다 테스트 진행
5. **최적화**: Phase 4에서 성능 및 에러 처리 개선

## 🔗 참고 자료

- `src/endpoints/worldinfo.js`: 월드인포 엔드포인트
- `src/endpoints/vectors.js`: 벡터 저장소 함수
- `src/endpoints/chats.js`: 채팅 엔드포인트 (통합 위치)
- `docs/WORLD_INFO_IMPLEMENTATION_PLAN.md`: 월드인포 구현 계획
- `public/scripts/extensions/vectors/index.js`: 클라이언트 벡터 확장 기능 (참고용)

