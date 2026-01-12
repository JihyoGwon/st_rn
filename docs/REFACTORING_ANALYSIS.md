# 리팩토링 분석 문서

## 개요
SillyTavern React Native 앱의 코드 품질을 분석하고 리팩토링이 필요한 부분을 정리한 문서입니다.

---

## 1. 하드코딩된 값들 (매직 넘버/문자열)

### 1.1 서버 URL 하드코딩 및 수동 입력 제거 ✅ 완료
**위치**: 여러 파일
**상태**: 완료 (2024년)
**문제점**:
- `lib/api/client.ts:13`: `'http://192.168.0.197:8001'` 하드코딩
- `store/app-settings-store.ts:62`: 동일한 기본 URL 하드코딩
- `components/character-card.tsx:33`: `'http://localhost:8000/characters/'` 하드코딩 (포트 불일치)
- `app/(tabs)/profile.tsx`: 사용자가 수동으로 서버 URL을 입력하도록 되어 있음

**현재 상황**:
- 프로필 화면에서 서버 URL을 수동으로 입력할 수 있음
- 자동 감지 기능도 있지만, 수동 입력이 기본 UI로 노출됨
- `useNetworkDiscovery` 훅이 앱 시작 시 자동 감지를 시도하지만, 실패 시 사용자가 수동으로 입력해야 함

**영향**:
- 서버 포트나 기본 IP 변경 시 여러 파일 수정 필요
- 캐릭터 이미지 URL이 서버 설정과 무관하게 하드코딩됨
- 사용자가 서버 주소를 직접 알아야 하는 부담
- 자동 감지 기능이 있음에도 수동 입력이 필요함

**해결 방안**:

#### 방안 1: 완전 자동화 - 프로필 화면 제거 (최종 권장)
**개념**: 프로필 화면에서 서버 관련 UI를 전부 제거하고, 앱 실행 시 백그라운드에서 자동 감지만 수행

**현재 상황 분석**:
- 프로필 화면은 서버 URL 입력/자동 감지 버튼만 있음 (다른 설정 없음)
- `useNetworkDiscovery` 훅이 이미 앱 시작 시 자동 감지 수행 (`app/_layout.tsx`에서 사용)
- 네트워크 변경 시에도 자동 감지 수행
- 수동 입력/수동 감지 버튼은 사실상 불필요

**구현 방법**:
1. 프로필 화면 단순화 또는 제거:
   - 옵션 A: 프로필 화면을 완전히 제거 (탭에서 제거)
   - 옵션 B: 프로필 화면을 간단한 정보 화면으로 변경 (앱 정보, 버전 등)
   - 옵션 C: 프로필 화면을 빈 화면으로 두고 나중에 다른 설정 추가 시 활용

2. 기본값 처리:
   - `defaultSettings.serverUrl`을 `null` 또는 빈 문자열로 변경 (하드코딩 제거)
   - 서버 URL이 없으면 자동 감지 시도 (이미 구현됨)

3. 자동 감지 강화 (이미 구현됨):
   - 앱 시작 시 자동 감지 (`useNetworkDiscovery` 훅)
   - 네트워크 변경 시 자동 감지
   - 서버 유효성 검사 실패 시 자동 감지

4. 에러 처리:
   - 자동 감지 실패 시 홈 화면이나 채팅 화면에서 명확한 에러 메시지 표시
   - "서버를 찾을 수 없습니다" 등의 메시지와 함께 해결 방법 안내

**장점**:
- 사용자 경험 극대화 (아무것도 할 필요 없음)
- 코드 단순화 (프로필 화면의 복잡한 UI 제거)
- 실수 방지 (잘못된 URL 입력 불가)
- 자동 감지 기능만으로 충분함

**단점**:
- 자동 감지 실패 시 사용자가 할 수 있는 것이 없음
  - 하지만 네트워크 문제면 수동 입력해도 안 되므로 사실상 문제 없음
  - 필요시 나중에 고급 설정으로 추가 가능

**구현 단계**:
1. `app/(tabs)/profile.tsx`에서 서버 관련 UI 전부 제거
2. `store/app-settings-store.ts`에서 `defaultSettings.serverUrl`을 `null`로 변경
3. `lib/api/client.ts`에서 하드코딩된 기본 URL 제거 (서버 URL이 없으면 에러 처리)
4. 자동 감지 실패 시 사용자에게 명확한 메시지 표시 (홈 화면 또는 채팅 화면)

