# Proxy 중계 서버 아키텍처 설계

## 📋 개요

앱 스토어 배포를 위한 Proxy 중계 서버 설계 문서입니다. React Native 앱과 SillyTavern 서버 사이에 Proxy 서버를 두어 사용자 인증, 세션 관리, 보안을 독립적으로 관리합니다.

## 🎯 목표

- **인터넷을 통한 원격 접근** 지원
- **사용자별 독립적인 세션 관리**
- **보안 강화** (API 키, 레이트 리미팅, 요청 검증)
- **확장 가능한 아키텍처** (로드밸런싱, 멀티 서버)
- **앱 스토어 배포 준비**

## 🏗️ 아키텍처 설계

### 전체 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    앱 스토어 배포 아키텍처                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📱 React Native 앱 (App Store)                            │
│     ├─ 사용자 인증 (JWT/API Key)                            │
│     ├─ API 요청                                             │
│     └─ 세션 관리 (클라이언트)                               │
│                                                             │
│           ↓ HTTPS                                            │
│                                                             │
│  🌐 Proxy 중계 서버 (공개 서버)                             │
│     ├─ 인증 및 권한 관리                                    │
│     ├─ API 키 검증                                          │
│     ├─ 레이트 리미팅                                        │
│     ├─ 요청 로깅 및 모니터링                                │
│     ├─ 로드밸런싱                                           │
│     └─ 요청 라우팅                                          │
│                                                             │
│           ↓ 내부 네트워크                                   │
│                                                             │
│  🖥️ SillyTavern 서버 (내부 서버)                            │
│     ├─ 데이터베이스 (PostgreSQL)                            │
│     ├─ 채팅 데이터                                          │
│     ├─ 캐릭터 데이터                                         │
│     └─ 사용자 데이터                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 데이터 흐름

```
1. 앱 시작
   앱 → Proxy 서버 (/api/auth/login)
   → JWT 토큰 발급
   → 앱에 토큰 저장

2. API 요청
   앱 → Proxy 서버 (Authorization: Bearer {token})
   → 토큰 검증
   → 사용자 ID 추출
   → SillyTavern 서버로 요청 전달 (내부 세션 생성)
   → 응답 반환

3. 세션 관리
   Proxy 서버: JWT 토큰 관리 (stateless)
   SillyTavern 서버: 내부 세션 관리 (쿠키 기반)
```

## 🔐 인증 및 세션 관리

### 이중 인증 구조

#### 1. Proxy 서버 레벨 (외부)

**역할**: 앱 사용자 인증 및 API 키 관리

```typescript
// Proxy 서버 인증
interface ProxyAuth {
  // JWT 토큰 기반 (stateless)
  token: string;           // JWT 토큰
  userId: string;         // 사용자 ID
  apiKey: string;          // API 키 (선택적)
  expiresAt: number;       // 만료 시간
}

// API 요청 헤더
Authorization: Bearer {jwt_token}
X-API-Key: {api_key}  // 선택적
```

**장점**:
- Stateless (확장성)
- 모바일 앱에 적합
- 쿠키 제약 없음

#### 2. SillyTavern 서버 레벨 (내부)

**역할**: 실제 데이터 접근 및 세션 관리

```typescript
// 내부 세션 (Proxy 서버가 관리)
interface InternalSession {
  sessionId: string;      // Express 세션 ID
  userId: string;         // 사용자 ID
  handle: string;         // 사용자 핸들
  createdAt: Date;        // 생성 시간
}
```

**장점**:
- 기존 세션 시스템 활용
- 파일 시스템/DB 접근
- 사용자별 데이터 격리

### 인증 플로우

