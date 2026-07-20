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
    '<label style="font-size:13px">ตั้งแต่</label>' + ro('s13_seasonFrom', '150px') +
    '<label style="font-size:13px">ถึง</label>' + ro('s13_seasonTo', '150px') + '</div>' +
    '<div class="note" style="margin-top:4px">= วันรับเงินกู้ → วันส่งชำระงวดสุดท้าย (คำนวณอัตโนมัติ)</div></div>';
  H += '<datalist id="dl_species"><option>ปลา</option><option>กุ้ง</option><option>ข้าว</option><option>ฝรั่ง</option><option>ชมพู่</option><option>มะม่วง</option><option>มะนาว</option></datalist>';
  H += '<div id="s13_medium_box" style="border:1px solid #e5e7eb;border-radius:8px;padding:10px">' +
    '<div style="font-weight:600;margin-bottom:6px">รายละเอียดเกี่ยวกับแผนงาน <span class="note" style="font-weight:400">(เฉพาะเงินกู้ระยะปานกลาง · ตัวเลขคำนวณอัตโนมัติจากวงเงิน)</span></div>' +
    '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:6px">' +
    '<label style="font-size:13px">ลักษณะการปรับพื้นที่</label>' + sel('s13_medMode', ['เลี้ยงสัตว์น้ำ (กุ้ง/ปลา)', 'ทำนา/ทำสวน'], '220px') +
    '<label style="font-size:13px">ชนิด</label>' + dl('s13_medSpecies', 'dl_species', 'เช่น ปลา/กุ้ง/ข้าว', '150px') + '</div>' +
    '<textarea id="s13_planDetail" rows="4" placeholder="กด/แก้วงเงินแล้วข้อความจะถูกสร้างอัตโนมัติ — แก้ไขเพิ่มเองได้" style="width:100%;' + box + ';font-family:inherit"></textarea>' +
    '<div class="note" style="margin-top:4px">ข้อความสร้างอัตโนมัติจากลักษณะ+ชนิด+วงเงิน (รวมทุกรายการ = วงเงินกู้เต็ม) · แก้เองได้ · <a href="javascript:void(0)" onclick="composeMediumPlan(true)">🔄 สร้างใหม่</a></div></div>';

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

  // auto ค่าหุ้น/เงินสด + ป้ายเงื่อนไข + แผนงานปานกลาง — อัปเดตเมื่อวงเงิน/ประเภทเปลี่ยน
  ['principal', 'years', 'rate', 'loanType', 'asofDate', 'startDate'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const h = function () { updateSngk13Auto(); updateSngk13Hints(); composeMediumPlan(false); };
    el.addEventListener('input', h); el.addEventListener('change', h);
  });
  ['s13_medMode', 's13_medSpecies'].forEach(id => {
    const el = document.getElementById(id); if (!el) return;
    const h = function () { composeMediumPlan(false); };
    el.addEventListener('input', h); el.addEventListener('change', h);
  });
  /* กรอกแถว 2-4 → แถว 1 (เงินสด) ต้องลดตามทันทีบนจอ
   * ไม่มีบรรทัดนี้ = จอค้างที่ 95% แต่กระดาษพิมพ์ค่าที่ลดแล้ว = สองจอไม่ตรงกัน */
  for (let i = 2; i <= 4; i++) {
    const el = document.getElementById('s13_use' + i + '_amt'); if (!el) continue;
    const h = function () { updateSngk13Auto(); };
    el.addEventListener('input', h); el.addEventListener('change', h);
  }
  // เจ้าหน้าที่พิมพ์ชื่อรายการแถว 1 เอง → ระบบเลิกยุ่งกับช่องนั้น (ไม่ล้างของเขา)
  const i1u = document.getElementById('s13_use1_item');
  if (i1u) i1u.addEventListener('input', function () { delete i1u.dataset.auto; });

  // ผู้ใช้พิมพ์แก้เอง → ตั้ง dirty กันระบบเขียนทับ (ยกเว้นกด "สร้างใหม่")
  const pd = document.getElementById('s13_planDetail');
  if (pd) pd.addEventListener('input', function () { pd.dataset.dirty = '1'; });
  updateSngk13Auto();
  updateSngk13Hints();
})();

