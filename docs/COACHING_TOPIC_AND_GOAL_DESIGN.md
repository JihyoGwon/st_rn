# 코칭 시스템 주제 및 목표 설계 분석

## 핵심 질문

1. **주제 선택 방식**: 자유주제 vs 선택형 주제
2. **세션 목표 설정**: LLM 자율 판단 vs 커리큘럼식

---

## 1. 주제 선택 방식 비교

### 방식 A: 완전 자유주제 (LLM 자율 파악)

#### 개념
- 사용자가 자유롭게 대화 시작
- LLM이 메시지에서 주제를 자동으로 파악
- 파악된 주제에 맞춰 코칭 진행

#### 구현 방식
```javascript
// 주제 자동 감지
async function detectCoachingTopic(messages) {
  const prompt = `
다음 대화에서 코칭이 필요한 주제를 파악하세요.
가능한 주제: 정신 건강, 커리어, 라이프 코칭, 기타

대화 내용:
${messages.map(m => m.mes).join('\n')}

주제를 JSON 형식으로 반환하세요:
{
  "topic": "mental-health" | "career" | "life" | "other",
  "confidence": 0.0-1.0,
  "subtopic": "구체적인 하위 주제",
  "reasoning": "주제를 선택한 이유"
}
  `;
  
  const response = await callLLM(prompt);
  return parseTopic(response);
}
```

#### 장점

##### 1. 사용자 경험
- ✅ 자연스러운 대화 시작
- ✅ 사용자가 "코칭 받고 싶어"라고 명시할 필요 없음
- ✅ 진입 장벽이 낮음
- ✅ 유연한 대화 흐름

##### 2. 구현 측면
- ✅ 초기 구현이 단순함
- ✅ 주제 목록 관리 불필요
- ✅ 사용자 선택 UI 불필요

##### 3. 확장성
- ✅ 새로운 주제가 자동으로 감지됨
- ✅ 하이브리드 주제 (여러 주제 동시) 처리 가능
- ✅ 주제 목록 업데이트 불필요

#### 단점

##### 1. 정확도 문제
- ❌ 주제 파악 오류 가능성
- ❌ 모호한 대화에서 주제 혼동
- ❌ 사용자가 원하는 주제와 다르게 파악될 수 있음

##### 2. 일관성 문제
- ❌ 같은 대화에서 주제가 바뀔 수 있음
- ❌ 세션 간 주제 일관성 유지 어려움
- ❌ 코칭 스타일이 일관되지 않을 수 있음

##### 3. 사용자 제어 부족
- ❌ 사용자가 원하는 주제를 명시적으로 선택 불가
- ❌ 주제 변경이 어려울 수 있음
- ❌ "이 주제로 코칭 받고 싶어" 명시 불가

#### 고려사항

##### LLM 정확도
- 주제 감지 정확도를 높이기 위한 프롬프트 엔지니어링 필요
- 여러 메시지를 종합하여 판단하는 로직 필요
- 신뢰도(confidence) 기반 처리 필요

##### 주제 변경 처리
- 대화 중 주제가 바뀔 때 처리 방법
- 주제 변경 감지 및 전환 로직
- 이전 주제 컨텍스트 유지 여부

##### 사용자 피드백
- 주제 파악이 틀렸을 때 수정 메커니즘
- "이 주제가 아니야" 피드백 처리

---

### 방식 B: 선택형 주제 (사용자 선택)

#### 개념
- 사용자가 명시적으로 주제 선택
- 선택된 주제에 맞춰 코칭 진행
- 주제 목록을 UI에 표시

#### 구현 방식
```javascript
// 주제 선택 UI
const topics = [
  { id: 'mental-health', name: '정신 건강', icon: '🧠' },
  { id: 'career', name: '커리어', icon: '💼' },
  { id: 'life', name: '라이프', icon: '🌟' }
];

// 선택된 주제로 코칭 시작
async function startCoachingSession(topicId, characterId) {
  const session = {
    sessionId: generateId(),
    topic: topicId,
    startTime: Date.now(),
    status: 'active'
  };
  
  // 주제별 프롬프트 로드
  const prompt = await loadTopicPrompt(topicId);
  
  return session;
}
```

#### 장점

