# 기능 제거 계획 (Feature Removal Plan)

## 📋 개요

SillyTavern의 복잡도를 줄이기 위해 점진적으로 불필요한 기능을 제거하는 계획입니다.

## 🎯 목표

- 모바일 앱에 필요한 핵심 기능만 유지
- 복잡도 감소 (251개 → 목표: 50-80개 라우트)
- 유지보수성 향상
- 의존성 최소화

## 📊 현재 상태 분석

### 모바일 앱이 사용하는 엔드포인트

#### 필수 엔드포인트 (제거 불가)
```
✅ /csrf-token                          # CSRF 토큰
✅ /api/settings/get                    # 설정 조회
✅ /api/chats/get                        # 채팅 조회
✅ /api/chats/save                       # 채팅 저장
✅ /api/chats/reset                      # 채팅 리셋
✅ /api/chats/delete                     # 채팅 삭제
✅ /api/chats/prepare-messages          # 메시지 준비
✅ /api/characters/all                  # 캐릭터 목록
✅ /api/characters/get                  # 캐릭터 조회
✅ /api/characters/chats                # 캐릭터별 채팅 목록
✅ /api/backends/chat-completions/generate  # AI 응답 생성
```

#### 사용자 인증 (필요 시)
```
✅ /api/users/login                     # 로그인
✅ /api/users/register                  # 회원가입
✅ /api/users/logout                    # 로그아웃
```

### 전체 엔드포인트 목록 (44개 파일)

#### 핵심 기능 (유지)
- `chats.js` - 채팅 관리 ✅
- `characters.js` - 캐릭터 관리 ✅
- `backends/chat-completions.js` - AI 응답 생성 ✅
- `settings.js` - 설정 관리 ✅
- `users-public.js` - 사용자 인증 ✅
- `secrets.js` - API 키 관리 ✅

#### 제거 가능 (웹 전용)
- `stable-diffusion.js` - 이미지 생성 (웹 전용)
- `novelai.js` - NovelAI 통합 (웹 전용)
- `images.js` - 이미지 처리 (웹 전용)
- `speech.js` - 음성 처리 (웹 전용)
- `translate.js` - 번역 (웹 전용)
- `themes.js` - 테마 관리 (웹 전용)
- `moving-ui.js` - UI 애니메이션 (웹 전용)
- `quick-replies.js` - 빠른 답변 (웹 전용)
- `sprites.js` - 스프라이트 (웹 전용)
- `backgrounds.js` - 배경 이미지 (웹 전용)
- `thumbnails.js` - 썸네일 생성 (선택적)
- `stats.js` - 통계 (웹 전용)
- `data-maid.js` - 데이터 정리 (웹 전용)
- `backups.js` - 백업 (선택적, 나중에 필요할 수 있음)

#### 제거 가능 (고급 기능)
- `worldinfo.js` - World Info (복잡하지만 유용할 수 있음)
- `vectors.js` - 벡터 검색 (고급 기능)
- `classify.js` - 분류 (고급 기능)
- `caption.js` - 캡션 생성 (고급 기능)
- `extensions.js` - 확장 기능 (복잡함)
- `groups.js` - 그룹 채팅 (고급 기능)

#### 제거 가능 (외부 서비스 통합)
- `openai.js` - OpenAI 직접 통합 (OpenRouter로 대체 가능)
- `anthropic.js` - Claude 직접 통합 (OpenRouter로 대체 가능)
- `google.js` - Google 직접 통합 (OpenRouter로 대체 가능)
- `azure.js` - Azure 통합 (OpenRouter로 대체 가능)
- `horde.js` - AI Horde 통합 (선택적)
- `minimax.js` - Minimax 통합 (선택적)
- `openrouter.js` - OpenRouter (유지, 통합 포인트)

#### 제거 가능 (백엔드)
- `backends/kobold.js` - Kobold 통합 (로컬 모델)
- `backends/text-completions.js` - 텍스트 완성 (OpenRouter로 대체)

#### 제거 가능 (컨텐츠 관리)
- `content-manager.js` - 컨텐츠 다운로드 (Pygmalion, Chub 등)
- `assets.js` - 에셋 관리 (웹 전용)
- `avatars.js` - 아바타 관리 (선택적)
- `files.js` - 파일 관리 (선택적)
- `search.js` - 검색 (선택적)
- `presets.js` - 프리셋 (선택적)

