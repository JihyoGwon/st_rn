# 데이터베이스 마이그레이션 계획

## 📋 개요

SillyTavern 서버의 파일 시스템 기반 저장 방식을 데이터베이스 기반으로 전환하여 확장성, 보안, 성능을 개선합니다.

## 🎯 핵심 전략: PostgreSQL로 직접 전환

**파일 시스템에서 PostgreSQL로 직접 전환합니다.**

- ✅ 프로덕션 환경에 최적화 (확장성, 성능)
- ✅ 처음부터 확장 가능한 아키텍처 구축
- ✅ 멀티 서버, 클러스터링 등 고급 기능 지원
- ✅ 강력한 트랜잭션 및 ACID 보장
- ✅ 복잡한 쿼리 및 인덱싱 최적화

**전환 경로**: 파일 시스템 → **PostgreSQL**

## 🎯 목표

- 파일 시스템 의존성 제거 (249개 접근 지점)
- 데이터베이스 기반 저장으로 전환
- 암호화 및 보안 강화 기반 마련
- 확장 가능한 아키텍처 구축
- 앱 출시를 위한 규정 준수 준비

## 📊 현재 상태 분석

### 파일 시스템 의존성
- **직접 파일 접근**: 249개 매치, 27개 파일
- **사용자 디렉토리 참조**: 369개 매치, 38개 파일
- **주요 접근 패턴**:
  - `tryReadFileSync()` / `tryWriteFileSync()`
  - `writeFileAtomicSync()`
  - `fs.readFileSync()` / `fs.writeFileSync()`
  - `request.user.directories.*` 경로 사용

### 현재 저장 방식
```
/data/{userHandle}/
├── chats/{characterId}/{chatId}.jsonl    # 채팅 데이터
├── characters/{characterId}.png          # 캐릭터 이미지
├── settings.json                         # 사용자 설정
├── secrets.json                          # API 키 등
└── ...
```

### 문제점
1. 암호화 추가 시 모든 접근 지점 수정 필요
2. 동시성 제어 어려움 (파일 기반)
3. 검색/쿼리 기능 제한적
4. 확장성 제한 (대용량 데이터 처리 어려움)
5. 트랜잭션 불가능 (데이터 일관성 보장 어려움)

## 🗄️ 데이터베이스 선택

### 옵션 비교

| 데이터베이스 | 장점 | 단점 | 추천도 |
|------------|------|------|--------|
| **PostgreSQL** | - 강력한 기능<br>- 확장성 우수<br>- 트랜잭션/ACID 보장<br>- 복잡한 쿼리 가능<br>- 프로덕션 최적화 | - 설정 복잡<br>- 서버 필요 | ⭐⭐⭐⭐⭐ |
| **SQLite** | - 설정 간단<br>- 파일 기반<br>- 트랜잭션 지원 | - 동시 쓰기 제한<br>- 확장성 제한 | ⭐⭐⭐☆☆ |
| **MongoDB** | - JSON 친화적<br>- 유연한 스키마 | - 트랜잭션 제한<br>- SQL 없음 | ⭐⭐⭐☆☆ |

### 선택: PostgreSQL (프로덕션 최적화)

**바로 PostgreSQL로 전환하는 이유**:
1. **확장성**: 대규모 사용자 대비 가능 (수천 명 이상)
2. **프로덕션 환경**: 멀티 서버, 클러스터링, 리플리케이션 지원
3. **성능**: 고급 인덱싱, 쿼리 최적화, 연결 풀링
4. **기능**: JSONB, Full-text Search, 확장 기능 등
5. **한 번만 작업**: SQLite → PostgreSQL 전환 과정 생략

**주의사항**:
- 초기 설정이 SQLite보다 복잡함 (서버 설치 필요)
- 개발 환경에 PostgreSQL 설치 필요
- 하지만 장기적으로 더 나은 선택

## 🏗️ 아키텍처 설계

### 추상화 레이어 (Repository Pattern)

**핵심**: 인터페이스로 추상화하면 구현체를 쉽게 교체할 수 있습니다.