/* auto-compose narrative แผนงานปานกลาง — รวมทุกรายการ = วงเงินกู้เต็ม (P)
 *   หุ้น 5% (คงที่) · รถตักดิน ≈15% ของวงเงิน → ชั่วโมง (×1,000) · ที่เหลือแบ่งตามลักษณะ
 *   สัตว์น้ำ: พันธุ์ 30% + อาหาร 70% ของที่เหลือ · พืช: พันธุ์ 30% + ปุ๋ย 45% + ยา 25%
 * force=true → เขียนทับแม้ผู้ใช้แก้แล้ว (ปุ่ม 🔄) · force=false → ไม่ทับถ้า dirty */
const SNGK13_ALLOC = { sharePct: 0.05, excavPct: 0.15, excavRate: 1000,
  water: { seed: 0.30, feed: 0.70 }, crop: { seed: 0.30, fert: 0.45, chem: 0.25 } };
function composeMediumPlan(force) {
  const ta = document.getElementById('s13_planDetail'); if (!ta) return;
  const lt = document.getElementById('loanType');
  const isShort = (window.CONTRACT_CONFIG && window.CONTRACT_CONFIG.loanTypeLabel[lt ? lt.value : ''] || '').indexOf('สั้น') >= 0;
  if (isShort) return;                                  // ปานกลางเท่านั้น
  if (!force && ta.dataset.dirty === '1') return;       // ผู้ใช้แก้เอง — ไม่ทับ
  let r = null; try { r = calcCoop(); } catch (e) { }
  const P = r ? r.P : 0; if (!P) { if (force) ta.value = ''; return; }
  const A = SNGK13_ALLOC;
  const share = Math.round(P * A.sharePct);
  const hrs = Math.max(1, Math.round(P * A.excavPct / A.excavRate));
  const excav = hrs * A.excavRate;
  const rest = P - share - excav;
  const modeEl = document.getElementById('s13_medMode');
  const isWater = (modeEl && modeEl.value || 'เลี้ยงสัตว์น้ำ (กุ้ง/ปลา)').indexOf('สัตว์น้ำ') >= 0;
  let sp = (document.getElementById('s13_medSpecies') || {}).value || '';
  if (!sp) sp = isWater ? 'ปลา' : 'ข้าว';
  const B = n => fmt0(n);
  const head = 'ค่าจ้างรถตักดินชั่วโมงละ ' + B(A.excavRate) + ' บาท เป็นเวลา ' + hrs + ' ชั่วโมง เป็นเงิน ' + B(excav) + ' บาท ';
  const tail = ' ลงทุนซื้อหุ้นเพิ่ม ' + B(share) + ' บาท (5% ของเงินกู้)';
  let mid;
  if (isWater) {
    const seed = Math.round(rest * A.water.seed), feed = rest - seed;
    mid = 'ค่าพันธุ์' + sp + ' ' + B(seed) + ' บาท ค่าอาหาร' + sp + ' ' + B(feed) + ' บาท';
  } else {
    const seed = Math.round(rest * A.crop.seed), fert = Math.round(rest * A.crop.fert), chem = rest - seed - fert;
    mid = 'ค่าพันธุ์' + sp + ' ' + B(seed) + ' บาท ค่าปุ๋ย ' + B(fert) + ' บาท ค่ายาสำหรับฉีดบำรุงและป้องกันแมลง ' + B(chem) + ' บาท';
  }
  ta.value = head + mid + tail;
  ta.dataset.dirty = '';
}

/* 🔒 SSOT ของการจัดสรรตาราง "ข้อ 2" — ทั้งจอและกระดาษต้องเรียกตัวนี้ตัวเดียว
 * กติกา (ผู้จัดการ 20-07-2569): ค่าหุ้น 5% ตายตัว · แถว 1-4 รวมกันได้ 95%
 * คืน null เมื่อยังไม่มีวงเงิน · cashLeft < 0 = กรอกแถว 2-4 เกินส่วนที่จัดสรรได้
 * ⚠️ ห้ามคำนวณสูตรนี้ซ้ำที่อื่น — เดิมจอคิดแบบหนึ่ง (แถว 1 = 95% เสมอ) กระดาษคิดอีกแบบ
 *    ก็จะได้ "เห็น 95,000 บนจอ แต่พิมพ์ 75,000 บนกระดาษ" โดยไม่มีอะไรเตือน */