**예상 결과**:
- 프로필 화면: 빈 화면 또는 간단한 정보 화면
- 앱 시작: 백그라운드에서 자동으로 서버 감지
- 서버 연결 실패: 홈 화면에서 "서버를 찾을 수 없습니다" 메시지 표시

#### 방안 2: 프로필 화면에 현재 상태만 표시
**개념**: 프로필 화면에서 입력/버튼은 제거하고 현재 서버 상태만 읽기 전용으로 표시

**구현 방법**:
- 현재 연결된 서버 URL 표시 (읽기 전용)
- 연결 상태 표시 (연결됨/연결 안 됨)
- 자동 감지 중 상태 표시

**장점**:
- 사용자는 현재 상태를 확인할 수 있음
- 입력/버튼 없이 단순함

**단점**:
- 여전히 프로필 화면이 필요함
- 정보만 보여주는 화면은 큰 의미가 없을 수 있음

**권장 사항**:
- **방안 1 (완전 자동화 - 프로필 화면 제거) 최종 권장** ✅ 완료
  - ✅ `constants/api.ts` 파일 생성하여 상수로 분리
  - ✅ 캐릭터 이미지 URL은 서버 설정에서 동적으로 가져오기 (`character-card.tsx` 수정)
  - ✅ 프로필 화면에서 서버 관련 UI 전부 제거 (현재 상태만 표시)
  - ✅ `defaultSettings.serverUrl`을 빈 문자열로 변경하여 하드코딩 제거
  - ✅ 앱 실행 시 백그라운드에서 자동 감지만 수행 (이미 구현됨)
  - ✅ 자동 감지 실패 시 홈 화면에서 명확한 에러 메시지와 해결 방법 안내

**완료된 작업**:
- `app/(tabs)/profile.tsx`: 서버 관련 입력/버튼 UI 제거, 현재 상태만 표시
- `store/app-settings-store.ts`: `defaultSettings.serverUrl`을 빈 문자열로 변경, 타입을 `string | null`로 변경
- `lib/api/client.ts`: 하드코딩된 기본 URL 제거, 서버 URL이 없으면 에러 throw
- `constants/api.ts`: 포트, 타임아웃 등 상수 분리
- `components/character-card.tsx`: 하드코딩된 이미지 URL 제거, 서버 설정에서 동적 생성
- `app/(tabs)/index.tsx`: 에러 메시지 개선, 해결 방법 안내 추가

---

### 1.2 타임아웃 값 하드코딩 ✅ 완료
**위치**: `lib/api/client.ts`, `utils/server-discovery.ts`
**상태**: 완료 (2024년)
**문제점**:
- `5000` (5초) - CSRF 토큰: 90라인
- `8000` (8초) - 설정 동기화: 167라인
- `10000` (10초) - API 요청: 26, 236라인
- `60000` (60초) - 채팅 생성: 383라인
- `5000` (5초) - 설정 체크 간격: 63라인
- `2000` (2초) - 서버 스캔 타임아웃: `utils/server-discovery.ts` 7라인

**영향**:
- 타임아웃 값 변경 시 여러 곳 수정 필요
- 일관성 없는 값 사용

**권장 사항**:
- ✅ `constants/api.ts`에 `TIMEOUTS` 객체로 상수화

**완료된 작업**:
- ✅ `lib/api/client.ts`: 모든 하드코딩된 타임아웃 값을 `TIMEOUTS` 상수로 교체
  - `fetchWithTimeout` 기본값: `TIMEOUTS.API_REQUEST`
  - `settingsCheckInterval`: `SETTINGS_SYNC_INTERVAL`
  - CSRF 토큰: `TIMEOUTS.CSRF_TOKEN`
  - 설정 동기화: `TIMEOUTS.SETTINGS_SYNC`
  - API 요청: `TIMEOUTS.API_REQUEST`
  - 채팅 생성: `TIMEOUTS.CHAT_GENERATION`
- ✅ `utils/server-discovery.ts`: 서버 스캔 타임아웃을 `TIMEOUTS.SERVER_SCAN`으로 교체
- ✅ `constants/api.ts`: 모든 타임아웃 상수 정의 완료

---