```typescript
// 추상 인터페이스 (변경 불필요)
interface ChatRepository {
  get(chatId: string, userId: string): Promise<ChatData>;
  save(chatId: string, userId: string, data: ChatData): Promise<void>;
  delete(chatId: string, userId: string): Promise<void>;
  list(userId: string, characterId?: string): Promise<ChatSummary[]>;
}

// 구현체 1: 파일 시스템 (기존, 전환 기간 동안 유지)
class FileSystemChatRepository implements ChatRepository {
  // 기존 파일 시스템 로직
}

// 구현체 2: PostgreSQL (새로운 구현)
class PostgreSQLChatRepository implements ChatRepository {
  private pool: Pool;
  
  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'sillytavern',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      max: 20, // 연결 풀 크기
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }
  
  async save(chatId: string, userId: string, data: ChatData) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      await client.query(`
        INSERT INTO chats (id, user_id, character_id, chat_name, data, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (id) DO UPDATE 
        SET data = $5, updated_at = NOW()
      `, [chatId, userId, data.characterId, data.chatName, JSON.stringify(data.messages)]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async get(chatId: string, userId: string): Promise<ChatData> {
    const result = await this.pool.query(`
      SELECT * FROM chats 
      WHERE id = $1 AND user_id = $2
    `, [chatId, userId]);
    
    if (result.rows.length === 0) {
      throw new Error('Chat not found');
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      characterId: row.character_id,
      chatName: row.chat_name,
      messages: JSON.parse(row.data),
      updatedAt: row.updated_at
    };
  }
}

// 팩토리 패턴으로 선택
function createChatRepository(): ChatRepository {
  const storageType = process.env.STORAGE_TYPE || 'postgresql';
  
  switch (storageType) {
    case 'postgresql':
      return new PostgreSQLChatRepository();
    case 'file':
    default:
      return new FileSystemChatRepository();
  }
}

// 사용하는 곳은 변경 불필요!
const repo = createChatRepository();
await repo.save(chatId, userId, data); // 동일한 인터페이스
```

**장점**:
- PostgreSQL로 바로 전환 가능
- 나중에 다른 DB로 전환 시 인터페이스는 그대로, 구현체만 교체
- 테스트 시 Mock Repository로 쉽게 교체 가능

### 데이터베이스 스키마 설계 (PostgreSQL)

**PostgreSQL 전용 스키마로 설계합니다.**

#### 사용자 (users)
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  password_hash VARCHAR(255) NOT NULL,
  salt VARCHAR(255) NOT NULL,
  enabled BOOLEAN DEFAULT true,
  admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_users_handle ON users(handle);
CREATE INDEX idx_users_enabled ON users(enabled);
```

#### 채팅 (chats)
```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id VARCHAR(255) NOT NULL,
  chat_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_user_character_chat UNIQUE(user_id, character_id, chat_name)
);

CREATE INDEX idx_chats_user_id ON chats(user_id);
CREATE INDEX idx_chats_user_character ON chats(user_id, character_id);
CREATE INDEX idx_chats_last_message ON chats(last_message_at DESC NULLS LAST);
CREATE INDEX idx_chats_updated_at ON chats(updated_at DESC);
```

#### 채팅 메시지 (chat_messages)
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  message_index INTEGER NOT NULL,
  name VARCHAR(255),
  is_user BOOLEAN NOT NULL,
  content TEXT NOT NULL,
  send_date TIMESTAMP WITH TIME ZONE NOT NULL,
  extra JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_chat_message_index UNIQUE(chat_id, message_index)
);

CREATE INDEX idx_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX idx_messages_chat_index ON chat_messages(chat_id, message_index);
CREATE INDEX idx_messages_send_date ON chat_messages(send_date);
```

#### 캐릭터 (characters)
```sql
CREATE TABLE characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_name VARCHAR(255) NOT NULL,
  character_data JSONB NOT NULL,
  avatar_path VARCHAR(500), -- 파일 시스템 경로 유지 (이미지는 파일로)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_user_character_name UNIQUE(user_id, character_name)
);

CREATE INDEX idx_characters_user_id ON characters(user_id);
CREATE INDEX idx_characters_character_name ON characters(character_name);
-- JSONB 인덱스 (GIN 인덱스)
CREATE INDEX idx_characters_data ON characters USING GIN (character_data);
```