function sngk13Alloc(P) {
  if (!P) return null;
  const num2 = v => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return (String(v).trim() !== '' && !isNaN(n)) ? n : 0; };
  let extra = 0;
  for (let i = 2; i <= 4; i++) {
    const el = document.getElementById('s13_use' + i + '_amt');
    if (!el) continue;
    // แถวที่ถูกซ่อน (ระยะสั้น) ไม่นับ — ต้องตรงกับตัวเก็บค่าตอนสร้าง PDF
    let hidden = false;
    for (let n = el; n && n.id !== 'sngk13Panel'; n = n.parentElement) {
      if (n.style && n.style.display === 'none') { hidden = true; break; }
    }
    if (!hidden) extra += num2(el.value);
  }
  const sh = Math.round(P * 0.05), cash95 = P - sh;
  return { share: sh, cash95: cash95, extra: extra, cashLeft: cash95 - extra };
}

/* auto: ค่าหุ้น = 5% ของวงเงิน · เงินสด = ส่วนที่เหลือหลังหักแถว 2-4 · ฤดูกาลผลิต (ระยะสั้น) — read-only */
function updateSngk13Auto() {
  let r = null; try { r = calcCoop(); } catch (e) { }
  const P = r ? r.P : 0;
  const al = sngk13Alloc(P);
  const a5 = document.getElementById('s13_use5_amt'), a1 = document.getElementById('s13_use1_amt'), i1 = document.getElementById('s13_use1_item');
  if (a5) a5.value = al ? fmt0(al.share) : '';
  if (a1) a1.value = (al && al.cashLeft > 0) ? fmt0(al.cashLeft) : '';
  /* ชื่อแถว 1 เติมอัตโนมัติเฉพาะตอนมีเงินสดจริง · ทำเครื่องหมาย auto ไว้
   * เพื่อให้ตอนไม่มีเงินสด (แถว 2-4 กิน 95% พอดี) ล้างได้โดยไม่ไปลบชื่อที่คนพิมพ์เอง
   * — แพตเทิร์นเดียวกับผู้ค้ำและหนี้เดิม (dataset.auto) */
  if (i1) {
    const wantCash = !!(al && al.cashLeft > 0);
    if (wantCash) { if (!i1.value) { i1.value = 'เงินสด'; i1.dataset.auto = '1'; } }
    else if (i1.dataset.auto === '1') { i1.value = ''; delete i1.dataset.auto; }
  }
  // ฤดูกาลผลิต — เฉพาะระยะสั้น
  const lt = document.getElementById('loanType');
  const isShort = (window.CONTRACT_CONFIG && window.CONTRACT_CONFIG.loanTypeLabel[lt ? lt.value : ''] || '').indexOf('สั้น') >= 0;
  let startD = null; try { startD = parseDate(document.getElementById('startDate').value); } catch (e) { }
  const prin = r ? r.rows.filter(x => x.isPrincipal) : [];
  const sf = document.getElementById('s13_seasonFrom'), stt = document.getElementById('s13_seasonTo');
  if (sf) sf.value = (isShort && startD) ? thDate(startD) : '';
  if (stt) stt.value = (isShort && prin.length) ? thDate(prin[prin.length - 1].date) : '';
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

  /* 🔑 การซ่อน/โชว์แถว 2-4 เปลี่ยน "ผลบวกที่นับได้" → ต้องคำนวณแถว 1 ใหม่ทุกครั้ง
   * ต้องเรียก "หลัง" ตั้ง display เสร็จ เพราะ sngk13Alloc อ่านสถานะการซ่อนจาก DOM
   * เดิม handler เรียก Auto ก่อน Hints → จอถือค่าที่คิดตอนสถานะการซ่อนยังเป็นแบบเก่า
   *   สลับ ระยะสั้น→ปานกลาง แล้วจอโชว์ 95,000 แต่กระดาษพิมพ์ 65,000 (ผู้ตรวจรับจับได้ 20-07)
   * ⚠️ updateSngk13Auto ต้องไม่เรียกกลับมาที่นี่ ไม่งั้นวนไม่จบ */
  updateSngk13Auto();
}

