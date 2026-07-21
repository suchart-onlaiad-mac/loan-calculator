/* ตรวจว่าด่าน "ไม่แน่ใจ = ไม่พิมพ์" ทำงานจริง ไม่ใช่แค่เขียนไว้
 *
 * ที่มา (ตรวจเชิงลึก 21-07-2569): พบ 2 จุดที่ fail-open คือเจอปัญหาแล้วเงียบ
 * แล้วปล่อยให้เอกสารออกพร้อมข้อความ "✅ สร้างสำเร็จ"
 *
 *   1. fill_engine: fieldmap อ้างหน้าที่แบบฟอร์มไม่มี → `continue` ข้ามทั้งหน้า
 *      ช่องทุกช่องของหน้านั้นหายไป และด่านข้อความล้นก็ไม่ได้รันกับหน้านั้นด้วย
 *   2. doc_gate.ceiling: อ่านสูตรเพดานไม่ได้ → คืน null = ผ่าน
 *      ถ้า loan_core.js โหลดไม่ทัน เพดานหายเงียบพร้อมกันทั้ง 5 ใบ
 *
 * ตัวตรวจนี้ "ทำลายของ" จริงในหน้าเว็บ แล้วยืนยันว่าระบบปฏิเสธที่จะพิมพ์
 * ด่านที่ทดสอบไม่ได้ = ด่านที่ไม่มีอยู่จริง — และการเขียนด่านที่ fail ไม่ได้
 * เคยเกิดในโปรเจกต์นี้มาแล้ว 2 ครั้งในวันเดียว
 *
 *   node test/browser/check_failclosed.js          # ไฟล์ในเครื่อง
 *   node test/browser/check_failclosed.js --live   # เว็บจริงบน Pages
 */
'use strict';
const path = require('path'), fs = require('fs'), http = require('http');
const REPO = '/Users/suchartonla-iad/Desktop/loan-calculator';
const LIVE = 'https://suchart-onlaiad-mac.github.io/loan-calculator/';
const { launch, connect, sleep } = require('./cdp');
const useLive = process.argv.includes('--live');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.pdf': 'application/pdf',
  '.png': 'image/png', '.json': 'application/json', '.ttf': 'font/ttf' };

function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(REPO, u === '/' ? 'index.html' : u);
      if (!f.startsWith(REPO) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rq.writeHead(404); return rq.end('x'); }
      rq.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(f).pipe(rq);
    });
    s.listen(0, '127.0.0.1', () => res({ server: s, port: s.address().port }));
  });
}

const IDENT = { ct_meetdate: '2026-08-09', ct_name: 'ทดสอบ ระบบ', ct_reg: '12345',
  ct_group: '7', ct_house: '99', ct_moo: '4' };

/* เตรียมหน้าเว็บให้พร้อมพิมพ์ ส.-งก.13 (สถานะปกติที่พิมพ์ผ่านแน่ ๆ) */
async function prep(t) {
  for (const [id, v] of Object.entries({ principal: '100000', loanType: 'medium', years: '3', rate: '7' })) await t.setField(id, v);
  await t.clickButtonText('คำนวณ'); await sleep(600);
  await t.clickButtonText('พิมพ์สัญญากู้ ส.-งก.14'); await sleep(900);
  for (const [id, v] of Object.entries(IDENT)) await t.setField(id, v);
  await t.evaluate(`(()=>{const s=document.querySelector('input[name="ct_security"][value="mortgage"]');
    if(s){s.checked=true;s.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
  await sleep(300);
  await t.evaluate(`(()=>{for(const id of ['ct_tambon','ct_purpose']){const s=document.getElementById(id);
    if(s&&!s.value){s.selectedIndex=1;s.dispatchEvent(new Event('change',{bubbles:true}));}}})()`);
  await t.clickButtonText('คำขอกู้ ส.-งก.13'); await sleep(1300);
}

async function pressAndRead(t) {
  await t.evaluate(`document.getElementById('sngk13_status').innerHTML='';`);
  await t.clickButtonText('สร้าง PDF คำขอกู้ ส.-งก.13');
  let st = '';
  for (let i = 0; i < 40; i++) {
    st = await t.evaluate(`(()=>{const e=document.getElementById('sngk13_status');return e?e.textContent.trim():''})()`);
    if (/✅|⚠️|❌/.test(st)) break;
    await sleep(500);
  }
  return st;
}

/* แต่ละเคส: [ชื่อ, โค้ดที่ใช้ทำลายของ, ข้อความที่ต้องเห็น] */
const CASES = [
  ['สภาพปกติ (ตัวเทียบ) — ต้องพิมพ์ได้', null, /สำเร็จ/],
  ['fieldmap อ้างหน้าที่แบบฟอร์มไม่มี → ต้องไม่พิมพ์',
    `window.SNGK13_MAP.__probe = {page:99, x:100, y:100, size:14, max:50};`,
    /ไม่มีหน้า 99|ไม่พิมพ์ให้/],
  ['อ่านสูตรเพดานไม่ได้ → ต้องไม่พิมพ์',
    `window.ceilingFor = undefined; ceilingFor = undefined;`,
    /อ่าน .*ไม่ได้|แจ้งผู้พัฒนา/],
];

(async () => {
  const srv = useLive ? null : await serve();
  const URL = useLive ? LIVE : `http://127.0.0.1:${srv.port}/index.html`;
  const proc = await launch();
  let bad = 0;

  for (const [name, sabotage, want] of CASES) {
    const t = await connect(URL);
    await sleep(useLive ? 3000 : 2000);
    await prep(t);
    if (sabotage) {
      /* ใส่ข้อมูลให้ช่องที่เพิ่งเสกด้วย เพื่อให้มันถูกเก็บเข้า perPage จริง */
      await t.evaluate(sabotage);
      await t.evaluate(`(()=>{const p=document.getElementById('sngk13_body');
        if(p && window.SNGK13_MAP.__probe){const i=document.createElement('input');
        i.id='s13___probe'; i.value='ทดสอบ'; p.appendChild(i);}})()`);
      await sleep(200);
    }
    const st = await pressAndRead(t);
    const ok = want.test(st);
    if (!ok) bad++;
    console.log(`  ${ok ? '✅' : '🔴'} ${name}`);
    console.log(`       ได้: ${st.slice(0, 90) || '(ว่าง)'}`);
    t.ws.close();
  }

  proc.kill(); if (srv) srv.server.close();
  console.log('\n' + (bad ? `🔴 ไม่ผ่าน ${bad} เคส — ด่านยังไม่ fail-closed จริง` : '✅ ด่านปฏิเสธที่จะพิมพ์ทุกเคสที่ควรปฏิเสธ'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.stack || e.message); process.exit(2); });
