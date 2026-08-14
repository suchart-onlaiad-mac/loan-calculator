/* debtcontact_ui.js — แผงกรอก + ปุ่มพิมพ์ บันทึกข้อตกลงการติดตามหนี้สิน (1 หน้า)
 * self-contained: ใช้ global เดิม (thDate, parseDate, ContractFill, ct_*, DocGate)
 *
 * เอกสารนี้ทำให้สหกรณ์ติดต่อ "บุคคลซึ่งลูกหนี้ระบุไว้เพื่อการทวงถามหนี้" ได้ตาม
 * พ.ร.บ.การทวงถามหนี้ 2558 ม.8 — ไม่มีเอกสารนี้ การโทรบอกญาติว่าสมาชิกเป็นหนี้
 * คือการฝ่าฝืน ม.8/ม.11 (ติดต่อได้แค่ถามที่อยู่ ห้ามแจ้งความเป็นหนี้)
 *
 * 🎯 ลดการพิมพ์: ชื่อ/ที่อยู่/ตำบล/อำเภอ ดึงจากแผงด้านบนทั้งหมด
 *    ❌ อายุ เติมให้ไม่ได้ — ไม่มีวันเกิดในฐานข้อมูลเลย (ทั้งระบบเก่าและทะเบียนกรมฯ)
 *    ❌ บุคคลที่ระบุ 3 ราย ไม่มีแหล่งข้อมูล — กรอกที่นี่ หรือเว้นให้เขียนมือหน้างาน
 * 🔑 id ช่อง = 'dc_' + <key ใน DEBTCONTACT_MAP> → collect วนตาม fieldmap (แบบเดียวกับใบอื่น)
 */
(function () {
  const mount = document.getElementById('debtcontact_body');
  if (!mount) return;

  const box = 'box-sizing:border-box;padding:5px 7px;border:1px solid var(--line);border-radius:6px;font-size:13px;background-color:var(--card2);color:var(--ink)';
  const cell = (id, ph, w) => '<input id="' + id + '"' + (ph ? ' placeholder="' + ph + '"' : '') + ' style="width:' + (w || '100%') + ';' + box + '">';
  const th = t => '<th style="border:1px solid var(--line);padding:5px;background:var(--fill);color:var(--on-fill);font-size:12px;font-weight:600">' + t + '</th>';
  const td = h => '<td style="border:1px solid #e5e7eb;padding:3px">' + h + '</td>';
  const secH = t => '<div style="font-weight:700;margin:16px 0 8px;color:var(--ink)">' + t + '</div>';

  let H = '';
  H += secH('ผู้ให้ถ้อยคำ <span class="note" style="font-weight:400">(ชื่อ/ที่อยู่/ตำบล เติมจากด้านบน — กรอกเฉพาะเบอร์)</span>');
  H += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
    '<label style="font-size:13px">โทรศัพท์</label>' + cell('dc_tel', 'เว้นว่าง = เขียนมือ', '180px') + '</div>';
  H += '<div class="note" style="margin-top:6px">ฟอร์มพิมพ์ “อำเภอ นครชัยศรี จังหวัดนครปฐม” ไว้ตายตัว — สมาชิกนอกอำเภอให้ขีดฆ่าแก้บนกระดาษ</div>';

  H += secH('บุคคลที่ระบุไว้เพื่อการทวงถามหนี้ ' +
    '<span class="note" style="font-weight:400">(ตาม พ.ร.บ.ทวงถามหนี้ ม.8 · เว้นว่างได้ ให้เขียนมือตอนเซ็น)</span>');
  H += '<table style="border-collapse:collapse;width:100%"><tr>' +
    th('') + th('ชื่อ-สกุล') + th('เกี่ยวข้องเป็น') + th('สถานที่ติดต่อ') + th('โทรศัพท์') + '</tr>';
  for (let n = 1; n <= 3; n++) {
    H += '<tr>' + td('<span style="font-size:13px;padding:0 6px">' + n + '</span>') +
      td(cell('dc_p' + n + 'Name', '', '190px')) +
      td(cell('dc_p' + n + 'Rel', '', '110px')) +
      td(cell('dc_p' + n + 'Addr', '', '250px')) +
      td(cell('dc_p' + n + 'Tel', '', '130px')) + '</tr>';
  }
  H += '</table>';
  H += '<div class="note" style="margin-top:8px">🔒 ต้องแจ้งบุคคลที่ระบุให้ทราบก่อน — ข้อ 3 ของหนังสือยืนยันว่าแจ้งแล้ว</div>';

  H += secH('ชื่อในวงเล็บใต้ลายเซ็น');
  H += '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
    '<label style="font-size:13px">ผู้บันทึกถ้อยคำ</label>' + cell('dc_signRecorderName', 'ชื่อเจ้าหน้าที่ (เว้นว่าง = เขียนมือ)', '260px') + '</div>';

  mount.innerHTML = H;
})();

