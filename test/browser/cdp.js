/* ตัวขับ Chrome ผ่าน DevTools Protocol — ไม่มี dependency (Node 26 มี WebSocket ในตัว) */
const { spawn } = require('child_process');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
/* โปรไฟล์ + พอร์ต แยกต่อรอบ (ผูกกับ pid)
 * เดิมใช้ชื่อคงที่ → รันสองรอบติดกัน รอบหลังพัง ENOTEMPTY
 * เพราะ Chrome รอบก่อนยังปล่อยโฟลเดอร์ไม่หมดตอนรอบใหม่ลบทิ้ง
 * ⚠️ ไม่แตะ Chrome ที่ผู้จัดการใช้อยู่ — คนละโปรไฟล์คนละพอร์ตเสมอ */
const PORT = 9300 + (process.pid % 600);
const PROFILE = '/tmp/cdp-profile-loan-' + process.pid;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* เก็บกวาดโปรไฟล์เก่าตอน "เริ่ม" ไม่ใช่ตอนจบ
 * ตอนจบเก็บไม่ได้จริง — Chrome ยังปล่อยไฟล์ไม่หมดตอน process ปิด (ลองแล้ว เหลือค้าง 2/3 รอบ)
 * ตอนเริ่มเก็บได้แน่นอนเพราะ Chrome รอบก่อนตายไปแล้ว → ขยะไม่มีวันสะสม */
function sweepOld() {
  let n = 0;
  for (const d of fs.readdirSync('/tmp')) {
    if (!d.startsWith('cdp-profile-loan-')) continue;
    const pid = Number(d.split('-').pop());
    if (pid === process.pid) continue;
    try { process.kill(pid, 0); continue; } catch (e) { /* ไม่มี process นี้แล้ว = ลบได้ */ }
    try { fs.rmSync('/tmp/' + d, { recursive: true, force: true }); n++; } catch (e) { }
  }
  return n;
}

async function launch() {
  sweepOld();
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const sweep = () => { try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { } };
  process.on('exit', sweep);
  process.on('SIGINT', () => { sweep(); process.exit(130); });

  const p = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE,
    '--window-size=1280,900', 'about:blank',
  ], { stdio: 'ignore', detached: false });

  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      if (r.ok) return p;
    } catch (e) { }
    await sleep(250);
  }
  throw new Error('Chrome ไม่ยอมเปิดพอร์ต debug');
}

async function connect(url) {
  const r = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  const tab = await r.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const myId = ++id;
    pending.set(myId, m => m.error ? rej(new Error(method + ': ' + m.error.message)) : res(m.result));
    ws.send(JSON.stringify({ id: myId, method, params }));
  });

  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('JS: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };

  /* คลิกด้วยเมาส์จริงตามพิกัดของ element (ไม่ใช่ el.click()) */
  const clickSelector = async sel => {
    const box = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
      if(!e) return null; e.scrollIntoView({block:'center'});
      const r=e.getBoundingClientRect();
      return {x:Math.round(r.x+r.width/2), y:Math.round(r.y+r.height/2)}})()`);
    if (!box) throw new Error('ไม่พบ element: ' + sel);
    for (const type of ['mousePressed', 'mouseReleased']) {
      await send('Input.dispatchMouseEvent', {
        type, x: box.x, y: box.y, button: 'left', clickCount: 1,
      });
    }
    return box;
  };

  /* คลิกปุ่มจากข้อความบนปุ่ม */
  const clickButtonText = async text => {
    const ok = await evaluate(`(()=>{const b=[...document.querySelectorAll('button')]
      .find(x=>x.textContent.includes(${JSON.stringify(text)}) && x.offsetParent!==null);
      if(!b) return null; b.id = b.id || 'cdp_tmp_'+Math.floor(performance.now());
      b.scrollIntoView({block:'center'}); return b.id})()`);
    if (!ok) throw new Error('ไม่พบปุ่ม: ' + text);
    return clickSelector('#' + ok);
  };

  /* พิมพ์ลงช่อง แล้วยิง event เหมือนคนพิมพ์ */
  const setField = (id, value) => evaluate(
    `(()=>{const e=document.getElementById(${JSON.stringify(id)});
      if(!e) return 'ไม่พบช่อง ' + ${JSON.stringify(id)};
      e.focus(); e.value=${JSON.stringify(value)};
      e.dispatchEvent(new Event('input',{bubbles:true}));
      e.dispatchEvent(new Event('change',{bubbles:true}));
      e.blur(); return e.value})()`);

  const shot = async path => {
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
    return path;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  return { send, evaluate, clickSelector, clickButtonText, setField, shot, ws, tabId: tab.id };
}

module.exports = { launch, connect, sleep, PORT };
