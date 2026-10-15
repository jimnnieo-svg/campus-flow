export const auth = { currentUser: null, listener: null };
export const store = new Map();
export const listeners = new Map();
export class Timestamp {
  constructor(seconds, nanoseconds = 0) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  toMillis() { return this.seconds * 1000 + this.nanoseconds / 1000000; }
  static fromMillis(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    return new Timestamp(seconds, (milliseconds - seconds * 1000) * 1000000);
  }
}
export function publish(uid) {
  for (const listener of listeners.get(uid) || []) listener();
}
export function seed(uid) {
  if (store.has(uid)) return;
  const today = new Date();
  const date = offset => {
    const value = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  };
  const timestamp = () => new Timestamp(Math.floor(Date.now() / 1000), 0);
  const sample = (id, subject, title, offset, priority, completed, memo) => [id, {
    subject, title, dueDate: date(offset), priority, memo, completed,
    createdAt: timestamp(), updatedAt: timestamp(), completedAt: completed ? timestamp() : null
  }];
  store.set(uid, new Map([
    sample('mock-1', 'UX 디자인', '사용자 인터뷰 결과 정리', 1, 'high', false, '인터뷰 핵심 인사이트와 개선 방향을 정리하세요.'),
    sample('mock-2', '데이터 분석', '시각화 발표 자료 만들기', 5, 'normal', false, '차트와 발표 흐름을 점검하세요.'),
    sample('mock-3', '캡스톤 디자인', '프로젝트 제안서 제출', -2, 'low', true, '최종 검토 완료')
  ]));
}
