# 챗봇 안전 관리 시스템 구현 계획

## 배경

Google Gemini API의 Safety Settings(`threshold: 'BLOCK_LOW_AND_ABOVE'`)를 사용했지만, 한국어 위험 발화(예: "자살하고 싶어")가 `NEGLIGIBLE`로 평가되어 통과되는 문제가 발견됨. Google의 안전 필터가 한국어나 특정 컨텍스트에서 부정확할 수 있어 추가적인 안전 관리 시스템이 필요함.

## 현재 상황 분석

### Google Safety Settings의 한계

- **문제점:**
  - 한국어 위험 발화 감지 정확도가 낮음
  - 컨텍스트(역할극, 상담 등)에 따라 평가가 달라질 수 있음
  - `NEGLIGIBLE`로 평가되면 `BLOCK_LOW_AND_ABOVE` 설정으로도 차단되지 않음

- **현재 동작:**
  - `threshold: 'BLOCK_LOW_AND_ABOVE'` → `LOW`, `MEDIUM`, `HIGH`만 차단
  - `NEGLIGIBLE`은 통과됨
  - `finishReason: 'STOP'`이면 정상 응답으로 처리됨

### 코드 현황

- `src/endpoints/backends/chat-completions.js`: `finishReason`과 `safetyRatings`를 체크하지 않음
- `src/constants.js`: `GEMINI_SAFETY`, `VERTEX_SAFETY` 설정만 존재
- 서버 사이드에서 추가 안전 검사 로직 없음

## 안전 관리 시스템 옵션

### 1. NVIDIA NeMo Guardrails
- **특징:** 범용 guardrails 프레임워크, 정책 기반 제어
- **장점:** 유연한 정책 설정, 다양한 통합 옵션
- **단점:** 설정 복잡도가 높음

### 2. Llama Guard (Meta)
- **특징:** 범용 안전 분류 모델
- **장점:** 오픈소스, 범용적
- **단점:** 한국어 성능이 제한적일 수 있음

### 3. Kakao Kanana Safeguard
- **특징:** 한국어 특화 안전 관리 시스템
- **장점:** 한국어 감지 정확도 높음
- **단점:** 상용 서비스, 비용 발생 가능

### 4. Upstage Solar Guard
- **특징:** 한국어 특화 안전 관리 시스템
- **장점:** 한국어 감지 정확도 높음
- **단점:** 상용 서비스, 비용 발생 가능

### 5. Perspective API (Google)
- **특징:** Toxicity 감지 API
- **장점:** Google 인프라, 안정적
- **단점:** 한국어 지원 제한적일 수 있음

### 6. HateXplain
- **특징:** 혐오 표현 감지
- **장점:** 오픈소스
- **단점:** 범위가 제한적 (혐오 표현 위주)

## 일반적인 프로덕션 구성 방식

### 다층적 방어 (Defense in Depth) 전략

일반적으로 챗봇 시스템은 여러 안전 관리 시스템을 조합하여 사용함:

1. **다중 시스템 통합**
   - 각 시스템의 강점을 활용
   - 한 시스템의 한계를 다른 시스템으로 보완
   - 예: Llama Guard(범용) + Kanana Safeguard(한국어) + 키워드 필터

2. **자체 보완 시스템**
   - 기존 시스템을 보완하는 자체 감지 로직
   - 키워드 기반 필터링
   - 도메인 특화 규칙

3. **지속적인 모니터링**
   - 안전 관리 시스템의 성능 모니터링
   - 새로운 위협 패턴 감지 및 대응

### 실제 프로덕션 구성 예시

**최소 구성 (비용 효율적):**
1. Llama Guard 또는 NeMo Guardrails (범용 안전 분류)
2. 키워드 기반 필터 (자체 구현)
3. Google Perspective API (선택적)

**권장 구성 (한국어 특화):**
1. Kakao Kanana Safeguard 또는 Upstage Solar Guard (한국어 특화)
2. Llama Guard (범용 보완)
3. 키워드 기반 필터 (자체 구현)

**고급 구성 (최대 보호):**
- 위 권장 구성 + NeMo Guardrails (정책 기반 제어)
- + Perspective API (추가 검증)

## SillyTavern 구현 추천

### 1단계: 기본 구성 (우선 구현)

1. **키워드 기반 필터 (자체 구현)**
   - 위험 키워드 리스트 정의
   - 사용자 메시지에서 키워드 감지
   - 감지 시 차단 또는 경고
   - 구현 난이도: 낮음
   - 비용: 무료

2. **Kakao Kanana Safeguard 또는 Upstage Solar Guard**
   - 한국어 위험 발화 감지
   - API 통합 필요
   - 구현 난이도: 중간
   - 비용: API 사용료 발생 가능

### 2단계: 보완 시스템 (선택적)

3. **Llama Guard**
   - 범용 안전 분류 보완
   - 오픈소스 모델 사용 가능
   - 구현 난이도: 중간
   - 비용: 모델 호스팅 비용

4. **Google Safety Ratings 추가 체크**
   - `finishReason: 'SAFETY'` 감지
   - `safetyRatings`에서 `DANGEROUS_CONTENT` 체크
   - 구현 난이도: 낮음
   - 비용: 무료

## 구현 우선순위

### Phase 1: 즉시 구현 가능 (키워드 필터)
- [ ] 위험 키워드 리스트 정의
- [ ] 사용자 메시지 키워드 감지 로직
- [ ] 차단/경고 처리 로직
- [ ] 설정 UI (키워드 리스트 관리)

### Phase 2: 한국어 특화 시스템 통합
- [ ] Kanana Safeguard 또는 Solar Guard API 통합
- [ ] API 응답 처리 로직
- [ ] 에러 핸들링 및 폴백

### Phase 3: 추가 보완 시스템
- [ ] Llama Guard 통합 (선택적)
- [ ] Google Safety Ratings 추가 체크
- [ ] 모니터링 및 로깅 시스템

## 기술적 고려사항

### 키워드 필터 구현 시
- 정규식 패턴 매칭
- 부분 문자열 매칭 vs 전체 단어 매칭
- 대소문자 구분 여부
- 키워드 우선순위 및 카테고리 분류

### API 통합 시
- 비동기 처리 및 타임아웃
- API 실패 시 폴백 전략
- 응답 캐싱 (성능 최적화)
- 비용 관리 (API 호출 제한)

### 사용자 경험
- 차단 시 명확한 메시지 표시
- 사용자에게 차단 이유 설명 (선택적)
- 관리자용 로깅 및 모니터링

## 참고 자료

- [Google Gemini API Safety Settings](https://ai.google.dev/gemini-api/docs/safety-settings)
- [NVIDIA NeMo Guardrails](https://github.com/NVIDIA/NeMo-Guardrails)
- [Meta Llama Guard](https://github.com/facebookresearch/PurpleLlama)
- [Kakao Kanana Safeguard](https://developers.kakao.com/)
- [Upstage Solar Guard](https://www.upstage.ai/)

## 다음 단계

1. 키워드 필터 구현 검토 및 설계
2. 한국어 특화 안전 관리 시스템 API 문서 검토
3. 비용 및 성능 분석
4. 구현 계획 수립

