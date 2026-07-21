/* janong_ui.js — แผงกรอก + ปุ่มพิมพ์ หนังสือแสดงความจำนงขอกู้เงิน (1 หน้า)
 * self-contained: ใช้ global เดิม (calcCoop, fmt0, thDate, parseDate, ContractFill, ct_*, s13_debt*)
 * 🎯 ลดการพิมพ์สุด (ผู้จัดการ 17-07 / ยืนยันซ้ำ 20-07 "ติ๊กให้เลย · หนี้เดิม+หลักค้ำเติมอัตโนมัติ")
 *   - ผู้กู้ / วงเงิน / วัตถุประสงค์ / วันที่ → ดึงจากแผงด้านบน
 *   - หนี้เดิม 4 ประเภท → map จากตาราง "ข้อ 3 หนี้เงินกู้เดิม" ของ ส.-งก.13
 *   - หลักค้ำ → ติ๊กตามที่เลือกใน "หลักประกัน" ด้านบน
 *   - ความเห็นประธานกลุ่ม 7 ข้อ → ติ๊กค่าเริ่มต้นที่พบบ่อย แก้ได้ทุกข้อ
 * 🔑 id ช่อง = 'jn_' + <key ใน JANONG_MAP> → collect วนตาม fieldmap (แบบเดียวกับ ส.-งก.13)
 */