```
┌─────────┐         ┌──────────┐         ┌──────────────┐
│   앱    │         │  Proxy   │         │ SillyTavern  │
└────┬────┘         └────┬─────┘         └──────┬───────┘
     │                   │                       │
     │ 1. 로그인 요청    │                       │
     ├──────────────────>│                       │
     │                   │                       │
     │                   │ 2. 사용자 인증        │
     │                   ├──────────────────────>│
     │                   │                       │
     │                   │ 3. 세션 생성          │
     │                   │<──────────────────────┤
     │                   │                       │
     │ 4. JWT 발급       │                       │
     │<──────────────────┤                       │
     │                   │                       │
     │ 5. API 요청 (JWT) │                       │
     ├──────────────────>│                       │
     │                   │                       │
     │                   │ 6. JWT 검증           │
     │                   │ (사용자 ID 추출)       │
     │                   │                       │
     │                   │ 7. 내부 세션 확인/생성│
     │                   ├──────────────────────>│
     │                   │                       │
     │                   │ 8. 요청 처리          │
     │                   │<──────────────────────┤
     │                   │                       │
     │ 9. 응답           │                       │
     │<──────────────────┤                       │
     │                   │                       │
```

## 🗄️ 데이터베이스 스키마 (Proxy 서버)

### 사용자 인증 테이블

```sql
-- Proxy 서버 사용자 (앱 사용자)
CREATE TABLE proxy_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  api_key VARCHAR(255) UNIQUE,  -- API 키 (선택적)
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_proxy_users_email ON proxy_users(email);
CREATE INDEX idx_proxy_users_api_key ON proxy_users(api_key);

-- SillyTavern 서버 매핑 (1:N 관계)
CREATE TABLE server_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_user_id UUID NOT NULL REFERENCES proxy_users(id) ON DELETE CASCADE,
  sillytavern_user_handle VARCHAR(255) NOT NULL,  -- SillyTavern 사용자 핸들
  server_url VARCHAR(500),  -- 사용자별 서버 URL (선택적)
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_proxy_user_handle UNIQUE(proxy_user_id, sillytavern_user_handle)
);

CREATE INDEX idx_server_mappings_proxy_user ON server_mappings(proxy_user_id);
CREATE INDEX idx_server_mappings_default ON server_mappings(proxy_user_id, is_default);

-- JWT 토큰 관리 (선택적, Redis 권장)
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_user_id UUID NOT NULL REFERENCES proxy_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(proxy_user_id);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);
```

### 세션 매핑 테이블

```sql
-- Proxy JWT ↔ SillyTavern 세션 매핑
CREATE TABLE session_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_user_id UUID NOT NULL REFERENCES proxy_users(id) ON DELETE CASCADE,
  sillytavern_session_id VARCHAR(255) NOT NULL,  -- Express 세션 ID
  sillytavern_user_handle VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX idx_session_mappings_proxy_user ON session_mappings(proxy_user_id);
CREATE INDEX idx_session_mappings_st_session ON session_mappings(sillytavern_session_id);
CREATE INDEX idx_session_mappings_expires ON session_mappings(expires_at);
```

## 🔧 Proxy 서버 구현

### 기술 스택

- **프레임워크**: Express.js 또는 Fastify
- **데이터베이스**: PostgreSQL (사용자 인증, 세션 매핑)
- **인증**: JWT (jsonwebtoken)
- **캐싱**: Redis (선택적, 성능 향상)
- **로드밸런싱**: Nginx 또는 내장 로드밸런서

### 핵심 미들웨어

```typescript
// 1. 인증 미들웨어
async function authenticateRequest(req, res, next) {
  // JWT 토큰 검증
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.proxyUser = {
      id: decoded.userId,
      email: decoded.email,
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// 2. 레이트 리미팅 미들웨어
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15분
  max: 100, // 최대 100 요청
  keyGenerator: (req) => req.proxyUser.id,
});

// 3. SillyTavern 세션 관리 미들웨어
async function getSillyTavernSession(req, res, next) {
  const proxyUserId = req.proxyUser.id;
  
  // 세션 매핑 조회
  const mapping = await db.query(`
    SELECT * FROM session_mappings
    WHERE proxy_user_id = $1
    AND expires_at > NOW()
    ORDER BY last_accessed_at DESC
    LIMIT 1
  `, [proxyUserId]);

  if (mapping.length === 0) {
    // 새 세션 생성
    const session = await createSillyTavernSession(proxyUserId);
    req.sillytavernSession = session;
  } else {
    // 기존 세션 사용
    req.sillytavernSession = mapping[0];
    // 마지막 접근 시간 업데이트
    await updateLastAccessed(mapping[0].id);
  }

  next();
}

// 4. 요청 프록시 미들웨어
async function proxyToSillyTavern(req, res) {
  const { sillytavernSession } = req;
  const targetUrl = `${SILLYTAVERN_SERVER_URL}${req.path}`;

  // SillyTavern 서버로 요청 전달
  const response = await fetch(targetUrl, {
    method: req.method,
    headers: {
      ...req.headers,
      'Cookie': `session=${sillytavernSession.sillytavern_session_id}`,
      'X-CSRF-Token': await getCsrfToken(sillytavernSession),
    },
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  });

  const data = await response.json();
  res.status(response.status).json(data);
}
```

