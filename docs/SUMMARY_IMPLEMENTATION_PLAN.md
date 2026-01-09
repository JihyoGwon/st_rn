# Summary 생성 기능 구현 계획

## 📋 개요

SillyTavern의 Summary 기능을 서버로 포팅하여 모바일 앱에서도 Summary가 자동으로 생성되고 사용되도록 구현합니다.

## 🎯 목표

- 앱에서 메시지를 보낼 때 Summary가 자동으로 생성되도록 구현
- 웹에서 설정한 Summary 설정이 앱에서도 동일하게 작동
- Summary 생성 API 엔드포인트 구현
- Summary 자동 생성 로직 구현 (업데이트 빈도 체크)

## ✅ 현재 상태

### 구현 완료
- [x] Summary 로드: 채팅 히스토리에서 `extra.memory` 필드 로드
- [x] Summary 설정 로드: `extension_settings.memory`에서 설정 로드
- [x] Summary 적용: 템플릿 적용 및 위치별 삽입
- [x] Summary 생성 함수 기본 구조: `generateSummaryForChat` 함수 추가
- [x] 자동 생성 체크: `prepare-messages`에서 업데이트 빈도 체크

### 미구현
- [x] 실제 Summary 생성 API 호출 ✅
- [x] Summary 생성 엔드포인트 (`/api/chats/summarize`) ✅
- [x] Summary 저장 로직 (채팅 히스토리에 저장) ✅

## 🔍 기술적 분석

### Summary 생성 프로세스

1. **조건 체크**
   - Summary 설정이 활성화되어 있는지 확인
   - 마지막 Summary 이후 메시지 수가 `promptInterval` 이상인지 확인
   - Summary 소스가 'main'인지 확인 (현재는 Main API만 지원)

2. **데이터 수집**
   - 채팅 히스토리에서 마지막 Summary 찾기
   - 마지막 Summary 이후의 메시지들 수집 (마지막 메시지 제외)
   - 기존 Summary와 새 메시지들을 결합

3. **프롬프트 생성**
   - Summary 프롬프트 템플릿 로드 (`extension_settings.memory.prompt`)
   - `{{words}}` 매크로를 실제 단어 수로 치환
   - 시스템 프롬프트와 사용자 프롬프트 생성

4. **API 호출**
   - `/api/backends/chat-completions/generate` 엔드포인트 호출
   - 요약 생성 요청
   - 응답에서 Summary 텍스트 추출

5. **저장**
   - 생성된 Summary를 채팅 히스토리의 `extra.memory` 필드에 저장
   - 두 번째 마지막 메시지에 저장 (마지막 메시지 제외)

### 주요 함수 및 엔드포인트

#### 클라이언트 코드 참고
- `public/scripts/extensions/memory/index.js`:
  - `summarizeChatMain()`: Main API를 사용한 Summary 생성
  - `getRawSummaryPrompt()`: Summary 프롬프트 생성
  - `setMemoryContext()`: Summary 저장

#### 서버 엔드포인트
- `/api/chats/prepare-messages`: 메시지 준비 (현재 Summary 로드만 구현)
- `/api/backends/chat-completions/generate`: 채팅 생성 (Summary 생성에 사용)

## 📝 구현 계획

### Phase 1: Summary 생성 API 엔드포인트 구현

#### 1.1 `/api/chats/summarize` 엔드포인트 추가
**목표**: Summary 생성을 위한 전용 엔드포인트 생성

**요구사항**:
- 요청 파라미터:
  - `character_id`: 캐릭터 ID (필수)
  - `chat_id`: 채팅 ID (필수)
  - `force`: 강제 생성 여부 (선택, 기본값: false)
- 응답:
  - `success`: 성공 여부
  - `summary`: 생성된 Summary 텍스트
  - `error`: 에러 메시지 (실패 시)

**구현 내용**:
```javascript
router.post('/summarize', validateAvatarUrlMiddleware, async function (request, response) {
    // 1. 파라미터 검증
    // 2. 채팅 히스토리 로드
    // 3. Summary 생성 조건 체크
    // 4. Summary 생성
    // 5. Summary 저장
    // 6. 응답 반환
});
```

**예상 작업 시간**: 2-3시간

#### 1.2 Summary 생성 로직 구현
**목표**: `generateSummaryForChat` 함수 완전 구현

**구현 내용**:
1. 채팅 히스토리에서 마지막 Summary 찾기
2. Summary 이후 메시지 수집
3. Summary 프롬프트 생성
4. Chat Completion API 호출
5. Summary 추출 및 저장

**주요 함수**:
- `getLatestSummaryFromChat()`: 마지막 Summary 찾기
- `collectMessagesForSummary()`: Summary용 메시지 수집
- `buildSummaryPrompt()`: Summary 프롬프트 생성
- `callChatCompletionForSummary()`: Chat Completion API 호출
- `saveSummaryToChat()`: Summary 저장

**예상 작업 시간**: 4-5시간

### Phase 2: Chat Completion API 호출 구현

#### 2.1 내부 API 호출 함수 구현
**목표**: 서버 내부에서 Chat Completion API를 호출하는 함수 구현

**문제점**:
- `/api/backends/chat-completions/generate`는 Express request/response 객체를 필요로 함
- 서버 내부에서 직접 호출하기 어려움

**해결 방안**:
1. **옵션 1**: Chat Completion 로직을 별도 모듈로 분리
   - 장점: 재사용 가능, 깔끔한 구조
   - 단점: 기존 코드 리팩토링 필요
   - 예상 작업 시간: 6-8시간

