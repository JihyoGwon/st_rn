# PostgreSQL 설정 완료 가이드

## ✅ 설치 확인 완료

- PostgreSQL 18.1 설치됨
- 서비스 실행 중 (`postgresql-x64-18`)

## 📝 다음 단계

### 1. 데이터베이스 생성

**방법 1: pgAdmin 사용 (GUI)**
1. 시작 메뉴에서 "pgAdmin 4" 실행
2. 왼쪽에서 "Servers" → "PostgreSQL 18" 확장
3. "Databases" 우클릭 → "Create" → "Database..."
4. Database name: `sillytavern`
5. "Save" 클릭

**방법 2: 명령줄 사용**
```powershell
# PostgreSQL bin 디렉토리로 이동
cd "C:\Program Files\PostgreSQL\18\bin"

# PostgreSQL 접속 (비밀번호 입력 필요)
.\psql.exe -U postgres

# 데이터베이스 생성
CREATE DATABASE sillytavern;

# 종료
\q
```

### 2. Node.js 패키지 설치

```powershell
cd apps/server
npm install pg
```

### 3. 환경 변수 설정

`apps/server/config.yaml` 파일에 추가:

```yaml
storage:
  type: postgresql  # 'file' 또는 'postgresql'

# 또는 환경 변수로 설정:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=sillytavern
# DB_USER=postgres
# DB_PASSWORD=설치시_설정한_비밀번호
```

### 4. 마이그레이션 실행

```powershell
cd apps/server
node src/db/migrate.js
```

### 5. 테스트

서버 시작 후:
```powershell
npm start
```

브라우저에서:
```
http://localhost:8001/api/characters-repo-test/all
```

## 🔑 비밀번호 확인

PostgreSQL 설치 시 설정한 비밀번호가 필요해. 기억이 안 나면:
- pgAdmin에서 비밀번호 재설정 가능
- 또는 PostgreSQL 서비스 재설정

## ✅ 체크리스트

- [x] PostgreSQL 설치 완료
- [ ] 데이터베이스 생성 (`sillytavern`)
- [ ] `pg` 패키지 설치 (`npm install pg`)
- [ ] 환경 변수 설정
- [ ] 마이그레이션 실행
- [ ] 테스트 완료