#### 유지 필요 (인프라)
- `users-admin.js` - 관리자 기능 (필요 시)
- `users-private.js` - 사용자 개인 기능 (필요 시)

## 🗑️ 제거 우선순위

### 1단계: 안전하게 제거 가능 (의존성 없음)

#### 웹 UI 전용 기능
```
❌ stable-diffusion.js      # 이미지 생성 (웹 전용)
❌ novelai.js               # NovelAI 통합 (웹 전용)
❌ images.js                # 이미지 처리 (웹 전용)
❌ speech.js                # 음성 처리 (웹 전용)
❌ translate.js             # 번역 (웹 전용)
❌ themes.js                # 테마 관리 (웹 전용)
❌ moving-ui.js             # UI 애니메이션 (웹 전용)
❌ quick-replies.js         # 빠른 답변 (웹 전용)
❌ sprites.js               # 스프라이트 (웹 전용)
❌ backgrounds.js           # 배경 이미지 (웹 전용)
❌ stats.js                 # 통계 (웹 전용)
```

**예상 효과**: 
- 엔드포인트: -50개
- 의존성: -10개
- 복잡도: ⬇️⬇️

#### 외부 서비스 직접 통합 (OpenRouter로 대체)
```
❌ openai.js                # OpenAI 직접 통합
❌ anthropic.js            # Claude 직접 통합
❌ google.js               # Google 직접 통합
❌ azure.js                # Azure 통합
```

**예상 효과**:
- 엔드포인트: -30개
- 의존성: -5개
- 복잡도: ⬇️⬇️

**주의**: OpenRouter가 모든 모델을 지원하는지 확인 필요

### 2단계: 신중하게 제거 (의존성 확인 필요)

#### 고급 기능
```
⚠️ worldinfo.js            # World Info (복잡하지만 유용)
⚠️ vectors.js              # 벡터 검색 (고급 기능)
⚠️ classify.js             # 분류 (고급 기능)
⚠️ caption.js              # 캡션 생성 (고급 기능)
⚠️ extensions.js           # 확장 기능 (복잡함)
⚠️ groups.js               # 그룹 채팅 (고급 기능)
```

**검토 필요**:
- 모바일 앱에서 사용하는지 확인
- 향후 필요할 가능성 평가
- 제거 시 영향도 분석

#### 컨텐츠 다운로드
```
⚠️ content-manager.js      # 컨텐츠 다운로드 (Pygmalion, Chub 등)
⚠️ assets.js               # 에셋 관리
```

**검토 필요**:
- 캐릭터 가져오기 기능 필요 여부
- 모바일 앱에서 사용하는지 확인

### 3단계: 선택적 제거 (나중에 필요할 수 있음)

```
⚠️ thumbnails.js           # 썸네일 생성 (성능 최적화)
⚠️ backups.js              # 백업 (데이터 보호)
⚠️ avatars.js              # 아바타 관리 (사용자 경험)
⚠️ files.js                # 파일 관리 (유틸리티)
⚠️ search.js               # 검색 (사용성)
⚠️ presets.js              # 프리셋 (편의성)
```

**검토 필요**:
- 각 기능의 가치 평가
- 제거 시 사용자 경험 영향

### 4단계: 유지 (핵심 기능)

```
✅ chats.js                 # 채팅 관리
✅ characters.js            # 캐릭터 관리
✅ backends/chat-completions.js  # AI 응답 생성
✅ settings.js              # 설정 관리
✅ users-public.js          # 사용자 인증
✅ secrets.js               # API 키 관리
✅ openrouter.js            # OpenRouter 통합
```

## 📝 제거 절차

### 안전한 제거 프로세스

#### 1. 의존성 확인
```bash
# 엔드포인트가 다른 곳에서 사용되는지 확인
grep -r "stable-diffusion\|novelai\|images" apps/server/src
grep -r "/api/stable-diffusion\|/api/novelai\|/api/images" apps/
```

