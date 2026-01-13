# 월드인포 (World Info / Lorebook) 구현 계획

## 📋 개요

SillyTavern의 월드인포 기능을 서버로 포팅하여 모바일 앱에서도 월드인포가 자동으로 활성화되고 사용되도록 구현합니다.

## 🎯 목표

- 앱에서 메시지를 보낼 때 월드인포가 자동으로 스캔되고 활성화되도록 구현
- 웹에서 설정한 월드인포 설정이 앱에서도 동일하게 작동
- 캐릭터별로 지정된 월드인포가 자동으로 로드되고 사용됨
- 키워드 기반 자동 활성화 기능 구현

## ✅ 현재 상태

### 구현 완료
- [x] 월드인포 파일 로드 (`/api/chats/prepare-messages`에서 처리) ✅
- [x] 모든 엔트리 포함 (현재는 모든 엔트리 포함) ✅
- [x] 위치 기반 분리 (Before/After) - worldInfoBefore/worldInfoAfter로 분리 (현재는 모두 Before에 포함) ✅
- [x] **Phase 1.1**: 캐릭터 월드인포 로드 함수 구현 (`getCharacterWorldInfo`) ✅

### 미구현
- [ ] 키워드 기반 필터링 (스캔 로직 미구현)
- [ ] 엔트리 수집 로직 (Global, Character, Chat, Persona)
- [ ] 키워드 매칭 로직
- [ ] 활성화 제어 로직

## 🔍 기술적 분석

### 월드인포 작동 방식

#### 1. 월드인포 소스 (4가지)
1. **Global Lore**: 전역으로 선택한 월드인포 (`selected_world_info`)
2. **Character Lore**: 캐릭터에 지정된 월드인포
   - Primary: `character.data.extensions.world`
   - Additional: `world_info.charLore` (추가 월드인포)
3. **Chat Lore**: 채팅별로 지정된 월드인포 (`chat_metadata[METADATA_KEY]`)
4. **Persona Lore**: 페르소나에 지정된 월드인포 (`power_user.persona_description_lorebook`)

#### 2. 엔트리 수집 및 정렬
- `getSortedEntries()` 함수에서 모든 소스에서 엔트리 수집
- 전략에 따라 정렬:
  - Character First: 캐릭터 월드인포 우선
  - Global First: 전역 월드인포 우선
  - Evenly: 균등하게 섞기
- 최종 순서: Chat Lore → Persona Lore → (Global + Character)

#### 3. 활성화 로직
- `checkWorldInfo()` 함수에서 채팅 내용을 스캔
- 키워드 매칭으로 엔트리 활성화
- 활성화된 엔트리만 프롬프트에 포함

### 주요 함수 및 엔드포인트

#### 클라이언트 코드 참고
- `public/scripts/world-info.js`:
  - `getSortedEntries()`: 모든 소스에서 엔트리 수집 및 정렬
  - `getCharacterLore()`: 캐릭터 월드인포 엔트리 수집
  - `getGlobalLore()`: 전역 월드인포 엔트리 수집
  - `checkWorldInfo()`: 채팅 스캔 및 엔트리 활성화
  - `getWorldInfoPrompt()`: 활성화된 월드인포 프롬프트 생성

#### 서버 엔드포인트
- `/api/chats/prepare-messages`: 메시지 준비 (현재 월드인포 파일 로드만 구현)
- `/api/worldinfo/get`: 월드인포 파일 로드 (필요 시)

## 📝 구현 계획

### Phase 1: 핵심 기능 (기본 동작)

#### 1.1 캐릭터 월드인포 로드 ✅
**목표**: 캐릭터에 지정된 월드인포 파일 로드

**구현 내용**:
1. 캐릭터 데이터에서 월드인포 이름 가져오기
   - `character.data.extensions.world` (Primary)
   - `world_info.charLore` (Additional) - 나중에 구현
2. 해당 월드인포 파일 로드
3. 엔트리 파싱 및 반환

**주요 함수**:
```javascript
export function getCharacterWorldInfo(directories, characterData) {
    // 1. 캐릭터 데이터에서 월드인포 이름 가져오기
    // 2. 월드인포 파일 로드
    // 3. 엔트리를 배열로 변환하고 'world' 필드 추가
    // 4. 엔트리 반환
}
```

