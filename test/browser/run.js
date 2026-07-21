#!/usr/bin/env node
/* ชุดทดสอบชั้นเอกสาร — กดจริงบน Chrome ตัวจริง (headless)
 *
 *   node test/browser/run.js            → ทดสอบไฟล์ในเครื่อง (index.html) ← ใช้ก่อน commit
 *   node test/browser/run.js --live     → ทดสอบเว็บจริงบน GitHub Pages   ← ใช้หลัง push
 *
 * ไม่มี dependency — ใช้ Chrome ที่ติดมากับเครื่อง + WebSocket ใน Node (≥22)
 * ต่างจาก test/run.js ตรงที่ชุดนั้นตรวจ "สูตร" ชุดนี้ตรวจ "หน้าเว็บ"
 *
 * 🔒 กฎเหล็กของ runner นี้:
 *    ถ้าเคสควบคุม (expect:'block') ไม่แดงครบทุกตัว → ปฏิเสธที่จะรายงานผลเขียว
 *    เพราะตัวตรวจที่ fail ไม่ได้ = ตัวตรวจที่ไม่มีอยู่จริง
 *    (บทเรียน 20-07-2569 — เขียนด่านที่ fail ไม่ได้ 2 ครั้งในวันเดียว)
 */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const { launch, connect, sleep } = require('./cdp');
const { BASE, CASES } = require('./cases');

const ROOT = path.resolve(__dirname, '../..');
const LIVE = 'https://suchart-onlaiad-mac.github.io/loan-calculator/';
const useLive = process.argv.includes('--live');

/* เสิร์ฟไฟล์ในเครื่องผ่าน http — ไม่ใช้ file://
 * เพราะ file:// โหลด base PDF ไม่ได้ (fetch ถูกบล็อก) แล้วเอกสารจะไม่ถูกสร้าง
 * ทั้งที่ด่านไม่ได้บล็อก = ผ่านแบบไม่ได้ทดสอบอะไรเลย */
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
};
function serve() {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, rel === '/' ? 'index.html' : rel);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        rq.writeHead(404); return rq.end('not found');
      }
      rq.writeHead(200, {
        'Content-Type': MIME[path.extname(f)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(f).pipe(rq);
    });
    s.listen(0, '127.0.0.1', () => res({ server: s, port: s.address().port }));
  });
}

/* สถานะของด่าน = ข้อความที่ bad()/ok() เขียนลง #sngk13_status ที่เดียว
 * อ่านตรงนั้น ไม่ใช่ regex กวาดทั้งหน้า (v1 เคยไปจับคอมเมนต์ใน <script> แล้วสรุปผิด) */
const STATUS = `(()=>{const e=document.getElementById('sngk13_status');
  return e ? e.textContent.trim() : '<<ไม่พบ #sngk13_status>>'})()`;

const FIELDS = ['s13_use1_amt', 's13_use2_amt', 's13_use3_amt', 's13_use4_amt', 's13_use5_amt'];

let URL = LIVE;   // ตั้งจริงใน main() — local จะได้ port ของเซิร์ฟเวอร์ชั่วคราว

