# 파일 시스템 vs 데이터베이스 (SQLite) 비교

## 🤔 질문: SQLite가 파일 기반이면 데이터베이스 전환이 아닌 거 아니야?

**답변**: SQLite는 파일 기반이지만 **엄연한 데이터베이스**입니다. 파일 시스템과는 완전히 다른 개념이에요.

---

## 📊 현재 상태: 파일 시스템

### 현재 코드 (파일 시스템)

```javascript
// apps/server/src/endpoints/chats.js

// 채팅 저장
router.post('/save', async function (request, response) {
  const chatFilePath = path.join(
    request.user.directories.chats, 
    cardName, 
    sanitize(chatFileName)
  );
  
  // 1. 기존 파일 읽기
  const existingData = tryReadFileSync(chatFilePath) ?? '';
  const existingChat = parseJSONL(existingData);
  
  // 2. 새 데이터와 병합
  const mergedChatData = [...existingChat, ...chatData];
  
  // 3. 파일에 쓰기
  await trySaveChat(mergedChatData, chatFilePath, ...);
  
  return response.send({ ok: true });
});

// 채팅 조회
export function getChatData(chatFilePath) {
  const chatJSON = tryReadFileSync(chatFilePath) ?? '';
  // JSONL 파싱...
  return chatData;
}
```

### 파일 시스템의 특징

❌ **트랜잭션 없음**
- `read-modify-write` 패턴에서 race condition 위험
- 동시 접근 시 데이터 손실 가능

❌ **쿼리 불가능**
- 특정 조건으로 검색하려면 모든 파일을 읽어야 함
- "최근 10개 채팅" 같은 쿼리 불가능

❌ **관계형 모델 없음**
- 파일 간 관계를 코드로 관리해야 함
- 외래키, 조인 등 불가능

❌ **인덱싱 없음**
- 검색이 느림 (전체 파일 스캔)

---

## 🗄️ SQLite: 파일 기반이지만 데이터베이스

### SQLite 코드 예시