**구현 완료**:
- ✅ `src/endpoints/worldinfo.js`에 `getCharacterWorldInfo` 함수 추가
- ✅ `src/endpoints/chats.js`의 `prepare-messages`에서 사용하도록 통합
- ✅ 엔트리를 객체에서 배열로 변환
- ✅ 각 엔트리에 `world` 필드 추가

**예상 작업 시간**: 2-3시간

#### 1.2 엔트리 수집 로직 구현
**목표**: Global Lore와 Character Lore 엔트리 수집

**구현 내용**:
1. Global Lore 수집 (`selected_world_info` 기반)
2. Character Lore 수집 (캐릭터의 월드인포)
3. 전략에 따른 정렬 (Character First, Global First, Evenly)
4. 중복 제거 (같은 월드인포가 여러 소스에 있으면 한 번만)

**주요 함수**:
```javascript
async function getSortedEntries(characterId, globalWorldInfo) {
    // 1. Global Lore 수집
    // 2. Character Lore 수집
    // 3. 전략에 따라 정렬
    // 4. 엔트리 반환
}
```

**예상 작업 시간**: 3-4시간

#### 1.3 기본 키워드 매칭 구현
**목표**: Primary Keywords만 사용한 기본 키워드 매칭

**구현 내용**:
1. 채팅 내용을 텍스트로 변환
2. 각 엔트리의 Primary Keywords 검색
3. 키워드 매칭 시 엔트리 활성화
4. 활성화된 엔트리만 반환

**주요 함수**:
```javascript
async function checkWorldInfo(chat, entries, maxContext) {
    // 1. 채팅 내용을 스캔 가능한 텍스트로 변환
    // 2. 각 엔트리의 키워드 검색
    // 3. 매칭된 엔트리 활성화
    // 4. 활성화된 엔트리 반환
}
```

**예상 작업 시간**: 4-5시간

#### 1.4 월드인포 프롬프트 생성
**목표**: 활성화된 엔트리를 프롬프트 형식으로 변환

**구현 내용**:
1. 활성화된 엔트리 포맷팅
2. 위치별 분리 (Before/After)
3. 프롬프트에 포함

**주요 함수**:
```javascript
function formatWorldInfo(activatedEntries) {
    // 1. 엔트리 포맷팅
    // 2. Before/After 분리
    // 3. 프롬프트 문자열 생성
}
```

**예상 작업 시간**: 2-3시간

**Phase 1 총 예상 시간**: 11-15시간

### Phase 2: 기본 필터링 및 정렬

#### 2.1 보조 키워드 (Secondary Keywords) 구현
**목표**: Secondary Keywords 매칭 로직 추가

**구현 내용**:
- Primary Keywords 매칭 후 Secondary Keywords 체크
- Selective 로직 적용 (AND ANY, AND ALL 등)

**예상 작업 시간**: 2-3시간

#### 2.2 키워드 로직 구현
**목표**: AND ANY, AND ALL, NOT ANY, NOT ALL 로직 구현

**구현 내용**:
- `selectiveLogic` 필드에 따른 키워드 매칭 로직
- Primary와 Secondary 키워드 조합 처리

**예상 작업 시간**: 3-4시간

#### 2.3 위치 분리 개선
**목표**: Before/After 외 추가 위치 지원

**구현 내용**:
- At Depth, ANTop, ANBottom, Outlet 위치 지원
- 위치별 엔트리 분리 및 적용

**예상 작업 시간**: 2-3시간

#### 2.4 우선순위 정렬
**목표**: Order 필드 기반 정렬

**구현 내용**:
- 엔트리의 `order` 필드로 정렬
- 같은 우선순위 내에서 안정적 정렬

**예상 작업 시간**: 1시간

**Phase 2 총 예상 시간**: 8-11시간

### Phase 3: 고급 필터링

#### 3.1 대소문자 구분 및 전체 단어 매칭
**목표**: 전역 설정 및 엔트리별 오버라이드 지원

**구현 내용**:
- 전역 설정: `world_info_case_sensitive`, `world_info_match_whole_words`
- 엔트리별 오버라이드: `caseSensitive`, `matchWholeWords`
- 엔트리별 설정이 있으면 우선 적용