(function () {
  const mount = document.getElementById('janong_body');
  if (!mount) return;

  const box = 'box-sizing:border-box;padding:5px 7px;border:1px solid #d1d5db;border-radius:6px;font-size:13px';
  const cell = (id, ph, w) => '<input id="' + id + '"' + (ph ? ' placeholder="' + ph + '"' : '') + ' style="width:' + (w || '100%') + ';' + box + '">';
  const ro = (id, w) => '<input id="' + id + '" readonly title="เติมอัตโนมัติจากด้านบน" style="width:' + (w || '100%') + ';' + box + ';background:#f3f4f6;color:#374151">';
  const th = t => '<th style="border:1px solid #e5e7eb;padding:5px;background:#eef2f7;color:#1f2937;font-size:12px;font-weight:600">' + t + '</th>';
  const td = h => '<td style="border:1px solid #e5e7eb;padding:3px">' + h + '</td>';
  const secH = t => '<div style="font-weight:700;margin:16px 0 8px;color:#1f2937">' + t + '</div>';

  /* 🔒 ส่วน "ความเห็นของประธานกลุ่ม" (7 ข้อ + ชื่อผู้ใช้เงินแทน) ถูกตัดออกจากเว็บ (มติ ผจก 20-07-2569)
   *    เหตุ: ประธานกลุ่มติ๊กเองด้วยมือบนกระดาษ — ไม่มีใครกรอกผ่านเว็บ ใส่ไว้ก็รกและชี้นำ
   *    พิกัดช่องติ๊ก 18 ช่องยังอยู่ใน janong_fieldmap.js (GENERATED) — ถ้าจะเอากลับ
   *    แค่สร้าง radio ชื่อ jn_g_* ค่า = key ใน map แล้ว genJanongPDF จะเก็บให้เอง ไม่ต้องแก้ engine
   * หลักค้ำประกัน (ข้อ 2 ส่วนเจ้าหน้าที่สินเชื่อ) ↔ ค่าใน radio "ct_security" ด้านบน */
  const COLL = [['collPerson', 'บุคคล', 'person'], ['collProperty', 'อสังหาริมทรัพย์', 'mortgage'],
                ['collDeposit', 'สมุดเงินฝาก', 'deposit'], ['collShare', 'หุ้น', 'share']];
  /* หนี้เดิม 4 แถว ↔ ประเภทในตาราง ส.-งก.13 (ค่าที่ผู้ใช้เลือกใน s13_debt{i}_type) */
  const DEBT = [['Mid', 'ระยะปานกลาง'], ['Short', 'ระยะสั้น'], ['Trade', 'ลูกหนี้การค้า'], ['Other', 'ลูกหนี้อื่น']];

  let H = '';
  H += secH('ส่วนที่ 1 · คำขอ <span class="note" style="font-weight:400">(เติมจากด้านบนทั้งหมด)</span>');
  H += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
    '<label style="font-size:13px">วัตถุประสงค์ที่ 2 (ถ้ามี)</label>' + cell('jn_purpose2', 'เว้นว่างได้', '260px') +
    '<label style="font-size:13px">จำนวนเงิน</label>' + cell('jn_purpose2Amount', '', '120px') + '</div>';

  H += secH('ส่วนที่ 2 · ข้อเสนอแนะเจ้าหน้าที่สินเชื่อ ' +
    '<span class="note" style="font-weight:400">(ส่วน “ความเห็นประธานกลุ่ม” เว้นไว้ให้ติ๊กมือบนกระดาษ)</span>');
  H += '<div class="note" style="margin-bottom:6px">หนี้เดิม + หลักค้ำ เติมอัตโนมัติจาก ส.-งก.13 และหลักประกันด้านบน — แก้ทับได้</div>';
  H += '<div id="jn_debt_note" style="margin-bottom:6px;font-size:13px"></div>';
  H += '<table style="border-collapse:collapse;width:100%;max-width:620px"><tr>' + th('หนี้คงเหลือ') + th('จำนวนสัญญา') + th('จำนวนเงิน (บาท)') + '</tr>';
  DEBT.forEach(d => {
    H += '<tr>' + td('<span style="font-size:13px;padding-left:4px">' + d[1] + '</span>') +
      td(cell('jn_debt' + d[0] + 'Count', '', '90px')) + td(cell('jn_debt' + d[0] + 'Amount', '', '140px')) + '</tr>';
  });
  H += '</table>';
  H += '<div style="margin-top:10px;font-size:13px">หลักค้ำประกัน &nbsp;' +
    COLL.map(c => '<label style="margin-right:14px"><input type="radio" name="jn_g_coll" value="' + c[0] + '"> ' + c[1] + '</label>').join('') + '</div>';
  H += '<div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
    '<label style="font-size:13px">ประวัติ · ผิดสัญญา</label>' + cell('jn_lateCount', '', '80px') +
    '<label style="font-size:13px">ครั้ง · ชำระภายในกำหนด</label>' + cell('jn_onTimeCount', '', '80px') +
    '<label style="font-size:13px">ครั้ง</label></div>';
  H += '<div style="margin-top:10px">' + cell('jn_remark1', 'ความคิดเห็นอย่างอื่น (บรรทัด 1)') + '</div>';
  H += '<div style="margin-top:6px">' + cell('jn_remark2', 'ความคิดเห็นอย่างอื่น (บรรทัด 2)') + '</div>';

  mount.innerHTML = H;
  window.__JANONG_UI = { COLL: COLL, DEBT: DEBT };
})();