### 1.3 포트 번호 하드코딩 ✅ 완료
**위치**: `utils/server-discovery.ts`, `store/app-settings-store.ts`
**상태**: 완료 (2024년)
**문제점**:
- `SERVER_PORT = 8001` (6라인) - `utils/server-discovery.ts`
- `DEFAULT_CHARACTER_PORT = 8000` (character-card.tsx에서 암묵적 사용)
- `http://${foundIP}:8001` - `store/app-settings-store.ts` 163라인

**영향**:
- 포트 변경 시 여러 파일 수정 필요

**권장 사항**:
- ✅ 상수 파일로 통합

**완료된 작업**:
- ✅ `utils/server-discovery.ts`: `SERVER_PORT`를 `DEFAULT_SERVER_PORT` 상수로 교체
- ✅ `store/app-settings-store.ts`: 하드코딩된 `:8001`을 `DEFAULT_SERVER_PORT` 상수로 교체
- ✅ `components/character-card.tsx`: 이미 `DEFAULT_CHARACTER_PORT` 상수 사용 중 (1.1에서 완료)
- ✅ `constants/api.ts`: 모든 포트 상수 정의 완료 (`DEFAULT_SERVER_PORT`, `DEFAULT_CHARACTER_PORT`)

---

## 2. 타입 안정성 문제

### 2.1 `any` 타입 남용 ✅ 완료
**위치**: 여러 파일
**상태**: 완료 (2024년)
**문제점**:

#### `lib/api/client.ts`
- `getChatHistory()`: `Promise<any[]>` (297라인)
- `saveChat()`: `chat: any[]`, `chatMetadata?: any` (310-311라인)
- `prepareMessages()`: `Promise<any>` (344라인)
- `generateChatCompletion()`: `messages: any[]`, `Promise<any>` (351-361라인)

#### `store/chat-store.ts`
- `ServerChatMessage`: `[key: string]: any` (15라인)
- `convertAppMessagesToServerFormat()`: `any[]` 반환 (72라인)
- Character 데이터: `apiClient.post<any>()` (134, 192라인)
- `generateData.messages.forEach((msg: any, ...)` (346라인)

**영향**:
- 타입 체크 불가능
- 런타임 에러 가능성 증가
- IDE 자동완성 및 리팩토링 지원 부족

**권장 사항**:
- ✅ `types/api.ts` 파일 생성하여 타입 정의
- ✅ 서버 응답 타입 명시적 정의
- ✅ 제네릭 타입 활용

**완료된 작업**:
- ✅ `types/api.ts` 파일 생성 및 모든 API 관련 타입 정의
  - `ServerChatMessage`, `ServerChatData`, `ServerChatMetadata`
  - `CharacterResponse`, `CharacterData`
  - `PrepareMessagesResponse`
  - `ChatCompletionMessage`, `ChatCompletionParams`, `ChatCompletionResponse`
  - `ApiResponse<T>`
- ✅ `lib/api/client.ts`: 모든 `any` 타입을 구체적 타입으로 교체
  - `getChatHistory()`: `Promise<ServerChatMessage[]>`
  - `saveChat()`: `chat: ServerChatData`, `chatMetadata?: Record<string, unknown>`
  - `prepareMessages()`: `Promise<PrepareMessagesResponse>`
  - `generateChatCompletion()`: `ChatCompletionParams` 파라미터, `Promise<ChatCompletionResponse>` 반환
- ✅ `store/chat-store.ts`: 모든 `any` 타입을 구체적 타입으로 교체
  - `ServerChatMessage`: `[key: string]: unknown`으로 변경 (types/api.ts로 이동)
  - `convertAppMessagesToServerFormat()`: `ServerChatData` 반환
  - Character 데이터: `CharacterResponse` 타입 사용
  - `generateData.messages.forEach`: `ChatCompletionMessage` 타입 사용
  - `prepareResult`: `PrepareMessagesResponse` 타입 명시
  - `completionResponse`: `ChatCompletionResponse` 타입 명시
  - `generateData`: `ChatCompletionParams` 타입 명시

---

## 3. 코드 중복

### 3.1 Character 정보 가져오기 로직 중복 ✅ 완료
**위치**: `store/chat-store.ts`
**상태**: 완료 (2024년)
**문제점**:
- `loadChatHistory()` 함수 내에서 Character 정보를 가져오는 로직이 두 번 반복됨
  - 134-179라인: 새 채팅인 경우 Character 정보 가져오기
  - 191-211라인: 첫 메시지 필터링을 위한 Character 정보 가져오기