```typescript
// SQLite 사용 (데이터베이스)

import Database from 'better-sqlite3';

class SQLiteChatRepository {
  private db: Database;
  
  constructor(userId: string) {
    // 파일 기반이지만 데이터베이스!
    const dbPath = `/data/${userId}/database.db`;
    this.db = new Database(dbPath);
    this.initSchema();
  }
  
  // 채팅 저장 (트랜잭션으로 안전)
  async save(chatId: string, userId: string, data: ChatData) {
    const transaction = this.db.transaction(() => {
      // 트랜잭션으로 원자성 보장!
      this.db.prepare(`
        INSERT OR REPLACE INTO chats (id, user_id, character_id, data, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(chatId, userId, data.characterId, JSON.stringify(data.messages));
    });
    transaction(); // 원자성 보장!
  }
  
  // 채팅 조회 (SQL 쿼리)
  async get(chatId: string): Promise<ChatData> {
    const row = this.db.prepare(`
      SELECT * FROM chats WHERE id = ?
    `).get(chatId);
    
    return {
      id: row.id,
      messages: JSON.parse(row.data),
      updatedAt: row.updated_at
    };
  }
  
  // 복잡한 쿼리 가능!
  async getRecentChats(userId: string, limit: number = 10) {
    return this.db.prepare(`
      SELECT * FROM chats 
      WHERE user_id = ? 
      ORDER BY updated_at DESC 
      LIMIT ?
    `).all(userId, limit);
  }
  
  // 관계형 조인 가능!
  async getChatsWithCharacterInfo(userId: string) {
    return this.db.prepare(`
      SELECT 
        c.id,
        c.chat_name,
        c.updated_at,
        char.character_name,
        char.avatar_path
      FROM chats c
      JOIN characters char ON c.character_id = char.id
      WHERE c.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(userId);
  }
  
  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        chat_name TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_chats_user ON chats(user_id);
      CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);
    `);
  }
}
```

### SQLite의 특징

✅ **트랜잭션 지원**
- ACID 속성 보장 (원자성, 일관성, 격리, 지속성)
- `read-modify-write` race condition 해결

✅ **SQL 쿼리 가능**
- SELECT, WHERE, ORDER BY, JOIN 등 모든 SQL 기능
- 복잡한 쿼리 가능

✅ **관계형 모델**
- 외래키, 조인, 제약조건 지원
- 데이터 무결성 보장

✅ **인덱싱**
- 빠른 검색 (인덱스 활용)
- 쿼리 최적화

✅ **파일 기반**
- 서버 설치 불필요
- 단일 파일로 관리

---

## 🔍 핵심 차이점

### 1. 데이터 접근 방식

**파일 시스템**:
```javascript
// 파일 직접 읽기/쓰기
const data = fs.readFileSync('/path/to/file.json');
const json = JSON.parse(data);
json.messages.push(newMessage);
fs.writeFileSync('/path/to/file.json', JSON.stringify(json));
```

**SQLite (데이터베이스)**:
```typescript
// SQL 쿼리로 접근
const result = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
db.prepare('INSERT INTO chats ...').run(...);
```

### 2. 동시성 제어

**파일 시스템**:
```javascript
// ❌ Race condition 위험
// 사용자 A가 읽는 동안 사용자 B가 쓰면 데이터 손실 가능
const data = readFile(); // A가 읽음
// ... B가 동시에 읽고 쓰면?
data.push(newMessage);
writeFile(data); // A가 쓰면 B의 변경사항 덮어씀
```

**SQLite (데이터베이스)**:
```typescript
// ✅ 트랜잭션으로 안전
const transaction = db.transaction(() => {
  const data = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
  db.prepare('UPDATE chats SET data = ? WHERE id = ?').run(newData, chatId);
});
transaction(); // 원자성 보장!
```

### 3. 검색 기능

**파일 시스템**:
```javascript
// ❌ 모든 파일을 읽어야 함
const files = fs.readdirSync('/chats');
const results = [];
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file));
  if (data.user_id === userId) { // 모든 파일 검사
    results.push(data);
  }
}
```

**SQLite (데이터베이스)**:
```typescript
// ✅ 인덱스를 활용한 빠른 검색
const results = db.prepare(`
  SELECT * FROM chats 
  WHERE user_id = ? 
  ORDER BY updated_at DESC 
  LIMIT 10
`).all(userId); // 인덱스 활용으로 빠름!
```

### 4. 관계형 데이터

**파일 시스템**:
```javascript
// ❌ 관계를 코드로 관리
const chat = getChat(chatId);
const character = getCharacter(chat.characterId); // 별도 파일 읽기
const user = getUser(chat.userId); // 또 별도 파일 읽기
```

**SQLite (데이터베이스)**:
```typescript
// ✅ JOIN으로 한 번에 조회
const result = db.prepare(`
  SELECT 
    c.*,
    char.character_name,
    u.handle
  FROM chats c
  JOIN characters char ON c.character_id = char.id
  JOIN users u ON c.user_id = u.id
  WHERE c.id = ?
`).get(chatId); // 한 번의 쿼리로 모든 데이터!
```

---

## 📈 성능 비교

### 시나리오: 사용자 100명, 채팅 10,000개

**파일 시스템**:
- "최근 10개 채팅" 조회: 모든 파일 읽기 필요 (느림)
- 동시 저장: Race condition 위험 (데이터 손실 가능)
- 검색: 전체 파일 스캔 (매우 느림)

**SQLite (데이터베이스)**:
- "최근 10개 채팅" 조회: 인덱스 활용 (빠름)
- 동시 저장: 트랜잭션으로 안전 (데이터 손실 없음)
- 검색: 인덱스 활용 (빠름)

---

## 🎯 결론

### SQLite는 파일 기반이지만 **데이터베이스**입니다

**파일 시스템**:
- JSON 파일 직접 읽기/쓰기
- 트랜잭션 없음
- 쿼리 불가능
- 관계형 모델 없음

**SQLite (데이터베이스)**:
- SQL 쿼리로 접근
- 트랜잭션 지원 (ACID)
- 복잡한 쿼리 가능
- 관계형 모델 지원
- 인덱싱 및 최적화

### 왜 "파일 기반"이라고 하나?

SQLite가 **파일 기반**이라고 하는 이유:
- 서버 프로세스가 필요 없음 (PostgreSQL처럼)
- 단일 파일 (`.db`)로 모든 데이터 저장
- 설정이 간단함

하지만 이것은 **구현 방식**일 뿐, **데이터베이스의 기능**은 모두 제공합니다!

### 전환의 의미

**파일 시스템 → SQLite**:
- ✅ 트랜잭션 지원 (race condition 해결)
- ✅ SQL 쿼리 가능 (검색, 필터링)
- ✅ 관계형 모델 (JOIN, 외래키)
- ✅ 인덱싱 (성능 향상)
- ✅ 데이터 무결성 보장

이것이 바로 **데이터베이스 전환**입니다!

---

## 📝 요약

| 항목 | 파일 시스템 | SQLite (DB) |
|------|------------|-------------|
| 저장 방식 | JSON 파일 | SQLite DB 파일 |
| 트랜잭션 | ❌ 없음 | ✅ 있음 (ACID) |
| 쿼리 | ❌ 불가능 | ✅ SQL 가능 |
| 관계형 모델 | ❌ 없음 | ✅ 있음 (JOIN) |
| 인덱싱 | ❌ 없음 | ✅ 있음 |
| 동시성 제어 | ❌ 위험 | ✅ 안전 |
| 검색 성능 | ❌ 느림 | ✅ 빠름 |

**결론**: SQLite는 파일 기반이지만 **완전한 데이터베이스**입니다. 파일 시스템과는 완전히 다른 개념이에요!
