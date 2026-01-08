# SillyTavern React Native 클라이언트 마이그레이션 계획서

## 📋 목차
1. [개요](#개요)
2. [아키텍처 설계](#아키텍처-설계)
3. [서버 변경사항](#서버-변경사항)
4. [클라이언트 개발 계획](#클라이언트-개발-계획)
5. [API 명세](#api-명세)
6. [개발 단계별 계획](#개발-단계별-계획)
7. [테스트 전략](#테스트-전략)
8. [배포 계획](#배포-계획)

---

## 개요

### 목표
SillyTavern의 웹 클라이언트를 React Native 모바일 앱으로 마이그레이션하여, 모바일에서도 채팅 기능을 사용할 수 있도록 한다.

### 핵심 원칙
- **하이브리드 접근**: 웹에서 설정 관리, 앱에서 채팅 전용
- **서버 중심 설계**: 복잡한 로직은 서버에서 처리
- **점진적 마이그레이션**: 단계별 개발 및 테스트
- **기존 기능 보존**: 웹 클라이언트는 그대로 유지

### 예상 개발 기간
- **총 기간**: 4-6주
- **서버 개발**: 1주
- **앱 개발**: 3-4주
- **테스트 및 배포**: 1주

---

## 아키텍처 설계

### 전체 구조

```
┌─────────────────────────────────────────────────────────┐
│                    사용자 워크플로우                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  🖥️ 웹 브라우저 (설정 관리)                             │
│     ├─ 캐릭터 생성/편집                                  │
│     ├─ API 연결 설정                                     │
│     ├─ 시스템 프롬프트 설정                              │
│     ├─ 월드 인포 관리                                    │
│     ├─ 확장 기능 설정                                    │
│     └─ 모든 고급 설정                                    │
│                                                         │
│  📱 React Native 앱 (채팅 전용)                           │
│     ├─ 로그인/인증                                       │
│     ├─ 캐릭터 선택 (읽기 전용)                           │
│     ├─ 채팅하기                                          │
│     ├─ 메시지 전송/수신                                  │
│     ├─ 스트리밍 응답                                     │
│     └─ 채팅 히스토리                                     │
│                                                         │
│  🖥️ Express 서버 (공유)                                  │
│     ├─ 설정 저장 (웹에서 설정)                            │
│     ├─ 채팅 데이터 (앱에서 사용)                         │
│     ├─ 메시지 준비 API (신규)                            │
│     └─ 기존 API 엔드포인트                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 데이터 흐름

```
1. 설정 단계 (웹)
   사용자 → 웹 브라우저 → 서버 API → 설정 저장

2. 채팅 단계 (앱)
   사용자 → 앱 → 메시지 준비 API → 생성 API → 응답 → 앱 표시
```

---

## 서버 변경사항

### 1. 새로운 API 엔드포인트 추가

#### `/api/chats/prepare-messages` (신규)

**목적**: 클라이언트가 보낸 간단한 메시지를 서버에서 완전한 메시지 배열로 변환

**요청**:
```http
POST /api/chats/prepare-messages
Content-Type: application/json
X-CSRF-Token: {token}

{
  "chat_id": "chat_123",              // 기존 채팅 ID (선택)
  "character_id": "char_456",         // 캐릭터 ID (필수)
  "user_message": "안녕하세요",        // 사용자 메시지 (필수)
  "type": "chat",                     // 요청 타입: "chat" | "continue" | "impersonate"
  "regenerate": false,                // 재생성 여부
  "swipe_index": -1                   // 스와이프 인덱스 (선택)
}
```

**응답**:
```json
{
  "success": true,
  "messages": [
    {
      "role": "system",
      "content": "시스템 프롬프트..."
    },
    {
      "role": "user",
      "content": "안녕하세요"
    }
  ],
  "generate_data": {
    "messages": [...],
    "model": "gpt-4",
    "temperature": 0.7,
    "max_tokens": 2000,
    "stream": true,
    "chat_completion_source": "openai"
  },
  "metadata": {
    "character_name": "캐릭터 이름",
    "user_name": "사용자 이름",
    "token_count": 150
  }
}
```

**에러 응답**:
```json
{
  "success": false,
  "error": "캐릭터를 찾을 수 없습니다",
  "code": "CHARACTER_NOT_FOUND"
}
```

### 2. 구현 위치

**파일**: `src/endpoints/chats.js`

**구현 방식**: 
- **코드 재사용**: 클라이언트의 메시지 준비 로직(`public/scripts/openai.js`)을 서버로 이동
- **기존 API 활용**: 서버에 이미 있는 API들을 활용:
  - `/api/vector` - 벡터 검색 (벡터 메모리, Data Bank용)
  - `/api/worldinfo` - 월드 인포
  - `/api/chats/get` - 채팅 히스토리
  - `/api/characters/get` - 캐릭터 데이터
  - `/api/settings/get` - 사용자 설정
- **로직 이동**: 클라이언트의 `preparePromptsForChatCompletion`, `prepareOpenAIMessages` 함수를 서버로 포팅

**주요 기능**:
- 캐릭터 데이터 로드
- 채팅 히스토리 로드 (chat_id가 있는 경우)
- 시스템 프롬프트 조합
- 월드 인포 적용 (worldInfoBefore, worldInfoAfter)
- 확장 프롬프트 적용:
  - Summary (1_memory) - 서버에서 Summary API 호출 필요
  - Authors Note (2_floating_prompt) - 설정에서 로드
  - 벡터 메모리 (3_vectors) - `/api/vector` 활용
  - Data Bank 벡터 (4_vectors_data_bank) - `/api/vector` 활용
  - Smart Context/ChromaDB (chromadb) - 서버 API 확인 필요
  - Persona Description - 설정에서 로드
  - 기타 확장 프롬프트들
- 토큰 예산 관리
- 메시지 배열 생성

**의존성**:
- `src/prompt-converters.js` (프롬프트 변환 로직 재사용)
- `src/endpoints/characters.js` (캐릭터 데이터)
- `src/endpoints/settings.js` (사용자 설정)
- `src/endpoints/vectors.js` (벡터 검색)
- `src/endpoints/worldinfo.js` (월드 인포)

### 3. 기존 API 활용

기존 엔드포인트는 그대로 사용:
- `/api/backends/chat-completions/generate` - 메시지 생성
- `/api/chats/save` - 채팅 저장
- `/api/chats/get` - 채팅 로드
- `/api/characters/all` - 캐릭터 목록
- `/api/characters/get` - 캐릭터 상세

---

## 클라이언트 개발 계획

### 기술 스택

- **프레임워크**: React Native (Expo 또는 CLI)
- **네비게이션**: React Navigation
- **상태 관리**: React Context API 또는 Zustand
- **API 통신**: Axios 또는 fetch
- **스트리밍**: EventSource 또는 fetch with ReadableStream
- **스토리지**: AsyncStorage 또는 MMKV

### 프로젝트 구조

```
sillytavern-mobile/
├── src/
│   ├── api/
│   │   ├── client.js              # API 클라이언트
│   │   ├── auth.js                # 인증 관련
│   │   ├── chats.js               # 채팅 관련
│   │   └── characters.js          # 캐릭터 관련
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── CharacterListScreen.js
│   │   ├── ChatScreen.js
│   │   └── ChatHistoryScreen.js
│   ├── components/
│   │   ├── MessageBubble.js
│   │   ├── CharacterCard.js
│   │   └── StreamingText.js
│   ├── hooks/
│   │   ├── useChat.js
│   │   ├── useStreaming.js
│   │   └── useAuth.js
│   ├── utils/
│   │   ├── storage.js
│   │   └── constants.js
│   └── App.js
├── package.json
└── app.json
```

---

## API 명세

### 인증 API

#### 로그인
```http
POST /api/users/login
Content-Type: application/json

{
  "handle": "username",
  "password": "password"
}
```

#### CSRF 토큰
```http
GET /csrf-token
```

### 캐릭터 API

#### 캐릭터 목록
```http
GET /api/characters/all
```

#### 캐릭터 상세
```http
POST /api/characters/get
Content-Type: application/json

{
  "id": "character_id"
}
```

### 채팅 API

#### 메시지 준비 (신규)
```http
POST /api/chats/prepare-messages
Content-Type: application/json
X-CSRF-Token: {token}

{
  "chat_id": "chat_123",
  "character_id": "char_456",
  "user_message": "안녕하세요",
  "type": "chat"
}
```

#### 메시지 생성
```http
POST /api/backends/chat-completions/generate
Content-Type: application/json
X-CSRF-Token: {token}

{
  "messages": [...],
  "model": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 2000,
  "stream": true,
  "chat_completion_source": "openai"
}
```

#### 채팅 저장
```http
POST /api/chats/save
Content-Type: application/json
X-CSRF-Token: {token}

{
  "chat_id": "chat_123",
  "chat": [...],
  "chat_metadata": {...}
}
```

#### 채팅 로드
```http
POST /api/chats/get
Content-Type: application/json
X-CSRF-Token: {token}

{
  "chat_id": "chat_123"
}
```

#### 최근 채팅 목록
```http
GET /api/chats/recent
```

---

## 개발 단계별 계획

### Phase 1: 서버 개발 (1주)

#### Week 1: 메시지 준비 API 구현

**Day 1-2: API 설계 및 기본 구조**
- [x] 엔드포인트 라우터 생성
- [x] 요청/응답 스키마 정의
- [x] 에러 핸들링 구조 설계

**Day 3-4: 핵심 로직 구현**
- [x] 캐릭터 데이터 로드
- [x] 채팅 히스토리 로드
- [x] 시스템 프롬프트 조합 (기본 구현 완료)
- [x] 월드 인포 적용 (worldInfoBefore, worldInfoAfter) - 기본 로드 완료, 채팅 스캔 로직은 TODO
- [ ] 확장 프롬프트 적용:
  - [ ] Summary (1_memory)
  - [ ] Authors Note (2_floating_prompt)
  - [ ] 벡터 메모리 (3_vectors)
  - [ ] Data Bank 벡터 (4_vectors_data_bank)
  - [ ] Smart Context/ChromaDB (chromadb)
  - [ ] Persona Description
  - [ ] 기타 확장 프롬프트들

**Day 5: 통합 및 테스트**
- [x] 기존 프론트엔드와 통합 테스트 (브라우저 콘솔 테스트 완료)
- [ ] API 문서 작성
- [ ] 단위 테스트 작성

### Phase 2: 앱 기반 구축 (1주)

#### Week 2: 프로젝트 설정 및 API 통신

**Day 1: 프로젝트 초기화**
- [ ] React Native 프로젝트 생성
- [ ] 기본 폴더 구조 생성
- [ ] 필수 패키지 설치

**Day 2-3: API 클라이언트 구현**
- [ ] API 클라이언트 모듈 생성
- [ ] CSRF 토큰 처리
- [ ] 에러 핸들링
- [ ] 인터셉터 설정

**Day 4-5: 인증 구현**
- [ ] 로그인 화면 UI
- [ ] 로그인 API 연동
- [ ] 세션 관리
- [ ] 자동 로그인 기능

### Phase 3: 핵심 기능 개발 (2주)

#### Week 3: 캐릭터 및 채팅 UI

**Day 1-2: 캐릭터 목록**
- [ ] 캐릭터 목록 화면 UI
- [ ] 캐릭터 API 연동
- [ ] 캐릭터 선택 기능

**Day 3-5: 채팅 화면 기본**
- [ ] 채팅 화면 레이아웃
- [ ] 메시지 버블 컴포넌트
- [ ] 입력창 구현
- [ ] 메시지 리스트 표시

#### Week 4: 채팅 기능 구현

**Day 1-2: 메시지 전송/수신**
- [ ] 메시지 준비 API 연동
- [ ] 메시지 생성 API 연동
- [ ] 응답 처리 및 표시

**Day 3-4: 스트리밍 구현**
- [ ] SSE 스트리밍 처리
- [ ] 실시간 텍스트 업데이트
- [ ] 스트리밍 상태 관리

**Day 5: 채팅 저장/로드**
- [ ] 채팅 저장 기능
- [ ] 채팅 히스토리 로드
- [ ] 최근 채팅 목록

### Phase 4: 마무리 및 배포 (1주)

#### Week 5: 테스트 및 최적화

**Day 1-2: 통합 테스트**
- [ ] 전체 플로우 테스트
- [ ] 에러 케이스 테스트
- [ ] 성능 테스트

**Day 3-4: UI/UX 개선**
- [ ] 디자인 개선
- [ ] 애니메이션 추가
- [ ] 접근성 개선

**Day 5: 배포 준비**
- [ ] 빌드 설정
- [ ] 앱 아이콘 및 스플래시
- [ ] 스토어 등록 준비

---

## 테스트 전략

### 단위 테스트
- API 클라이언트 함수
- 유틸리티 함수
- 커스텀 훅

### 통합 테스트
- 로그인 플로우
- 채팅 전송/수신 플로우
- 스트리밍 응답 처리

### E2E 테스트
- 전체 사용자 시나리오
- 웹-앱 연동 테스트

### 테스트 환경
- 개발 서버와 연동
- 실제 API 테스트
- 다양한 기기 테스트

---

## 배포 계획

### 서버 배포
1. 개발 환경에서 테스트
2. 스테이징 환경 배포
3. 프로덕션 배포

### 앱 배포
1. **개발 빌드**: 내부 테스터용
2. **베타 테스트**: TestFlight (iOS) / Internal Testing (Android)
3. **프로덕션**: App Store / Google Play Store

### 배포 전 체크리스트
- [ ] 서버 API 안정성 확인
- [ ] 앱 크래시 테스트
- [ ] 성능 최적화
- [ ] 보안 검토
- [ ] 개인정보 처리방침 업데이트

---

## 위험 요소 및 대응 방안

### 위험 요소

1. **서버 API 복잡도**
   - 위험: 메시지 준비 로직이 복잡할 수 있음
   - 대응: 기존 코드 재사용, 단계별 구현

2. **스트리밍 처리**
   - 위험: React Native에서 SSE 처리 이슈
   - 대응: 폴리필 사용 또는 fetch with ReadableStream

3. **성능 이슈**
   - 위험: 긴 채팅 히스토리 처리
   - 대응: 가상화 리스트 사용, 페이지네이션

4. **서버 호스팅**
   - 위험: 사용자가 서버를 직접 운영해야 함
   - 대응: 서버 설정 가이드 제공, 클라우드 옵션 안내

### 대응 방안

- 각 단계마다 테스트 진행
- 문제 발생 시 롤백 계획 수립
- 사용자 피드백 수집 및 반영

---

## 성공 지표

### 기술적 지표
- API 응답 시간 < 2초
- 앱 시작 시간 < 3초
- 메모리 사용량 < 200MB
- 크래시율 < 0.1%

### 사용자 지표
- 일일 활성 사용자 수
- 평균 세션 시간
- 메시지 전송 성공률
- 사용자 만족도

---

## 향후 개선 사항

### Phase 2 기능 (선택)
- 오프라인 모드 지원
- 푸시 알림
- 이미지 전송
- 음성 메시지
- 다크 모드

### 최적화
- 캐싱 전략 개선
- 이미지 최적화
- 번들 크기 최적화

---

## 참고 자료

### 관련 파일
- `src/endpoints/chats.js` - 채팅 API
- `src/endpoints/backends/chat-completions.js` - 생성 API
- `public/scripts/openai.js` - 프론트엔드 메시지 준비 로직
- `src/prompt-converters.js` - 프롬프트 변환 로직

### 외부 문서
- React Native 공식 문서
- React Navigation 문서
- SillyTavern API 문서

---

## 결론

이 계획서는 SillyTavern을 React Native로 마이그레이션하기 위한 종합적인 로드맵입니다. 하이브리드 접근 방식을 통해 개발 시간을 단축하고, 서버 중심 설계로 유지보수성을 높입니다.

각 단계는 독립적으로 테스트 가능하며, 점진적으로 기능을 추가하여 안정적인 앱을 구축할 수 있습니다.

---

**작성일**: 2024년
**버전**: 1.0
**작성자**: AI Assistant