**영향**:
- 코드 중복으로 유지보수 어려움
- 로직 변경 시 두 곳 모두 수정 필요
- 불필요한 API 호출 (최대 2번)

**권장 사항**:
- ✅ Character 정보를 한 번만 가져와서 재사용

**완료된 작업**:
- ✅ Character 정보를 함수 시작 부분에서 한 번만 가져오기
  - `needsCharacterData` 변수로 필요 여부 확인
  - 새 채팅이거나 필터링이 필요한 경우에만 API 호출
- ✅ 가져온 `characterData`를 새 채팅 처리와 필터링에서 모두 재사용
- ✅ 중복 API 호출 제거 (최대 2번 → 최대 1번)
- ✅ 코드 중복 제거로 유지보수성 향상

---

### 3.2 에러 메시지 처리 로직 중복 ✅ 완료
**위치**: `lib/api/client.ts`
**상태**: 완료 (2024년)
**문제점**:
- 네트워크 에러 감지 로직이 여러 곳에 반복됨
  - 122라인: CSRF 토큰 에러 처리
  - 269라인: API 요청 에러 처리

**영향**:
- 에러 처리 로직 변경 시 여러 곳 수정 필요

**권장 사항**:
- ✅ `isNetworkError(error: Error): boolean` 헬퍼 함수로 추출

**완료된 작업**:
- ✅ `isNetworkError()` 헬퍼 함수 생성
  - 네트워크 에러 감지 로직을 한 곳에 통합
  - '시간 초과', 'Network request failed', 'aborted', 'Failed to fetch' 등 감지
- ✅ 중복된 네트워크 에러 처리 로직 교체
  - CSRF 토큰 에러 처리: `isNetworkError()` 사용
  - API 요청 에러 처리: `isNetworkError()` 사용
- ✅ 코드 중복 제거로 유지보수성 향상

---

## 4. 컴포넌트 관련 이슈

### 4.1 하드코딩된 에러 색상
**위치**: `components/chat-message.tsx`
**문제점**:
- 258라인: `color: '#ff4444'` 하드코딩
- 프로젝트 규칙에 따르면 하드코딩된 색상 코드 사용 금지

**영향**:
- 다크 모드에서 가독성 문제 가능
- 테마 색상과 일관성 없음

**권장 사항**:
- `useThemeColor` 훅 사용 또는 `Colors` 상수 활용

---

### 4.2 캐릭터 이미지 URL 동적 생성 필요
**위치**: `components/character-card.tsx`
**문제점**:
- 33라인: `http://localhost:8000/characters/${character.avatar}` 하드코딩
- 서버 URL 설정과 무관하게 고정된 포트 사용

**영향**:
- 서버 포트가 8000이 아닌 경우 이미지 로드 실패
- 서버 URL 변경 시 이미지가 표시되지 않음

**권장 사항**:
- `useAppSettingsStore`에서 서버 URL 가져와서 동적 생성
- 포트 번호도 서버 설정에서 가져오기

---

## 5. 로깅 일관성

### 5.1 로깅 레벨 및 형식 불일치
**위치**: 전체 코드베이스
**문제점**:
- `console.log`, `console.error`, `console.warn` 혼용
- 로깅 형식이 일관되지 않음
  - `[API]`, `[ChatStore]`, `[CharacterStore]`, `[AppSettings]`, `[NetworkDiscovery]`, `[ServerDiscovery]` 등 다양한 프리픽스 사용
- 개발용 로그와 프로덕션 로그 구분 없음

**영향**:
- 디버깅 시 로그 추적 어려움
- 프로덕션에서 불필요한 로그 출력 가능

**권장 사항**:
- 로깅 유틸리티 모듈 생성 (`utils/logger.ts`)
- 로그 레벨 관리 (DEBUG, INFO, WARN, ERROR)
- `__DEV__` 플래그로 개발/프로덕션 구분

---

## 6. 에러 처리 일관성

### 6.1 에러 처리 방식 불일치
**위치**: 여러 파일
**문제점**:
- 일부는 에러를 throw하고, 일부는 조용히 무시
- 에러 메시지 형식이 일관되지 않음
- 사용자에게 표시할 에러와 내부 로그 에러 구분 없음

**예시**:
- `lib/api/client.ts:149`: CSRF 토큰 실패 시 조용히 return
- `lib/api/client.ts:214`: 설정 동기화 실패 시 조용히 무시
- `store/chat-store.ts:163`: 첫 메시지 저장 실패 시 로그만 남기고 계속 진행

