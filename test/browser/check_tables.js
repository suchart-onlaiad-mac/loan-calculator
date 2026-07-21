/* ตรวจทุกตารางใน ส.-งก.13 — จำนวนแถวบนหน้าจอต้องเท่ากับที่แบบฟอร์มพิมพ์ได้
 *
 * ที่มา (21-07-2569): หน้าจอกรอกฝังจำนวนแถวไว้เป็นเลขคงที่ ขณะที่ fieldmap
 * (= พิกัดจริงบนกระดาษ) มีมากกว่า ทำให้มีช่องบนกระดาษที่ไม่มีทางถูกเติมค่า
 * และเอกสารยังขึ้น "✅ สำเร็จ" ตามปกติ เจ้าหน้าที่ไม่มีทางรู้
 *
 *   ตารางจำนอง      หน้าจอ 2 · กระดาษ 3
 *   ตารางหนี้เดิม   หน้าจอ 2 · กระดาษ 4   ← หนักสุด: คำขอกู้ระบุหนี้น้อยกว่าจริง
 *   ตารางรายรับ     หน้าจอ 3 · กระดาษ 7
 *   ตารางการผลิต    หน้าจอ 3 · กระดาษ 6
 *
 * 🔑 เกณฑ์มาจาก fieldmap ไม่ใช่ตัวเลขที่เทสต์คิดเอง — คนละแหล่งกับโค้ดที่ถูกตรวจ
 *    ชุดทดสอบเดิม 42 ข้อมองไม่เห็นบั๊กนี้เลย เพราะทุกข้อถามว่า "พิมพ์ออกไหม"
 *    ไม่มีข้อไหนถามว่า "เจ้าหน้าที่กรอกได้ครบไหม"
 *
 *   node test/browser/check_tables.js          # ไฟล์ในเครื่อง
 *   node test/browser/check_tables.js --live   # เว็บจริงบน Pages
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

/* ตาราง = [ชื่อไทย, prefix, suffix ที่มีครบทุกแถว] */
const TABLES = [
  ['การผลิตฤดูที่ล่วงมา (ข้อ 3)', 'prod', '_type'],
  ['รายรับ (ข้อ 4)', 'inc', '_type'],
  ['รายจ่าย (ข้อ 4)', 'exp', '_amt'],
  ['หนี้เงินกู้เดิม', 'debt', '_type'],
  ['การใช้เงินกู้ (ข้อ 2)', 'use', '_amt'],
  ['จำนอง (ข้อ 5 ข)', 'mort', '_landtype'],
  ['บุคคลค้ำ (ข้อ 5 ก)', 'g', '_name'],
];

const IDENT = { ct_meetdate: '2026-08-09', ct_name: 'ทดสอบ ระบบ', ct_reg: '12345',
  ct_group: '7', ct_house: '99', ct_moo: '4' };

(async () => {
  const srv = useLive ? null : await serve();
  const URL = useLive ? LIVE : `http://127.0.0.1:${srv.port}/index.html`;
  const proc = await launch();
  const t = await connect(URL);
  await sleep(useLive ? 3000 : 2000);

  let bad = 0;
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

  console.log('\nตาราง                            กระดาษ  หน้าจอ');
  for (const [label, pre, suf] of TABLES) {
    const r = JSON.parse(await t.evaluate(`JSON.stringify({
      map:(()=>{let n=0;while(window.SNGK13_MAP[${JSON.stringify(pre)}+(n+1)+${JSON.stringify(suf)}])n++;return n})(),
      ui:(()=>{let n=0;while(document.getElementById('s13_'+${JSON.stringify(pre)}+(n+1)+${JSON.stringify(suf)}))n++;return n})()
    })`));
    const ok = r.ui === r.map;
    if (!ok) bad++;
    console.log(`  ${ok ? '✅' : '🔴'} ${label.padEnd(30)} ${String(r.map).padStart(4)}  ${String(r.ui).padStart(6)}`);
    if (!ok) console.log(`       เจ้าหน้าที่กรอกแถว ${r.ui + 1}-${r.map} ไม่ได้ ทั้งที่กระดาษมีที่ว่าง`);
  }

  /* กรอกหนี้ให้เต็มทุกแถว แล้วยืนยันว่าหนังสือแสดงความจำนงเห็นครบ
   * (ใบนั้นเคยอ่านหนี้แค่ 2 แถวเหมือนกัน → หนี้แถว 3-4 หายจากใบนั้นแทน) */
  const nDebt = JSON.parse(await t.evaluate(
    `JSON.stringify((()=>{let n=0;while(window.SNGK13_MAP['debt'+(n+1)+'_type'])n++;return n})())`));
  const types = ['ระยะสั้น', 'ระยะปานกลาง', 'ระยะยาว'];
  for (let i = 1; i <= nDebt; i++) {
    await t.setField('s13_debt' + i + '_type', types[(i - 1) % types.length]);
    await t.setField('s13_debt' + i + '_remain', '10000');
  }
  await sleep(500);
  const seen = JSON.parse(await t.evaluate(`JSON.stringify(
    (typeof janongAggDebt==='function') ? (()=>{const r=janongAggDebt();
      return {count:Object.values(r.agg).reduce((s,a)=>s+a.count,0), unmapped:r.unmapped.length}})()
    : null)`));
  if (seen) {
    const ok = (seen.count + seen.unmapped) === nDebt;
    if (!ok) bad++;
    console.log(`\n  ${ok ? '✅' : '🔴'} หนังสือแสดงความจำนงเห็นหนี้ ${seen.count + seen.unmapped}/${nDebt} แถว`);
    if (!ok) console.log('       หนี้บางแถวหายจากหนังสือความจำนง — เอกสารบอกหนี้น้อยกว่าจริง');
  }

  /* ทุกตัวเลือกในกล่องเลือกต้องพิมพ์เอกสารออกได้ — เลือกได้แต่พิมพ์ไม่ได้ = ทางตัน
   * ("ระยะปานกลาง" เคยทำให้ทั้งใบพิมพ์ไม่ออก ทั้งที่เป็นตัวเลือกของระบบเอง) */
  await t.evaluate(`document.getElementById('sngk13_status').innerHTML='';`);
  await t.clickButtonText('สร้าง PDF คำขอกู้ ส.-งก.13');
  let st = '';
  for (let i = 0; i < 40; i++) {
    st = await t.evaluate(`(()=>{const e=document.getElementById('sngk13_status');return e?e.textContent.trim():''})()`);
    if (/✅|⚠️|❌/.test(st)) break;
    await sleep(500);
  }
  const ok = /สำเร็จ/.test(st);
  if (!ok) bad++;
  console.log(`  ${ok ? '✅' : '🔴'} กรอกหนี้ครบทุกแถวทุกประเภท แล้วพิมพ์ได้ — ${st.slice(0, 55)}`);

  t.ws.close(); proc.kill(); if (srv) srv.server.close();
  console.log('\n' + (bad ? `🔴 ไม่ผ่าน ${bad} ข้อ` : '✅ ผ่านทุกข้อ'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.stack || e.message); process.exit(2); });
