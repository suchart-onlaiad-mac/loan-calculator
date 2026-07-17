/* sngk13_ui.js — แผงกรอก + ปุ่มพิมพ์ คำขอกู้ ส.-งก.13 (เติมหน้า 1-3)
 * self-contained: ใช้ global เดิม (calcCoop, getShares, fmt0, thDate, parseDate, CONTRACT_CONFIG, ContractFill, ct_*, g{i}_*)
 * 🎯 หลักการ: ลดการพิมพ์สุด — dropdown ได้ทำ · auto-fill ได้เติม (ผู้จัดการ 17-07)
 *   - ค่าหุ้น = 5% ของวงเงิน · เงินสด = 95% → auto read-only (ยืนยันกฎ 5% โดยผู้จัดการ + ตัวอย่างจริง 2 ใบ)
 *   - reuse: ผู้กู้/วงเงิน/วัตถุประสงค์/ระยะ + งวดชำระคืน(auto) + ผู้ค้ำ
 *   - dropdown: เดือน · ประเภทที่ดิน · ประเภทหนี้ · ประเภทผลิต/รายรับ
 *   - ระยะสั้น: ซ่อนช่องที่ไม่เกี่ยว (แผนงานปานกลาง + แถวใช้เงินสำรอง)
 * 🔑 id ช่อง = 's13_' + <key ใน SNGK13_MAP> → collect วนตาม fieldmap
 */