##### 1. 명확성
- ✅ 사용자가 원하는 주제를 명확히 선택
- ✅ 주제 파악 오류 없음
- ✅ 일관된 코칭 경험

##### 2. 사용자 제어
- ✅ 사용자가 주제를 직접 선택
- ✅ 주제 변경이 쉬움
- ✅ "이 주제로 코칭 받고 싶어" 명시 가능

##### 3. 구조화
- ✅ 주제별로 최적화된 코칭 가능
- ✅ 주제별 프롬프트/커리큘럼 준비 가능
- ✅ 주제별 통계/분석 가능

#### 단점

##### 1. 사용자 경험
- ❌ 진입 장벽이 높음 (선택해야 함)
- ❌ 자연스럽지 않을 수 있음
- ❌ "그냥 이야기하고 싶은데..." 사용자 배제

##### 2. 구현 복잡도
- ❌ 주제 목록 관리 필요
- ❌ 주제 선택 UI 필요
- ❌ 주제별 설정 관리 필요

##### 3. 확장성
- ❌ 새로운 주제 추가 시 UI 업데이트 필요
- ❌ 하이브리드 주제 처리 어려움
- ❌ 주제 목록이 제한적

---

### 방식 C: 하이브리드 (겉으로는 자유, 내부적으로는 구조화)

#### 개념
- 겉으로는 자유주제처럼 보임
- 하지만 내부적으로는 주제를 파악하여 구조화된 코칭 진행
- 사용자는 자유롭게 대화하지만, 시스템은 주제를 감지하여 최적화

#### 구현 방식
```javascript
// 자유 대화 시작
async function handleMessage(message, session) {
  // 1. 주제 자동 감지 (사용자에게는 보이지 않음)
  const detectedTopic = await detectTopic(message, session);
  
  // 2. 주제가 확정되면 해당 주제의 코칭 스타일 적용
  if (detectedTopic.confidence > 0.8 && !session.confirmedTopic) {
    session.confirmedTopic = detectedTopic.topic;
    // 주제별 프롬프트 적용
    await applyTopicPrompt(session, detectedTopic.topic);
  }
  
  // 3. 주제별 최적화된 코칭 진행
  const response = await generateCoachingResponse(message, session);
  
  return response;
}
```

#### 장점
- ✅ 자연스러운 시작 (자유주제의 장점)
- ✅ 구조화된 코칭 (선택형의 장점)
- ✅ 사용자는 자유롭게, 시스템은 최적화

#### 단점
- ⚠️ 구현 복잡도가 높음
- ⚠️ 주제 감지 정확도에 의존
- ⚠️ 사용자가 주제를 모를 수 있음

---

## 2. 세션 목표 설정 방식 비교

### 방식 A: LLM 자율 판단

#### 개념
- LLM이 대화 내용을 분석하여 세션 목표를 자동으로 설정
- 사용자가 명시적으로 목표를 설정하지 않음
- 목표는 대화가 진행되면서 동적으로 업데이트

#### 구현 방식
```javascript
// 목표 자동 감지 및 설정
async function detectSessionGoal(messages, session) {
  const prompt = `
다음 대화를 분석하여 코칭 세션의 목표를 파악하세요.

대화 내용:
${messages.map(m => m.mes).join('\n')}

현재 세션 정보:
- 주제: ${session.topic}
- 시작 시간: ${session.startTime}

목표를 JSON 형식으로 반환하세요:
{
  "goal": "구체적인 목표",
  "type": "short-term" | "long-term",
  "milestones": ["마일스톤1", "마일스톤2"],
  "expectedOutcome": "기대 결과"
}
  `;
  
  const response = await callLLM(prompt);
  const goal = parseGoal(response);
  
  // 세션에 목표 저장
  session.goal = goal;
  return goal;
}
```

#### 장점

##### 1. 자연스러움
- ✅ 사용자가 목표를 명시할 필요 없음
- ✅ 대화 흐름이 자연스러움
- ✅ 진입 장벽이 낮음

##### 2. 유연성
- ✅ 목표가 대화에 따라 변경 가능
- ✅ 사용자의 실제 니즈에 맞춤
- ✅ 예상치 못한 목표도 처리 가능

##### 3. 구현 단순성
- ✅ 목표 설정 UI 불필요
- ✅ 목표 목록 관리 불필요
- ✅ 초기 구현이 단순함