#### 코칭 세션 (coaching_sessions)
```sql
CREATE TABLE coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  session_name VARCHAR(255) NOT NULL,
  domain VARCHAR(50) NOT NULL, -- mental-health, career, life
  style VARCHAR(50) NOT NULL,  -- directive, non-directive, collaborative
  status VARCHAR(50) DEFAULT 'active', -- active, paused, completed
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_coaching_user_id ON coaching_sessions(user_id);
CREATE INDEX idx_coaching_status ON coaching_sessions(status);
CREATE INDEX idx_coaching_domain ON coaching_sessions(domain);
CREATE INDEX idx_coaching_created_at ON coaching_sessions(created_at DESC);
```

## 📝 단계별 마이그레이션 계획

### 1단계: 인프라 구축 (1-2주)

#### 1.1 PostgreSQL 설치 및 설정
- [ ] PostgreSQL 서버 설치 (로컬 개발 환경)
  ```bash
  # macOS
  brew install postgresql@15
  brew services start postgresql@15
  
  # Ubuntu/Debian
  sudo apt-get install postgresql postgresql-contrib
  
  # Windows
  # https://www.postgresql.org/download/windows/ 에서 설치
  ```
- [ ] 데이터베이스 생성
  ```sql
  CREATE DATABASE sillytavern;
  CREATE USER sillytavern_user WITH PASSWORD 'your_password';
  GRANT ALL PRIVILEGES ON DATABASE sillytavern TO sillytavern_user;
  ```
- [ ] 연결 풀 설정 (`pg` 패키지 사용)
- [ ] 마이그레이션 도구 설정 (Knex.js 또는 Prisma)
  ```bash
  npm install pg knex
  npm install -D @types/pg
  ```

#### 1.2 추상화 레이어 구축
- [x] Repository 인터페이스 정의
- [x] 파일 시스템 구현체 (기존 코드 래핑)
- [x] 데이터베이스 구현체 (새 코드)
- [x] Factory 패턴으로 구현체 선택

#### 1.3 설정 관리
- [ ] 데이터베이스 연결 설정 추가
- [ ] 마이그레이션 모드 설정 (file/database/hybrid)
- [ ] 환경 변수 관리

**작업 파일**:
- `src/repositories/interfaces/` - 인터페이스 정의
- `src/repositories/file-system/` - 파일 시스템 구현
- `src/repositories/database/` - 데이터베이스 구현
- `src/db/` - 데이터베이스 연결 및 스키마

### 2단계: 핵심 데이터 마이그레이션 (2-3주)

#### 2.1 채팅 데이터 (최우선)
- [ ] `ChatRepository` 구현
- [ ] 채팅 저장/로드 API 수정
- [ ] 기존 채팅 데이터 마이그레이션 스크립트
- [ ] 양방향 동기화 (전환 기간)

**마이그레이션 스크립트 예시**:
```typescript
async function migrateChats(userId: string) {
  const chatFiles = fs.readdirSync(userDirectories.chats);
  
  for (const characterDir of chatFiles) {
    const chats = fs.readdirSync(
      path.join(userDirectories.chats, characterDir)
    );
    
    for (const chatFile of chats) {
      const chatData = getChatData(chatFilePath);
      await chatRepository.save(userId, characterDir, chatFile, chatData);
    }
  }
}
```

#### 2.2 사용자 정보
- [x] `UserRepository` 구현
- [x] 사용자 인증 로직 수정
- [x] 기존 사용자 데이터 마이그레이션

#### 2.3 코칭 세션 데이터
- [ ] `CoachingRepository` 구현
- [ ] 코칭 API 수정
- [ ] 기존 코칭 데이터 마이그레이션 (있는 경우)

**수정 대상 파일**:
- `src/endpoints/chats.js` - 채팅 저장/로드
- `src/endpoints/users-*.js` - 사용자 관리
- `src/endpoints/coaching.js` - 코칭 세션 (새로 추가)

### 3단계: 보조 데이터 마이그레이션 (1-2주)

#### 3.1 캐릭터 메타데이터
- [x] 캐릭터 정보 DB 저장 (이미지는 파일 시스템 유지)
- [x] 캐릭터 검색 기능 개선
- [x] `is_shared` 플래그로 공유 캐릭터 지원

#### 3.2 설정 및 메타데이터
- [x] 전역 설정 디렉토리 구조 (`_global`)
- [x] 전역 설정 파일 마이그레이션 스크립트
- [x] API 키 등 전역 디렉토리에서 읽기/쓰기
- [ ] 사용자 설정 DB 저장 (파일 시스템 유지)
- [ ] API 키 등 민감 정보 암호화 저장

