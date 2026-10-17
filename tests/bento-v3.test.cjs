// Run against tests/mock-server.mjs only. Never points at production Firebase.
// Requires Playwright and Chromium; no production npm dependency is added.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8001';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local mock server required');
const output = path.resolve(process.env.ARTIFACT_DIR || 'screenshots');
const results = [], consoleErrors = [], pageErrors = [], externalRequests = [];
let browser;
const check = async (name, run) => {
  try { await run(); results.push({ name, status: 'passed' }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, status: 'failed', error: error.message }); throw error; }
};
const total = (page, count) => page.waitForFunction(count => document.querySelector('#stat-total').textContent === String(count), count);
const idle = page => page.waitForFunction(() => document.querySelector('#task-form').getAttribute('aria-busy') === 'false' && !document.querySelector('#import-data').disabled);
async function login(page, email, count = 3) {
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill('test-password');
  await page.locator('#auth-submit').click(); await total(page, count);
}
async function createTask(page, title, offset = 1, priority = 'normal', note = '') {
  await page.locator('[data-open-task]').click();
  await page.locator('#subject').fill('테스트 과목'); await page.locator('#title').fill(title);
  const date = await page.evaluate(offset => {
    const d = new Date(); d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, offset);
  await page.locator('#due-date').fill(date);
  await page.locator(`input[name="priority"][value="${priority}"]`).check({force:true});
  await page.locator('#note').fill(note); await page.locator('#submit-task').click();
  await page.waitForFunction(() => !document.querySelector('#task-dialog').open); await idle(page);
}
async function importJSON(page, data, confirm = true) {
  await idle(page);
  await page.locator('#import-file').setInputFiles({ name:'local-test.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(data)) });
  await page.locator('#confirm-dialog').waitFor({ state:'visible' });
  await page.locator(confirm ? '#dialog-confirm' : '#confirm-dialog button[value="cancel"]').click();
  await page.waitForFunction(() => !document.querySelector('#confirm-dialog').open); await idle(page);
}
async function screenshot(page, name, fullPage = true) {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(() => {
    document.activeElement?.blur(); window.scrollTo({top:0,behavior:'instant'}); document.querySelector('#toast').textContent='';
    const label=document.createElement('div'); label.id='test-capture-label';
    label.textContent='LOCAL MOCK · 테스트 데이터';
    label.style.cssText='position:fixed;bottom:5px;right:8px;z-index:50;font:9px sans-serif;color:#52647b;background:#ffffffee;padding:4px 7px;border-radius:6px;pointer-events:none';
    document.body.append(label);
  });
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:path.join(output, name),fullPage,type:'jpeg',quality:88,animations:'disabled'});
  await page.locator('#test-capture-label').evaluate(el=>el.remove());
}
async function main() {
  await fs.mkdir(output,{recursive:true});
  browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context = await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Seoul',acceptDownloads:true});
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || ['data:','blob:'].includes(url.protocol)) return route.continue();
    externalRequests.push(url.origin); return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')consoleErrors.push(m.text());});
  await page.goto(base);
  await check('인증 확인 전 대시보드 숨김 / 로그인 화면', async()=>{
    await page.locator('#auth-layout').waitFor({state:'visible'});
    assert.equal(await page.locator('#main').isVisible(),false);
    await screenshot(page,'bento-v3-login.jpg',false);
  });
  await check('잘못된 비밀번호 오류',async()=>{
    await page.locator('#auth-email').fill('v3-suite@example.com');await page.locator('#auth-password').fill('wrong-password');
    await page.locator('#auth-submit').click(); await page.locator('#auth-error').waitFor({state:'visible'});
    assert.match(await page.locator('#auth-error').textContent(),/이메일 또는 비밀번호/);
  });
  await check('회원가입 확인 불일치 검증',async()=>{
    await page.locator('[data-auth-mode="signup"]').click();
    await page.locator('#auth-password').fill('test-password');await page.locator('#auth-password-confirm').fill('different-password');
    await page.locator('#auth-submit').click(); assert.match(await page.locator('#auth-error').textContent(),/일치하지/);
  });
  await check('모의 회원가입 / 실시간 초기 과제',async()=>{
    await page.locator('#auth-password-confirm').fill('test-password');await page.locator('#auth-submit').click();await total(page,3);
    assert.equal(await page.locator('#account-email').textContent(),'v3-suite@example.com');
  });
  await check('실제 과제 통계 / 진행률 / 중요도 / 7일 집계',async()=>{
    assert.equal(await page.locator('#progress-number').textContent(),'33.3%');
    assert.equal(await page.locator('#priority-count-high').textContent(),'1');
    assert.equal(await page.locator('#priority-count-normal').textContent(),'1');
    assert.equal(await page.locator('#week-total').textContent(),'2');
    assert.equal(await page.locator('[data-id="mock-1"] .badge').textContent(),'D-1');
  });
  await check('필수 입력 검증',async()=>{
    await page.locator('[data-open-task]').click();await page.locator('#submit-task').click();
    assert.equal(await page.locator('#subject').getAttribute('aria-invalid'),'true');
    assert.equal(await page.locator('#subject').evaluate(el=>el===document.activeElement),true);
  });
  await check('모달 키보드 포커스 제한 / Escape / 초안 보존',async()=>{
    assert.equal(await page.getByRole('link',{name:'새 과제 작성',exact:true}).getAttribute('aria-current'),'location');
    await page.locator('#subject').fill('보존할 초안');
    for(let i=0;i<18;i++){
      await page.keyboard.press('Tab');
      const focus=await page.evaluate(()=>({id:document.activeElement.id,tag:document.activeElement.tagName,inside:document.querySelector('#task-dialog').contains(document.activeElement)}));
      // Native dialog may yield to browser chrome (BODY), but not background controls.
      assert(focus.inside || focus.tag==='BODY',JSON.stringify(focus));
    }
    await page.keyboard.press('Escape');assert.equal(await page.locator('#task-dialog').evaluate(el=>el.open),false);
    assert.equal(await page.locator('[data-open-task]').evaluate(el=>el===document.activeElement),true);
    await page.getByRole('link',{name:'새 과제 작성',exact:true}).click();
    assert.equal(await page.locator('#subject').inputValue(),'보존할 초안');
    await page.locator('#close-task-form').click();
  });
  await check('과제 생성 / XSS 문자열을 텍스트로 표시',async()=>{
    await createTask(page,'V3 회귀 과제',0,'high','<img src=x onerror=alert(1)>\n메모는 안전한 텍스트로 표시됩니다.'); await total(page,4);
    assert.equal(await page.locator('#week-total').textContent(),'3');
    assert.equal(await page.locator('#priority-count-high').textContent(),'2');
    assert.equal(await page.locator('#task-list img').count(),0);
  });
  const created = page.locator('#task-list > li').filter({has:page.getByRole('heading',{name:'V3 회귀 과제',exact:true})});
  let id=await created.getAttribute('data-id');
  await check('상단 완료율과 오늘/임박/진행 중 실제 바로가기',async()=>{
    assert.equal(await page.locator('#header-rate').textContent(),'25%');
    await page.locator('[data-quick="today"]').click();assert.equal(await page.locator('#task-list > li').count(),1);
    assert.equal(await page.locator('#date-filter-line').isVisible(),true);
    await page.locator('[data-quick="urgent"]').click();assert.equal(await page.locator('#task-list > li').count(),2);
    await page.locator('[data-quick="active"]').click();assert.equal(await page.locator('#task-list > li').count(),3);
    await page.locator('[data-filter="all"]').click();assert.equal(await page.locator('#task-list > li').count(),4);
  });
  await check('메모 펼치기 / 실제 내용',async()=>{
    await created.locator('summary').click();
    assert.match(await created.locator('.task-note p').textContent(),/<img src=x/);
  });
  await check('완료 / 차트와 메모 열림 동시 갱신',async()=>{
    await created.locator('[data-action="toggle"]').check();await idle(page);
    assert.equal(await page.locator('#progress-number').textContent(),'50%');
    assert.equal(await page.locator('#week-total').textContent(),'2');
    assert.equal(await created.locator('.task-note').evaluate(el=>el.open),true);
    assert.equal(await page.locator('#progress').getAttribute('aria-valuenow'),'50');
  });
  await check('완료 취소',async()=>{
    await created.locator('[data-action="toggle"]').uncheck();await idle(page);
    assert.equal(await page.locator('#progress-number').textContent(),'25%');
  });
  await check('수정 폼 / 취소',async()=>{
    await created.locator('[data-action="edit"]').click();assert.equal(await page.locator('#title').inputValue(),'V3 회귀 과제');
    await page.locator('#title').fill('저장하지 않을 제목');await page.locator('#cancel-edit').click();
    assert.equal(await page.locator('#title').inputValue(),'');await page.locator('#close-task-form').click();
  });
  await check('과제 수정 저장',async()=>{
    await page.locator(`[data-id="${id}"] [data-action="edit"]`).click();
    await page.locator('#title').fill('V3 수정 완료');await page.locator('#submit-task').click();
    await page.waitForFunction(()=>!document.querySelector('#task-dialog').open);
    assert.equal(await page.locator(`[data-id="${id}"] h3`).textContent(),'V3 수정 완료');
  });
  await check('모의 서버 스냅샷 변경 반영 / 단일 구독',async()=>{
    const count=await page.evaluate(async()=>{
      const m=await import('/mock/state.js');const uid='v3-suite@example.com';
      const item=m.store.get(uid).get('mock-2');item.title='실시간 변경 확인';item.updatedAt=m.Timestamp.fromMillis(Date.now());m.publish(uid);
      return m.listeners.get(uid).size;
    });
    assert.equal(count,1);assert.equal(await page.locator('[data-id="mock-2"] h3').textContent(),'실시간 변경 확인');
  });
  await check('검색 / 검색 해제',async()=>{
    await page.locator('#search').fill('V3 수정');assert.equal(await page.locator('#task-list > li').count(),1);
    await page.locator('#clear-search').click();assert.equal(await page.locator('#task-list > li').count(),4);
  });
  await check('진행 중 / 완료 / 마감 임박 필터',async()=>{
    for(const [filter,count] of [['active',3],['completed',1],['urgent',2],['all',4]]){
      await page.locator(`[data-filter="${filter}"]`).click();assert.equal(await page.locator('#task-list > li').count(),count);
    }
  });
  await check('중요도 / 최근 / 마감일 정렬',async()=>{
    await page.locator('#sort').selectOption('priority');assert.match(await page.locator('#task-list > li').first().locator('.priority-tag').textContent(),/높음/);
    await page.locator('#sort').selectOption('recent');assert.equal(await page.locator('#task-list > li').first().getAttribute('data-id'),id);
    await page.locator('#sort').selectOption('due');assert.equal(await page.locator('#task-list > li').first().getAttribute('data-id'),id);
  });
  await check('삭제 확인 취소 / 삭제',async()=>{
    await page.locator(`[data-id="${id}"] [data-action="delete"]`).click();
    await page.locator('#confirm-dialog button[value="cancel"]').click();await total(page,4);
    await page.locator(`[data-id="${id}"] [data-action="delete"]`).click();await page.locator('#dialog-confirm').click();await total(page,3);
  });
  await check('저장 실패 시 입력과 모달 내부 오류 보존',async()=>{
    await page.locator('[data-open-task]').click();await page.locator('#subject').fill('실패 검증');await page.locator('#title').fill('MOCK_FAIL');
    await page.locator('#due-date').fill('2026-10-20');await page.locator('#submit-task').click();
    await page.waitForFunction(()=>document.querySelector('#task-save-feedback').textContent.includes('서버에 연결하지 못했어요'));
    assert.equal(await page.locator('#title').inputValue(),'MOCK_FAIL');assert.equal(await page.locator('#task-dialog').evaluate(el=>el.open),true);
    assert.equal(await page.locator('#cloud-notice').getAttribute('hidden'),null);
  });
  await check('실패 후 재시도',async()=>{
    await page.locator('#title').fill('실패 후 복구');await page.locator('#submit-task').click();await total(page,4);
    await page.waitForFunction(()=>!document.querySelector('#task-dialog').open);
  });
  let backup;
  await check('사이드바 백업 열기 / JSON 다운로드',async()=>{
    await page.getByRole('link',{name:'백업과 복원',exact:true}).click();assert.equal(await page.locator('#backup').evaluate(el=>el.open),true);
    const download=page.waitForEvent('download');await page.locator('#export-data').click();
    backup=JSON.parse(await fs.readFile(await (await download).path(),'utf8'));
    assert.equal(backup.app,'CampusFlow');assert.equal(backup.version,2);assert.equal(backup.tasks.length,4);
  });
  const imported={...backup.tasks[0],id:'restore-local-1',title:'병합 복원 검증'};
  await check('JSON 병합 복원 / 기존 기록 보존',async()=>{
    await page.locator('#import-mode').selectOption('merge');await importJSON(page,{...backup,tasks:[imported]});await total(page,5);
    assert.equal(await page.locator('[data-id="restore-local-1"] h3').textContent(),'병합 복원 검증');
  });
  await check('같은 백업 재가져오기 중복 방지',async()=>{
    await importJSON(page,{...backup,tasks:[imported]});await total(page,5);
  });
  await check('잘못된 JSON 복원 거부 / 원본 보존',async()=>{
    await page.locator('#import-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
    await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('JSON 파일을 읽을 수 없어요'));
    await total(page,5);
  });
  await check('JSON 전체 교체 취소 후 확인 / 원본 백업으로 복원',async()=>{
    await page.locator('#import-mode').selectOption('replace');await importJSON(page,backup,false);await total(page,5);
    await importJSON(page,backup);await total(page,4);
  });
  await check('오프라인 오류 표시 / 쓰기 차단 / 재연결',async()=>{
    await context.setOffline(true);await page.waitForFunction(()=>document.querySelector('#cloud-message').textContent.includes('인터넷 연결이 끊겼어요'));
    assert.equal(await page.locator('#submit-task').isDisabled(),true);
    await context.setOffline(false);await page.waitForFunction(()=>!document.querySelector('#submit-task').disabled);
  });
  await check('로그아웃 시 과제 / 폼 / 모달 / 구독 초기화',async()=>{
    await page.locator('[data-open-task]').click();await page.locator('#subject').fill('남아 있으면 안 되는 초안');
    await page.evaluate(async()=>{const a=await import('/mock/firebase-auth.js');await a.signOut(a.getAuth());});
    assert.equal(await page.locator('#main').isVisible(),false);assert.equal(await page.locator('#task-dialog').evaluate(el=>el.open),false);
    assert.equal(await page.locator('#subject').inputValue(),'');assert.equal(await page.locator('#task-list > li').count(),0);
    assert.equal(await page.evaluate(async()=>{const m=await import('/mock/state.js');return m.listeners.get('v3-suite@example.com').size;}),0);
  });
  await check('다른 계정 데이터 격리 / 모의 로그인',async()=>{
    await page.locator('[data-auth-mode="login"]').click();await login(page,'v3-other@example.com');
    assert.equal(await page.getByRole('heading',{name:'실패 후 복구',exact:true}).count(),0);
    assert.equal(await page.locator('[data-id="mock-2"] h3').textContent(),'시각화 발표 자료 만들기');
  });
  await check('기존 계정 재로그인 / 기존 데이터 유지',async()=>{
    await page.locator('#logout').click();await login(page,'v3-suite@example.com',4);
    await total(page,4);assert.equal(await page.getByRole('heading',{name:'실패 후 복구',exact:true}).count(),1);
  });
  await check('기존 브라우저 기록 명시적 가져오기 / 원본 보존',async()=>{
    const legacy=JSON.stringify({...backup,tasks:[{...backup.tasks[0],id:'legacy-v3',title:'예전 브라우저 과제'}]});
    await page.evaluate(async legacy=>{
      localStorage.setItem('campus-flow.tasks.v1',legacy);
      window.dispatchEvent(new StorageEvent('storage',{key:'campus-flow.tasks.v1',newValue:legacy}));
    },legacy);
    assert.equal(await page.locator('#legacy-notice').isVisible(),true);
    assert.equal(await page.locator('[data-id="legacy-v3"]').count(),0);
    await page.locator('#import-legacy').click();await page.locator('#dialog-confirm').click();await total(page,5);
    assert.equal(await page.evaluate(()=>localStorage.getItem('campus-flow.tasks.v1')),legacy);
    const download=page.waitForEvent('download');await page.locator('#download-legacy').click();
    assert.equal(await fs.readFile(await (await download).path(),'utf8'),legacy);
  });
  await check('긴 과목 / 제목 / 메모 / 360px 입력',async()=>{
    await page.setViewportSize({width:360,height:900});
    await createTask(page,'긴 제목 '.repeat(20),3,'low','긴 메모 '.repeat(300));await total(page,6);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('[data-open-task]').click();
    assert.equal(await page.evaluate(()=>document.querySelector('#task-dialog').scrollWidth<=document.querySelector('#task-dialog').clientWidth),true);
    await page.keyboard.press('Escape');
  });
  for(const width of [360,390,768,1280,1440]) await check(`반응형 ${width}px / 넘침 / 폼 / 주요 기능`,async()=>{
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await page.locator('[data-open-task]').isVisible(),true);
    await page.locator('[data-open-task]').click();
    assert.equal(await page.locator('#title').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.querySelector('#task-dialog').getBoundingClientRect().width<=innerWidth),true);
    await page.keyboard.press('Escape');
    await page.getByRole('link',{name:'백업과 복원',exact:true}).click();assert.equal(await page.locator('#backup').evaluate(el=>el.open),true);
    await page.locator('#backup > summary').click();
  });
  await check('모션 감소 / 키보드 focus 표시 / DOM ID 중복 없음',async()=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('[data-open-task]').focus();await page.keyboard.press('Tab');
    const styles=await page.evaluate(()=>({outline:getComputedStyle(document.activeElement).outlineStyle,smooth:getComputedStyle(document.documentElement).scrollBehavior,ids:[...document.querySelectorAll('[id]')].map(e=>e.id)}));
    assert.notEqual(styles.outline,'none');assert.equal(styles.smooth,'auto');assert.equal(styles.ids.length,new Set(styles.ids).size);
  });
  await check('내비게이션 현재 위치 / 마감 바로 보기',async()=>{
    await page.getByRole('link',{name:'과제 목록',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('a[href="#tasks"]').getAttribute('aria-current')==='location');
    await page.locator('#view-urgent').click();assert.equal(await page.locator('[data-filter="urgent"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-filter="all"]').click();
  });
  // Separate browser context: presentation captures use only local fixtures.
  const captures=await browser.newContext({viewport:{width:1440,height:900},timezoneId:'Asia/Seoul'});
  const visual=await captures.newPage();
  visual.on('pageerror',e=>pageErrors.push(e.message));
  await visual.goto(base);await login(visual,'v3-visual@example.com');
  await createTask(visual,'서비스 기획안 다듬기',2);await createTask(visual,'중간 리서치 제출',3);
  await check('1440×900 Taskly 42:58 배치 / 상하 카드 정렬',async()=>{
    const boxes=await visual.evaluate(()=>Object.fromEntries(['.deadline-panel','#tasks','.progress-panel','.stats','.focus-panel'].map(key=>[key,document.querySelector(key).getBoundingClientRect().toJSON()])));
    const ratio=boxes['.deadline-panel'].width/(boxes['.deadline-panel'].width+boxes['#tasks'].width);
    assert(ratio>0.41&&ratio<0.44);
    assert(Math.abs(boxes['#tasks'].top-boxes['.deadline-panel'].top)<1);
    assert(Math.abs(boxes['#tasks'].bottom-boxes['.deadline-panel'].bottom)<1);
    assert(Math.abs(boxes['.progress-panel'].left-boxes['#tasks'].left)<1);
    assert(Math.abs(boxes['.focus-panel'].left-boxes['.deadline-panel'].left)<1);
    assert(boxes['.progress-panel'].top>boxes['#tasks'].bottom);
    assert(boxes['.progress-panel'].right<=1440);
    await screenshot(visual,'bento-v3-desktop-1440.jpg',false);
    await screenshot(visual,'bento-v3-dashboard-data.jpg',true);
  });
  await check('390px 모바일 캡처 / 전체 과제 기능',async()=>{
    await visual.setViewportSize({width:390,height:900});await screenshot(visual,'bento-v3-mobile-390.jpg');
    assert.equal(await visual.locator('#task-list > li').count(),5);
    assert.equal(await visual.locator('#task-list').evaluate(el=>getComputedStyle(el).maxHeight),'none');
  });
  await check('빈 대시보드 / 차트 0 / 첫 과제 폼',async()=>{
    await visual.evaluate(async()=>{const m=await import('/mock/state.js');m.store.set('v3-visual@example.com',new Map());m.publish('v3-visual@example.com');});
    await total(visual,0);assert.equal(await visual.locator('#week-total').textContent(),'0');assert.equal(await visual.locator('#progress-number').textContent(),'0%');
    await visual.setViewportSize({width:1440,height:900});await screenshot(visual,'bento-v3-empty-state.jpg',false);
    await visual.locator('#empty-action').click();assert.equal(await visual.locator('#task-dialog').evaluate(el=>el.open),true);
    await visual.keyboard.press('Escape');
  });
  await check('브라우저 콘솔 / 런타임 오류 / 외부 Firebase 요청 없음',async()=>{
    assert.deepEqual(pageErrors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(externalRequests,[]);
  });
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'bento-v3-test-results.json'),JSON.stringify({environment:'Local mock Firebase + real Chromium, Asia/Seoul',passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,results,pageErrors,consoleErrors,externalRequests,unverified:['Live Firebase Authentication/Firestore','Published Firestore security rules','Real authentication persistence across browser restarts','Production Hosting']},null,2)+'\n');
  await browser?.close();
});
