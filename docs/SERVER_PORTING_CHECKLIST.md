# SillyTavern 서버 포팅 체크리스트

이 문서는 클라이언트의 메시지 준비 로직을 서버로 포팅할 때 필요한 모든 기능들을 정리한 것입니다.

## 📋 사용 방법

각 항목을 확인하고:
- ✅ **필요**: 앱에서 이 기능을 사용하려면 서버로 포팅 필요
- ❌ **불필요**: 앱에서 사용하지 않거나 클라이언트 전용 기능
- ⚠️ **조건부**: 특정 조건에서만 필요

---

## 1. 기본 캐릭터 데이터

### ✅ 필수 항목
- [x] 캐릭터 파일 로드 및 파싱 (`/api/characters/all`)
- [x] 캐릭터 설명 (description) - 서버에서 로드됨
- [x] 캐릭터 성격 (personality) - 서버에서 로드됨
- [x] 시나리오 (scenario) - 서버에서 로드됨
- [x] 캐릭터 이름 (name2) - 서버에서 로드됨
- [x] 시스템 프롬프트 (system_prompt) - 서버에서 로드됨
- [x] Post-History Instructions (jailbreak) - 서버에서 로드됨
- [x] 메시지 예제 (mes_example) - 서버에서 로드됨
- [x] 첫 메시지 (first_mes) - 서버에서 로드됨, 첫 메시지 처리 구현됨 ✅
- [x] 대체 인사말 (alternate_greetings) - 서버에서 로드됨, 랜덤 선택 구현됨 ✅
- [x] Creator Notes (creator_notes) - 서버에서 로드됨

### ⚠️ 조건부 항목
- [ ] Character Book (character_book) - 월드 인포와 연관
- [ ] Group Only Greetings - 그룹 채팅 전용

---

## 2. 월드 인포 (World Info / Lorebook)

### ✅ 필수 항목 (완전한 기능 사용 시)

#### 2.1 기본 스캔 기능
- [ ] 월드 인포 파일 로드
- [ ] 월드 인포 엔트리 스캔 (`checkWorldInfo` 함수)
- [ ] 키워드 매칭 (Primary Keywords)
- [ ] 보조 키워드 (Secondary Keywords)
- [ ] 키워드 로직 (AND ANY, AND ALL, NOT ANY, NOT ALL)
- [ ] 스캔 깊이 (Scan Depth) - 전역 설정
- [ ] 엔트리별 스캔 깊이 (scanDepth) - 엔트리별 오버라이드
- [ ] 대소문자 구분 (Case-Sensitive) - 전역 설정
- [ ] 엔트리별 대소문자 구분 (caseSensitive) - 엔트리별 오버라이드
- [ ] 전체 단어 매칭 (Whole Words) - 전역 설정
- [ ] 엔트리별 전체 단어 매칭 (matchWholeWords) - 엔트리별 오버라이드
- [ ] 그룹 스코어링 (Group Scoring) - 전역 설정
- [ ] 엔트리별 그룹 스코어링 (useGroupScoring) - 엔트리별 오버라이드

#### 2.2 엔트리 속성
- [ ] 우선순위 (Priority / Order)
- [ ] 전략 (Strategy: ↑ Char, ↓ Char 등) - `world_info_character_strategy`
- [ ] 위치 (Position: Before, After, At Depth, ANTop, ANBottom, Outlet)
- [ ] 깊이 (Depth) - 엔트리별 depth 설정
- [ ] 역할 (Role: system, user, assistant) - `extension_prompt_roles`
- [ ] 트리거 확률 (Trigger % / Probability)
- [ ] 확률 사용 여부 (Use Probability)
- [ ] 코멘트 (Comment)
- [ ] Add Memo (addMemo)