/* เปิดแผง + เติมค่าที่ระบบรู้แล้ว (หนี้เดิมจาก ส.-งก.13 · หลักค้ำจากหลักประกันด้านบน) */
function toggleJanong() {
  const p = document.getElementById('janongPanel');
  p.style.display = (p.style.display === 'none') ? 'block' : 'none';
  if (p.style.display !== 'block') return;
  janongAutofill();
  p.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* 🔒 SSOT ของการรวมหนี้เดิม ส.-งก.13 → หนังสือแสดงความจำนง
 * ทั้งฝั่งแสดงคำเตือนบนจอ และฝั่งด่านตอนพิมพ์ ต้องเรียกตัวนี้ตัวเดียว
 * ห้ามคำนวณซ้ำที่อื่น — ไม่งั้นจอเตือนอย่าง ด่านเช็คอีกอย่าง แล้วเพี้ยนจากกันเงียบ ๆ
 * (แพตเทิร์นเดียวกับ sngk13Alloc ที่เป็น SSOT ของตารางข้อ 2)
 *
 * unmapped = ประเภทหนี้ที่ ส.-งก.13 มี แต่ฟอร์มนี้ไม่มีแถวรองรับ (เช่น "ระยะยาว")
 *            → ถ้าปล่อยผ่าน เอกสารจะบอกว่าผู้กู้มีหนี้น้อยกว่าความจริง */
function janongAggDebt() {
  const U = window.__JANONG_UI || { DEBT: [] };
  const V = id => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
  const agg = {}, unmapped = [];
  for (let i = 1; i <= 2; i++) {
    const type = V('s13_debt' + i + '_type'), remain = V('s13_debt' + i + '_remain');
    if (!type) continue;
    const hit = U.DEBT.find(d => d[1] === type);
    if (!hit) { unmapped.push(type + (remain ? ' (' + remain + ')' : '')); continue; }
    const n = Number(String(remain).replace(/,/g, ''));
    const a = agg[hit[0]] = agg[hit[0]] || { count: 0, sum: 0 };
    a.count++; if (!isNaN(n)) a.sum += n;
  }
  return { agg, unmapped };
}

/* แถวที่เจ้าหน้าที่พิมพ์ยอดเองไว้ แต่ไม่มีหนี้ประเภทนั้นใน ส.-งก.13 แล้ว
 * → เอกสารจะนับหนี้ก้อนเดิมซ้ำ (ผู้ตรวจรับจับได้ 20-07) */
function janongOrphanDebt() {
  const U = window.__JANONG_UI || { DEBT: [] };
  const { agg } = janongAggDebt();
  const out = [];
  U.DEBT.forEach(d => {
    if (agg[d[0]]) return;
    const c = document.getElementById('jn_debt' + d[0] + 'Count');
    const m = document.getElementById('jn_debt' + d[0] + 'Amount');
    if ((c && c.value) || (m && m.value)) out.push(d[1]);
  });
  return out;
}

function janongAutofill() {
  const U = window.__JANONG_UI; if (!U) return;
  const V = id => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };

  /* หลักค้ำ ← radio หลักประกันด้านบน
   * 🔒 sync ตามเสมอ ไม่ใช่ "เติมเฉพาะตอนยังว่าง" — เดิมถ้าเปิดแผงตอนเลือกบุคคลค้ำ
   *    แล้วไปเปลี่ยนหลักประกันด้านบนทีหลัง ติ๊กจะค้างของเก่า ขัดกับสัญญา (บั๊ก 20-07)
   *    ผู้ใช้ยังติ๊กทับเองได้ — แต่พอหลักประกันด้านบนเปลี่ยน ให้ถือว่าของบนเป็นความจริง */
  const secEl = document.querySelector('input[name="ct_security"]:checked');
  if (secEl) {
    const hit = U.COLL.find(c => c[2] === secEl.value);
    document.querySelectorAll('input[name="jn_g_coll"]').forEach(el => {
      el.checked = !!(hit && el.value === hit[0]);
    });
  }

  /* หนี้เดิม ← ตาราง "ข้อ 3 หนี้เงินกู้เดิม" ของ ส.-งก.13 (รวมยอด+นับสัญญาตามประเภท)
   * ⚠️ ประเภทที่ ส.-งก.13 มีแต่ฟอร์มนี้ไม่มีแถวรองรับ (เช่น "ระยะยาว") จะ map ไม่ได้
   *    เดิมข้ามเงียบ → ตารางหนี้ว่างเปล่าเหมือนผู้กู้ไม่มีหนี้ · ตอนนี้แจ้งให้กรอกมือแทน */
  const { agg, unmapped } = janongAggDebt();
  /* 🔒 sync ตามเสมอ + ล้างของที่ไม่มีแล้ว — หลักเดียวกับติ๊กหลักค้ำด้านบน
   * เดิม `if (!c.value)` เขียนเฉพาะตอนช่องว่าง และวนเฉพาะประเภทที่มีใน agg
   *   → แก้ประเภทหนี้ใน ส.-งก.13 แล้วยอดเก่าค้าง = หนี้ 1 ก้อน พิมพ์เป็น 2 ก้อน ยอดเบิ้ล
   *   → แก้ยอดก็ไม่อัปเดต เพราะช่องไม่ว่างแล้ว = ไม่มีทางแก้ผ่านหน้าจอ (บั๊ก 20-07 ยืนยันด้วยการกดจริง)
   * ⚠️ ต้องไม่ทับค่าที่เจ้าหน้าที่พิมพ์เอง → ทำเครื่องหมาย dataset.auto ไว้เฉพาะช่องที่เราเติม
   *    ช่องที่คนแก้เอง (input event ด้านล่างลบเครื่องหมายทิ้ง) จะไม่ถูกแตะอีกเลย */
  const own = el => el && (!el.value || el.dataset.auto === '1');
  const orphan = [];   // ประเภทที่ไม่มีใน ส.-งก.13 แล้ว แต่ยังมียอดที่คนพิมพ์เองค้างอยู่
  U.DEBT.forEach(d => {
    const k = d[0], a = agg[k];
    const c = document.getElementById('jn_debt' + k + 'Count'),
          m = document.getElementById('jn_debt' + k + 'Amount');
    if (a) {
      if (own(c)) { c.value = String(a.count); c.dataset.auto = '1'; }
      if (own(m)) { m.value = a.sum ? fmt0(a.sum) : ''; m.dataset.auto = '1'; }
    } else {
      /* ประเภทนี้ไม่มีใน ส.-งก.13 แล้ว
       * · ที่ระบบเติมไว้ → ล้างได้เลย
       * · ที่คนพิมพ์เอง → ห้ามลบ (ของเขา) แต่ห้ามเงียบด้วย — ไม่งั้นหนี้เบิ้ลกลับมาทางนี้
       *   (ผู้ตรวจรับจับได้ 20-07: พิมพ์ทับเอง 99,999 แล้วเปลี่ยนประเภท → พิมพ์ออกมา 2 ก้อน) */
      if (c && c.dataset.auto === '1') { c.value = ''; delete c.dataset.auto; }
      if (m && m.dataset.auto === '1') { m.value = ''; delete m.dataset.auto; }
      if ((c && c.value) || (m && m.value)) orphan.push(d[1]);
    }
  });
  const note = document.getElementById('jn_debt_note');
  if (note) {
    const msgs = [];
    if (unmapped.length) {
      msgs.push('⚠️ หนี้เดิมประเภท “' + unmapped.join('”, “')
        + '” ไม่มีแถวรองรับในฟอร์มนี้ — กรุณากรอกลงแถวที่ใกล้เคียงเอง');
    }
    if (orphan.length) {
      msgs.push('⚠️ แถว “' + orphan.join('”, “') + '” มียอดที่กรอกเองค้างอยู่ '
        + 'แต่ไม่มีหนี้ประเภทนี้ใน ส.-งก.13 แล้ว — ถ้าไม่ลบ เอกสารจะนับหนี้ก้อนเดิมซ้ำ');
    }
    note.innerHTML = msgs.length
      ? '<span style="color:#c00;font-weight:700">' + msgs.join('<br>') + '</span>' : '';
  }
}