**예상 작업 시간**: 2-3시간

#### 3.2 스캔 깊이 구현
**목표**: 전역 및 엔트리별 스캔 깊이 지원

**구현 내용**:
- 전역 설정: `world_info_depth`
- 엔트리별 오버라이드: `scanDepth`
- 스캔 깊이에 따라 채팅 히스토리 범위 제한

**예상 작업 시간**: 2-3시간

#### 3.3 트리거 확률 구현
**목표**: Probability 및 Use Probability 지원

**구현 내용**:
- `probability` 필드로 확률 체크
- `useProbability`가 false면 항상 활성화
- 랜덤 확률 체크 로직

**예상 작업 시간**: 1-2시간

**Phase 3 총 예상 시간**: 5-8시간

### Phase 4: 그룹 및 Inclusion

#### 4.1 Inclusion Group 구현
**목표**: Inclusion Group 필터링 로직

**구현 내용**:
- 그룹별 엔트리 필터링
- 그룹 스코어링 로직
- 그룹 오버라이드 및 가중치 처리

**예상 작업 시간**: 4-5시간

#### 4.2 그룹 스코어링 구현
**목표**: Group Scoring 로직 구현

**구현 내용**:
- 전역 설정: `world_info_use_group_scoring`
- 엔트리별 오버라이드: `useGroupScoring`
- 그룹 가중치 기반 선택

**예상 작업 시간**: 2-3시간

**Phase 4 총 예상 시간**: 6-8시간

### Phase 5: 활성화 제어

#### 5.1 Constant 및 Disable 구현
**목표**: 항상 활성화 및 비활성화 로직

**구현 내용**:
- `constant`: 항상 활성화
- `disable`: 비활성화 (스캔 제외)

**예상 작업 시간**: 1시간

#### 5.2 Sticky/Cooldown/Delay 구현
**목표**: 시간 기반 활성화 제어

**구현 내용**:
- Sticky: 지속 활성화 (채팅 인덱스 기반)
- Cooldown: 재사용 대기 시간
- Delay: 지연 활성화
- 채팅 메타데이터에 상태 저장

**예상 작업 시간**: 4-5시간

#### 5.3 Decorators 구현
**목표**: @@activate, @@dont_activate 데코레이터 지원

**구현 내용**:
- 엔트리 내용에서 decorator 파싱
- @@activate: 강제 활성화
- @@dont_activate: 강제 비활성화

**예상 작업 시간**: 1-2시간

**Phase 5 총 예상 시간**: 6-8시간

### Phase 6: 재귀 및 예산

#### 6.1 재귀 스캔 구현
**목표**: 재귀 스캔 로직 구현

**구현 내용**:
- 전역 설정: `world_info_recursive`
- 재귀 제어: `excludeRecursion`, `preventRecursion`
- 재귀 지연: `delayUntilRecursion`
- 최대 재귀 단계: `maxRecursionSteps`

**예상 작업 시간**: 5-6시간

#### 6.2 토큰 예산 관리
**목표**: 예산 기반 엔트리 선택

**구현 내용**:
- 전역 설정: `world_info_budget` (%), `world_info_budget_cap`
- 예산 계산: `budget = maxContext * world_info_budget / 100`
- 예산 내에서 엔트리 선택
- `ignoreBudget` 필드 지원

**예상 작업 시간**: 3-4시간

#### 6.3 최소 활성화 수 구현
**목표**: Min Activations 로직

**구현 내용**:
- `world_info_min_activations`: 최소 활성화 수
- `world_info_min_activations_depth_max`: 최대 깊이
- 최소 활성화 수에 도달할 때까지 스캔

**예상 작업 시간**: 2-3시간

**Phase 6 총 예상 시간**: 10-13시간

### Phase 7: 특수 기능

#### 7.1 벡터 기반 검색 연동
**목표**: 벡터 확장 기능과 연동

**구현 내용**:
- `vectorized` 플래그 확인
- 벡터 검색 API 호출 (`/api/vector`)
- 벡터 검색 결과로 엔트리 활성화

**예상 작업 시간**: 4-5시간