#### 2.3 필터링 및 매칭
- [ ] 캐릭터 이름 필터링 (characterFilterNames)
- [ ] 캐릭터 태그 필터링 (characterFilterTags)
- [ ] 캐릭터 필터 제외 모드 (characterFilterExclude)
- [ ] 생성 트리거 필터링 (triggers: Normal, Continue, Impersonate, Swipe)
- [ ] Persona Description 매칭 (matchPersonaDescription)
- [ ] Character Description 매칭 (matchCharacterDescription)
- [ ] Character Personality 매칭 (matchCharacterPersonality)
- [ ] Character Depth Prompt 매칭 (matchCharacterDepthPrompt)
- [ ] Scenario 매칭 (matchScenario)
- [ ] Creator Notes 매칭 (matchCreatorNotes)

#### 2.4 그룹 및 Inclusion
- [ ] Inclusion Group
- [ ] 그룹 (Group)
- [ ] 그룹 오버라이드 (Group Override)
- [ ] 그룹 가중치 (Group Weight)

#### 2.5 활성화 제어
- [ ] Constant (항상 활성화)
- [ ] Vectorized (벡터 기반 검색) - 벡터 확장 기능과 연동
- [ ] Sticky (지속 활성화) - 엔트리별 sticky 값
- [ ] Cooldown (재사용 대기 시간) - 엔트리별 cooldown 값
- [ ] Delay (지연 활성화) - 엔트리별 delay 값
- [ ] Decorators (@@activate, @@dont_activate)
- [ ] Disable (비활성화)

#### 2.6 재귀 및 예산
- [ ] 재귀 스캔 (Recursion) - 전역 설정
- [ ] 재귀 제외 (Exclude Recursion)
- [ ] 재귀 방지 (Prevent Recursion)
- [ ] 재귀 지연 (Delay Until Recursion)
- [ ] 최대 재귀 단계 (Max Recursion Steps)
- [ ] 최소 활성화 수 (Min Activations)
- [ ] 최소 활성화 깊이 최대값 (Min Activations Depth Max)
- [ ] 토큰 예산 관리 (Budget %) - 전역 설정
- [ ] 예산 한도 (Budget Cap)
- [ ] 예산 무시 (Ignore Budget)

#### 2.7 출력 타입
- [ ] worldInfoBefore / worldInfoAfter 분리
- [ ] Example Messages (EMEntries)
- [ ] Depth Entries (WIDepthEntries)
- [ ] Authors Note Before (ANBeforeEntries)
- [ ] Authors Note After (ANAfterEntries)
- [ ] Outlet Entries (outletEntries) - outletName 기반
- [ ] 월드 인포 포맷팅 (`formatWorldInfo`)

#### 2.8 기타
- [ ] Automation ID (automationId)
- [ ] 이름 포함 여부 (Include Names)
- [ ] 오버플로우 알림 (Overflow Alert)
- [ ] Character Book (character_book) - 캐릭터 카드에 임베드된 로어북

### ⚠️ 간소화 버전 (기본 기능만)
- [x] 월드 인포 파일 로드 (`/api/chats/prepare-messages`에서 처리) ✅
- [x] 모든 엔트리 포함 (현재는 모든 엔트리 포함) ✅
- [ ] 키워드 기반 필터링 (TODO: 스캔 로직 미구현)
- [x] 위치 기반 분리 (Before/After) - worldInfoBefore/worldInfoAfter로 분리 (현재는 모두 Before에 포함) ✅

---

## 3. 확장 프롬프트 (Extension Prompts)

### ✅ 알려진 확장 프롬프트

#### 3.1 Summary (1_memory)
- [x] Summary 설정 로드
- [x] Summary 생성 로직
  - [x] 요약 소스 선택 (main) ✅
  - [ ] 요약 소스 선택 (extras, webllm) - 미지원
  - [x] 요약 프롬프트 실행 - `/api/chats/summarize` 엔드포인트 구현됨 ✅
  - [x] 요약 템플릿 적용 - `{{summary}}` 매크로 치환 구현됨 ✅
  - [x] Summary 로드 - 채팅 히스토리에서 `extra.memory` 로드 구현됨 ✅
  - [x] Summary 저장 - 채팅 히스토리에 저장 구현됨 ✅
