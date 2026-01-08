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
- [x] 캐릭터 파일 로드 및 파싱
- [x] 캐릭터 설명 (description)
- [x] 캐릭터 성격 (personality)
- [x] 시나리오 (scenario)
- [x] 캐릭터 이름 (name2)
- [x] 시스템 프롬프트 (system_prompt)
- [x] Post-History Instructions (jailbreak)
- [x] 메시지 예제 (mes_example)
- [x] 첫 메시지 (first_mes)
- [x] 대체 인사말 (alternate_greetings)
- [x] Creator Notes (creator_notes)

### ⚠️ 조건부 항목
- [ ] Character Book (character_book) - 월드 인포와 연관
- [ ] Group Only Greetings - 그룹 채팅 전용

---

## 2. 월드 인포 (World Info / Lorebook)

### ✅ 필수 항목 (완전한 기능 사용 시)
- [ ] 월드 인포 파일 로드
- [ ] 월드 인포 엔트리 스캔 (`checkWorldInfo` 함수)
- [ ] 키워드 매칭 (Primary Keywords)
- [ ] 보조 키워드 (Secondary Keywords)
- [ ] 키워드 로직 (AND ANY, AND ALL, NOT ANY, NOT ALL)
- [ ] 스캔 깊이 (Scan Depth)
- [ ] 대소문자 구분 (Case-Sensitive)
- [ ] 전체 단어 매칭 (Whole Words)
- [ ] 그룹 스코어링 (Group Scoring)
- [ ] 우선순위 (Priority)
- [ ] 전략 (Strategy: ↑ Char, ↓ Char 등)
- [ ] 위치 (Position: Before, After, At Depth)
- [ ] 깊이 (Depth)
- [ ] 트리거 확률 (Trigger %)
- [ ] 캐릭터/태그 필터링
- [ ] 생성 트리거 필터링 (Normal, Continue, Impersonate, Swipe)
- [ ] Inclusion Group
- [ ] Sticky (항상 활성화)
- [ ] Cooldown (재사용 대기 시간)
- [ ] Delay (지연 활성화)
- [ ] 재귀 스캔 (Recursion)
- [ ] 최소 활성화 수 (Min Activations)
- [ ] 토큰 예산 관리 (Budget)
- [ ] 월드 인포 포맷팅 (`formatWorldInfo`)
- [ ] worldInfoBefore / worldInfoAfter 분리

### ⚠️ 간소화 버전 (기본 기능만)
- [x] 월드 인포 파일 로드 (현재 구현됨)
- [x] 모든 엔트리 포함 (현재 구현됨)
- [ ] 키워드 기반 필터링 (TODO)
- [ ] 위치 기반 분리 (Before/After) (TODO)

---

## 3. 확장 프롬프트 (Extension Prompts)

### ✅ 알려진 확장 프롬프트

#### 3.1 Summary (1_memory)
- [ ] Summary 설정 로드
- [ ] Summary 생성 로직
  - [ ] 요약 소스 선택 (extras, main, webllm)
  - [ ] 요약 프롬프트 실행
  - [ ] 요약 템플릿 적용
  - [ ] 요약 간격 관리 (Prompt Interval)
  - [ ] 요약 단어 수 관리 (Prompt Words)
  - [ ] 강제 요약 단어 수 (Prompt Force Words)
- [ ] Summary 위치/깊이/역할 적용

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
- [ ] 매크로 치환 (`substituteParams`)
- [ ] 시나리오 포맷 (`scenario_format`)
- [ ] 성격 포맷 (`personality_format`)
- [ ] 월드 인포 포맷 (`wi_format`)
- [ ] 그룹 Nudge 프롬프트 (`group_nudge_prompt`)
- [ ] Impersonation 프롬프트 (`impersonation_prompt`)
- [ ] Continue Nudge 프롬프트 (`continue_nudge_prompt`)
- [ ] New Example Chat 프롬프트 (`new_example_chat_prompt`)
- [ ] Send If Empty (`send_if_empty`)
- [ ] Assistant Prefill (`assistant_prefill`)
- [ ] Continue Prefill (`continue_prefill`)

---

## 5. 프롬프트 관리 (Prompt Manager)

### ✅ 필수 항목
- [ ] 프롬프트 컬렉션 관리 (`getPromptCollection`)
- [ ] 프롬프트 마커 관리
- [ ] 프롬프트 순서 관리
- [ ] 프롬프트 위치 관리 (Before Prompt, In Prompt, In Chat)
- [ ] 프롬프트 깊이 관리 (Injection Depth)
- [ ] 프롬프트 우선순위 관리 (Injection Order)
- [ ] 프롬프트 역할 관리 (system, user, assistant)
- [ ] 프롬프트 비활성화 관리 (캐릭터별)
- [ ] 프롬프트 오버라이드 관리
- [ ] Main Prompt 처리
- [ ] Jailbreak Prompt 처리
- [ ] Dialogue Examples 처리
- [ ] Chat History 마커 처리

---

## 6. 메시지 처리

### ✅ 필수 항목
- [x] 채팅 히스토리 로드 (현재 구현됨)
- [ ] 채팅 히스토리 포맷팅
- [ ] 메시지 예제 (Message Examples) 처리
- [ ] 메시지 예제 파싱 (`parseExampleIntoIndividual`)
- [ ] 메시지 이름 처리 (Names Behavior)
- [ ] 메시지 역할 변환 (user, assistant, system)
- [ ] 이미지 인라인 처리 (Image Inlining)
- [ ] 비디오 인라인 처리 (Video Inlining)
- [ ] 오디오 인라인 처리 (Audio Inlining)
- [ ] 도구 호출 지원 (Tool Calling)
- [ ] 추론 서명 지원 (Reasoning Signature)
- [ ] In-Chat Injection 처리 (`populationInjectionPrompts`)
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
- [ ] 사용자 설정 로드 (name1, settings)
- [ ] OpenAI 설정 로드 (`oai_settings`)
- [ ] Power User 설정 로드 (`power_user`)
- [ ] 확장 설정 로드 (`extension_settings`)
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
- [x] 캐릭터 데이터 로드
- [x] 채팅 히스토리 로드
- [x] 기본 메시지 배열 생성
- [x] 월드 인포 기본 로드

### Phase 2: 필수 확장 기능
- [ ] Authors Note (간단)
- [ ] 기본 프롬프트 포맷팅 (중간)
- [ ] 메시지 예제 처리 (중간)

### Phase 3: 고급 확장 기능
- [ ] 벡터 메모리 (복잡)
- [ ] Summary (중간)
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

