/* ด่านหนี้เดิมของหนังสือแสดงความจำนง
 * ส.-งก.13 ให้เลือก "ระยะยาว" ได้ แต่ janong ไม่มีแถวรองรับ (Mid/Short/Trade/Other)
 * เดิม: เตือนบนจอแล้วพิมพ์ให้อยู่ดี → เอกสารบอกว่าผู้กู้มีหนี้น้อยกว่าจริง
 * ต้องแดงกับ "ระยะยาว" · ต้องเขียวกับ "ระยะปานกลาง" */
const path = require('path'), fs = require('fs'), http = require('http');
const REPO = '/Users/suchartonla-iad/Desktop/loan-calculator';
const LIVE = 'https://suchart-onlaiad-mac.github.io/loan-calculator/';
const { launch, connect, sleep } = require('./cdp');
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

const CASES = [
  { name: 'หนี้ "ระยะปานกลาง" (มีแถวรองรับ) → ต้องพิมพ์ได้', debt: 'ระยะปานกลาง', block: false },
  { name: 'ควบคุม: หนี้ "ระยะยาว" (ไม่มีแถวรองรับ) → ต้องไม่พิมพ์', debt: 'ระยะยาว', block: true },
  { name: 'ไม่กรอกหนี้เดิมเลย → ต้องพิมพ์ได้', debt: '', block: false },
];

(async () => {
  const useLive = process.argv.includes('--live');
  const srv = useLive ? null : await serve();
  const URL = useLive ? LIVE : `http://127.0.0.1:${srv.port}/index.html`;
  const proc = await launch();
  console.log('🌐 ' + URL + '\n');
  let bad = 0;
  for (const c of CASES) {
    const t = await connect(URL); await sleep(useLive ? 2500 : 1500);
    await t.setField('principal', '100000');
    await t.setField('loanType', 'medium');
    await t.setField('years', '3');
    await t.setField('rate', '7');
    await sleep(250);
    await t.clickButtonText('คำนวณ'); await sleep(600);
    await t.clickButtonText('พิมพ์สัญญากู้ ส.-งก.14'); await sleep(900);
    for (const [id, v] of Object.entries({
      ct_meetdate: '2026-08-09', ct_name: 'ทดสอบ ระบบ', ct_reg: '12345',
      ct_group: '7', ct_house: '99', ct_moo: '4',
    })) await t.setField(id, v);
    await t.evaluate(`(()=>{const s=document.querySelector('input[name="ct_security"][value="mortgage"]');
      if(s){s.checked=true; s.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
    await sleep(300);
    await t.evaluate(`(()=>{for(const id of ['ct_tambon','ct_purpose']){const s=document.getElementById(id);
      if(s&&!s.value){s.selectedIndex=1; s.dispatchEvent(new Event('change',{bubbles:true}));}}})()`);
    await sleep(300);

    // เปิดแผง ส.-งก.13 เพื่อกรอกหนี้เดิม
    await t.clickButtonText('คำขอกู้ ส.-งก.13'); await sleep(900);
    if (c.debt) {
      await t.setField('s13_debt1_type', c.debt);
      await t.setField('s13_debt1_remain', '50000');
      await sleep(600);
    }
    // เปิดแผงหนังสือแสดงความจำนง แล้วกดสร้าง
    await t.clickButtonText('หนังสือแสดงความจำนง'); await sleep(900);
    await t.evaluate(`(()=>{const e=document.getElementById('janong_status'); if(e) e.innerHTML='';})()`);
    await t.clickButtonText('สร้าง PDF หนังสือแสดงความจำนง');

    let status = '';
    for (let i = 0; i < 40; i++) {
      status = await t.evaluate(`(()=>{const e=document.getElementById('janong_status'); return e?e.textContent.trim():'<<ไม่พบ janong_status>>'})()`);
      if (/✅|⚠️|❌/.test(status)) break;
      await sleep(500);
    }
    const blocked = /⚠️|❌/.test(status);
    const ok = blocked === c.block;
    if (!ok) bad++;
    console.log(`  ${ok ? (c.block ? '🔴' : '✅') : '❌'} ${c.name}`);
    console.log(`       ${status.slice(0, 120) || '(ว่าง)'}`);
    t.ws.close();
  }
  proc.kill(); if (srv) srv.server.close();
  console.log('\n' + (bad ? `❌ ไม่ผ่าน ${bad} เคส` : '✅ ผ่านทุกเคส — ด่านแดงกับ "ระยะยาว" เขียวกับที่เหลือ'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.stack || e.message); process.exit(2); });
