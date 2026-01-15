# 벡터 메모리 및 벡터 요약 기능 구현 계획

## 📋 개요

SillyTavern의 벡터 메모리(3.3) 기능을 서버로 포팅하여 모바일 앱에서도 채팅 히스토리를 벡터화하고 검색하여 장기 기억을 구현합니다. 벡터 요약 기능도 함께 구현하여 추후 필요 시 사용할 수 있도록 합니다.

## 🎯 목표

- 앱에서 메시지를 보낼 때 채팅 히스토리를 벡터화하여 저장
- 벡터 검색을 통해 관련된 과거 메시지를 자동으로 프롬프트에 삽입
- 벡터 요약 기능 구현 (당장 사용하지 않더라도 구현해두기)
- 웹에서 설정한 벡터 메모리 설정이 앱에서도 동일하게 작동
- 과거 대화 맥락을 기억할 수 있도록 캐릭터별 벡터 저장소 구현

## ✅ 현재 상태

### 구현 완료
- [x] 벡터 저장소 기본 구조 (`vectra.LocalIndex` 사용)
- [x] 벡터 검색 API (`/api/vector/query`)
- [x] 벡터 삽입 API (`/api/vector/insert`)
- [x] 벡터 삭제 API (`/api/vector/delete`)
- [x] 벡터 해시 조회 API (`/api/vector/get-hashes`)
- [x] 월드 인포 벡터 동기화 (별도 구현 완료)

### 미구현
- [ ] 벡터 메모리 설정 로드 (`extension_settings.vectors`)
- [ ] 채팅 히스토리 벡터화 (`synchronizeChat` 로직)
- [ ] 벡터 검색 및 프롬프트 삽입 (`rearrangeChat` 로직)
- [ ] 벡터 요약 기능 (`summarize` 로직)
- [ ] 검색 쿼리 요약 (`summarize_sent` 로직)
- [ ] 캐릭터별 벡터 저장소 (현재는 채팅별)

## 🔍 기술적 분석

### 벡터 메모리 구조

#### 저장소 위치
```
user/vectors/{source}/{collectionId}/{model}/
```
- `source`: 벡터 소스 (transformers, openai, etc.)
- `collectionId`: 현재는 `chatId` (채팅별), 변경 예정: `characterId` (캐릭터별)
- `model`: 벡터 모델명

#### 벡터 저장 형식
```javascript
{
  vector: [0.123, -0.456, ...],  // 벡터 임베딩
  metadata: {
    hash: 1234567890,           // 원본 메시지 해시
    text: "요약된 메시지...",    // 요약본 또는 원본
    index: 5                     // 메시지 인덱스
  }
}
```

### 벡터 메모리 프로세스

#### 1. 동기화 (Synchronization)
- 채팅 히스토리에서 새 메시지와 삭제된 메시지 감지
- 새 메시지를 벡터화하여 저장소에 추가
- 삭제된 메시지를 저장소에서 제거
- **벡터 요약 활성화 시**: 메시지를 요약한 후 벡터화

#### 2. 검색 (Query)
- 최근 N개 메시지로 검색 쿼리 생성
- **검색 쿼리 요약 활성화 시**: 쿼리 텍스트를 요약
- 벡터 저장소에서 유사한 메시지 검색
- 스코어 임계값 이상인 결과만 선택

#### 3. 삽입 (Insert)
- 검색 결과의 해시로 원본 메시지 찾기
- 템플릿 적용하여 프롬프트에 삽입
- 위치/깊이/역할에 따라 적절한 위치에 삽입

### 벡터 요약 기능

#### 요약 저장 (`summarize: true`)
- 메시지를 벡터화하기 전에 요약
- 요약본을 벡터 저장소에 저장
- 원본 메시지의 해시는 메타데이터에 저장
- 검색 시 해시로 원본 메시지를 찾아 삽입

#### 검색 쿼리 요약 (`summarize_sent: true`)
- 검색 쿼리 텍스트를 요약
- 요약된 쿼리로 벡터 검색 수행
- 벡터 저장소에 요약본이 저장되어 있을 때 정확도 향상

### 주요 설정