#### 단점

##### 1. 명확성 부족
- ❌ 사용자가 목표를 명확히 알기 어려움
- ❌ 목표가 모호할 수 있음
- ❌ 목표 달성 여부 확인 어려움

##### 2. 일관성 문제
- ❌ 세션 간 목표 일관성 유지 어려움
- ❌ 목표가 자주 바뀔 수 있음
- ❌ 장기적인 진행 상황 추적 어려움

##### 3. 사용자 제어 부족
- ❌ 사용자가 목표를 직접 설정 불가
- ❌ 목표 수정이 어려울 수 있음
- ❌ "이 목표로 코칭 받고 싶어" 명시 불가

#### 고려사항

##### 목표 감지 정확도
- 여러 메시지를 종합하여 판단
- 신뢰도 기반 처리
- 목표 변경 감지 및 업데이트 로직

##### 목표 추적
- 목표 달성도 측정 방법
- 진행 상황 추적 메커니즘
- 목표 달성 시 알림/축하

##### 사용자 피드백
- 목표 파악이 틀렸을 때 수정 메커니즘
- 사용자가 목표를 확인/수정할 수 있는 방법

---

### 방식 B: 커리큘럼식 (정해진 목표)

#### 개념
- 주제별로 미리 정의된 목표/커리큘럼 제공
- 사용자가 목표를 선택하거나 시스템이 제안
- 구조화된 단계별 진행

#### 구현 방식
```javascript
// 주제별 커리큘럼 정의
const curricula = {
  'mental-health': {
    goals: [
      {
        id: 'stress-management',
        title: '스트레스 관리',
        description: '일상적인 스트레스를 효과적으로 관리하는 방법을 배웁니다.',
        steps: [
          '스트레스 원인 파악',
          '스트레스 대응 전략 수립',
          '실전 연습 및 피드백'
        ]
      },
      {
        id: 'mood-tracking',
        title: '기분 추적',
        description: '일상적인 기분 변화를 추적하고 패턴을 파악합니다.',
        steps: [
          '기분 일기 시작',
          '패턴 분석',
          '개선 방안 도출'
        ]
      }
    ]
  },
  'career': {
    goals: [
      {
        id: 'job-search',
        title: '취업 준비',
        description: '이력서 작성부터 면접 준비까지 체계적으로 준비합니다.',
        steps: [
          '이력서 작성',
          '포트폴리오 준비',
          '면접 연습'
        ]
      }
    ]
  }
};

// 커리큘럼 기반 세션 시작
async function startCurriculumSession(topicId, goalId) {
  const curriculum = curricula[topicId];
  const goal = curriculum.goals.find(g => g.id === goalId);
  
  const session = {
    sessionId: generateId(),
    topic: topicId,
    goal: goal,
    currentStep: 0,
    status: 'active'
  };
  
  return session;
}
```

#### 장점

##### 1. 구조화
- ✅ 명확한 목표와 단계
- ✅ 체계적인 진행
- ✅ 목표 달성도 측정 용이

##### 2. 사용자 제어
- ✅ 사용자가 목표를 선택 가능
- ✅ 목표를 명확히 알 수 있음
- ✅ 목표 수정 가능

##### 3. 효과성
- ✅ 검증된 커리큘럼 사용 가능
- ✅ 주제별 최적화된 진행
- ✅ 전문가가 설계한 구조 활용 가능

#### 단점

##### 1. 유연성 부족
- ❌ 예상치 못한 상황 처리 어려움
- ❌ 사용자의 특수한 니즈 반영 어려움
- ❌ 커리큘럼에서 벗어난 대화 어려움

##### 2. 구현 복잡도
- ❌ 커리큘럼 설계 및 관리 필요
- ❌ 주제별 커리큘럼 준비 필요
- ❌ 커리큘럼 업데이트 필요

##### 3. 사용자 경험
- ❌ 진입 장벽이 높을 수 있음
- ❌ 구조화된 진행이 부담스러울 수 있음
- ❌ "그냥 이야기하고 싶은데..." 사용자 배제

#### 고려사항

##### 커리큘럼 설계
- 주제별 커리큘럼 설계
- 단계별 목표 설정
- 진행 상황 추적 메커니즘