**권장 사항**:
- 에러 처리 전략 문서화
- 사용자 친화적 에러 메시지 매핑
- 에러 복구 전략 정의

---

## 7. 설정 관리

### 7.1 설정 동기화 로직 복잡성
**위치**: `lib/api/client.ts`, `store/app-settings-store.ts`
**문제점**:
- 설정 동기화 로직이 API 클라이언트와 스토어에 분산됨
- `checkAndSyncSettings()`가 여러 곳에서 호출됨
- 동기화 실패 시 처리 방식이 일관되지 않음

**영향**:
- 설정 동기화 타이밍 문제 가능
- 디버깅 어려움

**권장 사항**:
- 설정 동기화 로직을 별도 모듈로 분리
- 명확한 동기화 전략 수립

---

## 8. 성능 최적화 기회

### 8.1 불필요한 API 호출
**위치**: `store/chat-store.ts`
**문제점**:
- `loadChatHistory()`에서 같은 Character에 대해 여러 번 API 호출 가능
  - Character 정보 가져오기 (134라인)
  - 필터링을 위한 Character 정보 가져오기 (192라인)

**권장 사항**:
- Character 데이터 캐싱
- 한 번의 API 호출로 필요한 정보 모두 가져오기

---

### 8.2 설정 동기화 빈도
**위치**: `lib/api/client.ts`
**문제점**:
- `checkAndSyncSettings()`가 모든 API 요청 전에 호출됨 (211라인)
- 5초 간격 제한이 있지만, 여러 API 호출 시 불필요한 체크 가능

**권장 사항**:
- 설정 동기화 전략 재검토
- 필요한 경우에만 동기화하도록 개선

---

## 9. 타입 정의 분산

### 9.1 타입 정의 위치 불일치
**위치**: 여러 파일
**문제점**:
- 타입이 각 스토어 파일에 분산되어 정의됨
  - `store/chat-store.ts`: `ServerChatMessage`, `ChatMessage`
  - `store/character-store.ts`: `Character`
  - `store/app-settings-store.ts`: `ServerSettings`, `AppSettings`
  - `lib/api/client.ts`: `ApiResponse` (사용되지 않음)

**영향**:
- 타입 재사용 어려움
- 타입 정의 찾기 어려움

**권장 사항**:
- `types/` 디렉토리 생성하여 타입 정의 통합
- 도메인별로 파일 분리 (예: `types/api.ts`, `types/chat.ts`, `types/character.ts`)

---

## 10. 문서화 부족

### 10.1 함수 주석 부족
**위치**: 여러 파일
**문제점**:
- 일부 복잡한 로직에 대한 주석 부족
- 함수 파라미터 및 반환값 설명 부족

**예시**:
- `store/chat-store.ts:convertAppMessagesToServerFormat()`: 복잡한 변환 로직이지만 주석이 간단함
- `lib/api/client.ts:checkAndSyncSettings()`: 설정 동기화 로직이 복잡하지만 상세 설명 부족

**권장 사항**:
- JSDoc 형식 주석 추가
- 복잡한 비즈니스 로직에 대한 상세 설명

---

## 우선순위별 리팩토링 계획

### 높은 우선순위
1. ✅ **완료** 하드코딩된 URL 및 포트 상수화 (`constants/api.ts` 생성)
   - ✅ 서버 URL 하드코딩 제거
   - ✅ 프로필 화면 수동 입력 UI 제거
   - ✅ 자동 감지만 사용하도록 변경
   - ✅ Character 이미지 URL 동적 생성
2. ⏳ `any` 타입 제거 및 타입 정의 (`types/` 디렉토리 생성)
3. ⏳ 에러 색상 테마 색상으로 변경 (`chat-message.tsx` 수정)

### 중간 우선순위
5. Character 정보 가져오기 로직 중복 제거
6. 에러 처리 일관성 개선
7. 로깅 유틸리티 모듈 생성

### 낮은 우선순위
8. 설정 동기화 로직 개선
9. 성능 최적화 (캐싱 등)
10. 문서화 보완

---

## 참고사항
- 모든 변경사항은 기존 기능을 유지하면서 점진적으로 진행해야 함
- 각 리팩토링 후 테스트 필수
- 타입 변경 시 기존 코드와의 호환성 확인 필요