async function runCase(c) {
  const ctx = Object.assign({}, BASE, c.over || {});
  ctx.identity = Object.assign({}, BASE.identity, (c.over || {}).identity || {});
  ctx.use = Object.assign({}, BASE.use, (c.over || {}).use || {});

  const t = await connect(URL);
  await sleep(useLive ? 2500 : 1500);

  // 1. ข้อมูลเงินกู้
  await t.setField('principal', ctx.principal);
  await t.setField('loanType', ctx.loanType);
  await t.setField('years', ctx.years);
  await t.setField('rate', ctx.rate);
  await sleep(250);
  await t.clickButtonText('คำนวณ');
  await sleep(600);

  // 2. เปิดฟอร์ม ส.-งก.14 + ข้อมูลตัวตน + หลักประกัน
  await t.clickButtonText('พิมพ์สัญญากู้ ส.-งก.14');
  await sleep(800);
  for (const [id, v] of Object.entries(ctx.identity)) await t.setField(id, v);
  await t.evaluate(`(()=>{const s=document.querySelector('input[name="ct_security"][value=${JSON.stringify(ctx.security)}]');
    if(s){s.checked=true; s.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
  await sleep(350);
  await t.evaluate(`(()=>{for(const id of ['ct_tambon','ct_purpose']){
    const s=document.getElementById(id); if(s&&!s.value){s.selectedIndex=1;
    s.dispatchEvent(new Event('change',{bubbles:true}));}}})()`);
  await sleep(350);

  // 3. เปิดแผง ส.-งก.13 + กรอกตารางข้อ 2
  await t.clickButtonText('คำขอกู้ ส.-งก.13');
  await sleep(900);
  for (const [id, v] of Object.entries(ctx.use)) await t.setField(id, v);
  await sleep(700);

  const vals = await t.evaluate(`(()=>{const o={};
    ${JSON.stringify(FIELDS)}.forEach(id=>{const e=document.getElementById(id); if(e) o[id]=e.value;});
    return o})()`);

  // 4. กดปุ่มสร้างเอกสาร
  await t.evaluate(`document.getElementById('sngk13_status').innerHTML='';`);
  await t.clickButtonText('สร้าง PDF คำขอกู้ ส.-งก.13');
  await sleep(useLive ? 3000 : 2200);
  const status = await t.evaluate(STATUS);

  const blocked = /⚠️/.test(status);
  const fails = [];

  if (c.expect === 'block') {
    if (!blocked) fails.push('ควรบล็อก แต่ผ่านไปได้ — สถานะ: ' + (status || '(ว่าง)'));
    else if (c.match && !c.match.test(status)) {
      fails.push('บล็อกด้วยเหตุผลอื่น — ได้: ' + status + ' | ต้องการ: ' + c.match);
    }
  } else {
    /* 🔒 ต้องเห็น "สำเร็จ" จริง — ห้ามนับผ่านเพราะ "ไม่มี ⚠️"
     * ตอนแรกเขียนแบบนั้น แล้วได้เขียวปลอม 2 ข้อ ทั้งที่หน้าจอขึ้น "❌ Failed to fetch"
     * (เอกสารไม่ได้ถูกสร้างเลย) — ไม่มี error ≠ ทำงานสำเร็จ */
    if (blocked) fails.push('ควรพิมพ์ได้ แต่โดนบล็อก — ' + status);
    else if (!/สำเร็จ/.test(status)) fails.push('ไม่ได้สร้างเอกสาร — สถานะ: ' + (status || '(ว่าง)'));
    if (c.check) { const m = c.check(vals, ctx); if (m) fails.push(m); }
  }

  return { name: c.name, expect: c.expect, status, vals, fails };
}

(async () => {
  let srv = null;
  if (!useLive) { srv = await serve(); URL = `http://127.0.0.1:${srv.port}/index.html`; }

  console.log('🌐 ทดสอบชั้นเอกสาร — ' + (useLive ? 'เว็บจริง (GitHub Pages)' : 'ไฟล์ในเครื่อง'));
  console.log('   ' + URL + '\n');

  const done = code => { if (srv) srv.server.close(); process.exit(code); };

  let proc;
  try { proc = await launch(); }
  catch (e) { console.error('❌ เปิด Chrome ไม่ได้: ' + e.message); done(2); }

  const results = [];
  for (const c of CASES) {
    let r;
    try { r = await runCase(c); }
    catch (e) { r = { name: c.name, expect: c.expect, status: '', vals: {}, fails: ['เทสต์พังเอง: ' + e.message] }; }
    results.push(r);
    const icon = r.fails.length ? '❌' : (r.expect === 'block' ? '🔴' : '✅');
    console.log(`  ${icon} ${r.name}`);
    if (r.status) console.log(`       ↳ ${r.status.slice(0, 110)}`);
    r.fails.forEach(f => console.log(`       ⚠️  ${f}`));
  }
  proc.kill();

  const controls = results.filter(r => r.expect === 'block');
  const controlsOk = controls.every(r => r.fails.length === 0);
  const failed = results.filter(r => r.fails.length).length;

  console.log('\n' + '─'.repeat(60));
  if (!controlsOk) {
    console.log('❌ เคสควบคุมไม่แดงครบ → ตัวตรวจเชื่อไม่ได้ → ไม่รายงานผลเขียว');
    console.log('   แก้ตัวตรวจก่อน อย่าเพิ่งเชื่อว่าเคสอื่นผ่านจริง');
    done(1);
  }
  console.log(`🔒 เคสควบคุมแดงครบ ${controls.length}/${controls.length} — ตัวตรวจจับ error ได้จริง`);
  console.log(`ผ่าน ${results.length - failed} / ${results.length} ข้อ` +
    (failed ? `  ❌ ไม่ผ่าน ${failed} ข้อ` : '  ✅ ผ่านทั้งหมด'));
  done(failed ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.stack || e.message); process.exit(2); });