##### 커스터마이징
- 사용자가 커리큘럼을 수정할 수 있는지
- 커리큘럼에서 벗어난 대화 처리
- 하이브리드 접근 (커리큘럼 + 자유 대화)

---

## 3. 조합 방식 비교

### 조합 1: 자유주제 + LLM 자율 목표
```
주제: 자동 감지
목표: 자동 설정
```

**특징**
- 가장 자연스러운 경험
- 진입 장벽 최소
- 하지만 명확성과 일관성 부족

**적합한 경우**
- 캐주얼한 코칭
- 탐색 단계
- 사용자가 명확한 목표가 없는 경우

### 조합 2: 자유주제 + 커리큘럼식 목표
```
주제: 자동 감지
목표: 감지된 주제의 커리큘럼 적용
```

**특징**
- 자연스러운 시작 + 구조화된 진행
- 주제 감지 후 해당 커리큘럼 적용
- 하이브리드 접근

**적합한 경우**
- 자연스러운 시작을 원하지만 구조화된 진행도 원하는 경우
- 주제별 최적화된 코칭을 원하는 경우

### 조합 3: 선택형 주제 + LLM 자율 목표
```
주제: 사용자 선택
목표: 자동 설정
```

**특징**
- 주제는 명확하지만 목표는 유연
- 주제별 최적화 가능
- 목표는 대화에 따라 조정

**적합한 경우**
- 주제는 명확하지만 목표는 유연하게 하고 싶은 경우

### 조합 4: 선택형 주제 + 커리큘럼식 목표
```
주제: 사용자 선택
목표: 선택된 주제의 커리큘럼
```

**특징**
- 가장 구조화된 접근
- 명확한 진행
- 하지만 가장 덜 자연스러움

**적합한 경우**
- 체계적인 코칭을 원하는 경우
- 명확한 목표가 있는 경우

---

## 4. 권장 접근법: 단계적 하이브리드

### Phase 1: 자연스러운 시작 (자유주제 + LLM 자율 목표)

#### 구현
```javascript
// 1. 자유 대화 시작
async function handleCoachingMessage(message, session) {
  // 2. 주제 자동 감지 (사용자에게는 보이지 않음)
  if (!session.topic) {
    const detectedTopic = await detectTopic(message);
    if (detectedTopic.confidence > 0.7) {
      session.topic = detectedTopic.topic;
      // 주제별 기본 프롬프트 적용
      await applyTopicPrompt(session, detectedTopic.topic);
    }
  }
  
  // 3. 목표 자동 감지 및 업데이트
  const goal = await detectGoal(message, session);
  if (goal && !session.goal) {
    session.goal = goal;
  } else if (goal && session.goal) {
    // 목표 업데이트 (대화에 따라 변경 가능)
    session.goal = mergeGoals(session.goal, goal);
  }
  
  // 4. 코칭 응답 생성
  const response = await generateCoachingResponse(message, session);
  return response;
}
```

#### 장점
- 자연스러운 시작
- 진입 장벽 최소
- 빠른 구현 가능

#### 단점
- 명확성 부족
- 일관성 문제 가능

### Phase 2: 선택적 구조화 (사용자가 원할 때)

#### 구현
```javascript
// 사용자가 "목표를 정하고 싶어"라고 하면
async function setExplicitGoal(session, userRequest) {
  // 1. 주제별 목표 제안
  const suggestedGoals = await getSuggestedGoals(session.topic);
  
  // 2. 사용자가 목표 선택 또는 직접 입력
  const selectedGoal = await getUserGoalSelection(suggestedGoals, userRequest);
  
  // 3. 선택된 목표로 세션 업데이트
  session.goal = selectedGoal;
  session.goalType = 'explicit'; // 명시적 목표
  
  return session;
}
```

#### 장점
- 사용자가 원할 때 구조화 가능
- 자연스러움과 구조화의 균형

#### 단점
- 구현 복잡도 증가

---

## 5. 구현 고려사항

### 자율성을 택할 때 고려사항

#### 1. LLM 정확도 향상
- 프롬프트 엔지니어링
- 여러 메시지 종합 분석
- 신뢰도 기반 처리
- 주제/목표 변경 감지

#### 2. 사용자 피드백 메커니즘
- 주제/목표 확인 UI
- "이게 아니야" 피드백 처리
- 주제/목표 수정 기능