### API 엔드포인트

```typescript
// POST /api/auth/register
// 회원가입
router.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  
  // 비밀번호 해싱
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  
  // 사용자 생성
  const user = await db.query(`
    INSERT INTO proxy_users (email, password_hash, salt)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [email, passwordHash, salt]);
  
  // SillyTavern 사용자 생성 (자동)
  const stUserHandle = await createSillyTavernUser(user.id);
  
  // 매핑 생성
  await db.query(`
    INSERT INTO server_mappings (proxy_user_id, sillytavern_user_handle, is_default)
    VALUES ($1, $2, true)
  `, [user.id, stUserHandle]);
  
  res.json({ success: true, userId: user.id });
});

// POST /api/auth/login
// 로그인 (JWT 발급)
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  // 사용자 조회
  const user = await db.query(`
    SELECT * FROM proxy_users
    WHERE email = $1 AND enabled = true
  `, [email]);
  
  if (user.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // 비밀번호 검증
  const isValid = verifyPassword(password, user[0].password_hash, user[0].salt);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // JWT 토큰 발급
  const token = jwt.sign(
    { userId: user[0].id, email: user[0].email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.json({ token, userId: user[0].id });
});

// GET /api/proxy/*
// 모든 API 요청 프록시
router.all('/proxy/*', authenticateRequest, getSillyTavernSession, proxyToSillyTavern);
```

## 🔒 보안 고려사항

### 1. API 키 관리

```typescript
// 사용자별 API 키 생성 (선택적)
async function generateApiKey(userId: string): Promise<string> {
  const apiKey = `st_${crypto.randomBytes(32).toString('hex')}`;
  const hashedKey = hashApiKey(apiKey);
  
  await db.query(`
    UPDATE proxy_users
    SET api_key = $1
    WHERE id = $2
  `, [hashedKey, userId]);
  
  return apiKey; // 한 번만 반환, 이후 해시로만 저장
}
```

### 2. 레이트 리미팅

```typescript
// 사용자별 레이트 리미팅
const userRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: async (req) => {
    // 프리미엄 사용자는 더 높은 제한
    const user = await getUser(req.proxyUser.id);
    return user.isPremium ? 1000 : 100;
  },
  keyGenerator: (req) => req.proxyUser.id,
});
```

### 3. 요청 검증

```typescript
// 요청 본문 검증
function validateRequest(req, res, next) {
  // 크기 제한
  if (req.body && JSON.stringify(req.body).length > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'Request too large' });
  }
  
  // 위험한 경로 차단
  const blockedPaths = ['/api/admin', '/api/users/delete'];
  if (blockedPaths.some(path => req.path.includes(path))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  
  next();
}
```

### 4. HTTPS 필수

- 모든 통신은 HTTPS로 암호화
- SSL/TLS 인증서 필수
- HSTS 헤더 설정

## 📊 모니터링 및 로깅

### 요청 로깅

```typescript
// 모든 요청 로깅
app.use((req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userId: req.proxyUser?.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  };
  
  // 로그 저장 (데이터베이스 또는 파일)
  logger.info(logData);
  
  next();
});
```

### 성능 모니터링

- 응답 시간 추적
- 에러율 모니터링
- 레이트 리미팅 통계
- 데이터베이스 쿼리 성능

## 🚀 배포 전략

### Phase 1: 개발 환경 (현재)

```
앱 → 직접 SillyTavern 서버 연결
- 로컬 네트워크
- 쿠키 기반 세션
- 개발/테스트 목적
```

### Phase 2: 하이브리드 모드

```
앱 → 연결 모드 선택
├─ 직접 연결 (로컬 네트워크)
└─ Proxy 연결 (인터넷)
```

### Phase 3: Proxy 서버 배포

```
앱 → Proxy 서버 (필수)
- 인터넷을 통한 접근
- JWT 기반 인증
- 앱 스토어 배포 준비
```

## 📅 구현 일정

### 1단계: Proxy 서버 기본 구조 (2주)

- [ ] Express 서버 설정
- [ ] PostgreSQL 데이터베이스 스키마
- [ ] 기본 인증 (회원가입/로그인)
- [ ] JWT 토큰 발급/검증

### 2단계: SillyTavern 연동 (1주)

- [ ] 세션 매핑 로직
- [ ] 요청 프록시 미들웨어
- [ ] CSRF 토큰 처리
- [ ] 에러 핸들링

### 3단계: 보안 강화 (1주)

- [ ] 레이트 리미팅
- [ ] API 키 관리
- [ ] 요청 검증
- [ ] HTTPS 설정

### 4단계: 모니터링 및 최적화 (1주)

- [ ] 로깅 시스템
- [ ] 성능 모니터링
- [ ] 캐싱 (Redis)
- [ ] 로드밸런싱

### 5단계: 앱 연동 (1주)

- [ ] 앱 API 클라이언트 수정
- [ ] 인증 플로우 구현
- [ ] 연결 모드 선택 (직접/Proxy)
- [ ] 테스트

**총 기간**: 6주

## 🔄 데이터베이스 전환과의 연계

### Proxy 서버와 DB 전환의 관계

```
Proxy 서버 (사용자 인증)
    ↓
