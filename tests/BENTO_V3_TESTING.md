# V3 로컬 회귀 테스트

제품은 `index.html` 한 파일이며 새 런타임 의존성을 추가하지 않았다. 아래 테스트에는 Node.js, Playwright, Chromium이 필요하다.

```bash
# 터미널 1: 실제 Firebase SDK 대신 로컬 모의 모듈을 제공한다.
node tests/mock-server.mjs

# 터미널 2: Playwright가 Node 모듈 경로에 설치된 환경
node tests/bento-v3.test.cjs
```

- 기본 브라우저: `/usr/bin/chromium`. 다른 위치는 `CHROMIUM_PATH`로 지정한다.
- 기본 서버: `http://127.0.0.1:8001`. `TEST_BASE_URL`은 localhost/127.0.0.1만 허용한다.
- 기본 결과 위치: `screenshots/`. 임시 실행 시 `ARTIFACT_DIR=/workspace/work/v3-validation`처럼 별도 위치를 지정할 수 있다.
- 브라우저 시간대: `Asia/Seoul`. 날짜는 실행일 기준 상대 날짜이므로 특정 마감일에 의존하지 않는다.
- 제품 SDK 경로는 서버가 응답할 때만 모의 모듈로 치환한다. 제품 소스의 Firebase 설정과 SDK URL은 바꾸지 않는다.
- 합성 계정/과제만 사용한다. 실제 Firebase 서버의 데이터와 자격 증명은 필요하지 않다.

## 검증 내용과 한계

42개 검사: 인증 화면/오류/회원가입, CRUD, 완료/취소, 실시간 모의 스냅샷, 검색/필터/정렬, 저장 실패/재시도, JSON 백업/병합/중복 방지/전체 교체/오류 거부, 계정 전환/구독 해제, 기존 브라우저 원본 보존/가져오기, 오프라인 쓰기 차단, 긴 텍스트, 키보드/네이티브 모달, 모션 감소, 다섯 화면 너비, 빈 상태, 첫 화면 카드 위치, 콘솔 오류를 점검한다.

네이티브 dialog에서 Tab이 브라우저 툴바로 이동할 때 activeElement가 BODY가 될 수 있다. 테스트는 모달 밖의 제품 컨트롤로 포커스가 이동하지 않는지 검사한다.

스크린샷은 실제 Chromium에서 캡처한 **로컬 모의 Firebase 화면**이다. `LOCAL MOCK · 테스트 데이터` 표시가 포함된다. 캡처 시 모션을 줄여 과제 변경 직후 차트의 중간 애니메이션 값을 저장하지 않는다. 테스트 배지는 제품 코드에 포함되지 않는다.

- `bento-v3-desktop-1440.jpg`: 1440×900 첫 화면
- `bento-v3-dashboard-data.jpg`: 과제 5개가 있는 전체 대시보드
- `bento-v3-mobile-390.jpg`: 390px 모바일 전체 화면
- `bento-v3-login.jpg`: 로그인 화면
- `bento-v3-empty-state.jpg`: 과제가 없는 초기 화면
- `bento-v3-test-results.json`: 각 검사 통과/실패 및 브라우저 오류 기록

미검증: 실제 Firebase 인증/Firestore, 게시된 서버 보안 규칙, 실제 인증 상태의 브라우저 재시작 유지, 다중 실제 기기 동기화, Safari/Firefox, 스크린리더 실기. 별도 테스트 계정과 허용 범위가 정해진 뒤 검증한다. Hosting 배포는 하지 않는다.
