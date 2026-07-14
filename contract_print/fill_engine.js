/* fill_engine.js — เติมข้อมูลลง base.pdf (client-side, GitHub Pages)
 * วิธี: ให้เบราว์เซอร์ (Canvas + HarfBuzz) วาดข้อความไทยที่จัดเรียงสระถูกต้อง
 *       แล้ว overlay เป็นภาพโปร่งใสทับบนฟอร์ม PDF (แก้ปัญหา pdf-lib ไม่ shape ไทย)
 * ต้องโหลดก่อน: vendor/pdf-lib.min.js, config.js, fieldmap.js
 */
(function (global) {
  "use strict";

  // ---- เลขไทยบาท → ตัวอักษร ----
  const TH_NUM = ["ศูนย์","หนึ่ง","สอง","สาม","สี่","ห้า","หก","เจ็ด","แปด","เก้า"];
  const TH_POS = ["","สิบ","ร้อย","พัน","หมื่น","แสน","ล้าน"];
  function readGroup(n) {
    let s = "", str = String(n), L = str.length;
    for (let i = 0; i < L; i++) {
      const d = +str[i], pos = L - i - 1;
      if (d === 0) continue;
      if (pos === 0 && d === 1 && L > 1) s += "เอ็ด";
      else if (pos === 1 && d === 2) s += "ยี่" + TH_POS[pos];
      else if (pos === 1 && d === 1) s += TH_POS[pos];
      else s += TH_NUM[d] + TH_POS[pos];
    }
    return s;
  }
  function bahtText(amount) {
    amount = Math.round((+amount + Number.EPSILON) * 100) / 100;
    const baht = Math.floor(amount), satang = Math.round((amount - baht) * 100);
    let words = "";
    if (baht === 0) words = "ศูนย์";
    else {
      const millions = Math.floor(baht / 1e6), rest = baht % 1e6;
      if (millions > 0) words += readGroup(millions) + "ล้าน";
      if (rest > 0) words += readGroup(rest);
    }
    words += "บาท";
    words += satang === 0 ? "ถ้วน" : (readGroup(satang) + "สตางค์");
    return words;
  }

  const TH_MONTH = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน",
    "กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
  function thaiDate(d) {
    if (!(d instanceof Date) || isNaN(d)) return "";
    return `${d.getDate()} ${TH_MONTH[d.getMonth()]} ${d.getFullYear() + 543}`;
  }
  function fmtNum(n) { return (+n).toLocaleString("en-US", { maximumFractionDigits: 2 }); }

  // ---- asset loading ----
  const _ab = () => (global.CONTRACT_ASSET_BASE || "");
  const OVERLAY_FONT = "THSarabunOverlay";
  let _basePdf = null, _fontLoaded = false;
  const SCALE = 3; // supersample canvas → PDF ให้คมชัด

  async function _load() {
    if (!_basePdf) _basePdf = await fetch(_ab() + "base.pdf").then(r => r.arrayBuffer());
    if (!_fontLoaded) {
      const ff = new FontFace(OVERLAY_FONT, `url(${_ab()}assets/THSarabunNew.ttf)`);
      await ff.load();
      document.fonts.add(ff);
      _fontLoaded = true;
    }
  }

  // สร้าง list ของ field ที่จะวาด แยกตามหน้า
  // FM = fieldmap (default = FIELD_MAP ของสัญญา ส.-งก.14 · ส่ง GUARANTEE_MAP มาได้)
  function _collectFields(data, FM) {
    FM = FM || global.FIELD_MAP;
    const perPage = {}; // page → [{x, baselineTop, size, text, max, align, boxes}]
    const push = (page, o) => { (perPage[page] = perPage[page] || []).push(o); };

    // baselineTop = spec.y + baseDY (global) + spec.dy (per-field) — canvas top-origin, baseline='alphabetic'
    const baseDY = (FM.baseDY != null ? FM.baseDY : 0);
    for (const key of Object.keys(FM)) {
      if (key === "table" || key === "yAdjust" || key === "baseDY") continue;
      const spec = FM[key], text = data[key];
      if (text == null || text === "") continue;
      const baselineTop = spec.y + baseDY + (spec.dy || 0);
      // (ก) กล่องรายหลัก เช่น เลขบัตร 13 ช่อง — วางทีละตัวอักษรกลางกล่อง
      if (spec.boxes) {
        const chars = String(text).replace(/\D/g, "").split("");
        for (let i = 0; i < chars.length && i < spec.boxes.length; i++) {
          push(spec.page, { cx: spec.boxes[i], baselineTop, size: spec.size || 11, text: chars[i], align: "center" });
        }
        continue;
      }
      // (ข) จัดกึ่งกลาง (cx) เช่น ชื่อในวงเล็บ
      if (spec.align === "center") {
        push(spec.page, { cx: spec.cx, baselineTop, size: spec.size || 12, text: String(text), max: spec.max, align: "center" });
        continue;
      }
      push(spec.page, { x: spec.x, baselineTop, size: spec.size || 12, text: String(text), max: spec.max });
    }
    // ตาราง
    if (data.rows && FM.table) {
      const t = FM.table;
      let ri = 0;
      for (const seg of t.segments) {
        for (let k = 0; k < seg.cap && ri < data.rows.length; k++, ri++) {
          const row = data.rows[ri];
          const baselineTop = seg.firstY + k * seg.step + baseDY + (t.dy || 0);
          const put = (x, val) => { if (val != null && val !== "") push(seg.page, { x, baselineTop, size: t.size, text: String(val) }); };
          put(t.cols.due, row.due); put(t.cols.principal, row.principal); put(t.cols.interestTo, row.interestTo);
        }
      }
    }
    return perPage;
  }

  // วาด overlay canvas สำหรับ 1 หน้า (โปร่งใส) — เบราว์เซอร์ shape ไทยเอง
  function _renderOverlayCanvas(Wpt, Hpt, fields, colorCss) {
    const cv = document.createElement("canvas");
    cv.width = Math.round(Wpt * SCALE);
    cv.height = Math.round(Hpt * SCALE);
    const ctx = cv.getContext("2d");
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = colorCss;
    for (const f of fields) {
      let size = f.size;
      ctx.font = `${size * SCALE}px "${OVERLAY_FONT}"`;
      if (f.max) {
        while (size > 8 && ctx.measureText(f.text).width / SCALE > f.max) {
          size -= 0.5; ctx.font = `${size * SCALE}px "${OVERLAY_FONT}"`;
        }
      }
      // align:center → ยึด cx เป็นกึ่งกลาง (เลขบัตรรายกล่อง / ชื่อในวงเล็บ)
      const x = (f.align === "center")
        ? (f.cx * SCALE - ctx.measureText(f.text).width / 2)
        : (f.x * SCALE);
      ctx.fillText(f.text, x, f.baselineTop * SCALE);
    }
    return cv;
  }

  function _canvasToPngBytes(cv) {
    const dataUrl = cv.toDataURL("image/png");
    const b64 = dataUrl.split(",")[1];
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  async function generateContract(data, opts = {}) {
    await _load();
    const { PDFDocument } = global.PDFLib;
    const pdf = await PDFDocument.load(_basePdf);
    const pages = pdf.getPages();
    const colorCss = opts.calibrate ? "#0d19b3" : "#000000";
    const perPage = _collectFields(data);

    for (const pageNoStr of Object.keys(perPage)) {
      const pageNo = +pageNoStr;
      const pg = pages[pageNo - 1];
      if (!pg) continue;
      const Wpt = pg.getWidth(), Hpt = pg.getHeight();
      const cv = _renderOverlayCanvas(Wpt, Hpt, perPage[pageNo], colorCss);
      const png = await pdf.embedPng(_canvasToPngBytes(cv));
      pg.drawImage(png, { x: 0, y: 0, width: Wpt, height: Hpt });
    }
    return await pdf.save();
  }

  /* ===== หนังสือค้ำประกันเงินกู้ (บุคคลค้ำ) =====
   * sheets = [ผู้ค้ำคนที่1, ผู้ค้ำคนที่2, ...] แต่ละคน = หนังสือ 2 หน้า → ต่อกันเป็นเล่มเดียว
   * ผู้ค้ำ 2 คน = 4 หน้า (ระเบียบเงินกู้ ข้อ 8(2) บังคับอย่างน้อย 2 คน)
   * base = guarantee_base.pdf (Word export ของผู้จัดการ — ห้าม re-render)
   */
  let _guarPdf = null;
  async function _loadGuarantee() {
    if (!_guarPdf) _guarPdf = await fetch(_ab() + "guarantee_base.pdf").then(r => r.arrayBuffer());
    if (!_fontLoaded) {
      const ff = new FontFace(OVERLAY_FONT, `url(${_ab()}assets/THSarabunNew.ttf)`);
      await ff.load(); document.fonts.add(ff); _fontLoaded = true;
    }
  }

  async function generateGuarantee(sheets, opts = {}) {
    if (!Array.isArray(sheets) || !sheets.length) throw new Error("generateGuarantee: ต้องส่ง array ของผู้ค้ำอย่างน้อย 1 คน");
    if (!global.GUARANTEE_MAP) throw new Error("ไม่พบ guarantee_fieldmap.js");
    await _loadGuarantee();
    const { PDFDocument } = global.PDFLib;
    const FM = global.GUARANTEE_MAP;
    const colorCss = opts.calibrate ? "#0d19b3" : "#000000";
    const outPdf = await PDFDocument.create();

    for (const sheet of sheets) {
      const src = await PDFDocument.load(_guarPdf);          // โหลดใหม่ทุกคน = base สะอาดเสมอ
      const srcPages = src.getPages();
      const perPage = _collectFields(sheet, FM);
      for (const pageNoStr of Object.keys(perPage)) {
        const pg = srcPages[+pageNoStr - 1];
        if (!pg) continue;
        const Wpt = pg.getWidth(), Hpt = pg.getHeight();
        const cv = _renderOverlayCanvas(Wpt, Hpt, perPage[pageNoStr], colorCss);
        const png = await src.embedPng(_canvasToPngBytes(cv));
        pg.drawImage(png, { x: 0, y: 0, width: Wpt, height: Hpt });
      }
      const copied = await outPdf.copyPages(src, src.getPageIndices());
      copied.forEach(p => outPdf.addPage(p));
    }
    return await outPdf.save();
  }

  // debug: คืน canvas overlay ของหน้า (สำหรับ verify บนจอ)
  async function debugOverlayCanvas(data, pageNo) {
    await _load();
    const { PDFDocument } = global.PDFLib;
    const pdf = await PDFDocument.load(_basePdf);
    const pg = pdf.getPages()[pageNo - 1];
    const perPage = _collectFields(data);
    return _renderOverlayCanvas(pg.getWidth(), pg.getHeight(), perPage[pageNo] || [], "#cc0000");
  }

  // debug: overlay ตาม fieldmap ที่ระบุ (ใช้ verify guarantee — พิกัดชุดเดียวกับตอน gen จริง)
  async function debugOverlayCanvasFM(data, pageNo, FM) {
    if (!_fontLoaded) {
      const ff = new FontFace(OVERLAY_FONT, `url(${_ab()}assets/THSarabunNew.ttf)`);
      await ff.load(); document.fonts.add(ff); _fontLoaded = true;
    }
    const perPage = _collectFields(data, FM);
    return _renderOverlayCanvas(595.2, 841.92, perPage[pageNo] || [], "#0d19b3");
  }

  global.ContractFill = { generateContract, generateGuarantee, bahtText, thaiDate, fmtNum, debugOverlayCanvas, debugOverlayCanvasFM, _SCALE: SCALE };
})(window);