/* ข้อมูลต้นทางเปลี่ยน → sync แผงความจำนงทันที (ไม่ต้องรอเปิด/ปิดแผง)
 * ครอบ 2 ทาง: หลักประกันด้านบน (ติ๊กหลักค้ำ) · ตารางหนี้เดิมใน ส.-งก.13 (ยอด + คำเตือน)
 * ⚠️ ถ้าไม่ดักตารางหนี้ด้วย คำเตือน "ประเภทนี้ไม่มีแถวรองรับ" จะค้างของเก่า = เตือนผิด */
document.addEventListener('change', function (e) {
  const t = e.target; if (!t || !document.getElementById('janong_body')) return;
  if (t.name === 'ct_security' || /^s13_debt\d+_(type|remain)$/.test(t.id || '')) janongAutofill();
});

/* เจ้าหน้าที่พิมพ์ทับช่องหนี้เดิมเอง → ถือว่าช่องนั้นเป็นของคน ระบบเลิกยุ่งกับมันถาวร
 * (ไม่มีบรรทัดนี้ = sync รอบหน้าจะลบสิ่งที่คนเพิ่งพิมพ์ทิ้ง) */
document.addEventListener('input', function (e) {
  const t = e.target;
  if (t && /^jn_debt\w+(Count|Amount)$/.test(t.id || '')) delete t.dataset.auto;
});