**하이브리드 접근**:
- **DB에 저장**: 메타데이터, 설정, 구조화된 데이터
- **파일 시스템 유지**: 이미지, 대용량 바이너리, 벡터 인덱스

### 4단계: 최적화 및 정리 (1주)

#### 4.1 성능 최적화
- [ ] 인덱스 최적화
- [ ] 쿼리 최적화
- [ ] 연결 풀 튜닝

#### 4.2 코드 정리
- [ ] 사용하지 않는 파일 시스템 코드 제거
- [ ] 테스트 코드 작성
- [ ] 문서화

#### 4.3 모니터링
- [ ] 데이터베이스 성능 모니터링
- [ ] 에러 로깅 개선
- [ ] 마이그레이션 상태 추적

## 🔄 마이그레이션 전략

### PostgreSQL 직접 전환 전략

**핵심 아이디어**: 파일 시스템에서 PostgreSQL로 직접 전환합니다.

#### 왜 바로 PostgreSQL인가?

1. **프로덕션 환경 최적화**
   - 대규모 사용자 대비 가능 (수천 명 이상)
   - 멀티 서버, 클러스터링, 리플리케이션 지원
   - 고급 인덱싱 및 쿼리 최적화

2. **강력한 기능**
   - JSONB 타입으로 유연한 JSON 저장 및 쿼리
   - Full-text Search 내장
   - 확장 기능 (PostGIS, pg_trgm 등)
   - 트리거, 함수, 뷰 등 고급 기능

3. **한 번만 작업**
   - SQLite → PostgreSQL 전환 과정 생략
   - 처음부터 확장 가능한 아키텍처 구축
   - 장기적으로 더 효율적

4. **Repository Pattern으로 추상화**
   ```typescript
   // 인터페이스는 동일
   interface ChatRepository {
     save(chatId: string, data: ChatData): Promise<void>;
     get(chatId: string): Promise<ChatData>;
   }
   
   // PostgreSQL 구현
   class PostgreSQLChatRepository implements ChatRepository { ... }
   
   // 나중에 다른 DB로 전환 시에도 인터페이스는 그대로
   // 사용하는 곳은 변경 불필요
   const repo: ChatRepository = new PostgreSQLChatRepository();
   ```

5. **트랜잭션 및 ACID 보장**
   - 파일 시스템: read-modify-write race condition 위험
   - PostgreSQL: 강력한 트랜잭션 및 격리 수준 보장

#### 전환 경로

```
현재 (파일 시스템)
  ↓
PostgreSQL (직접 전환)
```

**전환 방법**:
1. Repository Pattern으로 추상화 레이어 구축
2. PostgreSQL 스키마 생성 및 마이그레이션
3. 기존 데이터를 PostgreSQL로 마이그레이션
4. 하이브리드 모드로 점진적 전환

### 하이브리드 모드 (권장)

전환 기간 동안 두 시스템을 병행 운영:

```typescript
class HybridChatRepository implements ChatRepository {
  async save(chatId: string, data: ChatData) {
    // 1. 데이터베이스에 저장
    await this.dbRepo.save(chatId, data);
    
    // 2. 파일 시스템에도 저장 (백업/호환성)
    if (MIGRATION_MODE === 'hybrid') {
      await this.fileRepo.save(chatId, data);
    }
  }
  
  async get(chatId: string) {
    // 1. DB에서 먼저 시도
    try {
      return await this.dbRepo.get(chatId);
    } catch {
      // 2. 없으면 파일 시스템에서 읽기 (레거시 데이터)
      const data = await this.fileRepo.get(chatId);
      // 3. DB로 마이그레이션
      await this.dbRepo.save(chatId, data);
      return data;
    }
  }
}
```

### 점진적 전환

1. **새 데이터**: DB에만 저장
2. **기존 데이터**: 읽을 때만 파일 시스템 사용
3. **마이그레이션**: 백그라운드에서 점진적 이전
4. **완전 전환**: 모든 데이터 마이그레이션 완료 후 파일 시스템 코드 제거

## 🔐 보안 강화

### 암호화 계획

#### 저장 시 암호화 (At-rest)
```typescript
// 민감한 데이터 암호화 저장
async saveChat(chatId: string, data: ChatData) {
  const encrypted = encrypt(
    JSON.stringify(data),
    userEncryptionKey
  );
  
  await db.chats.update({
    content: encrypted,
    encryption_version: '1.0'
  });
}
```