#### 7.2 출력 타입 구현
**목표**: Example Messages, Depth Entries 등

**구현 내용**:
- EMEntries: Example Messages
- WIDepthEntries: Depth Entries
- ANBeforeEntries/ANAfterEntries: Authors Note 위치
- Outlet Entries: Outlet 위치

**예상 작업 시간**: 3-4시간

#### 7.3 필터링 옵션 구현
**목표**: 캐릭터/태그 필터링 및 매칭 옵션

**구현 내용**:
- 캐릭터 이름/태그 필터링
- Persona/Character Description 매칭
- Scenario, Creator Notes 매칭

**예상 작업 시간**: 4-5시간

**Phase 7 총 예상 시간**: 11-14시간

## 🧪 테스트 계획

### 단위 테스트
1. 월드인포 파일 로드 테스트
2. 엔트리 수집 테스트 (Global, Character)
3. 키워드 매칭 테스트
4. 활성화 로직 테스트

### 통합 테스트
1. `prepare-messages`와 월드인포 통합 테스트
2. 캐릭터별 월드인포 자동 로드 테스트
3. 앱에서 월드인포 자동 활성화 테스트

### 시나리오 테스트
1. **시나리오 1**: 기본 키워드 매칭
   - 채팅 내용에 키워드가 있는 경우
   - 해당 엔트리 활성화 확인
   - 프롬프트에 포함 확인

2. **시나리오 2**: 캐릭터별 월드인포
   - 캐릭터에 월드인포가 지정된 경우
   - 해당 월드인포 엔트리 수집 확인
   - 전략에 따른 정렬 확인

3. **시나리오 3**: 위치 분리
   - Before/After 위치 엔트리 분리 확인
   - 프롬프트에 올바른 위치에 포함 확인

## 📊 예상 작업 시간

| Phase | 작업 | 예상 시간 |
|-------|------|----------|
| Phase 1 | 핵심 기능 (기본 동작) | 11-15시간 |
| Phase 2 | 기본 필터링 및 정렬 | 8-11시간 |
| Phase 3 | 고급 필터링 | 5-8시간 |
| Phase 4 | 그룹 및 Inclusion | 6-8시간 |
| Phase 5 | 활성화 제어 | 6-8시간 |
| Phase 6 | 재귀 및 예산 | 10-13시간 |
| Phase 7 | 특수 기능 | 11-14시간 |
| **총계** | | **57-77시간** |

## 🚧 기술적 고려사항

### 1. 월드인포 파일 로드
- 캐릭터 데이터에서 월드인포 이름 가져오기
- 월드인포 파일 경로 확인 및 로드
- 파일이 없거나 비어있는 경우 처리

### 2. 엔트리 수집 및 정렬
- 여러 소스에서 엔트리 수집
- 중복 제거 로직
- 전략에 따른 정렬

### 3. 키워드 매칭 성능
- 대량의 엔트리에서 키워드 검색
- 효율적인 매칭 알고리즘 필요
- 정규식 vs 문자열 검색

### 4. 채팅 내용 스캔
- 채팅 히스토리를 텍스트로 변환
- 스캔 깊이에 따른 범위 제한
- 이름 포함 여부 처리

### 5. 예산 관리
- 토큰 수 계산
- 예산 내에서 엔트리 선택
- 우선순위 기반 선택

### 6. 재귀 스캔
- 무한 루프 방지
- 재귀 깊이 제한
- 성능 최적화

## 📌 다음 단계

1. **Phase 1 시작**: 캐릭터 월드인포 로드 및 기본 키워드 매칭 구현
2. **프로토타입 구현**: 기본 기능 먼저 구현
3. **테스트**: 각 Phase마다 테스트 진행
4. **점진적 확장**: 세부 기능 단계적으로 추가
5. **최적화**: 성능 및 에러 처리 개선

## 🔗 참고 자료

- `public/scripts/world-info.js`: 클라이언트 월드인포 구현
- `src/endpoints/chats.js`: 채팅 엔드포인트
- `src/endpoints/worldinfo.js`: 월드인포 엔드포인트 (존재 시)
- `docs/SERVER_PORTING_CHECKLIST.md`: 서버 포팅 체크리스트