- [x] 요약 간격 관리 (Prompt Interval) - 자동 생성 체크 구현됨 ✅
- [x] 요약 단어 수 관리 (Prompt Words) - 프롬프트에 적용됨 ✅
- [ ] 강제 요약 단어 수 (Prompt Force Words)
- [x] 요청당 최대 메시지 수 (Max Messages Per Request)
- [x] 프롬프트 빌더 모드 (Prompt Builder: RAW_BLOCKING, RAW_NON_BLOCKING)
- [x] Summary 위치/깊이/역할 적용 - IN_PROMPT, IN_CHAT 위치 및 depth, role 지원 ✅

#### 3.2 Authors Note (2_floating_prompt)
- [ ] Authors Note 설정 로드
- [ ] Authors Note 텍스트 가져오기
- [ ] Authors Note 위치/깊이/역할 적용
- [ ] 캐릭터별 Authors Note
- [ ] 월드 인포 추가 Authors Note

#### 3.3 벡터 메모리 (3_vectors)
- [ ] 벡터 메모리 설정 로드
- [ ] 벡터 검색 API 호출 (`/api/vector`)
- [ ] 채팅 히스토리 벡터화
- [ ] 쿼리 텍스트 생성
- [ ] 벡터 검색 결과 포맷팅
- [ ] 벡터 메모리 템플릿 적용
- [ ] 벡터 메모리 위치/깊이 적용
- [ ] 보호 메시지 수 (Protect)
- [ ] 삽입 메시지 수 (Insert)
- [ ] 쿼리 메시지 수 (Query)
- [ ] 스코어 임계값 (Score Threshold)

#### 3.4 Data Bank 벡터 (4_vectors_data_bank)
- [ ] Data Bank 벡터 설정 로드
- [ ] Data Bank 벡터 검색 API 호출
- [ ] 파일 벡터화 및 검색
- [ ] Data Bank 템플릿 적용
- [ ] Data Bank 위치/깊이/역할 적용

#### 3.5 Smart Context / ChromaDB (chromadb)
- [ ] ChromaDB 설정 로드
- [ ] ChromaDB 검색 로직
- [ ] Smart Context 템플릿 적용
- [ ] Smart Context 위치/깊이 적용

#### 3.6 Persona Description
- [ ] Persona Description 설정 로드
- [ ] Persona Description 위치 확인 (IN_PROMPT)
- [ ] Persona Description 적용

#### 3.7 Depth Prompt
- [ ] Depth Prompt 설정 로드
- [ ] Depth Prompt 깊이/역할 적용
- [ ] 그룹 Depth Prompt 처리

#### 3.8 Quiet Prompt
- [ ] Quiet Prompt 설정 로드
- [ ] Quiet Prompt 적용

#### 3.9 기타 확장 프롬프트
- [ ] 동적 확장 프롬프트 처리
- [ ] 확장 프롬프트 필터 함수 실행
- [ ] 확장 프롬프트 위치/역할 적용

---

## 4. 프롬프트 포맷팅

### ✅ 필수 항목
- [x] 매크로 치환 (`substituteParams`) - 기본 매크로 ({{char}}, {{user}}, {{charIfNotGroup}}) 구현됨 ✅
- [ ] 시나리오 포맷 (`scenario_format`)
- [ ] 성격 포맷 (`personality_format`)
- [ ] 월드 인포 포맷 (`wi_format`)
- [ ] 그룹 Nudge 프롬프트 (`group_nudge_prompt`)
- [ ] Impersonation 프롬프트 (`impersonation_prompt`)
- [ ] Continue Nudge 프롬프트 (`continue_nudge_prompt`)
- [x] New Example Chat 프롬프트 (`new_example_chat_prompt`) - `new_chat_prompt` 구현됨 ✅
- [ ] Send If Empty (`send_if_empty`)
- [ ] Assistant Prefill (`assistant_prefill`)
- [ ] Continue Prefill (`continue_prefill`)

---

## 5. 프롬프트 관리 (Prompt Manager)