```javascript
extension_settings.vectors = {
  enabled_chats: true,              // 벡터 메모리 활성화
  source: 'transformers',            // 벡터 소스
  model: '',                        // 벡터 모델
  summarize: false,                 // 메시지 요약 활성화
  summarize_sent: false,            // 검색 쿼리 요약 활성화
  summary_source: 'main',          // 요약 소스 (main/extras/webllm)
  summary_prompt: '...',            // 요약 프롬프트
  query: 2,                         // 검색 쿼리 메시지 수
  insert: 5,                        // 삽입할 메시지 수
  protect: 5,                       // 보호할 메시지 수 (최근 N개)
  score_threshold: 0.25,            // 스코어 임계값
  template: 'Past events:\n{{text}}', // 템플릿
  position: 0,                      // 위치 (IN_PROMPT/IN_CHAT)
  depth: 2,                         // 깊이
  role: 'system',                   // 역할
  message_chunk_size: 0,            // 메시지 청크 크기
  // ... 기타 설정
}
```

## 📝 구현 계획

### Phase 1: 벡터 메모리 설정 로드 및 기본 구조 (2-3시간)

#### 1.1 벡터 메모리 설정 로드
**목표**: `prepare-messages` 엔드포인트에서 벡터 메모리 설정 로드

**구현 내용**:
- `extension_settings.vectors` 로드
- 벡터 메모리 활성화 여부 확인 (`enabled_chats`)
- 필수 설정값 검증

**예상 작업 시간**: 30분

#### 1.2 벡터 동기화 함수 기본 구조
**목표**: 채팅 히스토리를 벡터화하는 함수 구조 생성

**구현 내용**:
- `synchronizeChatVectors` 함수 생성
- 채팅 히스토리 로드
- 새 메시지와 삭제된 메시지 감지 로직
- 벡터 저장소 API 호출 준비

**예상 작업 시간**: 1-1.5시간

#### 1.3 벡터 검색 함수 기본 구조
**목표**: 벡터 검색 및 프롬프트 삽입 함수 구조 생성

**구현 내용**:
- `queryChatVectors` 함수 생성
- 검색 쿼리 텍스트 생성 로직
- 벡터 검색 API 호출
- 검색 결과 처리 준비

**예상 작업 시간**: 1시간

---

### Phase 2: 벡터 동기화 구현 (3-4시간)

#### 2.1 채팅 히스토리 벡터화
**목표**: 새 메시지를 벡터화하여 저장소에 추가

**구현 내용**:
```javascript
async function synchronizeChatVectors(chatHistory, chatId, vectorSettings, directories, request) {
  // 1. 채팅 히스토리에서 메시지 추출 (시스템 메시지 제외)
  const hashedMessages = chatHistory
    .filter(x => !x.is_system)
    .map(x => ({
      text: String(substituteParams(x.mes)),
      hash: getStringHash(substituteParams(x.mes)),
      index: chatHistory.indexOf(x)
    }));
  
  // 2. 저장소에 있는 해시 조회
  const hashesInCollection = await getSavedHashes(directories, chatId, ...);
  
  // 3. 새 메시지와 삭제된 메시지 감지
  const newVectorItems = hashedMessages.filter(x => !hashesInCollection.includes(x.hash));
  const deletedHashes = hashesInCollection.filter(x => !hashedMessages.some(y => y.hash === x));
  
  // 4. 벡터 요약 (설정 활성화 시)
  if (vectorSettings.summarize) {
    newVectorItems = await summarizeMessages(newVectorItems, vectorSettings, request);
  }
  
  // 5. 벡터 저장소에 추가
  if (newVectorItems.length > 0) {
    await insertVectorItems(directories, chatId, ..., newVectorItems);
  }
  
  // 6. 삭제된 메시지 제거
  if (deletedHashes.length > 0) {
    await deleteVectorItems(directories, chatId, ..., deletedHashes);
  }
}
```

**예상 작업 시간**: 2시간

#### 2.2 메시지 청크 분할
**목표**: 긴 메시지를 청크로 분할하여 벡터화

**구현 내용**:
- `message_chunk_size` 설정 확인
- 메시지가 설정값보다 길면 분할
- 청크별로 벡터화

**예상 작업 시간**: 1시간

#### 2.3 동기화 통합
**목표**: `prepare-messages` 엔드포인트에 벡터 동기화 통합

**구현 내용**:
- 벡터 메모리 활성화 시 자동 동기화
- 비동기 처리로 응답 지연 방지
- 에러 처리 및 로깅

**예상 작업 시간**: 1시간

---

### Phase 3: 벡터 검색 및 프롬프트 삽입 구현 (3-4시간)

#### 3.1 검색 쿼리 생성
**목표**: 최근 메시지로 검색 쿼리 텍스트 생성

