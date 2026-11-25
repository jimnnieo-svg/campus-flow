# Campus Flow | 마감일과 완료 현황을 함께 보는 과제 관리

대학 과제를 목록으로만 관리하면 특정 날짜에 일이 얼마나 몰리는지, 어떤 과제를 실제로 끝냈는지 파악하기 어렵습니다. Campus Flow는 과제 등록·마감·완료 데이터를 달력과 주간 차트에서 함께 보여줍니다. 구현은 V3 작업 브랜치에 있습니다. [V3 브랜치](https://github.com/jimnnieo-svg/campus-flow/tree/feat/campus-flow-bento-v3) · [V2를 대상으로 한 Draft PR #1](https://github.com/jimnnieo-svg/campus-flow/pull/1)

## 실제 화면과 주요 기능

아래 링크는 합성 과제 데이터를 사용해 Chromium에서 캡처한 실제 화면입니다. 날짜를 선택하면 해당 과제만 보이고, 완료 처리하면 최근 완료 추이가 갱신됩니다. 검색·필터·정렬, 과제 CRUD, JSON 백업·복원도 제공합니다. [날짜 선택 화면](https://github.com/jimnnieo-svg/campus-flow/blob/3790cac3335894ceeb2d62b89bfa244117d06977/screenshots/taskly-calendar-selection.jpg) · [여러 날짜의 완료 현황](https://github.com/jimnnieo-svg/campus-flow/blob/3790cac3335894ceeb2d62b89bfa244117d06977/screenshots/taskly-completion-multi-day.jpg)

## 맡은 일과 구현 결정

바이브코딩 수업 프로젝트에서 지원자는 과제·학사 일정 관리 흐름을 설계하고 Firebase 연동, 검색, 통계, 백업·복원의 구현과 검증을 진행했습니다. AI 코딩 도구 활용 과정에서 만든 화면을 날짜 경계, 새 계정, 빈 목록 같은 조건으로 확인했습니다. 개별 파일별 AI 작성 비율은 확인되지 않았습니다. 기술 스택은 HTML, CSS, JavaScript, Firebase Authentication, Cloud Firestore 및 Playwright입니다. [변경 과정](https://github.com/jimnnieo-svg/campus-flow/pull/1)

## 문제 해결과 테스트

완료 시각이 남아 있지 않은 데이터로 주간 추이를 그리면 기록에 없는 실적이 생깁니다. V3는 저장된 완료 시각으로 최근 7일을 집계하고, 시각 기록이 없을 때는 현재의 완료·미완료 현황을 표시합니다. 달력과 차트는 같은 Firestore 구독 결과를 사용합니다.

| 저장된 Chromium 결과 | 통과 | 실패 |
|---|---:|---:|
| [기본 회귀](https://github.com/jimnnieo-svg/campus-flow/blob/3790cac3335894ceeb2d62b89bfa244117d06977/screenshots/bento-v3-test-results.json) | 43 | 0 |
| [달력 선택·날짜 경계](https://github.com/jimnnieo-svg/campus-flow/blob/3790cac3335894ceeb2d62b89bfa244117d06977/screenshots/taskly-calendar-results.json) | 16 | 0 |
| [완료 기록·차트](https://github.com/jimnnieo-svg/campus-flow/blob/3790cac3335894ceeb2d62b89bfa244117d06977/screenshots/taskly-completion-results.json) | 16 | 0 |

## 로컬 실행과 검증 범위

V3의 루트에서 Node.js, Playwright와 Chromium이 준비된 환경을 사용합니다. 첫 터미널에서 모의 SDK 서버를 실행하면 로컬 8001 포트에서 화면을 볼 수 있습니다.

```sh
node tests/mock-server.mjs
```

두 번째 터미널에서 같은 브랜치의 세 테스트를 실행합니다.

```sh
node tests/bento-v3.test.cjs
node tests/taskly-calendar.test.cjs
node tests/taskly-completion.test.cjs
```

75건은 모의 Firebase와 Chromium에서 저장된 결과입니다. 다음 검증은 실제 Firebase의 사용자별 규칙, 재로그인 시 데이터 유지, 서로 다른 기기 간 동기화입니다. [테스트 환경과 세부 절차](https://github.com/jimnnieo-svg/campus-flow/blob/3790cac3335894ceeb2d62b89bfa244117d06977/tests/BENTO_V3_TESTING.md)

---

<details>
<summary>기존 프로젝트 문서와 실행 안내</summary>

# Campus Flow 📚

### 바이브코딩 특강 | 서연경 교수님

HTML, CSS, JavaScript를 활용하여 개발한 **대학생 과제 관리 TODO 웹앱**입니다.

본 프로젝트는 바이브코딩 특강에서 학습한 내용을 바탕으로, 대학생들이 과제와 마감 일정을 효율적으로 관리할 수 있도록 제작되었습니다.

</details>