/* ผู้ค้ำใน ส.-งก.13 ← แผงผู้ค้ำด้านบน (ของบนเป็นความจริง)
 * 🔒 sync ตามเสมอ + ล้างเมื่อหลักประกันไม่ใช่บุคคลค้ำ — หลักเดียวกับติ๊กหลักค้ำใน janong_ui.js
 * เดิมเติมครั้งเดียวตอนเปิดแผง (`!dst.value`) และไม่เคยดู ct_security เลย → 2 อาการ (บั๊ก 20-07):
 *   ก) แก้ชื่อผู้ค้ำด้านบนทีหลัง → คำขอกู้พิมพ์ชื่อเก่า ขณะหนังสือค้ำพิมพ์ชื่อใหม่ = สองใบคนละชื่อ
 *   ข) เปลี่ยนหลักประกันเป็นหุ้นตนเอง/จำนอง → คำขอกู้ยังพิมพ์ชื่อผู้ค้ำจากซากเดิม
 * ⚠️ ไม่ทับค่าที่เจ้าหน้าที่พิมพ์เอง — ทำเครื่องหมาย dataset.auto เฉพาะช่องที่เราเติม */
function syncSngk13Guarantors() {
  const secEl = document.querySelector('input[name="ct_security"]:checked');
  const isPerson = !secEl || secEl.value === 'person';
  const own = el => el && (!el.value || el.dataset.auto === '1');
  const put = (el, v) => {
    if (!own(el)) return;
    if (v) { el.value = v; el.dataset.auto = '1'; }
    else if (el.dataset.auto === '1') { el.value = ''; delete el.dataset.auto; }
  };
  for (let i = 1; i <= 2; i++) {
    const src = document.getElementById('g' + i + '_name');
    const sg = document.getElementById('g' + i + '_group'), sr = document.getElementById('g' + i + '_reg');
    const parts = [sg && sg.value.trim(), sr && sr.value.trim()].filter(Boolean);
    put(document.getElementById('s13_g' + i + '_name'),
        isPerson && src ? src.value.trim() : '');
    put(document.getElementById('s13_g' + i + '_group'),
        isPerson && parts.length ? parts.join(' / ') : '');
  }
}

/* ต้นทางเปลี่ยน → sync ทันที ไม่ต้องรอเปิด/ปิดแผง · คนพิมพ์ทับเอง → ระบบเลิกยุ่งกับช่องนั้น */
document.addEventListener('change', function (e) {
  const t = e.target; if (!t || !document.getElementById('sngk13Panel')) return;
  if (t.name === 'ct_security' || /^g[12]_(name|group|reg)$/.test(t.id || '')) syncSngk13Guarantors();
});
document.addEventListener('input', function (e) {
  const t = e.target;
  if (t && /^s13_g[12]_(name|group)$/.test(t.id || '')) delete t.dataset.auto;
  else if (t && /^g[12]_(name|group|reg)$/.test(t.id || '') && document.getElementById('sngk13Panel')) syncSngk13Guarantors();
});