(function () {
  const mount = document.getElementById('sngk13_body');
  if (!mount) return;
  const CFG = window.CONTRACT_CONFIG || {};

  const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const LAND = ['โฉนด', 'น.ส.3ก', 'น.ส.3', 'ส.ป.ก.4-01'];
  const DEBTT = ['ระยะสั้น', 'ระยะปานกลาง', 'ระยะยาว'];
  const PRODT = ['ทำนา', 'ทำสวน', 'ทำไร่', 'เลี้ยงกุ้ง', 'เลี้ยงปลา', 'เลี้ยงสัตว์'];

  const box = 'box-sizing:border-box;padding:5px 7px;border:1px solid #d1d5db;border-radius:6px;font-size:13px';
  const cell = (id, ph, w) => '<input id="' + id + '"' + (ph ? ' placeholder="' + ph + '"' : '') + ' style="width:' + (w || '100%') + ';' + box + '">';
  const ro = (id, w) => '<input id="' + id + '" readonly title="คำนวณอัตโนมัติ" style="width:' + (w || '100%') + ';' + box + ';background:#f3f4f6;color:#374151">';
  const sel = (id, opts, w) => '<select id="' + id + '" style="width:' + (w || '100%') + ';' + box + ';background:#fff"><option value=""></option>' + opts.map(o => '<option>' + o + '</option>').join('') + '</select>';
  const dl = (id, list, ph, w) => '<input id="' + id + '" list="' + list + '"' + (ph ? ' placeholder="' + ph + '"' : '') + ' style="width:' + (w || '100%') + ';' + box + '">';
  const th = t => '<th style="border:1px solid #e5e7eb;padding:5px;background:#eef2f7;color:#1f2937;font-size:12px;font-weight:600">' + t + '</th>';
  const td = h => '<td style="border:1px solid #e5e7eb;padding:3px">' + h + '</td>';
  const secH = t => '<div style="font-weight:700;margin:16px 0 8px;color:#1f2937">' + t + '</div>';

  let H = '';
  // datalist ใช้ร่วม
  H += '<datalist id="dl_prod">' + PRODT.map(o => '<option>' + o + '</option>').join('') + '</datalist>';
  H += '<datalist id="dl_land">' + LAND.map(o => '<option>' + o + '</option>').join('') + '</datalist>';
  H += '<datalist id="dl_item"><option>เงินสด</option></datalist>';

  // ── ข้อ 1 (ต่อ) · แยกตามประเภท (สั้น=ฤดูกาล / ปานกลาง=แผนงาน) ──
  H += secH('ข้อ 1 (ต่อ) · ตามประเภทเงินกู้');
  H += '<div id="s13_typehint" class="note" style="margin-bottom:8px"></div>';
  H += '<div id="s13_short_box" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px;margin-bottom:8px">' +
    '<div style="font-weight:600;margin-bottom:6px">สำหรับฤดูกาลผลิต <span class="note" style="font-weight:400">(เฉพาะเงินกู้ระยะสั้น)</span></div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
    '<label style="font-size:13px">ตั้งแต่</label>' + cell('s13_seasonFrom', 'วันทำสัญญา', '150px') +
    '<label style="font-size:13px">ถึง</label>' + cell('s13_seasonTo', 'วันส่งชำระ', '150px') + '</div></div>';
  H += '<div id="s13_medium_box" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px">' +
    '<div style="font-weight:600;margin-bottom:6px">รายละเอียดเกี่ยวกับแผนงาน <span class="note" style="font-weight:400">(เฉพาะเงินกู้ระยะปานกลาง)</span></div>' +
    '<textarea id="s13_planDetail" rows="2" placeholder="บรรยายการใช้เงินกู้ เช่น ปรับปรุงบ่อ ซื้อลูกกุ้ง อาหาร ฯลฯ" style="width:100%;' + box + ';font-family:inherit"></textarea></div>';

  // ── ข้อ 2 · รายละเอียดการใช้เงินกู้ (เงินสด/ค่าหุ้น = auto · งวดชำระ = auto) ──
  H += secH('ข้อ 2 · รายละเอียดการใช้เงินกู้');
  H += '<div class="note" style="margin-bottom:6px">เงินสด (95%) · ชำระค่าหุ้น (5%) · งวดชำระคืน · รวมเงินกู้ = คำนวณอัตโนมัติจากวงเงิน</div>';
  H += '<table style="border-collapse:collapse;width:100%"><tr>' + th('รายการ') + th('เดือน') + th('จำนวน (บาท)') + '</tr>';
  H += '<tr>' + td('<span style="font-size:12px;padding-left:4px">1.</span> ' + dl('s13_use1_item', 'dl_item', 'เงินสด')) + td(sel('s13_use1_month', MONTHS)) + td(ro('s13_use1_amt')) + '</tr>';
  for (let i = 2; i <= 4; i++) H += '<tr class="s13_userow_extra">' + td('<span style="font-size:12px;padding-left:4px">' + i + '.</span> ' + cell('s13_use' + i + '_item')) + td(sel('s13_use' + i + '_month', MONTHS)) + td(cell('s13_use' + i + '_amt')) + '</tr>';
  H += '<tr>' + td('<span style="font-size:13px;padding-left:4px">5. ชำระค่าหุ้น</span>') + td('') + td(ro('s13_use5_amt')) + '</tr>';
  H += '</table>';
  H += '<div style="margin-top:8px"><label style="font-size:13px">เงินทุนของตนเอง (บาท) </label>' + cell('s13_ownFund', '', '160px') + '</div>';

  // ── ข้อ 3 · ประวัติการผลิต + หนี้เงินกู้ ──
  H += secH('ข้อ 3 · การผลิตในฤดูที่ล่วงมา');
  H += '<table style="border-collapse:collapse;width:100%"><tr>' + th('ประเภท') + th('เนื้อที่/จำนวน') + th('จำนวน (บาท)') + '</tr>';
  for (let i = 1; i <= 3; i++) H += '<tr>' + td(dl('s13_prod' + i + '_type', 'dl_prod', i === 1 ? 'เช่น เลี้ยงกุ้ง' : '')) + td(cell('s13_prod' + i + '_area', i === 1 ? '10 ไร่' : '')) + td(cell('s13_prod' + i + '_amt')) + '</tr>';
  H += '</table>';
  H += secH('ข้อ 3 · หนี้เงินกู้เดิม (ถ้ามี)');
  H += '<table style="border-collapse:collapse;width:100%"><tr>' + th('ประเภท') + th('หนังสือกู้ที่') + th('ต้นเงินคงเหลือ') + th('ค้าง-ต้นเงิน') + th('ค้าง-ดอกเบี้ย') + '</tr>';
  for (let i = 1; i <= 2; i++) H += '<tr>' + td(sel('s13_debt' + i + '_type', DEBTT)) + td(cell('s13_debt' + i + '_book')) + td(cell('s13_debt' + i + '_remain')) + td(cell('s13_debt' + i + '_owePrin')) + td(cell('s13_debt' + i + '_oweInt')) + '</tr>';
  H += '</table>';
  H += '<div style="margin-top:8px"><label style="font-size:13px">สาเหตุที่ค้างชำระ </label>' + cell('s13_debtReason', '', '60%') + '</div>';

  // ── ข้อ 4 · รายรับ-รายจ่าย ──
  H += secH('ข้อ 4 · รายรับ');
  H += '<table style="border-collapse:collapse;width:100%"><tr>' + th('ประเภท') + th('เนื้อที่/จำนวน') + th('ส่วนเพื่อขาย') + th('มูลค่า (บาท)') + '</tr>';
  for (let i = 1; i <= 3; i++) H += '<tr>' + td(dl('s13_inc' + i + '_type', 'dl_prod', '')) + td(cell('s13_inc' + i + '_area')) + td(cell('s13_inc' + i + '_forsale')) + td(cell('s13_inc' + i + '_value')) + '</tr>';
  H += '</table>';
  const EXP = ['ชำระคืนเงินกู้ระยะสั้นเพื่อผลผลิตหลัก', 'ชำระคืนเงินกู้ระยะสั้นเพื่อการอื่น', 'ชำระคืนเงินกู้ระยะปานกลาง', 'ชำระคืนเงินกู้อื่นๆ', 'ค่าใช้จ่ายในการเกษตร (เฉพาะปานกลาง)', 'ค่าใช้จ่ายของครัวเรือน', 'ค่าใช้จ่ายอื่นๆ'];
  H += secH('ข้อ 4 · รายจ่าย');
  H += '<table style="border-collapse:collapse;width:100%"><tr>' + th('รายการ') + th('จำนวน (บาท)') + '</tr>';
  EXP.forEach((t, k) => { H += '<tr>' + td('<span style="font-size:12px">' + (k + 1) + '. ' + t + '</span>') + td(cell('s13_exp' + (k + 1) + '_amt', '', '140px')) + '</tr>'; });
  H += '</table>';

  // ── ข้อ 5 ก · บุคคลค้ำ ──
  H += secH('ข้อ 5 ก · บุคคลค้ำประกัน');
  H += '<div class="note" style="margin-bottom:6px">เติมอัตโนมัติจากช่อง “ผู้ค้ำประกัน” ด้านบน (ถ้าเลือกบุคคลค้ำ) — แก้ได้</div>';
  H += '<table style="border-collapse:collapse;width:100%"><tr>' + th('ชื่อ') + th('กลุ่มที่/เลขทะเบียน') + th('ค้ำประกันผู้ใดอยู่') + '</tr>';
  for (let i = 1; i <= 2; i++) H += '<tr>' + td(cell('s13_g' + i + '_name')) + td(cell('s13_g' + i + '_group')) + td(cell('s13_g' + i + '_guar')) + '</tr>';
  H += '</table>';

  // ── ข้อ 5 ข · จำนอง ──
  H += secH('ข้อ 5 ข · จำนองอสังหาริมทรัพย์ (ถ้ามี)');
  H += '<div style="margin-bottom:6px"><label style="font-size:13px">ทะเบียนจำนองลำดับที่ </label>' + cell('s13_mortRegNo', '', '160px') + '</div>';
  H += '<table style="border-collapse:collapse;width:100%"><tr>' + th('ประเภทที่ดิน') + th('หนังสือแสดงสิทธิ') + th('เนื้อที่') + th('วงเงินจำนอง') + th('หนังสือกู้ระยะ/ที่') + th('ต้นเงินคงเหลือ') + '</tr>';
  for (let i = 1; i <= 2; i++) H += '<tr>' + td(dl('s13_mort' + i + '_landtype', 'dl_land', '')) + td(cell('s13_mort' + i + '_deed')) + td(cell('s13_mort' + i + '_area')) + td(cell('s13_mort' + i + '_value')) + td(cell('s13_mort' + i + '_book')) + td(cell('s13_mort' + i + '_remain')) + '</tr>';
  H += '</table>';

  mount.innerHTML = H;

  // auto ค่าหุ้น/เงินสด + ป้ายเงื่อนไข — อัปเดตเมื่อวงเงิน/ประเภทเปลี่ยน
  ['principal', 'years', 'rate', 'loanType', 'asofDate', 'startDate'].forEach(id => {
    const el = document.getElementById(id); if (el) el.addEventListener('input', function () { updateSngk13Auto(); updateSngk13Hints(); });
    if (el) el.addEventListener('change', function () { updateSngk13Auto(); updateSngk13Hints(); });
  });
  updateSngk13Auto();
  updateSngk13Hints();
})();

