/* fieldmap.js — พิกัดเติมบน base.pdf (Word-export A4 2 หน้า 595x842)
 * y = "baseline (top-origin)" ที่วัดจากตำแหน่งเส้นประจริงด้วย pixel analysis (12-07 ค่ำ)
 *     → engine (canvas overlay) วาดข้อความ textBaseline='alphabetic' ที่ y นี้ = นั่งบนเส้นพอดี
 * baseDY = ระยะลอยเหนือเส้น (ค่าลบ = ยกขึ้น top-origin) → -2.5 = ลอย 2.5pt เท่ากันทั้ง 2 หน้า
 */
window.FIELD_MAP = {
  baseDY: -2.5,   // ลอยเหนือเส้น ~2.5pt (ค่าลบ = ยกขึ้นในระบบ top-origin) — เท่ากันทั้ง 2 หน้า

  // ---- หน้า 1 (y = baseline ที่วัดจริง) ----
  loanRange:   { page:1, x:317, y:92.6,  size:12 },              // หนังสือกู้เงินระยะ ___
  writtenAt:   { page:1, x:436, y:313,   size:11, max:150 },     // เขียนที่ ___
  contractDate:{ page:1, x:404, y:331.2, size:11, max:160 },     // วันที่ ___
  name:        { page:1, x:141, y:349.4, size:12, max:220 },     // ข้าพเจ้า ___
  group:       { page:1, x:366, y:349.4, size:12 },              // สมาชิกกลุ่มที่ ___
  regNo:       { page:1, x:466, y:349.4, size:12 },              // เลขทะเบียน ___
  houseNo:     { page:1, x:117, y:367.7, size:12 },              // บ้านเลขที่ ___
  moo:         { page:1, x:255, y:367.7, size:12 },              // หมู่ที่ ___
  tambon:      { page:1, x:328, y:367.7, size:12 },              // ตำบล ___
  amphoe:      { page:1, x:433, y:367.7, size:12 },              // อำเภอ ___
  changwat:    { page:1, x:75,  y:386.4, size:12 },              // จังหวัด ___
  amount:      { page:1, x:227, y:404.6, size:12 },              // ข้อ1 ไม่เกิน ___ บาท
  amountText:  { page:1, x:339, y:404.6, size:11, max:200 },     // ตัวอักษร (ในวงเล็บ)
  purpose:     { page:1, x:385, y:496.3, size:12, max:180 },     // ข้อ3 วัตถุประสงค์เพื่อ ___

  // ---- กล่อง "บันทึกการอนุมัติเงินกู้" หน้า 1 (y = baseline จุดไข่ปลาวัดจริง) ----
  approveCommittee: { page:1, x:200, y:160.3, size:11, max:63 },  // ..คณะกรรมการ[เงินกู้/ดำเนินการ] (dots 200-263)
  approveMeetDate:  { page:1, x:200, y:180.5, size:11, max:63 },  // ชุดที่_ครั้งที่_วันที่[ประชุม] (dots 200-263)
  approveAmount:    { page:1, x:146, y:200, size:11, max:82 },    // กำหนดวงเงินกู้จำนวน___บาท (dots 143-230)
  approveRepayBy:   { page:1, x:200, y:221.3, size:11, max:63 },  // ชำระคืนเสร็จภายในวันที่[งวดสุดท้าย] (dots 200-263)

  // ---- ตาราง 10 งวด หน้า 2 (firstY = baseline แถว 1 ที่วัดจริง) ----
  table: {
    size: 10,
    cols: { due:150, principal:275, interestTo:400 },
    segments: [
      { page:2, firstY:118.1, step:18.88, cap:10 },  // firstY = เส้นล่างงวด1 (วัดจริง) · baseDY ยกลอยเหนือเส้น
    ],
  },
};