PostgreSQL (SillyTavern 데이터)
    ↓
SillyTavern 서버
```

**장점**:
- Proxy 서버는 사용자 인증만 담당
- SillyTavern 서버는 데이터 관리만 담당
- 역할 분리로 확장성 향상

### 통합 시나리오

1. **Proxy 서버**: 앱 사용자 인증 (JWT)
2. **PostgreSQL**: 
   - Proxy 사용자 정보
   - SillyTavern 사용자 데이터 (채팅, 캐릭터 등)
3. **세션 매핑**: Proxy 사용자 ↔ SillyTavern 사용자

## ⚠️ 주의사항

### 1. 세션 동기화

- Proxy 서버의 JWT와 SillyTavern 세션을 동기화해야 함
- 세션 만료 시 자동 갱신 필요

### 2. 에러 처리

- SillyTavern 서버 다운 시 적절한 에러 메시지
- 네트워크 오류 처리
- 타임아웃 설정

### 3. 성능

- Proxy 서버가 병목이 되지 않도록 최적화
- 캐싱 활용 (Redis)
- 연결 풀링

## 📝 체크리스트

### 개발 단계
- [ ] Proxy 서버 기본 구조 구현
- [ ] 인증 시스템 구현
- [ ] SillyTavern 연동
- [ ] 보안 강화
- [ ] 모니터링 설정

### 배포 단계
- [ ] HTTPS 인증서 설정
- [ ] 도메인 설정
- [ ] 로드밸런싱 구성
- [ ] 백업 시스템
- [ ] 재해 복구 계획

### 앱 연동
- [ ] 앱 API 클라이언트 수정
- [ ] 인증 플로우 테스트
- [ ] 성능 테스트
- [ ] 보안 테스트

## 🎯 성공 기준

1. ✅ 앱이 인터넷을 통해 서버에 접근 가능
2. ✅ 사용자별 독립적인 세션 관리
3. ✅ 레이트 리미팅으로 DDoS 방지
4. ✅ 응답 시간 < 500ms (95th percentile)
5. ✅ 가용성 99.9% 이상

---

**작성일**: 2024년
**상태**: 설계 단계
**우선순위**: 앱 스토어 배포 전 필수