/* auto: ค่าหุ้น = 5% ของวงเงิน · เงินสด = 95% (read-only) */
function updateSngk13Auto() {
  let P = 0; try { const r = calcCoop(); P = r ? r.P : 0; } catch (e) { }
  const sh = Math.round(P * 0.05), cash = P - sh;
  const a5 = document.getElementById('s13_use5_amt'), a1 = document.getElementById('s13_use1_amt'), i1 = document.getElementById('s13_use1_item');
  if (a5) a5.value = P ? fmt0(sh) : '';
  if (a1) a1.value = P ? fmt0(cash) : '';
  if (i1 && !i1.value) i1.value = 'เงินสด';
}

/* ระยะสั้น → โชว์ฤดูกาล ซ่อนแผนงาน + ซ่อนแถวใช้เงินสำรอง · ปานกลาง → กลับกัน */
function updateSngk13Hints() {
  const sb = document.getElementById('s13_short_box'), mb = document.getElementById('s13_medium_box'),
    hint = document.getElementById('s13_typehint');
  if (!sb || !mb || !hint) return;
  const lt = document.getElementById('loanType');
  const label = (window.CONTRACT_CONFIG && window.CONTRACT_CONFIG.loanTypeLabel[lt ? lt.value : ''] || '');
  const isShort = label.indexOf('สั้น') >= 0;
  sb.style.display = isShort ? 'block' : 'none';
  mb.style.display = isShort ? 'none' : 'block';
  document.querySelectorAll('.s13_userow_extra').forEach(tr => tr.style.display = isShort ? 'none' : '');
  hint.innerHTML = isShort
    ? '📌 <b>ระยะสั้น</b> — กรอก “ฤดูกาลผลิต ตั้งแต่–ถึง” · เงินสด/ค่าหุ้นคำนวณให้อัตโนมัติ'
    : '📌 <b>ระยะปานกลาง</b> — เขียน “รายละเอียดแผนงาน” การใช้เงินกู้';
}

