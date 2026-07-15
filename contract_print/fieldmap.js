/* fieldmap.js — พิกัดเติมบน base.pdf (Word-export A4 2 หน้า 595x842)
 * y = "baseline (top-origin)" ที่วัดจากตำแหน่งเส้นประจริงด้วย pixel analysis (12-07 ค่ำ)
 *     → engine (canvas overlay) วาดข้อความ textBaseline='alphabetic' ที่ y นี้ = นั่งบนเส้นพอดี
 * baseDY = ระยะลอยเหนือเส้น (ค่าลบ = ยกขึ้น top-origin) → -2.5 = ลอย 2.5pt เท่ากันทั้ง 2 หน้า
 */
window.FIELD_MAP = {
  baseDY: -2.5,   // ลอยเหนือเส้น ~2.5pt (ค่าลบ = ยกขึ้นในระบบ top-origin) — เท่ากันทั้ง 2 หน้า

  /* 📐 max/cx = ความกว้างช่องจุดไข่ปลา "วัดจริง" จาก base.pdf ด้วย measure_contract_dots.js (15-07)
   *    cx = x + max/2 → align:"center" = ข้อความอยู่กึ่งกลางช่อง (ผู้จัดการสั่ง 15-07)
   * ⚠️ max ชุดเดิมเป็นค่า "เดา" และกว้างเกินจริงเกือบทุกช่อง (name 220→171 · writtenAt 150→114 · approve* 63→~45)
   *    ค่าเดาที่กว้างเกิน = ข้อความล้นไปทับคำถัดไปได้ + จัดกึ่งกลางแล้วเบี้ยวขวา
   * 🔒 แก้ max/cx ต้องรัน measure_contract_dots.js ใหม่ ห้ามกะเอาเอง · x/y ยังเป็นค่า pixel analysis เดิม (12-07) ไม่แตะ
   */
  // ---- หน้า 1 (y = baseline ที่วัดจริง) ----
  loanRange:   { page:1, x:317, y:92.6,  size:12, max:56,  cx:345,   align:"center" },  // หนังสือกู้เงินระยะ ___
  writtenAt:   { page:1, x:436, y:313,   size:11, max:114, cx:493,   align:"center" },  // เขียนที่ ___
  contractDate:{ page:1, x:404, y:331.2, size:11, max:146, cx:477,   align:"center" },  // วันที่ ___
  name:        { page:1, x:141, y:349.4, size:12, max:171, cx:226.5, align:"center" },  // ข้าพเจ้า ___
  group:       { page:1, x:366, y:349.4, size:12, max:50,  cx:391,   align:"center" },  // สมาชิกกลุ่มที่ ___
  regNo:       { page:1, x:466, y:349.4, size:12, max:73,  cx:502.5, align:"center" },  // เลขทะเบียน ___
  houseNo:     { page:1, x:117, y:367.7, size:12, max:49,  cx:141.5, align:"center" },  // บ้านเลขที่ ___
  moo:         { page:1, x:255, y:367.7, size:12, max:45,  cx:277.5, align:"center" },  // หมู่ที่ ___
  tambon:      { page:1, x:328, y:367.7, size:12, max:75,  cx:365.5, align:"center" },  // ตำบล ___
  amphoe:      { page:1, x:433, y:367.7, size:12, max:89,  cx:477.5, align:"center" },  // อำเภอ ___
  changwat:    { page:1, x:75,  y:386.4, size:12, max:76,  cx:113,   align:"center" },  // จังหวัด ___
  amount:      { page:1, x:227, y:404.6, size:12, max:88,  cx:271,   align:"center" },  // ข้อ1 ไม่เกิน ___ บาท
  amountText:  { page:1, x:339, y:404.6, size:11, max:207, cx:442.5, align:"center" },  // ตัวอักษร (ในวงเล็บ)
  purpose:     { page:1, x:385, y:496.3, size:12, max:165, cx:467.5, align:"center" },  // ข้อ3 วัตถุประสงค์เพื่อ ___

  // ---- กล่อง "บันทึกการอนุมัติเงินกู้" หน้า 1 (y = baseline จุดไข่ปลาวัดจริง) ----
  approveCommittee: { page:1, x:200, y:160.3, size:11, max:45, cx:222.5, align:"center" },  // ..คณะกรรมการ[เงินกู้/ดำเนินการ]
  approveMeetDate:  { page:1, x:200, y:180.5, size:11, max:44, cx:222,   align:"center" },  // ชุดที่_ครั้งที่_วันที่[ประชุม]
  approveAmount:    { page:1, x:146, y:200,   size:11, max:85, cx:188.5, align:"center" },  // กำหนดวงเงินกู้จำนวน___บาท
  approveRepayBy:   { page:1, x:200, y:221.3, size:11, max:47, cx:223.5, align:"center" },  // ชำระคืนเสร็จภายในวันที่[งวดสุดท้าย]

  // ---- ตาราง 10 งวด หน้า 2 (firstY = baseline แถว 1 ที่วัดจริง) ----
  table: {
    size: 10,
    cols: { due:150, principal:275, interestTo:400 },
    segments: [
      { page:2, firstY:118.1, step:18.88, cap:10 },  // firstY = เส้นล่างงวด1 (วัดจริง) · baseDY ยกลอยเหนือเส้น
    ],
  },
};