**구현 내용**:
```javascript
function getQueryTextForChat(chatHistory, queryCount) {
  // 최근 N개 메시지 추출
  const recentMessages = chatHistory
    .filter(x => !x.is_system && x.mes)
    .slice(-queryCount)
    .map(x => substituteParams(x.mes))
    .reverse();
  
  return recentMessages.join('\n');
}
```

**예상 작업 시간**: 30분

#### 3.2 벡터 검색 수행
**목표**: 벡터 저장소에서 관련 메시지 검색

**구현 내용**:
```javascript
async function queryChatVectors(chatHistory, chatId, vectorSettings, directories, request) {
  // 1. 검색 쿼리 텍스트 생성
  let queryText = getQueryTextForChat(chatHistory, vectorSettings.query);
  
  // 2. 검색 쿼리 요약 (설정 활성화 시)
  if (vectorSettings.summarize && vectorSettings.summarize_sent) {
    queryText = await summarizeQueryText(queryText, vectorSettings, request);
  }
  
  // 3. 벡터 검색 수행
  const queryResults = await queryCollection(
    directories, chatId, ...,
    queryText,
    vectorSettings.insert,
    vectorSettings.score_threshold
  );
  
  // 4. 검색 결과의 해시로 원본 메시지 찾기
  const queriedMessages = [];
  const queryHashes = queryResults.hashes;
  const retainMessages = chatHistory.slice(-vectorSettings.protect);
  
  for (const message of chatHistory) {
    if (retainMessages.includes(message)) continue;
    const hash = getStringHash(substituteParams(message.mes));
    if (queryHashes.includes(hash)) {
      queriedMessages.push(message);
    }
  }
  
  return queriedMessages;
}
```

**예상 작업 시간**: 2시간

#### 3.3 프롬프트 삽입
**목표**: 검색 결과를 프롬프트에 삽입

**구현 내용**:
- 템플릿 적용 (`{{text}}` 치환)
- 위치/깊이/역할에 따라 삽입
- `response.locals.extensionPrompts`에 추가

**예상 작업 시간**: 1-1.5시간

---

### Phase 4: 벡터 요약 기능 구현 (4-5시간)

#### 4.1 메시지 요약 함수 (`summarize: true`)
**목표**: 메시지를 요약하는 함수 구현

**구현 내용**:
```javascript
async function summarizeMessages(messages, vectorSettings, request) {
  const summarySource = vectorSettings.summary_source || 'main';
  const summaryPrompt = vectorSettings.summary_prompt || DEFAULT_SUMMARY_PROMPT;
  
  const summarizedMessages = [];
  
  for (const message of messages) {
    let summary;
    
    switch (summarySource) {
      case 'main':
        // Main API 사용
        summary = await generateSummaryMain(message.text, summaryPrompt, request);
        break;
      case 'extras':
        // Extras API 사용
        summary = await generateSummaryExtras(message.text, request);
        break;
      case 'webllm':
        // WebLLM 사용 (선택사항)
        summary = await generateSummaryWebLLM(message.text, summaryPrompt);
        break;
    }
    
    summarizedMessages.push({
      ...message,
      text: summary || message.text  // 요약 실패 시 원본 사용
    });
  }
  
  return summarizedMessages;
}
```

**예상 작업 시간**: 2-2.5시간

#### 4.2 검색 쿼리 요약 함수 (`summarize_sent: true`)
**목표**: 검색 쿼리 텍스트를 요약하는 함수 구현

**구현 내용**:
- `summarizeMessages` 함수 재사용
- 단일 메시지로 처리
- 요약된 쿼리로 벡터 검색 수행

**예상 작업 시간**: 1시간

#### 4.3 요약 캐싱
**목표**: 동일한 메시지의 중복 요약 방지

**구현 내용**:
- 해시 기반 캐시 구현
- 메모리 내 캐시 또는 파일 기반 캐시
- 요약된 텍스트 재사용

**예상 작업 시간**: 1-1.5시간

---

### Phase 5: 캐릭터별 벡터 저장소 구현 (2-3시간)

#### 5.1 Collection ID 변경
**목표**: 채팅별 저장소를 캐릭터별 저장소로 변경

**구현 내용**:
```javascript
// 현재: chatId 사용
const collectionId = chatId;  // "캐릭터명 - 2024-01-07 18:26:08"

// 변경: characterId 사용
const characterId = characterFileName.replace('.png', '');  // "캐릭터명"
const collectionId = characterId;
```