#### 전송 시 암호화 (In-transit)
- HTTPS 필수 (이미 구현 필요)
- API 응답 암호화 (선택적)

### 키 관리
- 사용자별 암호화 키 생성
- 키는 별도 보안 저장소에 저장
- 키 로테이션 메커니즘

## 📊 마이그레이션 스크립트

### 전체 마이그레이션 프로세스

```typescript
// scripts/migrate-to-database.js

async function migrateAllUsers() {
  const users = await getAllUserHandles();
  
  for (const userHandle of users) {
    console.log(`Migrating user: ${userHandle}`);
    
    // 1. 사용자 정보 마이그레이션
    await migrateUser(userHandle);
    
    // 2. 채팅 데이터 마이그레이션
    await migrateChats(userHandle);
    
    // 3. 캐릭터 데이터 마이그레이션
    await migrateCharacters(userHandle);
    
    // 4. 설정 마이그레이션
    await migrateSettings(userHandle);
    
    console.log(`Completed: ${userHandle}`);
  }
}

async function migrateChats(userHandle: string) {
  const userDirs = getUserDirectories(userHandle);
  const chatDirs = fs.readdirSync(userDirs.chats);
  
  for (const characterDir of chatDirs) {
    const chatFiles = fs.readdirSync(
      path.join(userDirs.chats, characterDir)
    );
    
    for (const chatFile of chatFiles) {
      if (!chatFile.endsWith('.jsonl')) continue;
      
      const chatPath = path.join(userDirs.chats, characterDir, chatFile);
      const chatData = getChatData(chatPath);
      
      // DB에 저장
      await chatRepository.save({
        userId: userHandle,
        characterId: characterDir,
        chatName: chatFile.replace('.jsonl', ''),
        messages: chatData
      });
      
      console.log(`  Migrated: ${characterDir}/${chatFile}`);
    }
  }
}
```

## ⚠️ 리스크 및 대응 방안

### 주요 리스크

| 리스크 | 영향도 | 대응 방안 |
|--------|--------|----------|
| **데이터 손실** | 높음 | - 백업 필수<br>- 마이그레이션 전 검증<br>- 롤백 계획 수립 |
| **성능 저하** | 중간 | - 인덱스 최적화<br>- 연결 풀 튜닝<br>- 점진적 마이그레이션 |
| **호환성 문제** | 중간 | - 하이브리드 모드<br>- 양방향 동기화<br>- 충분한 테스트 |
| **마이그레이션 실패** | 높음 | - 단계별 마이그레이션<br>- 각 단계별 검증<br>- 수동 복구 절차 |

### 안전장치

1. **백업 필수**
   ```bash
   # 마이그레이션 전 전체 백업
   tar -czf backup-$(date +%Y%m%d).tar.gz /data
   ```

2. **검증 스크립트**
   ```typescript
   async function verifyMigration(userHandle: string) {
     // 파일 시스템 데이터
     const fileData = await fileRepo.list(userHandle);
     
     // 데이터베이스 데이터
     const dbData = await dbRepo.list(userHandle);
     
     // 비교 검증
     assert(fileData.length === dbData.length);
     // ... 상세 검증
   }
   ```

3. **롤백 계획**
   - 설정으로 파일 시스템 모드로 즉시 전환 가능
   - 데이터베이스 데이터를 파일로 내보내기 기능

## 📅 일정 및 작업량

### PostgreSQL 직접 전환 일정

**예상 일정 (풀타임 기준)**:

| 단계 | 기간 | 작업량 | 주요 작업 |
|------|------|--------|----------|
| 1단계: 인프라 구축 | 1-2주 | 50-90시간 | PostgreSQL 설치, 스키마 설계, Repository 인터페이스 |
| 2단계: 핵심 데이터 마이그레이션 | 2-3주 | 80-120시간 | 채팅, 사용자, 코칭 데이터 전환 |
| 3단계: 보조 데이터 마이그레이션 | 1-2주 | 40-80시간 | 캐릭터 메타데이터, 설정 |
| 4단계: 최적화 및 정리 | 1-2주 | 50-80시간 | 인덱스 최적화, 쿼리 튜닝, 모니터링 |
| **총계** | **5-9주** | **220-370시간** | |