/* เปิด/ปิดแผง — แบบเดียวกับ toggleJanong() (ไม่มีค่าอัตโนมัติให้เติมล่วงหน้า
 * เพราะช่องทั้งหมดที่เติมได้ ดึงตอนกดสร้าง PDF อยู่แล้ว) */
function toggleDebtcontact() {
  const p = document.getElementById('debtcontactPanel');
  p.style.display = (p.style.display === 'none') ? 'block' : 'none';
  if (p.style.display !== 'block') return;
  p.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* สร้าง PDF — ผ่านด่านร่วม DocGate ตัวเดียวกับอีก 5 ใบ (ห้ามเขียนด่านซ้ำที่นี่) */
async function genDebtcontactPDF() {
  const st = document.getElementById('debtcontact_status');
  const V = id => { const el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
  const bad = m => { st.innerHTML = '<span style="color:var(--red)">❌ ' + m + '</span>'; return null; };
  try {
    /* 🪤 DocGate.borrower() คืน "อาร์เรย์" ไม่ใช่ข้อความ — `if (miss)` จึงจริงเสมอ
     *    (อาร์เรย์ว่างก็ truthy) แล้วจะบล็อกทุกครั้งพร้อมข้อความว่างเปล่า
     *    ต้องเช็ค .length เหมือนอีก 5 ใบ (loan_calculator.html:1443, 1527, 1575) */
    const miss = DocGate.borrower('debtcontact');
    if (miss.length) return bad('ยังขาดข้อมูลผู้กู้ (แผงด้านบน): ' + miss.join(' · '));

    /* วันที่ในหนังสือ = วันเดียวกับที่ใบอื่นใช้ (วันที่ประชุมอนุมัติ) — เซ็นพร้อมชุดสัญญา
     * ⚠️ ห้ามใส่วันที่วันนี้แทนเงียบ ๆ ถ้ายังไม่ได้เลือก เอกสารจะลงวันผิดจากทั้งชุด */
    const meetInp = document.getElementById('ct_meetdate');
    if (!meetInp || !meetInp.value) {
      if (meetInp) { meetInp.style.outline = '2px solid #c00'; meetInp.focus(); }
      return bad('เลือก "วันที่ประชุมอนุมัติ" ก่อน (= วันที่ในหนังสือ)');
    }
    meetInp.style.outline = '';

    /* ฉบับ 13-08-2569: อำเภอ/จังหวัด พิมพ์ตายตัวบนฟอร์มแล้ว จึงไม่มีช่องให้เติม
     * และช่อง "อายุ" ถูกตัดทิ้ง (ไม่มีวันเกิดในฐาน เติมอัตโนมัติไม่ได้อยู่แล้ว) */
    const data = {
      docDate: ContractFill.thaiDate(parseDate(meetInp.value)),
      name: V('ct_name'),
      house: V('ct_house'), moo: V('ct_moo'), tambon: V('ct_tambon'),
      signGiverName: V('ct_name'),
    };

    /* ช่องที่ผู้ใช้กรอกในแผงนี้ (id = 'dc_' + key ใน DEBTCONTACT_MAP) — ทับค่าอัตโนมัติได้ */
    Object.keys(window.DEBTCONTACT_MAP).forEach(k => {
      if (k === 'baseDY') return;
      const el = document.getElementById('dc_' + k);
      if (!el) return;
      const raw = (el.value || '').trim();
      if (raw !== '') data[k] = raw;
    });

    /* 🔒 กรอกชื่อบุคคลแล้วต้องบอกด้วยว่าเกี่ยวข้องกันอย่างไร — ม.8 ยกเว้นให้เฉพาะ
     * "บุคคลซึ่งลูกหนี้ระบุไว้" ถ้าไม่รู้ความเกี่ยวข้อง จะพิสูจน์ไม่ได้ว่าระบุไว้จริง */
    for (let n = 1; n <= 3; n++) {
      const nm = V('dc_p' + n + 'Name'), rel = V('dc_p' + n + 'Rel');
      if (nm && !rel) return bad('บุคคลรายที่ ' + n + ' กรอกชื่อแล้ว แต่ยังไม่ได้ระบุว่าเกี่ยวข้องเป็นอะไร');
      if (rel && !nm) return bad('บุคคลรายที่ ' + n + ' ระบุความเกี่ยวข้องแล้ว แต่ยังไม่ได้กรอกชื่อ');
    }

    st.textContent = '⏳ กำลังสร้าง PDF...';
    const bytes = await ContractFill.generateDebtcontact(data, {});
    st.innerHTML = ContractFill.deliverPdf(bytes,
      'บันทึกข้อตกลงติดตามหนี้_' + ((data.name || 'ผู้กู้').replace(/\s+/g, '_')) + '.pdf',
      'สร้างบันทึกข้อตกลงการติดตามหนี้สินสำเร็จ');
  } catch (e) {
    st.innerHTML = '<span style="color:var(--red)">❌ ' + (e && e.message || e) + '</span>';
    console.error(e);
  }
}