**영향 범위**:
- `synchronizeChatVectors`: `chatId` → `characterId`
- `queryChatVectors`: `chatId` → `characterId`
- 벡터 저장소 경로 변경

**예상 작업 시간**: 1-1.5시간

#### 5.2 기존 벡터 데이터 마이그레이션 (선택사항)
**목표**: 기존 채팅별 벡터 데이터를 캐릭터별로 통합

**구현 내용**:
- 마이그레이션 스크립트 작성
- 기존 채팅별 벡터 데이터 읽기
- 캐릭터별로 통합하여 저장
- 기존 데이터 백업

**예상 작업 시간**: 1-1.5시간

**참고**: 이 작업은 선택사항이며, 필요 시 나중에 수행 가능

---

### Phase 6: 통합 및 최적화 (2-3시간)

#### 6.1 `prepare-messages` 엔드포인트 통합
**목표**: 벡터 메모리 기능을 `prepare-messages`에 완전 통합

**구현 내용**:
- 벡터 동기화 호출 (비동기)
- 벡터 검색 및 프롬프트 삽입
- 다른 확장 프롬프트와의 조화

**예상 작업 시간**: 1시간

#### 6.2 에러 처리 및 로깅
**목표**: 안정적인 에러 처리 및 상세 로깅

**구현 내용**:
- 벡터화 실패 시 원본 메시지 사용
- 검색 실패 시 빈 결과 반환
- 상세한 디버그 로그

**예상 작업 시간**: 1시간

#### 6.3 성능 최적화
**목표**: 벡터 동기화 및 검색 성능 최적화

**구현 내용**:
- 배치 처리 최적화
- 비동기 처리로 응답 지연 방지
- 불필요한 벡터화 방지 (변경 감지)

**예상 작업 시간**: 1시간

---

## 🧪 테스트 계획

### 단위 테스트
- [ ] 벡터 동기화 함수 테스트
- [ ] 벡터 검색 함수 테스트
- [ ] 벡터 요약 함수 테스트
- [ ] 검색 쿼리 요약 함수 테스트

### 통합 테스트
- [ ] 벡터 메모리 전체 플로우 테스트
- [ ] 벡터 요약 활성화 시 플로우 테스트
- [ ] 검색 쿼리 요약 활성화 시 플로우 테스트
- [ ] 캐릭터별 벡터 저장소 테스트

### 시나리오 테스트
- [ ] 새 메시지 벡터화 테스트
- [ ] 삭제된 메시지 제거 테스트
- [ ] 관련 메시지 검색 및 삽입 테스트
- [ ] 긴 대화에서의 벡터 메모리 동작 테스트

---

## 📊 예상 작업 시간

| Phase | 작업 내용 | 예상 시간 |
|-------|----------|----------|
| Phase 1 | 설정 로드 및 기본 구조 | 2-3시간 |
| Phase 2 | 벡터 동기화 구현 | 3-4시간 |
| Phase 3 | 벡터 검색 및 프롬프트 삽입 | 3-4시간 |
| Phase 4 | 벡터 요약 기능 구현 | 4-5시간 |
| Phase 5 | 캐릭터별 벡터 저장소 | 2-3시간 |
| Phase 6 | 통합 및 최적화 | 2-3시간 |
| **총계** | | **16-22시간** |

---

## 📌 참고사항

### 벡터 요약 기능
- 당장 사용하지 않더라도 구현해두기
- `summarize: false`로 기본값 설정
- 필요 시 웹 UI에서 활성화 가능

### 캐릭터별 벡터 저장소
- 새 채팅이 생성되어도 과거 대화 맥락 기억 가능
- 같은 캐릭터의 모든 채팅이 하나의 벡터 저장소 공유
- 채팅별 독립성은 포기하지만 장기 기억 향상

### 벡터 저장소 구조
- `vectra.LocalIndex` 사용 (파일 시스템 기반)
- AWS EBS에 저장 시에도 로컬 파일 시스템으로 동작
- PostgreSQL + pgvector로 마이그레이션 가능 (추후)

---

## 🔗 관련 문서

- `docs/SERVER_PORTING_CHECKLIST.md`: 서버 포팅 체크리스트
- `docs/WORLD_INFO_IMPLEMENTATION_PLAN.md`: 월드 인포 벡터 동기화 (참고)
- `public/scripts/extensions/vectors/index.js`: 클라이언트 벡터 메모리 구현 (참고)