**참고**: SQLite 대비 초기 설정이 복잡하지만, 한 번만 작업하면 됩니다.

### 우선순위

1. **높음**: 채팅 데이터 (사용자 핵심 기능)
2. **중간**: 사용자 정보, 코칭 세션
3. **낮음**: 캐릭터 메타데이터, 설정

## 🧪 테스트 계획

### 단위 테스트
- Repository 인터페이스 테스트
- 각 구현체별 테스트
- 마이그레이션 스크립트 테스트

### 통합 테스트
- API 엔드포인트 테스트
- 데이터 일관성 테스트
- 성능 테스트

### 수동 테스트
- 실제 사용자 데이터로 마이그레이션 테스트
- 롤백 절차 테스트
- 에러 시나리오 테스트

## 📚 참고 자료

### 기술 스택
- **데이터베이스**: PostgreSQL 15+
- **클라이언트**: `pg` (node-postgres)
- **ORM/쿼리 빌더**: Knex.js 또는 Prisma
- **마이그레이션**: Knex Migrations 또는 Prisma Migrate
- **타입 안정성**: TypeScript
- **연결 풀**: `pg` 내장 Pool 또는 `pg-pool`

### 관련 문서
- [COACHING_IMPLEMENTATION_SCOPE.md](./COACHING_IMPLEMENTATION_SCOPE.md) - 코칭 시스템 구현 범위
- [REACT_NATIVE_MIGRATION_PLAN.md](./REACT_NATIVE_MIGRATION_PLAN.md) - 모바일 앱 마이그레이션
- [SAFETY_GUARDRAILS_IMPLEMENTATION_PLAN.md](./SAFETY_GUARDRAILS_IMPLEMENTATION_PLAN.md) - 보안 가드레일

## ✅ 체크리스트

### 준비 단계
- [ ] PostgreSQL 서버 설치 및 설정
- [ ] 개발 환경 설정 (로컬 PostgreSQL)
- [ ] 데이터베이스 및 사용자 생성
- [ ] 백업 시스템 구축
- [ ] 테스트 데이터 준비
- [ ] 환경 변수 설정 (DB 연결 정보)

### 구현 단계
- [x] 추상화 레이어 구축
- [x] 데이터베이스 스키마 생성 (users, characters)
- [x] 핵심 Repository 구현 (User, Character)
- [x] 전역 설정 마이그레이션 스크립트 작성
- [x] API 엔드포인트 수정 (characters, settings, secrets, thumbnails, chats)
- [ ] Chat Repository 구현
- [ ] Chat 마이그레이션 스크립트 작성

### 검증 단계
- [ ] 단위 테스트 작성
- [ ] 통합 테스트 수행
- [ ] 성능 테스트
- [ ] 데이터 무결성 검증

### 배포 단계
- [ ] 스테이징 환경 테스트
- [ ] 프로덕션 백업
- [ ] 점진적 마이그레이션
- [ ] 모니터링 설정

## 🎯 성공 기준

1. ✅ 모든 채팅 데이터가 데이터베이스에 저장됨
2. ✅ 파일 시스템 의존성 90% 이상 제거
3. ✅ API 응답 시간 20% 이하 증가
4. ✅ 데이터 무결성 100% 유지
5. ✅ 마이그레이션 롤백 가능
6. ✅ 암호화 기반 마련 완료

## 📝 다음 단계

1. 데이터베이스 선택 확정
2. 개발 환경 설정
3. 추상화 레이어 프로토타입 구현
4. 작은 데이터셋으로 마이그레이션 테스트
5. 피드백 반영 후 본격 구현

---

## ✅ 진행 상황 (2024년)

### 완료된 작업

#### 1. 전역 디렉토리 구조 및 마이그레이션
- ✅ 전역 디렉토리(`_global`) 구조 생성
- ✅ `getUserDirectories()` 함수 수정 - 전역 디렉토리 매핑 로직 구현
- ✅ 전역 설정 마이그레이션 스크립트 작성 (`apps/server/scripts/migrate-to-global-settings.js`)
- ✅ `getGlobalSettingsPath()`, `getGlobalDirectories()` 함수 추가
- ✅ 전역 디렉토리로 공유되는 리소스:
  - `settings.json` (전역 설정)
  - `secrets.json` (API 키 등)
  - `worlds`, `backgrounds`, `themes` 등 (전역 리소스)