2. **옵션 2**: HTTP 요청으로 내부 엔드포인트 호출
   - 장점: 기존 코드 수정 최소화
   - 단점: HTTP 오버헤드, 인증 처리 필요
   - 예상 작업 시간: 2-3시간

3. **옵션 3**: Chat Completion 핵심 로직만 추출하여 함수로 구현
   - 장점: 효율적, 직접 호출 가능
   - 단점: 코드 중복 가능성
   - 예상 작업 시간: 4-5시간

**권장 방안**: 옵션 2 (HTTP 요청) - 빠른 구현, 기존 코드 수정 최소화

**구현 내용**:
```javascript
async function callChatCompletionForSummary(messages, settings) {
    // 1. 서버 설정 로드 (oai_settings)
    // 2. HTTP 요청 생성
    // 3. /api/backends/chat-completions/generate 호출
    // 4. 응답 파싱
    // 5. Summary 텍스트 추출
}
```

**예상 작업 시간**: 2-3시간

### Phase 3: Summary 자동 생성 통합

#### 3.1 `prepare-messages`에서 Summary 생성 호출
**목표**: 메시지 준비 시 자동으로 Summary 생성

**구현 내용**:
- Summary 생성 조건 체크
- 조건 만족 시 `/api/chats/summarize` 호출 (비동기)
- Summary 생성 완료 후 메시지에 적용

**주의사항**:
- Summary 생성은 비동기로 처리 (응답 지연 방지)
- Summary 생성 실패 시에도 메시지 전송은 계속 진행

**예상 작업 시간**: 1-2시간

#### 3.2 Summary 업데이트 빈도 체크 개선
**목표**: 메시지 수 및 단어 수 기반 체크 구현

**구현 내용**:
- `promptInterval`: 메시지 수 기반 체크
- `promptForceWords`: 단어 수 기반 체크 (선택적)
- 두 조건 중 하나라도 만족하면 Summary 생성

**예상 작업 시간**: 1시간

### Phase 4: 에러 처리 및 최적화

#### 4.1 에러 처리
**목표**: Summary 생성 실패 시 적절한 에러 처리

**구현 내용**:
- API 호출 실패 처리
- 타임아웃 처리
- 잘못된 응답 처리
- 로깅 및 디버깅 정보

**예상 작업 시간**: 1-2시간

#### 4.2 성능 최적화
**목표**: Summary 생성 성능 최적화

**구현 내용**:
- Summary 생성 요청 큐잉 (동시 요청 방지)
- Summary 생성 결과 캐싱
- 불필요한 API 호출 방지

**예상 작업 시간**: 2-3시간

## 🧪 테스트 계획

### 단위 테스트
1. Summary 로드 테스트
2. Summary 프롬프트 생성 테스트
3. Summary 저장 테스트
4. 조건 체크 테스트

### 통합 테스트
1. Summary 생성 엔드포인트 테스트
2. `prepare-messages`와 Summary 생성 통합 테스트
3. 앱에서 Summary 자동 생성 테스트

### 시나리오 테스트
1. **시나리오 1**: 첫 Summary 생성
   - 채팅 히스토리에 Summary가 없는 경우
   - 메시지 수가 `promptInterval` 이상인 경우
   - Summary 생성 및 저장 확인

2. **시나리오 2**: Summary 업데이트
   - 기존 Summary가 있는 경우
   - 기존 Summary를 기반으로 새 Summary 생성
   - Summary 업데이트 확인

3. **시나리오 3**: Summary 생성 실패
   - API 호출 실패 시
   - 에러 처리 확인
   - 메시지 전송은 정상 진행 확인

## 📊 예상 작업 시간

| Phase | 작업 | 예상 시간 |
|-------|------|----------|
| Phase 1 | Summary 생성 API 엔드포인트 | 6-8시간 |
| Phase 2 | Chat Completion API 호출 | 2-3시간 |
| Phase 3 | 자동 생성 통합 | 2-3시간 |
| Phase 4 | 에러 처리 및 최적화 | 3-5시간 |
| **총계** | | **13-19시간** |

## 🚧 기술적 고려사항

### 1. 서버 내부 API 호출
- Express request/response 객체 없이 API 호출하는 방법
- 인증 및 CSRF 토큰 처리
- HTTP 요청 vs 직접 함수 호출

### 2. 비동기 처리
- Summary 생성은 비동기로 처리해야 함
- 메시지 전송 응답 지연 방지
- Summary 생성 완료 후 적용 방법

### 3. 설정 동기화
- `extension_settings.memory` 설정 로드
- 웹에서 변경된 설정이 앱에 반영되는지 확인
- 기본값 처리

### 4. 성능
- Summary 생성은 시간이 걸리는 작업
- 동시 요청 처리
- 요청 큐잉 필요 여부

## 📌 다음 단계

1. **Phase 1 시작**: `/api/chats/summarize` 엔드포인트 구현
2. **옵션 선택**: Chat Completion API 호출 방법 결정
3. **프로토타입 구현**: 기본 기능 먼저 구현
4. **테스트**: 각 Phase마다 테스트 진행
5. **최적화**: 성능 및 에러 처리 개선

## 🔗 참고 자료

- `public/scripts/extensions/memory/index.js`: 클라이언트 Summary 구현
- `src/endpoints/chats.js`: 채팅 엔드포인트
- `src/endpoints/backends/chat-completions.js`: Chat Completion 엔드포인트
- `docs/SERVER_PORTING_CHECKLIST.md`: 서버 포팅 체크리스트