#### 3. 일관성 유지
- 세션 간 주제/목표 일관성
- 목표 변경 이력 추적
- 진행 상황 연속성

#### 4. 모호함 처리
- 주제가 모호할 때 처리
- 여러 주제가 동시에 언급될 때
- 주제 변경 시 전환 로직

### 커리큘럼식을 택할 때 준비사항

#### 1. 커리큘럼 설계
- 주제별 커리큘럼 목록
- 각 커리큘럼의 단계별 목표
- 진행 상황 추적 메커니즘
- 완료 조건 정의

#### 2. 커리큘럼 관리 시스템
- 커리큘럼 CRUD API
- 커리큘럼 버전 관리
- 커리큘럼 공유 기능
- 커뮤니티 커리큘럼

#### 3. 유연성 제공
- 커리큘럼에서 벗어난 대화 처리
- 커리큘럼 수정 기능
- 하이브리드 접근 (커리큘럼 + 자유 대화)

#### 4. 사용자 선택 UI
- 주제 선택 화면
- 목표 선택 화면
- 커리큘럼 진행 화면
- 진행 상황 표시

---

## 6. 최종 권장사항

### 초기 구현: 자유주제 + LLM 자율 목표 (하이브리드)

**이유**
1. 자연스러운 시작 (사용자 경험 우선)
2. 빠른 구현 가능
3. 사용자 피드백 수집 후 개선 가능

**구현 전략**
- 주제 자동 감지 (내부적으로만)
- 목표 자동 설정 (내부적으로만)
- 사용자에게는 자연스럽게 보이도록
- 필요 시 주제/목표 확인 UI 제공

### 향후 확장: 선택적 구조화

**추가 기능**
- 사용자가 원할 때 명시적 목표 설정
- 주제별 커리큘럼 제안
- 구조화된 진행 옵션

---

## 7. 구체적 구현 예시

### 예시: 자유주제 + LLM 자율 목표

```javascript
// 코칭 메시지 처리
async function processCoachingMessage(message, session) {
  // 1. 주제 감지 (처음 몇 메시지에서)
  if (session.messages.length < 5 && !session.topic) {
    const topic = await detectTopic(session.messages);
    if (topic.confidence > 0.7) {
      session.topic = topic.topic;
      // 주제별 프롬프트 적용
      session.systemPrompt = await getTopicPrompt(topic.topic);
    }
  }
  
  // 2. 목표 감지 및 업데이트
  const goal = await detectGoal(message, session);
  if (goal) {
    if (!session.goal) {
      session.goal = goal;
    } else {
      // 목표 업데이트 (대화에 따라)
      session.goal = updateGoal(session.goal, goal);
    }
  }
  
  // 3. 코칭 응답 생성
  const response = await generateResponse(message, session);
  
  // 4. 목표 달성도 업데이트
  if (session.goal) {
    session.goalProgress = await calculateProgress(session);
  }
  
  return response;
}
```

### 예시: 선택적 구조화

```javascript
// 사용자가 명시적 목표 설정 요청
async function setExplicitGoal(session, userMessage) {
  // 1. 주제별 목표 제안
  const suggestions = await getGoalSuggestions(session.topic);
  
  // 2. 사용자에게 제안 표시 (UI)
  // 또는 LLM이 대화로 제안
  
  // 3. 사용자 선택 또는 직접 입력
  const selectedGoal = await getUserGoalSelection(suggestions, userMessage);
  
  // 4. 세션 업데이트
  session.goal = selectedGoal;
  session.goalType = 'explicit';
  session.goalSetAt = Date.now();
  
  return session;
}
```

---

## 결론

### 주제 선택
- **초기**: 자유주제 (LLM 자동 감지, 사용자에게는 보이지 않음)
- **향후**: 선택적 구조화 (사용자가 원할 때 명시적 선택)

### 세션 목표
- **초기**: LLM 자율 판단 (대화에 따라 동적 설정)
- **향후**: 선택적 커리큘럼 (사용자가 원할 때 구조화된 목표 선택)

### 핵심 원칙
1. **자연스러움 우선**: 사용자가 부담스럽지 않게 시작
2. **점진적 구조화**: 필요 시 구조화 옵션 제공
3. **유연성**: 자유와 구조의 균형


