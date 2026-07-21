/* ตรวจว่า "คำเตือนบนจอ" กับ "ด่านตอนกดพิมพ์" พูดตรงกัน
 *
 * ที่มา (ตรวจเชิงลึก 21-07-2569): บุคคลค้ำ + ยังไม่กรอกหุ้น
 *   จอบอก  "ยังไม่ได้กรอกจำนวนหุ้น — คำนวณเพดานตามระเบียบ ข้อ 8 ไม่ได้"
 *   ด่านบอก "วงเงิน 60,000 บาท เกินเพดาน 50,000 บาท (ข้อ 8(2))"
 * สองข้อความอ้างระเบียบข้อเดียวกันแต่ขัดกัน และจอเป็นฝ่ายผิด เพราะ ข้อ 8(2) ก.
 * ให้พื้น 50,000 อยู่แล้วโดยไม่ต้องรู้จำนวนหุ้น
 *
 * เจ้าหน้าที่เชื่อจอก่อนเสมอ — จอที่บอกกฎผิดจึงแพงกว่าจอที่ไม่บอกอะไรเลย
 *
 *   node test/browser/check_screen_vs_gate.js          # ไฟล์ในเครื่อง
 *   node test/browser/check_screen_vs_gate.js --live   # เว็บจริงบน Pages
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

/* [ชื่อ, หลักประกัน, หุ้น, วงเงิน] — เกณฑ์ตัดสินคือ "จอกับด่านต้องเห็นตรงกัน"
 * ไม่ได้ฮาร์ดโค้ดว่าเคสไหนควรบล็อก เพราะนั่นจะเป็นการเอาสูตรมาตรวจสูตรตัวเอง */
const CASES = [
  ['บุคคลค้ำ · ไม่กรอกหุ้น · 60,000 (เคสที่เจอ)', 'person', '', '60000'],
  ['บุคคลค้ำ · ไม่กรอกหุ้น · 40,000', 'person', '', '40000'],
  ['บุคคลค้ำ · หุ้น 5,000 หน่วย · 60,000', 'person', '5000', '60000'],
  ['หุ้นค้ำ · หุ้น 20,000 หน่วย · 100,000', 'share', '20000', '100000'],
  ['จำนอง · ไม่กรอกหุ้น · 500,000', 'mortgage', '', '500000'],
];

(async () => {
  const srv = useLive ? null : await serve();
  const URL = useLive ? LIVE : `http://127.0.0.1:${srv.port}/index.html`;
  const proc = await launch();
  const t = await connect(URL);
  await sleep(useLive ? 3000 : 2000);
  let bad = 0;

  for (const [name, sec, shares, P] of CASES) {
    await t.setField('principal', P);
    await t.setField('loanType', 'medium');
    await t.setField('years', '3');
    await t.setField('rate', '7');
    await t.clickButtonText('คำนวณ'); await sleep(500);
    await t.clickButtonText('พิมพ์สัญญากู้ ส.-งก.14'); await sleep(700);
    await t.evaluate(`(()=>{const s=document.querySelector('input[name="ct_security"][value=${JSON.stringify(sec)}]');
      if(s){s.checked=true;s.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
    await sleep(250);
    await t.setField('ct_shares', shares);
    await sleep(400);

    /* จอ = ข้อความในแถบเตือน · ด่าน = ผลของ DocGate.ceiling ตัวเดียวกับที่ปุ่มใช้ */
    const r = JSON.parse(await t.evaluate(`(()=>{
      const w = document.getElementById('ct_sec_warn');
      const screen = (w && w.style.display !== 'none') ? w.textContent.trim() : '';
      let gate = null;
      try { gate = DocGate.ceiling(getPrincipal()); } catch(e) { gate = 'ERR:'+e.message; }
      return JSON.stringify({screen, gate: gate || ''});
    })()`));

    const screenBlocks = /เกินเพดาน|คำนวณเพดาน.*ไม่ได้|ยังไม่ได้กรอกจำนวนหุ้น/.test(r.screen);
    const gateBlocks = !!r.gate;
    const ok = screenBlocks === gateBlocks;
    if (!ok) bad++;
    console.log(`  ${ok ? '✅' : '🔴'} ${name}`);
    console.log(`       จอ  : ${r.screen.slice(0, 78) || '(ไม่เตือน)'}`);
    console.log(`       ด่าน: ${String(r.gate).replace(/<[^>]*>/g, ' ').slice(0, 78) || '(ปล่อยผ่าน)'}`);
    if (!ok) console.log(`       ↳ จอ${screenBlocks ? 'ห้าม' : 'ปล่อย'} แต่ด่าน${gateBlocks ? 'ห้าม' : 'ปล่อย'} — เจ้าหน้าที่จะได้ข้อมูลผิด`);
  }

  t.ws.close(); proc.kill(); if (srv) srv.server.close();
  console.log('\n' + (bad ? `🔴 จอกับด่านขัดกัน ${bad} เคส` : '✅ จอกับด่านพูดตรงกันทุกเคส'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.stack || e.message); process.exit(2); });