function toggleSngk13() {
  const p = document.getElementById('sngk13Panel');
  p.style.display = (p.style.display === 'none') ? 'block' : 'none';
  if (p.style.display === 'block') {
    syncSngk13Guarantors();
    // default ลักษณะการปรับพื้นที่จากวัตถุประสงค์ (ถ้ายังไม่เลือก)
    const modeEl = document.getElementById('s13_medMode');
    if (modeEl && !modeEl.value) {
      const pv = (document.getElementById('ct_purpose') || {}).value || '';
      modeEl.value = /เลี้ยง|ปลา|กุ้ง/.test(pv) ? 'เลี้ยงสัตว์น้ำ (กุ้ง/ปลา)' : 'ทำนา/ทำสวน';
    }
    updateSngk13Auto(); updateSngk13Hints(); composeMediumPlan(false);
    p.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/* greedy word-wrap narrative → บรรทัด (max ต่อบรรทัดต่างกัน: บรรทัด 1 สั้น · 2-3 เต็ม)
 * วัดด้วย canvas + ฟอนต์ overlay ชุดเดียวกับ engine → บรรทัดพอดี ไม่ต้องย่อฟอนต์ · เกิน 3 บรรทัด = อัดลงบรรทัด 3 */
function wrapSngk13Plan(text, maxes, size) {
  const cv = wrapSngk13Plan._cv || (wrapSngk13Plan._cv = document.createElement('canvas'));
  const ctx = cv.getContext('2d');
  ctx.font = size + 'px "THSarabunOverlay"';
  const w = s => ctx.measureText(s).width;
  const toks = text.split(/\s+/).filter(Boolean);
  const lines = ['', '', ''];
  let li = 0;
  for (const t of toks) {
    if (li > 2) { lines[2] += ' ' + t; continue; }              // ล้น 3 บรรทัด → ต่อท้ายบรรทัดสุดท้าย
    const trial = lines[li] ? lines[li] + ' ' + t : t;
    if (w(trial) <= maxes[li] || !lines[li]) lines[li] = trial;  // token เดียวเกิน max ก็ต้องวางไว้บรรทัดนั้น
    else { li++; if (li > 2) { lines[2] += ' ' + t; } else lines[li] = t; }
  }
  return lines;
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

    /* 🔒 ด่านร่วม (doc_gate.js) — เดิมใบนี้ตรวจน้อยที่สุดในบรรดา 5 ใบ
     *    ไม่ตรวจตำบล · ไม่ตรวจวัตถุประสงค์ · ไม่ตรวจเพดาน · ไม่ตรวจความจุตารางงวด
     *    ผลคือ ส.-งก.14 บล็อก แต่ ส.-งก.13 ในแฟ้มเดียวกันพิมพ์ผ่าน = เอกสารขัดกันเอง (บั๊ก 20-07) */
    const miss = DocGate.borrower('sngk13');
    if (miss.length) return bad('ยังขาดข้อมูลผู้กู้ (แผงด้านบน): ' + miss.join(' · '));
    const capMsg = DocGate.ceiling(r.P);
    if (capMsg) return bad(capMsg);
    const ovf = DocGate.capacity('sngk13', r.rows.filter(x => x.isPrincipal).length);
    if (ovf) return bad(ovf);

    /* 🔒 ขัดกันเองระหว่างเอกสาร: หลักประกันไม่ใช่บุคคลค้ำ แต่คำขอกู้ยังระบุผู้ค้ำ
     * syncSngk13Guarantors() ล้างให้เฉพาะช่องที่ระบบเติม — ช่องที่เจ้าหน้าที่พิมพ์เองจะไม่ถูกแตะ
     * ถ้าปล่อยผ่าน คำขอกู้จะบอกว่ามีบุคคลค้ำ ขณะที่สัญญาบอกว่าใช้หลักประกันอื่น (ผู้ตรวจรับจับได้ 20-07) */
    const secEl2 = document.querySelector('input[name="ct_security"]:checked');
    if (secEl2 && secEl2.value !== 'person') {
      const stuck = [1, 2].filter(i => V('s13_g' + i + '_name'));
      if (stuck.length) {
        return bad('หลักประกันที่เลือกไว้ไม่ใช่ “บุคคลค้ำ 2 คน” แต่ข้อ 5 ก ยังมีชื่อผู้ค้ำคนที่ '
          + stuck.join(' และ ') + ' อยู่<br><span style="font-weight:400">ลบชื่อออก '
          + 'หรือเปลี่ยนหลักประกันด้านบนให้ตรงกัน — ไม่งั้นคำขอกู้จะขัดกับสัญญาในแฟ้มเดียวกัน</span>');
      }
    }

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

    /* input จากแผง (วน fieldmap key ที่มีช่อง)
     * 🔒 ข้ามช่องที่ "ถูกซ่อนอยู่ตอนนี้" — ซ่อน = ไม่เกี่ยวกับประเภทเงินกู้ที่เลือก
     *    เดิม updateSngk13Hints() ซ่อนแถวใช้เงิน 2-4 ด้วย display:none แต่ไม่ล้างค่า
     *    → กรอกตอนปานกลาง แล้วสลับเป็นระยะสั้น ค่ายังลง PDF ทั้งที่หายจากจอ
     *      แถวบนกระดาษบวกได้ 130,000 แต่ช่อง "รวมเงินกู้" พิมพ์ 100,000 (บั๊ก 20-07 ยืนยันด้วยการกดจริง)
     * ⚠️ เช็ก inline display ไล่ขึ้นถึงตัวแผง ไม่ใช่ offsetParent — ไม่ต้องพึ่ง layout
     *    และถ้าหาแผงไม่เจอ ให้เก็บทุกช่องตามเดิม (ยอมพลาดดีกว่าเอกสารว่างทั้งใบ) */
    const panelEl = document.getElementById('sngk13Panel');
    const isHiddenIn = (el, root) => {
      if (!root) return false;
      for (let n = el; n && n !== root; n = n.parentElement) {
        if (n.style && n.style.display === 'none') return true;
      }
      return false;
    };
    Object.keys(window.SNGK13_MAP).forEach(k => {
      if (k === 'baseDY') return;
      const el = document.getElementById('s13_' + k);
      if (!el) return;
      if (isHiddenIn(el, panelEl)) return;   // 🔒 ช่องที่ถูกซ่อนอยู่ = ไม่ใช่ของที่ผู้ใช้กรอกไว้จริง (ดูหมายเหตุด้านบน)
      const raw = (el.value || '').trim();
      if (raw === '') return;
      data[k] = /_(amt|value|remain|owePrin|oweInt)$|ownFund/.test(k) ? fmtA(raw) : raw;
    });

    /* 🔑 ตาราง "ข้อ 2 การใช้เงินกู้" — กติกาจากผู้จัดการ 20-07-2569:
     *    · แถว 5 ค่าหุ้น = 5% ของวงเงิน ตายตัวเสมอ
     *    · แถว 1-4 รวมกันต้องได้ 95% ที่เหลือ (ไม่ใช่แถว 1 = 95% ตายตัว)
     *    · วิธีปฏิบัติจริง: กรอกแถว 1 = "เงินสด" ใส่ 95% ข้อเดียว แถว 2-4 ไม่กรอก
     * เดิมยัด use1_amt = 95% เสมอ โดยไม่สนแถว 2-4 → กรอกแถว 2-4 เพิ่มเมื่อไร
     * คอลัมน์บนกระดาษบวกได้เกินช่อง "รวมเงินกู้" เงียบ ๆ (วัดจริงได้ 73,000 vs รวมพิมพ์ 50,000)
     * ตอนนี้: แถว 1 = 95% ลบด้วยผลบวกแถว 2-4 (ลดให้อัตโนมัติ) · ช่องรวมบวกจากแถวจริง
     *         ไม่ลงตัว = บล็อก ไม่พิมพ์เอกสารที่บวกไม่ได้ออกมา */
    const al = sngk13Alloc(r.P);          // 🔒 สูตรเดียวกับที่จอใช้ ไม่คำนวณซ้ำ
    if (!al) return bad('ยังไม่มีวงเงิน — กดคำนวณก่อน');
    const sh = al.share;
    if (al.cashLeft < 0) {
      return bad('รายการใช้เงินกู้แถว 2-4 รวมกัน ' + fmt0(al.extra) + ' บาท '
        + 'เกินส่วนที่จัดสรรได้ ' + fmt0(al.cash95) + ' บาท (วงเงิน ' + fmt0(r.P)
        + ' หัก ค่าหุ้น 5% = ' + fmt0(sh) + ')<br><span style="font-weight:400">'
        + 'ลดจำนวนในแถว 2-4 หรือเพิ่มวงเงิน — ตารางต้องรวมได้เท่าวงเงินพอดี</span>');
    }
    data.use5_amt = fmt0(sh);
    /* แถว 1 เหลือ 0 (แถว 2-4 กินครบ 95% พอดี) → เว้นว่างทั้งแถว ไม่พิมพ์เลข 0
     * (ผู้จัดการ 20-07: ให้เว้นว่างไว้) — เลข 0 บนแบบฟอร์มราชการอ่านแล้วชวนสงสัยว่ากรอกตกหรือเปล่า
     * ยกเว้นเจ้าหน้าที่พิมพ์ชื่อรายการเองไว้ → เคารพของเขา คงข้อความไว้ */
    const cashLeft = al.cashLeft;
    if (cashLeft > 0) {
      data.use1_amt = fmt0(cashLeft);
      if (!data.use1_item) data.use1_item = 'เงินสด';
    } else {
      delete data.use1_amt;
      if (!data.use1_item) delete data.use1_item;
    }

    /* ช่องรวม = บวกจาก "ค่าที่จะพิมพ์จริง" ทั้ง 5 แถว ไม่ใช่ยัดวงเงินลงไป
     * ต้องอ่านกลับจาก data.* ที่ผ่าน fmt0 แล้ว — ไม่ใช่บวกตัวแปรต้นทาง
     * เพราะบวกตัวแปรต้นทางจะได้ P เสมอโดยนิยาม = ด่านที่ fail ไม่ได้ = ด่านที่ไม่มีอยู่จริง
     * อ่านกลับแบบนี้จับการปัดเศษที่เพี้ยนระหว่างค่าหุ้นกับเงินสดได้ด้วย */
    let useSum = 0;
    for (let i = 1; i <= 5; i++) { const n = num(data['use' + i + '_amt']); if (n != null) useSum += n; }
    if (useSum !== r.P) {
      return bad('ระบบผิดพลาด: ตารางใช้เงินกู้รวมได้ ' + fmt0(useSum)
        + ' บาท ไม่เท่าวงเงิน ' + fmt0(r.P) + ' บาท — แจ้งผู้พัฒนา');
    }
    data.useTotal = fmt0(useSum);

    // 🔑 auto: ฤดูกาลผลิต (ระยะสั้นเท่านั้น) = วันรับเงินกู้ → งวดชำระสุดท้าย · ปานกลางเว้นว่าง
    const isShort = (data.loanRange || '').indexOf('สั้น') >= 0;
    if (isShort) {
      const sd = parseDate(document.getElementById('startDate').value);
      if (sd) data.seasonFrom = thDate(sd);   // ย่อ "10 ก.ค. 2569" (อ้างอิงในเอกสาร)
      if (prin.length) data.seasonTo = thDate(prin[prin.length - 1].date);
    } else { delete data.seasonFrom; delete data.seasonTo; }

    // 🔑 แผนงานปานกลาง = narrative → word-wrap ลง 3 บรรทัด (y=341 สั้น + 362/383 เต็ม) ที่ 16pt
    delete data.planDetail2; delete data.planDetail3;
    if (isShort) { delete data.planDetail; }
    else if (data.planDetail) {
      // โหลดฟอนต์ overlay ให้พร้อมวัด (ชุดเดียวกับ engine)
      if (!window.__s13FontReady) {
        try { const ff = new FontFace('THSarabunOverlay', 'url(' + window.CONTRACT_ASSET_BASE + 'assets/THSarabunNew.ttf)');
          await ff.load(); document.fonts.add(ff); window.__s13FontReady = true; } catch (e) { }
      }
      const M = window.SNGK13_MAP;
      const maxes = [M.planDetail.max, M.planDetail2 ? M.planDetail2.max : 481, M.planDetail3 ? M.planDetail3.max : 481];
      const lines = wrapSngk13Plan(String(data.planDetail), maxes, M.planDetail.size || 16);
      data.planDetail = lines[0] || '';
      if (lines[1]) data.planDetail2 = lines[1];
      if (lines[2]) data.planDetail3 = lines[2];
    }

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