#### 2. Repository 패턴 구현
- ✅ `UserRepository` 구현 (FileSystem, PostgreSQL, Hybrid)
- ✅ `CharacterRepository` 구현 (FileSystem, PostgreSQL, Hybrid)
- ✅ Repository Factory 패턴 구현 (`apps/server/src/repositories/factory.js`)
- ✅ 하이브리드 모드 지원 (파일 시스템 + PostgreSQL 병행)

#### 3. PostgreSQL 스키마 및 마이그레이션
- ✅ `users` 테이블 생성 및 마이그레이션
- ✅ `characters` 테이블 생성 및 마이그레이션
- ✅ `is_shared` 컬럼 추가 (캐릭터 공유 기능)
- ✅ 인덱스 최적화 (사용자 ID, 공유 캐릭터 등)

#### 4. 캐릭터 관리 구조 개선
- ✅ 캐릭터는 사용자별 디렉토리에 저장 (`data/{userHandle}/characters/`)
- ✅ `is_shared` 플래그로 캐릭터 공유 제어 (DB 기반)
- ✅ 공용 캐릭터 접근 로직 구현 (Repository 패턴 사용)
- ✅ 썸네일도 사용자별 디렉토리에 저장 (일관성 유지)

#### 5. API 엔드포인트 수정
- ✅ `chats.js`: Repository 패턴 사용, 전역 설정 경로 적용
- ✅ `characters.js`: Repository 패턴 사용, 하이브리드 모드 지원
- ✅ `thumbnails.js`: 사용자별 디렉토리 확인 로직 구현
- ✅ `secrets.js`: 전역 디렉토리에서 API 키 읽기/쓰기
- ✅ `settings.js`: 전역 설정 파일 사용

#### 6. 전역 디렉토리 매핑 정리
- ✅ `GLOBAL_DIRECTORY_KEYS`에서 `characters` 제거 (사용자별 저장)
- ✅ `GLOBAL_DIRECTORY_KEYS`에서 `thumbnails` 관련 항목 제거 (사용자별 저장)
- ✅ 전역 디렉토리는 설정 및 공유 리소스만 포함

### 현재 구조

```
data/
├── _global/                    # 전역 공유 디렉토리
│   ├── settings.json          # 전역 설정
│   ├── secrets.json           # API 키 등
│   ├── worlds/                # 전역 공유
│   ├── backgrounds/           # 전역 공유
│   └── themes/                # 전역 공유
│
└── {userHandle}/              # 사용자별 디렉토리
    ├── characters/            # 사용자별 캐릭터 (is_shared로 공유 제어)
    ├── thumbnails/            # 사용자별 썸네일
    ├── chats/                 # 사용자별 채팅
    └── ...
```

### 핵심 설계 결정

1. **캐릭터 저장 방식**
   - 사용자별 디렉토리에 저장 (`data/{userHandle}/characters/`)
   - DB의 `is_shared` 플래그로 공유 제어
   - 전역 디렉토리 사용 안 함

2. **썸네일 저장 방식**
   - 사용자별 디렉토리에 저장 (`data/{userHandle}/thumbnails/`)
   - 원본 파일과 동일한 사용자 디렉토리에 저장 (일관성)

3. **전역 디렉토리 용도**
   - 설정 파일 (`settings.json`, `secrets.json`)
   - 공유 리소스 (`worlds`, `backgrounds`, `themes` 등)
   - 캐릭터 및 썸네일은 제외

### 진행 중인 작업

- [ ] Chat 마이그레이션 (Repository 패턴 구현 필요)
- [ ] 기존 파일 시스템 데이터의 DB 마이그레이션 스크립트
- [ ] 성능 최적화 및 모니터링

### 알려진 이슈

1. **하위 호환성**
   - 기존 사용자별 디렉토리에 있는 파일들은 계속 읽을 수 있음
   - 점진적 마이그레이션 가능

2. **캐릭터 이미지 경로**
   - `thumbnails.js`에서 사용자별 디렉토리와 소유자 디렉토리 모두 확인
   - 공용 캐릭터의 경우 소유자 디렉토리에서 파일 읽기

---

**작성일**: 2024년
**최종 수정**: 2024년
**상태**: 진행 중 (1단계 완료, 2단계 진행 중)
