/* ตรวจตารางจำนอง ส.-งก.13 — จำนวนแถวบนหน้าจอต้องเท่ากับที่ fieldmap พิมพ์ได้
 *
 * ที่มา (21-07-2569): fieldmap มีพิกัดแถวจำนอง 3 แถว แต่หน้าจอกรอกฝังเลข 2
 * สมาชิกที่จำนอง 3 แปลง จึงกรอกได้แค่ 2 โดยไม่มีอะไรบอก และกระดาษเหลือแถวว่าง
 * ไม่มีเทสต์ข้อไหนจับได้เลย เพราะทุกใบขึ้น "✅ สำเร็จ" เหมือนกันหมด
 *
 * ตัวตรวจนี้เทียบ "จำนวนช่องบนหน้าจอ" กับ "จำนวนแถวใน fieldmap" — เกณฑ์มาจาก
 * คนละแหล่งกัน ไม่ใช่เอาโค้ดตรวจโค้ดตัวเอง
 *
 *   node test/browser/check_mort.js          # ไฟล์ในเครื่อง
 *   node test/browser/check_mort.js --live   # เว็บจริงบน Pages
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

(async () => {
  const srv = useLive ? null : await serve();
  const URL = useLive ? LIVE : `http://127.0.0.1:${srv.port}/index.html`;
  const proc = await launch();
  const t = await connect(URL);
  await sleep(useLive ? 3000 : 2000);

  let bad = 0;
  const say = (ok, msg) => { if (!ok) bad++; console.log(`  ${ok ? '✅' : '🔴'} ${msg}`); };

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

  /* เกณฑ์มาจาก fieldmap (= สิ่งที่กระดาษรับได้) ไม่ใช่ตัวเลขที่เทสต์คิดเอง */
  const n = await t.evaluate(`JSON.stringify({
    map: (()=>{let n=0; while(window.SNGK13_MAP['mort'+(n+1)+'_landtype']) n++; return n})(),
    ui:  (()=>{let n=0; while(document.getElementById('s13_mort'+(n+1)+'_landtype')) n++; return n})()
  })`);
  const { map, ui } = JSON.parse(n);
  console.log(`\nตารางจำนอง — fieldmap พิมพ์ได้ ${map} แถว · หน้าจอกรอกได้ ${ui} แถว`);
  say(ui === map, `จำนวนแถวตรงกัน (${ui}/${map})`);
  if (ui < map) console.log(`       เจ้าหน้าที่กรอกแถว ${ui + 1}-${map} ไม่ได้ ทั้งที่กระดาษมีที่ว่าง`);

  /* กรอกให้เต็มทุกแถว แล้วยืนยันว่าค่าไปถึง engine ครบ — ไม่ใช่แค่ช่องโผล่ */
  const vals = ['โฉนด', 'น.ส.3ก', 'ส.ป.ก.4-01', 'น.ส.3'];
  for (let i = 1; i <= ui; i++) {
    await t.setField('s13_mort' + i + '_landtype', vals[(i - 1) % vals.length]);
    await t.setField('s13_mort' + i + '_deed', '1000' + i);
    await t.setField('s13_mort' + i + '_value', '100000');
  }
  await sleep(500);
  await t.evaluate(`(()=>{const o=ContractFill.generateLoanRequest;
    ContractFill.generateLoanRequest=async function(d,op){window.__d=d;return o.call(this,d,op);};})()`);
  await t.evaluate(`document.getElementById('sngk13_status').innerHTML='';`);
  await t.clickButtonText('สร้าง PDF คำขอกู้ ส.-งก.13');

  let st = '';
  for (let i = 0; i < 40; i++) {
    st = await t.evaluate(`(()=>{const e=document.getElementById('sngk13_status');return e?e.textContent.trim():''})()`);
    if (/✅|⚠️|❌/.test(st)) break;
    await sleep(500);
  }
  say(/สำเร็จ/.test(st), `เอกสารสร้างได้ — ${st.slice(0, 50)}`);

  const got = JSON.parse(await t.evaluate(
    `JSON.stringify(Array.from({length:${map}},(_,i)=>(window.__d||{})['mort'+(i+1)+'_landtype']||null))`));
  const missing = got.map((v, i) => v ? null : i + 1).filter(Boolean);
  say(missing.length === 0, `ค่าทุกแถวถึง engine — ${JSON.stringify(got)}`);
  if (missing.length) console.log(`       แถวที่หายระหว่างทาง: ${missing.join(', ')}`);

  t.ws.close(); proc.kill(); if (srv) srv.server.close();
  console.log('\n' + (bad ? `🔴 ไม่ผ่าน ${bad} ข้อ` : '✅ ผ่านทุกข้อ'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.stack || e.message); process.exit(2); });