### ✅ 필수 항목
- [ ] 프롬프트 컬렉션 관리 (`getPromptCollection`)
- [ ] 프롬프트 마커 관리
- [ ] 프롬프트 순서 관리
- [x] 프롬프트 위치 관리 (Before Prompt, In Prompt, In Chat) - 기본 구조 구현됨 ✅
- [x] 프롬프트 깊이 관리 (Injection Depth) - Summary depth 지원 ✅
- [ ] 프롬프트 우선순위 관리 (Injection Order)
- [x] 프롬프트 역할 관리 (system, user, assistant) - Summary role 지원 ✅
- [ ] 프롬프트 비활성화 관리 (캐릭터별)
- [ ] 프롬프트 오버라이드 관리
- [x] Main Prompt 처리 - `oai_settings.prompts`에서 로드 및 매크로 치환 ✅
- [ ] Jailbreak Prompt 처리
- [ ] Dialogue Examples 처리
- [ ] Chat History 마커 처리

---

## 6. 메시지 처리

### ✅ 필수 항목
- [x] 채팅 히스토리 로드 (`/api/chats/get`) ✅
- [x] 채팅 히스토리 포맷팅 (`/api/chats/prepare-messages`에서 처리) ✅
- [ ] 메시지 예제 (Message Examples) 처리
- [ ] 메시지 예제 파싱 (`parseExampleIntoIndividual`)
- [x] 메시지 이름 처리 (Names Behavior) - name1, name2 기반 처리 ✅
- [x] 메시지 역할 변환 (user, assistant, system) - 채팅 히스토리 변환 구현됨 ✅
- [ ] 이미지 인라인 처리 (Image Inlining)
- [ ] 비디오 인라인 처리 (Video Inlining)
- [ ] 오디오 인라인 처리 (Audio Inlining)
- [ ] 도구 호출 지원 (Tool Calling)
- [x] 추론 설정 지원 (Reasoning Effort, Include Reasoning) - Gemini 모델용 ✅
- [ ] 추론 서명 지원 (Reasoning Signature)
- [x] In-Chat Injection 처리 (`populationInjectionPrompts`) - Summary IN_CHAT 위치 지원 ✅
- [ ] Continue 타입 처리
- [ ] Impersonate 타입 처리
- [ ] Regenerate 타입 처리
- [ ] Swipe 타입 처리

---

## 7. 토큰 관리

### ✅ 필수 항목
- [ ] 토큰 예산 설정 (`setTokenBudget`)
- [ ] 토큰 예산 예약 (`reserveBudget`)
- [ ] 토큰 예산 해제 (`freeBudget`)
- [ ] 토큰 예산 확인 (`canAfford`, `canAffordAll`)
- [ ] 토큰 카운팅 (`tokenHandler.countAsync`)
- [ ] 토큰 예산 초과 처리 (`TokenBudgetExceededError`)
- [ ] 필수 프롬프트 토큰 확인
- [ ] 채팅 히스토리 토큰 관리
- [ ] 시스템 메시지 압축 (`squash_system_messages`)

---

## 8. ChatCompletion 클래스

### ✅ 필수 항목
- [ ] ChatCompletion 클래스 포팅
- [ ] 메시지 컬렉션 관리 (`MessageCollection`)
- [ ] 메시지 생성 (`Message.createAsync`, `Message.fromPromptAsync`)
- [ ] 메시지 추가 (`add`, `insert`)
- [ ] 메시지 이름 설정 (`setName`)
- [ ] 최종 메시지 배열 생성 (`getChat`)
- [ ] 로깅 지원 (`enableLogging`)

---

## 9. 기타 기능

### ✅ 필수 항목
- [x] 사용자 설정 로드 (name1, settings) - `/api/chats/prepare-messages`에서 처리 ✅
- [x] OpenAI 설정 로드 (`oai_settings`) - `/api/settings/get`에서 동기화 ✅
- [x] Gemini 추론 설정 로드 (`reasoning_effort`, `include_reasoning`) - 서버 설정 동기화 및 API 요청에 포함 ✅
- [ ] Power User 설정 로드 (`power_user`)
- [x] 확장 설정 로드 (`extension_settings`) - `extension_settings.memory` 로드 및 사용 ✅
- [ ] Bias 처리 (`getBiasStrings`)
- [ ] Quiet Prompt 처리
- [ ] Quiet Image 처리
- [ ] Cycle Prompt 처리
- [ ] System Prompt Override 처리
- [ ] Jailbreak Prompt Override 처리