function toggleSngk13() {
  const p = document.getElementById('sngk13Panel');
  p.style.display = (p.style.display === 'none') ? 'block' : 'none';
  if (p.style.display === 'block') {
    for (let i = 1; i <= 2; i++) {   // prefill บุคคลค้ำจากแผงผู้ค้ำหลัก
      const src = document.getElementById('g' + i + '_name'), dst = document.getElementById('s13_g' + i + '_name');
      if (src && dst && !dst.value && src.value) dst.value = src.value.trim();
      const sg = document.getElementById('g' + i + '_group'), sr = document.getElementById('g' + i + '_reg'), dg = document.getElementById('s13_g' + i + '_group');
      if (dg && !dg.value) { const parts = [sg && sg.value.trim(), sr && sr.value.trim()].filter(Boolean); if (parts.length) dg.value = parts.join(' / '); }
    }
    updateSngk13Auto(); updateSngk13Hints();
    p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function genLoanRequestPDF() {
  const st = document.getElementById('sngk13_status');
  const bad = m => { st.innerHTML = '<span style="color:#c00;font-weight:700">⚠️ ' + m + '</span>'; };
  try {
    if (!window.SNGK13_MAP) return bad('ยังไม่ได้โหลด sngk13_fieldmap.js');
    const r = calcCoop();
    if (!r) return bad('กรอกเงินต้น + วันรับเงินกู้ แล้วกด "คำนวณ" ก่อน');
    const meetInp = document.getElementById('ct_meetdate');
    if (!meetInp.value) { meetInp.style.outline = '2px solid #c00'; meetInp.focus(); return bad('เลือก "วันที่ประชุมอนุมัติ" ก่อน (= วันที่ในคำขอ)'); }
    meetInp.style.outline = '';
    const meetDate = parseDate(meetInp.value);

    const V = id => { const el = document.getElementById(id); return el ? (el.value || '').trim() : ''; };
    const miss = [];
    if (!V('ct_name')) miss.push('ชื่อ-สกุล'); if (!V('ct_reg')) miss.push('เลขทะเบียน');
    if (!V('ct_group')) miss.push('กลุ่มที่'); if (!V('ct_house')) miss.push('บ้านเลขที่'); if (!V('ct_moo')) miss.push('หมู่ที่');
    if (miss.length) return bad('ยังขาดข้อมูลผู้กู้ (แผงด้านบน): ' + miss.join(' · '));

    const coop = await fetch(window.CONTRACT_ASSET_BASE + 'coop_data.json').then(x => x.json());
    const CFG = window.CONTRACT_CONFIG;
    const lt = document.getElementById('loanType').value;
    let purpose = document.getElementById('ct_purpose').value;
    if (purpose === '__OTHER__') purpose = (document.getElementById('ct_purpose_other').value || '').trim();

    const num = v => { const n = Number(String(v).replace(/,/g, '')); return (v !== '' && !isNaN(n)) ? n : null; };
    const fmtA = v => { const n = num(v); return n != null ? fmt0(n) : v; };

    const data = {
      loanRange: CFG.loanTypeLabel[lt] || '',
      docDate: ContractFill.thaiDate(meetDate),
      name: V('ct_name'), reg: V('ct_reg'), group: V('ct_group'),
      house: V('ct_house'), moo: V('ct_moo'), tambon: document.getElementById('ct_tambon').value,
      amount: fmt0(r.P), amountText: ContractFill.bahtText(r.P), purpose: purpose,
    };

    // auto: งวดชำระคืน (10 งวด) + รวม
    const prin = r.rows.filter(x => x.isPrincipal);
    for (let i = 0; i < prin.length && i < 10; i++) {
      data['rep' + (i + 1) + '_date'] = thDate(prin[i].date);
      data['rep' + (i + 1) + '_amt'] = fmt0(prin[i].principalPaid);
    }
    data.repTotal = fmt0(r.P);

    // input จากแผง (วน fieldmap key ที่มีช่อง)
    Object.keys(window.SNGK13_MAP).forEach(k => {
      if (k === 'baseDY') return;
      const el = document.getElementById('s13_' + k);
      if (!el) return;
      const raw = (el.value || '').trim();
      if (raw === '') return;
      data[k] = /_(amt|value|remain|owePrin|oweInt)$|ownFund/.test(k) ? fmtA(raw) : raw;
    });

    // 🔑 auto (override): ค่าหุ้น 5% · เงินสด 95% · รวมเงินกู้ = วงเงิน (source of truth = r.P)
    const sh = Math.round(r.P * 0.05);
    data.use5_amt = fmt0(sh);
    data.use1_amt = fmt0(r.P - sh);
    if (!data.use1_item) data.use1_item = 'เงินสด';
    data.useTotal = fmt0(r.P);

    // auto: ยอดรวม ข้อ 3/4
    const sumKeys = (pre, suf) => { let s = 0, any = false; for (let i = 1; i <= 7; i++) { const el = document.getElementById('s13_' + pre + i + suf); if (el) { const n = num(el.value); if (n != null) { s += n; any = true; } } } return any ? fmt0(s) : ''; };
    const pt = sumKeys('prod', '_amt'); if (pt) data.prodTotal = pt;
    const it = sumKeys('inc', '_value'); if (it) data.incTotal = it;
    const et = sumKeys('exp', '_amt'); if (et) data.expTotal = et;

    st.textContent = '⏳ กำลังสร้าง PDF...';
    const bytes = await ContractFill.generateLoanRequest(data, {});
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    window.open(url, '_blank');
    st.innerHTML = '✅ สร้างคำขอกู้ ส.-งก.13 สำเร็จ — เปิดแท็บใหม่แล้ว &nbsp;<a href="' + url + '" download="คำขอกู้_สงก13_' + ((data.name || 'ผู้กู้').replace(/\s+/g, '_')) + '.pdf">⬇ ดาวน์โหลด</a>';
  } catch (e) { st.innerHTML = '<span style="color:#c00">❌ ' + (e && e.message || e) + '</span>'; console.error(e); }
}
