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

function janongAutofill() {
  const U = window.__JANONG_UI; if (!U) return;
  const V = id => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };

  // หลักค้ำ ← radio หลักประกันด้านบน (ไม่ทับถ้าเลือกไว้แล้ว)
  const secEl = document.querySelector('input[name="ct_security"]:checked');
  const already = document.querySelector('input[name="jn_g_coll"]:checked');
  if (secEl && !already) {
    const hit = U.COLL.find(c => c[2] === secEl.value);
    if (hit) { const r = document.querySelector('input[name="jn_g_coll"][value="' + hit[0] + '"]'); if (r) r.checked = true; }
  }

  // หนี้เดิม ← ตาราง "ข้อ 3 หนี้เงินกู้เดิม" ของ ส.-งก.13 (รวมยอด+นับสัญญาตามประเภท)
  const agg = {};
  for (let i = 1; i <= 2; i++) {
    const type = V('s13_debt' + i + '_type'), remain = V('s13_debt' + i + '_remain');
    if (!type) continue;
    const hit = U.DEBT.find(d => d[1] === type);
    if (!hit) continue;
    const n = Number(String(remain).replace(/,/g, ''));
    const a = agg[hit[0]] = agg[hit[0]] || { count: 0, sum: 0 };
    a.count++; if (!isNaN(n)) a.sum += n;
  }
  Object.keys(agg).forEach(k => {
    const c = document.getElementById('jn_debt' + k + 'Count'), m = document.getElementById('jn_debt' + k + 'Amount');
    if (c && !c.value) c.value = String(agg[k].count);
    if (m && !m.value && agg[k].sum) m.value = fmt0(agg[k].sum);
  });
}

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
    const miss = [];
    if (!V('ct_name')) miss.push('ชื่อ-สกุล'); if (!V('ct_reg')) miss.push('เลขทะเบียน'); if (!V('ct_group')) miss.push('กลุ่มที่');
    if (miss.length) return bad('ยังขาดข้อมูลผู้กู้ (แผงด้านบน): ' + miss.join(' · '));

    let purpose = V('ct_purpose');
    if (purpose === '__OTHER__') purpose = V('ct_purpose_other');

    const num = v => { const n = Number(String(v).replace(/,/g, '')); return (v !== '' && !isNaN(n)) ? n : null; };
    const fmtA = v => { const n = num(v); return n != null ? fmt0(n) : v; };

    const data = {
      docDate: ContractFill.thaiDate(parseDate(meetInp.value)),
      name: V('ct_name'), reg: V('ct_reg'), group: V('ct_group'),
      amount: fmt0(r.P),
      purpose1Amount: fmt0(r.P), purpose1: purpose,
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
