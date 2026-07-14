/* guarantee_fieldmap.js — พิกัดเติมบน guarantee_base.pdf (หนังสือค้ำประกันเงินกู้ · บุคคลค้ำ)
 * base = Word export ของผู้จัดการ (Quartz PDFContext) A4 595x842 2 หน้า — ห้าม re-render ด้วย LibreOffice
 * generate โดย: node compute_guarantee.js  (แก้พิกัด → แก้ที่สคริปต์นั้น แล้ว regen)
 * y = yMax ของ word label (top-origin) · baseDY = ยกลอยเหนือเส้น
 * idcard.boxes = กึ่งกลาง 13 กล่อง (วัด pixel 300dpi · กว้าง 10.8pt เท่ากัน) วางเลขทีละหลัก
 */
window.GUARANTEE_MAP = {
  "baseDY": -10,   // pdftotext yMax = เส้น descent ฟอนต์ ต่ำกว่าก้นจุดไข่ปลาจริง 7.83pt (วัด 7 บรรทัด) + ลอยเหนือเส้น ~2pt
  "writtenAt": {
    "page": 1,
    "x": 382,
    "y": 185.4,
    "size": 14,
    "max": 170
  },
  "docDate": {
    "page": 1,
    "x": 325.7,
    "y": 206.8,
    "size": 14,
    "max": 220
  },
  "gName": {
    "page": 1,
    "x": 128.1,
    "y": 228.1,
    "size": 14,
    "max": 200
  },
  "gReg": {
    "page": 1,
    "x": 389.7,
    "y": 228.1,
    "size": 14,
    "max": 85
  },
  "gGroup": {
    "page": 1,
    "x": 503.3,
    "y": 228.1,
    "size": 14,
    "max": 46
  },
  "gHouse": {
    "page": 1,
    "x": 437.8,
    "y": 249.5,
    "size": 14,
    "max": 68
  },
  "gMoo": {
    "page": 1,
    "x": 512.4,
    "y": 249.5,
    "size": 14,
    "max": 38
  },
  "gTambon": {
    "page": 1,
    "x": 83.9,
    "y": 270.6,
    "size": 14,
    "max": 108
  },
  "gTel": {
    "page": 1,
    "x": 380.4,
    "y": 270.6,
    "size": 14,
    "max": 112
  },
  "borrower": {
    "page": 1,
    "x": 154.7,
    "y": 313.3,
    "size": 14,
    "max": 300
  },
  "purpose": {
    "page": 1,
    "x": 58.6,
    "y": 334.5,
    "size": 14,
    "max": 168
  },
  "loanRange": {
    "page": 1,
    "x": 322.4,
    "y": 334.5,
    "size": 14,
    "max": 59
  },
  "loanDate": {
    "page": 1,
    "x": 434.1,
    "y": 334.5,
    "size": 14,
    "max": 62
  },
  "amount": {
    "page": 1,
    "x": 110.2,
    "y": 355.8,
    "size": 14,
    "max": 100
  },
  "amountText": {
    "page": 1,
    "x": 221.6,
    "y": 355.8,
    "size": 13,
    "max": 168
  },
  "repayBy": {
    "page": 1,
    "x": 58.6,
    "y": 377.2,
    "size": 14,
    "max": 119
  },
  "amount3": {
    "page": 1,
    "x": 74.3,
    "y": 462.4,
    "size": 14,
    "max": 98
  },
  "amountText3": {
    "page": 1,
    "x": 186.6,
    "y": 462.4,
    "size": 13,
    "max": 200
  },
  "house4": {
    "page": 1,
    "x": 111.8,
    "y": 526.2,
    "size": 14,
    "max": 62
  },
  "moo4": {
    "page": 1,
    "x": 176,
    "y": 526.2,
    "size": 14,
    "max": 36
  },
  "tambon4": {
    "page": 1,
    "x": 233.9,
    "y": 526.2,
    "size": 14,
    "max": 80
  },
  "postcode": {
    "page": 1,
    "x": 58.6,
    "y": 547.6,
    "size": 14,
    "max": 64
  },
  "gNameParen": {
    "page": 2,
    "cx": 406.7,
    "y": 284.1,
    "size": 14,
    "max": 150,
    "align": "center"
  },
  "idcard": {
    "page": 1,
    "y": 249,
    "size": 13,
    "boxes": [
      182.5,
      200.3,
      214.7,
      228.8,
      243,
      260.8,
      275.2,
      289.3,
      307.1,
      321.2,
      335.6,
      353.2,
      367.6
    ],
    "align": "center"
  }
};