### ❌ 불필요 항목 (클라이언트 전용)
- [ ] UI 렌더링 (`promptManager.render`)
- [ ] 이벤트 발생 (`eventSource.emit`)
- [ ] 토스트 메시지 (`toastr`)
- [ ] DOM 조작
- [ ] 브라우저 API 사용

---

## 10. 복잡도 평가

### 🔴 매우 복잡 (수천 줄)
1. **월드 인포 스캔 로직** (`checkWorldInfo`)
   - 예상 코드량: ~2000줄
   - 복잡도: 매우 높음
   - 의존성: 많은 클라이언트 전용 코드

2. **벡터 메모리 로직**
   - 예상 코드량: ~500줄
   - 복잡도: 높음
   - 의존성: 벡터 검색 API, 채팅 스캔

3. **Summary 생성 로직**
   - 예상 코드량: ~300줄
   - 복잡도: 중간
   - 의존성: 요약 API

### 🟡 중간 복잡도 (수백 줄)
4. **ChatCompletion 클래스**
   - 예상 코드량: ~1000줄
   - 복잡도: 높음
   - 의존성: 토큰 관리, 메시지 처리

5. **프롬프트 관리자 (Prompt Manager)**
   - 예상 코드량: ~500줄
   - 복잡도: 중간
   - 의존성: 설정 관리

### 🟢 상대적으로 간단 (수십 줄)
6. **기본 프롬프트 포맷팅**
   - 예상 코드량: ~100줄
   - 복잡도: 낮음

7. **Authors Note**
   - 예상 코드량: ~50줄
   - 복잡도: 낮음

---

## 11. 우선순위 추천

### Phase 1: 기본 기능 (현재 진행 중)
- [x] 캐릭터 데이터 로드 (`/api/characters/all`)
- [x] 채팅 히스토리 로드 (`/api/chats/get`)
- [x] 기본 메시지 배열 생성 (`/api/chats/prepare-messages`)
- [x] 월드 인포 기본 로드 (파일 로드 완료, 스캔 로직은 TODO)

### Phase 2: 필수 확장 기능
- [ ] Authors Note (간단)
- [x] 기본 프롬프트 포맷팅 (중간) - Main Prompt, 매크로 치환 구현됨 ✅
- [ ] 메시지 예제 처리 (중간)

### Phase 3: 고급 확장 기능
- [ ] 벡터 메모리 (복잡)
- [x] Summary (중간) - 대부분 구현됨 (생성, 로드, 위치/깊이/역할 적용) ✅
- [ ] Smart Context (중간)

### Phase 4: 완전한 월드 인포
- [ ] 월드 인포 스캔 로직 (매우 복잡)

### Phase 5: 토큰 관리 및 최적화
- [ ] ChatCompletion 클래스 포팅 (복잡)
- [ ] 토큰 예산 관리 (중간)

---

## 12. 의사결정 가이드

### 이 기능이 필요한가요?

**질문 1: 앱에서 이 기능을 사용하나요?**
- 예 → 서버로 포팅 필요
- 아니오 → 포팅 불필요

**질문 2: 웹에서 설정한 값이 앱에 반영되어야 하나요?**
- 예 → 서버로 포팅 필요
- 아니오 → 포팅 불필요

**질문 3: 클라이언트 전용 기능인가요? (UI, 이벤트 등)**
- 예 → 포팅 불필요
- 아니오 → 서버로 포팅 필요

---

## 📝 참고

- 이 체크리스트는 `public/scripts/openai.js`의 `prepareOpenAIMessages` 함수를 기반으로 작성되었습니다.
- 실제 구현 시 클라이언트 코드를 서버 환경에 맞게 수정해야 합니다.
- 일부 기능은 서버에 이미 API가 있을 수 있습니다 (예: `/api/vector`).

