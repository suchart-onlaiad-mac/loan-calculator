/* ตรวจหมายเหตุแถวเงินต้นติดลบ (ทาง ง)
 * ต้องโผล่เฉพาะเคสที่มีแถวติดลบจริง · ห้ามโผล่กับอัตราที่สหกรณ์ใช้จริง */
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
  { name: 'เข้าเงื่อนไขครบ — 15% · 10 ปี · รับเงิน 1 ต.ค.', p: '100000', r: '15', y: '10', d: '2026-10-01', want: true },
  { name: 'อัตราที่สหกรณ์ใช้จริง — 7% · 10 ปี · 1 ต.ค.', p: '100000', r: '7', y: '10', d: '2026-10-01', want: false },
  { name: 'ดอกสูงแต่ปีน้อย — 15% · 5 ปี · 1 ต.ค.', p: '100000', r: '15', y: '5', d: '2026-10-01', want: false },
  { name: 'ดอกสูง ปีมาก แต่รับเงินสิ้นเดือน — 15% · 10 ปี · 28 ต.ค.', p: '100000', r: '15', y: '10', d: '2026-10-28', want: false },
];

(async () => {
  const srv = await serve();
  const URL = process.argv.includes('--live') ? LIVE : `http://127.0.0.1:${srv.port}/index.html`;
  const proc = await launch();
  let bad = 0;
  console.log('🌐 ' + URL + '\n');
  for (const c of CASES) {
    const t = await connect(URL);
    await sleep(2500);
    await t.setField('principal', c.p);
    await t.setField('rate', c.r);
    await t.setField('years', c.y);
    await t.setField('startDate', c.d);
    await t.setField('loanType', 'medium');
    await sleep(250);
    await t.clickButtonText('คำนวณ');
    await sleep(600);
    // ไปแท็บรายเดือน + โหมด annuity
    await t.evaluate(`(()=>{ showTab('monthly');
      const r=document.querySelector('input[name="mmode"][value="annuity"]');
      if(r){ r.checked=true; r.dispatchEvent(new Event('change',{bubbles:true})); }
      if(typeof calcMonthly==='function') calcMonthly(); })()`);
    await sleep(900);
    const info = await t.evaluate(`(()=>{
      const n=[...document.querySelectorAll('div,p,small')].map(e=>e.innerHTML).join('');
      const has=/ช่องเงินต้นเป็นค่าติดลบ/.test(n);
      const cells=[...document.querySelectorAll('#pane-monthly td')];
      const neg=cells.filter(td=>/^[-−]/.test(td.textContent.trim())).length;
      const rows=document.querySelectorAll('#pane-monthly tbody tr').length;
      return {has, neg, rows};
    })()`);
    const ok = info.has === c.want;
    if (!ok) bad++;
    console.log(`  ${ok ? '✅' : '🔴'} ${c.name}`);
    console.log(`       หมายเหตุโผล่: ${info.has} (ต้องการ ${c.want}) · ช่องติดลบ: ${info.neg} · แถวในตาราง: ${info.rows}`);
    t.ws.close();
  }
  proc.kill(); srv.server.close();
  console.log('\n' + (bad ? `🔴 ไม่ผ่าน ${bad} เคส` : '✅ ผ่านทุกเคส'));
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.stack || e.message); process.exit(2); });