async function genJanongPDF() {
  const st = document.getElementById('janong_status');
  const bad = m => { st.innerHTML = '<span style="color:#c00;font-weight:700">⚠️ ' + m + '</span>'; };
  try {
    if (!window.JANONG_MAP) return bad('ยังไม่ได้โหลด janong_fieldmap.js');
    const r = calcCoop();
    if (!r) return bad('กรอกเงินต้น + วันรับเงินกู้ แล้วกด "คำนวณ" ก่อน');
    const meetInp = document.getElementById('ct_meetdate');
    if (!meetInp.value) { meetInp.style.outline = '2px solid #c00'; meetInp.focus(); return bad('เลือก "วันที่ประชุมอนุมัติ" ก่อน (= วันที่ในหนังสือ)'); }
    meetInp.style.outline = '';

    const V = id => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };

    /* 🔒 ด่านร่วม (doc_gate.js) — ชื่อ/ทะเบียน/กลุ่ม/วัตถุประสงค์ + เพดานตาม ข้อ 8
     *    เดิมใบนี้ไม่ตรวจเพดาน ทั้งที่เป็นเอกสารที่คณะกรรมการใช้พิจารณาวงเงิน (บั๊ก 20-07) */
    const miss = DocGate.borrower('janong');
    if (miss.length) return bad('ยังขาดข้อมูลผู้กู้ (แผงด้านบน): ' + miss.join(' · '));
    const capMsg = DocGate.ceiling(r.P);
    if (capMsg) return bad(capMsg);

    /* 🔒 หนี้เดิมที่ตกจากเอกสาร — เดิมเตือนบนจออย่างเดียว แล้วพิมพ์ให้อยู่ดี
     * ถ้าเจ้าหน้าที่ไม่เห็นคำเตือน เอกสารจะบอกว่าผู้กู้มีหนี้น้อยกว่าความจริง
     * หลักเดียวกับข้อความล้นช่อง (ผู้จัดการเคาะ 21-07): เอกสารจะออกมาผิด = ไม่พิมพ์ */
    const _un = janongAggDebt().unmapped;
    if (_un.length) {
      return bad('หนี้เดิมประเภท “' + _un.join('”, “') + '” ไม่มีแถวรองรับในแบบฟอร์มนี้'
        + '<br><span style="font-weight:400">ถ้าพิมพ์ไป เอกสารจะบอกว่าผู้กู้มีหนี้น้อยกว่าความจริง — '
        + 'กรอกยอดลงแถวที่ใกล้เคียงในตารางหนี้เดิมก่อน แล้วสร้างใหม่</span>');
    }
    const _orph = janongOrphanDebt();
    if (_orph.length) {
      return bad('แถว “' + _orph.join('”, “') + '” มียอดค้างอยู่ แต่ไม่มีหนี้ประเภทนี้ใน ส.-งก.13 แล้ว'
        + '<br><span style="font-weight:400">ถ้าพิมพ์ไป เอกสารจะนับหนี้ก้อนเดิมซ้ำ — ลบยอดในแถวนั้นก่อน</span>');
    }

    let purpose = V('ct_purpose');
    if (purpose === '__OTHER__') purpose = V('ct_purpose_other');

    const num = v => { const n = Number(String(v).replace(/,/g, '')); return (v !== '' && !isNaN(n)) ? n : null; };
    const fmtA = v => { const n = num(v); return n != null ? fmt0(n) : v; };

    /* 🔒 ข้อ 1 + ข้อ 2 ต้องรวมได้ = วงเงินกู้ ห้ามเกิน
     * เดิม purpose1Amount = วงเงินเต็มเสมอ → กรอกข้อ 2 ด้วยแล้วเอกสารบอกยอดรวมเกินจริง (บั๊ก 20-07) */
    /* 🔒 ปัดที่จุดอ่าน — ช่องนี้รับทศนิยมได้ และถูกพิมพ์ด้วย fmt0 (ปัด)
     * ถ้าไม่ปัดตรงนี้ ข้อ 1 คิดจากค่าดิบ แต่ข้อ 2 พิมพ์ค่าปัด → บนกระดาษบวกเกินวงเงิน
     *   P=100,000 · ข้อ 2 = 1000.50 → พิมพ์ 99,000 + 1,001 = 100,001 เกินวงเงิน 1 บาท
     * ทั้งที่คอมเมนต์ด้านล่างระบุเจตนาไว้เองว่า "ข้อ 1 + ข้อ 2 ต้องรวมได้ = วงเงิน" */
    const p2 = Math.round(num(V('jn_purpose2Amount')) || 0);
    if (p2 > r.P) return bad('จำนวนเงินวัตถุประสงค์ที่ 2 (' + fmt0(p2) + ') เกินวงเงินกู้ (' + fmt0(r.P) + ')');
    if (p2 > 0 && !V('jn_purpose2')) return bad('กรอกจำนวนเงินวัตถุประสงค์ที่ 2 แล้ว แต่ยังไม่ได้ระบุว่าเพื่ออะไร');

    const data = {
      docDate: ContractFill.thaiDate(parseDate(meetInp.value)),
      name: V('ct_name'), reg: V('ct_reg'), group: V('ct_group'),
      amount: fmt0(r.P),
      purpose1Amount: fmt0(r.P - p2), purpose1: purpose,
    };

    // ช่องที่ผู้ใช้กรอกในแผงนี้ (id = 'jn_' + key ใน JANONG_MAP)
    Object.keys(window.JANONG_MAP).forEach(k => {
      if (k === 'baseDY' || window.JANONG_MAP[k].tick) return;
      const el = document.getElementById('jn_' + k);
      if (!el) return;
      const raw = (el.value || '').trim();
      if (raw === '') return;
      data[k] = /Amount$|Count$/.test(k) ? fmtA(raw) : raw;
    });

    // ช่องติ๊ก: radio ทุกกลุ่ม (ความเห็น 7 ข้อ + หลักค้ำ) → "✓"
    document.querySelectorAll('input[name^="jn_g_"]:checked').forEach(el => { data[el.value] = '✓'; });

    st.textContent = '⏳ กำลังสร้าง PDF...';
    const bytes = await ContractFill.generateJanong(data, {});
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    window.open(url, '_blank');
    st.innerHTML = '✅ สร้างหนังสือแสดงความจำนงสำเร็จ — เปิดแท็บใหม่แล้ว &nbsp;<a href="' + url +
      '" download="หนังสือแสดงความจำนง_' + ((data.name || 'ผู้กู้').replace(/\s+/g, '_')) + '.pdf">⬇ ดาวน์โหลด</a>';
  } catch (e) { st.innerHTML = '<span style="color:#c00">❌ ' + (e && e.message || e) + '</span>'; console.error(e); }
}