#### 2. 단계별 제거
```typescript
// 1단계: 엔드포인트 비활성화 (주석 처리)
// router.post('/generate', ...)  // 비활성화

// 2단계: 테스트
// - 모바일 앱 동작 확인
// - 웹 UI 동작 확인 (해당 기능 사용 안 함)

// 3단계: 코드 제거
// - 엔드포인트 파일 삭제
// - server-startup.js에서 라우터 등록 제거

// 4단계: 의존성 제거
// - package.json에서 불필요한 패키지 제거
// - npm install 실행
```

#### 3. 검증
```bash
# 서버 시작 확인
npm start

# 모바일 앱 연결 확인
# 핵심 기능 테스트
```

## 🎯 단계별 목표

### Phase 1: 웹 전용 기능 제거 (1-2주)
- 목표: 엔드포인트 50개 제거
- 리스크: 낮음
- 효과: 복잡도 ⬇️⬇️

### Phase 2: 외부 서비스 통합 정리 (1주)
- 목표: OpenRouter로 통합
- 리스크: 중간 (OpenRouter 지원 확인 필요)
- 효과: 복잡도 ⬇️

### Phase 3: 고급 기능 검토 (2-3주)
- 목표: 필요성 평가 후 제거
- 리스크: 중간 (기능 가치 평가 필요)
- 효과: 복잡도 ⬇️⬇️

### Phase 4: 최적화 (1주)
- 목표: 남은 기능 정리
- 리스크: 낮음
- 효과: 복잡도 ⬇️

## 📊 예상 결과

### 제거 전
- 엔드포인트: 251개
- 엔드포인트 파일: 44개
- 의존성: 122개
- 복잡도: ⭐⭐⭐⭐⭐

### 제거 후 (목표)
- 엔드포인트: 50-80개 (70% 감소)
- 엔드포인트 파일: 15-20개 (55% 감소)
- 의존성: 80-90개 (25% 감소)
- 복잡도: ⭐⭐⭐☆☆

## ⚠️ 주의사항

### 제거 전 확인사항
1. ✅ 모바일 앱이 해당 기능을 사용하지 않는지 확인
2. ✅ 다른 엔드포인트가 의존하지 않는지 확인
3. ✅ 웹 UI가 해당 기능을 사용하지 않는지 확인
4. ✅ 백업 필수 (Git 커밋)

### 제거 후 확인사항
1. ✅ 서버가 정상적으로 시작되는지 확인
2. ✅ 모바일 앱이 정상적으로 동작하는지 확인
3. ✅ 핵심 기능이 정상적으로 작동하는지 확인
4. ✅ 에러 로그 확인

## 🔄 롤백 계획

### 문제 발생 시
1. Git으로 이전 버전으로 복구
2. 제거한 파일 복원
3. 의존성 재설치
4. 문제 분석 후 재시도

## 📅 일정

### Week 1-2: Phase 1 (웹 전용 기능 제거)
- [ ] stable-diffusion.js 제거
- [ ] novelai.js 제거
- [ ] images.js 제거
- [ ] speech.js 제거
- [ ] translate.js 제거
- [ ] themes.js 제거
- [ ] moving-ui.js 제거
- [ ] quick-replies.js 제거
- [ ] sprites.js 제거
- [ ] backgrounds.js 제거
- [ ] stats.js 제거

### Week 3: Phase 2 (외부 서비스 통합 정리)
- [ ] OpenRouter 지원 확인
- [ ] openai.js 제거
- [ ] anthropic.js 제거
- [ ] google.js 제거
- [ ] azure.js 제거

### Week 4-6: Phase 3 (고급 기능 검토)
- [ ] worldinfo.js 필요성 평가
- [ ] vectors.js 필요성 평가
- [ ] classify.js 필요성 평가
- [ ] caption.js 필요성 평가
- [ ] extensions.js 필요성 평가
- [ ] groups.js 필요성 평가
- [ ] 필요 없는 기능 제거

### Week 7: Phase 4 (최적화)
- [ ] 남은 기능 정리
- [ ] 의존성 정리
- [ ] 문서 업데이트

## 📚 참고

- [DATABASE_MIGRATION_PLAN.md](./DATABASE_MIGRATION_PLAN.md) - 데이터베이스 마이그레이션 계획
- 모바일 앱 API 사용 현황: `apps/mobile/lib/api/client.ts`
