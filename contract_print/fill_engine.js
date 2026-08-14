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

    /* 🩹 patches — ปิดทับคำที่ "พิมพ์ผิดมาในแบบฟอร์มต้นแบบเอง" (ไม่ใช่ข้อมูลที่เรากรอก)
     * ต้อง push ก่อนช่องกรอกทั้งหมด เพราะวาดตามลำดับ — สี่เหลี่ยมขาวที่มาทีหลังจะลบของที่วาดไว้แล้ว
     * ⚠️ นี่คือการ "ปิดทับ" ไม่ใช่การแก้ต้นฉบับ — วัน ไหน export PDF ต้นแบบใหม่จาก Word ที่แก้แล้ว
     *    ต้องมาถอด patch ตัวนั้นออก ไม่งั้นจะทับคำที่ถูกต้องแล้วซ้ำอีกชั้น */
    for (const p of (FM.patches || [])) {
      push(p.page, { patch: p });
    }

    for (const key of Object.keys(FM)) {
      if (key === "table" || key === "yAdjust" || key === "baseDY" || key === "patches") continue;
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
        push(spec.page, { key, cx: spec.cx, baselineTop, size: spec.size || 12, text: String(text), max: spec.max, align: "center", wrap: spec.wrap === true });
        continue;
      }
      push(spec.page, { key, x: spec.x, baselineTop, size: spec.size || 12, text: String(text), max: spec.max, wrap: spec.wrap === true });
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

  /* ── นโยบายข้อความยาวเกินช่อง (ผู้จัดการเคาะ 21-07-2569) ────────────────
   *   1. ย่อฟอนต์ลง แต่ไม่ต่ำกว่า SHRINK_FLOOR (เดิม 8pt เล็กจนอ่านไม่ออก)
   *   2. ยังไม่พอ → ขึ้นบรรทัดที่ 2 (เฉพาะช่องที่ fieldmap ระบุ wrap:true
   *      เพราะรู้ว่ามีที่ว่างแนวตั้งจริง — ช่องอื่นขึ้นบรรทัดจะไปทับบรรทัดล่าง)
   *   3. ยังไม่พอ + ตัดคำไม่ได้ (ข้อความต่อเนื่อง) → ยอมล้ำได้ไม่เกิน BLEED
   *   4. ยังไม่พอ → 🔴 throw = ไม่พิมพ์เอกสารเลย
   *
   * 🔑 รากของบั๊ก 21-07-2569: เดิมย่อถึง 8pt แล้ว fillText วาดทับออกไปเงียบ ๆ
   *    ไม่ throw ไม่เตือน → ทุกใบขึ้น "✅ สร้างสำเร็จ" เหมือนกันหมด
   *    รวมใบที่ตัวหนังสือทะลุเส้นตาราง เจ้าหน้าที่ไม่มีทางรู้ว่าใบไหนยื่นไม่ได้
   *
   * BLEED=4 มาจากการวัดเส้นตารางจริงใน sngk13_base.pdf ที่ 300dpi
   * (ช่อง use*_item: เริ่ม x=92 · เส้นจริงที่ 148.0 · max=52 → เหลือเผื่อ 4pt)
   * ห้ามเดาค่านี้ — วัดใหม่ด้วย _scratch สคริปต์ measure_cells.py ถ้าเปลี่ยนแบบฟอร์ม */
  const SHRINK_FLOOR = 12;
  const BLEED = 4;
  /* ระยะห่างบรรทัด = 0.85 เท่าของขนาดฟอนต์ — แคบกว่า 1.0 โดยตั้งใจ
   * แถว use*_item สูง 28.3pt · 2 บรรทัดที่ 12pt × 0.85 = ห่างกัน 10.2pt
   * ทำให้บรรทัดบนไม่ไปชนหางบรรทัดของแถวก่อนหน้า (วัดแล้วเหลือระยะ ~5pt) */
  const LINE_RATIO = 0.85;

  // อักขระไทยที่เกาะตัวหน้า (สระบน-ล่าง วรรณยุกต์) — ห้ามตัดบรรทัดหน้าตัวพวกนี้
  const _COMBINING = /[ัิ-ฺ็-๎]/;

  function _w(ctx, s) { return ctx.measureText(s).width / SCALE; }

  /** หาจุดตัดที่ยาวที่สุดซึ่งบรรทัดแรกยังไม่เกิน max — คืน index หรือ -1 ถ้าตัดไม่ได้ */
  function _breakAt(ctx, text, max) {
    let best = -1;
    for (let i = 1; i < text.length; i++) {
      if (_COMBINING.test(text[i])) continue;          // ห้ามแยกสระออกจากพยัญชนะ
      if (_w(ctx, text.slice(0, i)) > max) break;
      best = i;
    }
    // มีช่องว่างในช่วงที่ตัดได้ → ตัดตรงช่องว่างสวยกว่า
    const sp = text.lastIndexOf(" ", best);
    return sp > 0 ? sp : best;
  }

  /* ✂️ ตัดที่ขอบคำไทย (backlog ข้อ 5 — 23-07-2569): เดิมตัดกลางคำ
   * "ค่าปุ๋ยเคมีและสา / รปรับปรุงดิน" — อ่านสะดุดแม้ไม่ผิด
   * ใช้ Intl.Segmenter th — ขอบคำใหญ่สุดที่บรรทัดแรกยังไม่เกิน max
   * ไม่มี Segmenter (เบราว์เซอร์เก่า) หรือหาขอบไม่ได้ → คืน -1 ให้ผู้เรียก fallback */
  function _breakAtWord(ctx, text, max) {
    if (typeof Intl === "undefined" || !Intl.Segmenter) return -1;
    let best = -1;
    try {
      for (const s of new Intl.Segmenter("th", { granularity: "word" }).segment(text)) {
        if (s.index <= 0) continue;
        if (_w(ctx, text.slice(0, s.index)) > max) break;
        best = s.index;
      }
    } catch (e) { return -1; }
    return best;
  }

  /** คืน {lines, size} ถ้าใส่ได้ · คืน null ถ้าใส่ไม่ลงตามนโยบาย */
  function _fit(ctx, f) {
    let size = f.size;
    const setFont = () => { ctx.font = `${size * SCALE}px "${OVERLAY_FONT}"`; };
    setFont();
    if (!f.max) return { lines: [f.text], size };

    // 1. ย่อ
    while (size > SHRINK_FLOOR && _w(ctx, f.text) > f.max) { size -= 0.5; setFont(); }
    if (_w(ctx, f.text) <= f.max) return { lines: [f.text], size };

    // 2. ขึ้นบรรทัดที่ 2 (เฉพาะช่องที่รู้ว่ามีที่ว่าง)
    // ลองตัดขอบคำก่อน (อ่านสวย) — สองบรรทัดไม่ลงค่อยถอยไปตัดกลางคำแบบเดิม
    // 🔒 ห้ามให้ทางขอบคำทำเอกสารที่เคยพิมพ์ได้กลายเป็นถูกบล็อก — fallback ต้องคงอยู่เสมอ
    if (f.wrap) {
      for (const cut of [_breakAtWord(ctx, f.text, f.max), _breakAt(ctx, f.text, f.max)]) {
        if (cut > 0) {
          const a = f.text.slice(0, cut).trim(), b = f.text.slice(cut).trim();
          if (_w(ctx, a) <= f.max && _w(ctx, b) <= f.max) return { lines: [a, b], size };
        }
      }
    }

    // 3. ตัดไม่ได้ (ข้อความต่อเนื่อง) แต่ล้ำแค่นิดเดียว → ยอม
    const over = _w(ctx, f.text) - f.max;
    if (over <= BLEED) return { lines: [f.text], size, bled: over };

    // 4. ใส่ไม่ลงจริง
    return null;
  }

  /* 🔒 fail-closed: fieldmap อ้างหน้าที่แบบฟอร์มไม่มี = หยุด ไม่ใช่ข้ามเงียบ
   * perPage มีเฉพาะหน้าที่มีข้อมูลจริงอยู่แล้ว → หาไม่เจอ = ผิดเสมอ ไม่มีเคสที่ถูก
   * เดิมเขียน `if (!pg) continue` ทั้ง 5 ใบ → ถ้าผู้จัดการ export Word ใหม่แล้วหน้าหด
   * ช่องทุกช่องของหน้านั้นจะหายไปพร้อมข้อความ "✅ สร้างสำเร็จ" และด่านข้อความล้น
   * ก็ไม่ได้รันกับหน้านั้นด้วย เพราะถูกข้ามไปก่อน (ตรวจเชิงลึก 21-07-2569)
   * แพตเทิร์นเดียวกับ DocGate.capacity — ด่านที่ fail แบบเงียบ = ด่านที่ไม่มีอยู่จริง */
  function _pageOrThrow(pages, pageNo, docLabel, fields) {
    const pg = pages[pageNo - 1];
    if (pg) return pg;
    throw new Error(
      `แบบฟอร์ม "${docLabel}" ไม่มีหน้า ${pageNo} (มี ${pages.length} หน้า) ` +
      `แต่มีข้อมูลรออยู่ ${fields.length} ช่อง — ไม่พิมพ์ให้ เพราะช่องเหล่านั้นจะหายทั้งหน้า` +
      `<br><span style="font-weight:400">แบบฟอร์มกับพิกัดไม่ตรงกัน — แจ้งผู้พัฒนา</span>`);
  }

  // วาด overlay canvas สำหรับ 1 หน้า (โปร่งใส) — เบราว์เซอร์ shape ไทยเอง
  function _renderOverlayCanvas(Wpt, Hpt, fields, colorCss) {
    const cv = document.createElement("canvas");
    cv.width = Math.round(Wpt * SCALE);
    cv.height = Math.round(Hpt * SCALE);
    const ctx = cv.getContext("2d");
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = colorCss;
    const tooLong = [];
    for (const f of fields) {
      /* 🩹 patch = ลบคำที่ผิดในแบบฟอร์มแล้วเขียนคำที่ถูกทับลงไป
       * ขนาด/พิกัดกล่องมาจาก pdftotext -bbox ของคำนั้นเอง (วัดจากฟอร์มจริง ไม่ได้กะ)
       * ไม่ผ่าน _fit เพราะไม่ใช่ข้อมูลผู้ใช้ — ข้อความคงที่ ยาวเท่าเดิมเสมอ */
      if (f.patch) {
        const p = f.patch;
        /* 🔴 ห้ามลบคำผิดด้วย fillRect บนผืนภาพนี้ — เคยทำแล้วเห็นกรอบจาง ๆ บนกระดาษ
         * ผืนภาพเป็น PNG โปร่งใสที่ถูกย่อจาก SCALE เท่า → ขอบสี่เหลี่ยมได้ค่าอัลฟาไม่เต็ม
         * ขาวไม่เต็มอัลฟาบนพื้นขาว = เส้นเทา (วัดจริง 09-08-2569: เทา 201 ยาว 80% ของกล่อง)
         * การลบจึงย้ายไปวาดเป็น "สี่เหลี่ยมเวกเตอร์" ใน PDF ก่อนแปะภาพ (_paintPatches)
         * ตรงนี้เหลือหน้าที่เดียว = เขียนคำที่ถูกทับลงไป */
        ctx.font = `${p.size * SCALE}px "${OVERLAY_FONT}"`;
        ctx.fillText(p.text, p.tx * SCALE, p.ty * SCALE);
        continue;
      }
      const fit = _fit(ctx, f);
      if (!fit) {
        ctx.font = `${SHRINK_FLOOR * SCALE}px "${OVERLAY_FONT}"`;
        tooLong.push({
          key: f.key || "(ไม่ทราบชื่อช่อง)",
          text: f.text,
          over: Math.ceil(_w(ctx, f.text) - f.max),
        });
        continue;   // ไม่วาดช่องนี้ — เดี๋ยว throw ทิ้งทั้งใบอยู่แล้ว
      }
      ctx.font = `${fit.size * SCALE}px "${OVERLAY_FONT}"`;
      /* 🔑 ที่ว่างของแถวอยู่ "เหนือ" baseline ไม่ใช่ใต้ — baseline เดิมชิดขอบล่างช่องอยู่แล้ว
       * เดิมวางบรรทัด 2 ไว้ใต้บรรทัดแรก → ตกไปทับเส้นล่างของแถว (เห็นในภาพ 21-07-2569)
       * ถูกคือ: บรรทัดสุดท้ายอยู่ที่ baseline เดิม แล้วไล่บรรทัดก่อนหน้าขึ้นไปด้านบน */
      const gap = fit.size * LINE_RATIO;
      const top = f.baselineTop - (fit.lines.length - 1) * gap;
      fit.lines.forEach((ln, i) => {
        // align:center → ยึด cx เป็นกึ่งกลาง (เลขบัตรรายกล่อง / ชื่อในวงเล็บ)
        const x = (f.align === "center")
          ? (f.cx * SCALE - ctx.measureText(ln).width / 2)
          : (f.x * SCALE);
        ctx.fillText(ln, x, (top + i * gap) * SCALE);
      });
    }
    if (tooLong.length) {
      const detail = tooLong
        .map(t => `• ${t.key}: "${t.text}" ยาวเกินช่อง ${t.over} pt`)
        .join("\n");
      const e = new Error(
        `ข้อความยาวเกินช่อง ${tooLong.length} ช่อง — ไม่พิมพ์ให้ เพราะจะทะลุเส้นตาราง\n` +
        detail + "\nแก้: พิมพ์ข้อความให้สั้นลง แล้วสร้างใหม่"
      );
      e.overflowFields = tooLong;
      throw e;
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
      const pg = _pageOrThrow(pages, pageNo, 'สัญญาเงินกู้ ส.-งก.14', perPage[pageNo]);
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
        const pg = _pageOrThrow(srcPages, +pageNoStr, 'หนังสือค้ำประกัน', perPage[pageNoStr]);
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

  /* ===== หนังสือค้ำประกันเงินกู้ (เงินหุ้นค้ำประกัน) =====
   * ผู้กู้ใช้หุ้นตัวเองค้ำ → ไม่มีผู้ค้ำแยก → 1 หน้า 1 ฉบับ (ต่างจากบุคคลค้ำที่ 2 คน = 4 หน้า)
   * base = share_base.pdf (Word export ของผู้จัดการ — ห้าม re-render ด้วย LibreOffice)
   */
  let _sharePdf = null;
  async function _loadShare() {
    if (!_sharePdf) _sharePdf = await fetch(_ab() + "share_base.pdf").then(r => r.arrayBuffer());
    if (!_fontLoaded) {
      const ff = new FontFace(OVERLAY_FONT, `url(${_ab()}assets/THSarabunNew.ttf)`);
      await ff.load(); document.fonts.add(ff); _fontLoaded = true;
    }
  }

  /* 🩹 ลบคำที่ผิดในแบบฟอร์ม ด้วยสี่เหลี่ยมขาว "เวกเตอร์" ใน PDF — ไม่ใช่บนผืนภาพ
   * ทำไม: ผืนภาพ overlay เป็น PNG โปร่งใสที่ย่อจาก SCALE เท่า ขอบสี่เหลี่ยมจึงได้อัลฟาไม่เต็ม
   *       ขาวไม่เต็มอัลฟาทับพื้นขาว = เส้นเทาจาง ๆ เห็นเป็นกรอบ (ผจก.เห็นเองที่ซูม 289%)
   *       วัดยืนยัน 09-08-2569: แถวบนกรอบเทา 201 ยาว 80% ของความกว้างกล่อง
   * เวกเตอร์ไม่ถูกย่อ ขอบจึงคมและขาวเต็ม — ต้องวาดก่อน drawImage เสมอ */
  function _paintPatches(pg, FM, Hpt) {
    const { rgb } = global.PDFLib;
    for (const p of (FM.patches || [])) {
      if (p.page !== 1) continue;                 // ฟอร์มหุ้นค้ำมีหน้าเดียว
      pg.drawRectangle({
        x: p.x, y: Hpt - (p.y + p.h), width: p.w, height: p.h,
        color: rgb(1, 1, 1), borderWidth: 0,
      });
    }
  }

  async function generateShare(data, opts = {}) {
    if (!global.SHARE_MAP) throw new Error("ไม่พบ share_fieldmap.js");
    await _loadShare();
    const { PDFDocument } = global.PDFLib;
    const src = await PDFDocument.load(_sharePdf);
    const perPage = _collectFields(data, global.SHARE_MAP);
    const srcPages = src.getPages();
    for (const pageNoStr of Object.keys(perPage)) {
      const pg = _pageOrThrow(srcPages, +pageNoStr, 'หนังสือหุ้นค้ำประกัน', perPage[pageNoStr]);
      const Wpt = pg.getWidth(), Hpt = pg.getHeight();
      _paintPatches(pg, global.SHARE_MAP, Hpt);
      const cv = _renderOverlayCanvas(Wpt, Hpt, perPage[pageNoStr], opts.calibrate ? "#0d19b3" : "#000000");
      const png = await src.embedPng(_canvasToPngBytes(cv));
      pg.drawImage(png, { x: 0, y: 0, width: Wpt, height: Hpt });
    }
    return await src.save();
  }

  /* ===== คำขอกู้เงิน ส.-งก.13 =====
   * เติมหน้า 1-3 (หน้า 4 = บันทึกผู้สอบสวน เจ้าหน้าที่ติ๊กเอง) · base = sngk13_base.pdf (Word export)
   */
  let _sngk13Pdf = null;
  async function _loadSngk13() {
    if (!_sngk13Pdf) _sngk13Pdf = await fetch(_ab() + "sngk13_base.pdf").then(r => r.arrayBuffer());
    if (!_fontLoaded) {
      const ff = new FontFace(OVERLAY_FONT, `url(${_ab()}assets/THSarabunNew.ttf)`);
      await ff.load(); document.fonts.add(ff); _fontLoaded = true;
    }
  }

  async function generateLoanRequest(data, opts = {}) {
    if (!global.SNGK13_MAP) throw new Error("ไม่พบ sngk13_fieldmap.js");
    await _loadSngk13();
    const { PDFDocument } = global.PDFLib;
    const src = await PDFDocument.load(_sngk13Pdf);
    const perPage = _collectFields(data, global.SNGK13_MAP);
    const srcPages = src.getPages();
    for (const pageNoStr of Object.keys(perPage)) {
      const pg = _pageOrThrow(srcPages, +pageNoStr, 'คำขอกู้ ส.-งก.13', perPage[pageNoStr]);
      const Wpt = pg.getWidth(), Hpt = pg.getHeight();
      const cv = _renderOverlayCanvas(Wpt, Hpt, perPage[pageNoStr], opts.calibrate ? "#0d19b3" : "#000000");
      const png = await src.embedPng(_canvasToPngBytes(cv));
      pg.drawImage(png, { x: 0, y: 0, width: Wpt, height: Hpt });
    }
    return await src.save();
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

  /* ===== หนังสือแสดงความจำนงขอกู้เงิน (1 หน้า) =====
   * base = janong_base.pdf v2 (Word export ของผู้จัดการ — ช่องติ๊กเป็น Wingdings 2 แล้ว)
   * ช่องติ๊ก = field ธรรมดาใน JANONG_MAP ที่มี tick:true → ส่ง data[key]="✓" ก็วาดให้เอง
   */
  let _janongPdf = null;
  async function _loadJanong() {
    if (!_janongPdf) _janongPdf = await fetch(_ab() + "janong_base.pdf").then(r => r.arrayBuffer());
    if (!_fontLoaded) {
      const ff = new FontFace(OVERLAY_FONT, `url(${_ab()}assets/THSarabunNew.ttf)`);
      await ff.load(); document.fonts.add(ff); _fontLoaded = true;
    }
  }

  async function generateJanong(data, opts = {}) {
    if (!global.JANONG_MAP) throw new Error("ไม่พบ janong_fieldmap.js");
    await _loadJanong();
    const { PDFDocument } = global.PDFLib;
    const src = await PDFDocument.load(_janongPdf);
    const perPage = _collectFields(data, global.JANONG_MAP);
    const srcPages = src.getPages();
    for (const pageNoStr of Object.keys(perPage)) {
      const pg = _pageOrThrow(srcPages, +pageNoStr, 'หนังสือแสดงความจำนง', perPage[pageNoStr]);
      const Wpt = pg.getWidth(), Hpt = pg.getHeight();
      const cv = _renderOverlayCanvas(Wpt, Hpt, perPage[pageNoStr], opts.calibrate ? "#0d19b3" : "#000000");
      const png = await src.embedPng(_canvasToPngBytes(cv));
      pg.drawImage(png, { x: 0, y: 0, width: Wpt, height: Hpt });
    }
    return await src.save();
  }

  /* ===== บันทึกข้อตกลงการติดตามหนี้สิน (1 หน้า) =====
   * ระบุบุคคลไว้เพื่อการทวงถามหนี้ ตาม พ.ร.บ.ทวงถามหนี้ 2558 ม.8
   * base = debtcontact_base.pdf (Word export) · ไม่มีช่องติ๊ก มีแต่เส้นจุดไข่ปลา
   * โครงเหมือน generateJanong ทุกบรรทัด ต่างแค่ map/base/ชื่อเอกสาร —
   * คงรูปแบบเดิมไว้โดยตั้งใจ เพื่อให้ใบที่ 6 อ่านเหมือนอีก 5 ใบ ไม่ต้องเรียนรู้ใหม่
   */
  let _debtcontactPdf = null;
  async function _loadDebtcontact() {
    if (!_debtcontactPdf) _debtcontactPdf = await fetch(_ab() + "debtcontact_base.pdf").then(r => r.arrayBuffer());
    if (!_fontLoaded) {
      const ff = new FontFace(OVERLAY_FONT, `url(${_ab()}assets/THSarabunNew.ttf)`);
      await ff.load(); document.fonts.add(ff); _fontLoaded = true;
    }
  }

  async function generateDebtcontact(data, opts = {}) {
    if (!global.DEBTCONTACT_MAP) throw new Error("ไม่พบ debtcontact_fieldmap.js");
    await _loadDebtcontact();
    const { PDFDocument } = global.PDFLib;
    const src = await PDFDocument.load(_debtcontactPdf);
    const perPage = _collectFields(data, global.DEBTCONTACT_MAP);
    const srcPages = src.getPages();
    for (const pageNoStr of Object.keys(perPage)) {
      const pg = _pageOrThrow(srcPages, +pageNoStr, 'บันทึกข้อตกลงการติดตามหนี้สิน', perPage[pageNoStr]);
      const Wpt = pg.getWidth(), Hpt = pg.getHeight();
      const cv = _renderOverlayCanvas(Wpt, Hpt, perPage[pageNoStr], opts.calibrate ? "#0d19b3" : "#000000");
      const png = await src.embedPng(_canvasToPngBytes(cv));
      pg.drawImage(png, { x: 0, y: 0, width: Wpt, height: Hpt });
    }
    return await src.save();
  }

  /* debug hook สำหรับเทสต์นโยบายตัดบรรทัด (แบบแผนเดียวกับ debugOverlayCanvas)
   * ⚠️ ต้องโหลดฟอนต์ overlay ก่อนวัด — fallback font กว้าง ~1.5 เท่า ทำผลเพี้ยนเงียบ */
  async function _fitDebug(text, max, size, wrap) {
    if (!_fontLoaded) {
      const ff = new FontFace(OVERLAY_FONT, `url(${_ab()}assets/THSarabunNew.ttf)`);
      await ff.load(); document.fonts.add(ff); _fontLoaded = true;
    }
    const cv = document.createElement("canvas");
    cv.width = cv.height = 8;
    const ctx = cv.getContext("2d");
    return _fit(ctx, { text: String(text), max, size: size || 14, wrap: wrap !== false });
  }

  /* ── ส่งไฟล์ PDF ให้ผู้ใช้ + บอกความจริงว่าเปิดได้หรือไม่ ──────────────
   *
   * ปัญหาเดิม (พบ 10-08-2569): ทั้ง 5 ปุ่มเรียก window.open() แล้วขึ้นข้อความ
   * "เปิดแท็บใหม่แล้ว" ทันทีโดยไม่ดูว่าเปิดสำเร็จไหม
   *   → บน iPad/iPhone มี await คั่นก่อน window.open ⇒ Safari ถือว่าไม่ได้เกิดจากการแตะ
   *     แล้วบล็อกป๊อปอัป · เจ้าหน้าที่เห็นเครื่องหมายถูกสีเขียวทั้งที่ไม่มีอะไรเปิดขึ้นมา
   *   → ตระกูลเดียวกับบั๊ก "ช่องว่างเงียบ" คือระบบรายงานว่าสำเร็จโดยไม่ได้ตรวจ
   *
   * 🔑 รวมไว้ที่เดียว ไม่ก๊อปตรรกะไป 5 ที่ — ไม่งั้นวันหนึ่งข้อความจะไม่ตรงกัน
   * 🔒 ลิงก์ดาวน์โหลดต้องมีเสมอ ไม่ว่าเปิดแท็บได้หรือไม่ (เป็นทางเดียวที่ใช้ได้บน iPad)
   */
  /* ── หน้าตัวอย่างก่อนพิมพ์ ────────────────────────────────────────────
   *
   * มติผู้จัดการ 10-08-2569: อยากได้ "ตัวอย่างแล้วพิมพ์ได้" เหมือนบนวินโดวส์
   *
   * 📱 **เลิกพึ่งตัวแสดง PDF ของเบราว์เซอร์แล้ว — ทดลองบน iPad จริงจนตัน 4 รอบ**
   *   ❌ `<iframe>` ไฟล์หลายหน้า → เห็นหน้า 1 แล้วพื้นขาวยาว ไม่มีหน้า 2
   *   ❌ `<iframe>` ไฟล์แยกรายหน้า → เห็นครบ แต่เนื้อหาถูกตัดขวา (iOS ไม่สนใจ #view=FitH)
   *   ❌ `iframe.contentWindow.print()` → กล่องพิมพ์ให้แค่หน้าที่กำลังแสดง
   *   ❌ นำทางแท็บไปที่ blob → เมนูหายหมด กลับไม่ได้ (กับดัก)
   *   ❌ `window.open(blob)` → ขึ้น PDF เต็มหน้า แต่ไม่มีเมนูเลือกเครื่องพิมพ์
   *   ⇒ เราไม่ได้ควบคุมตัวแสดง PDF เลย ปะเท่าไรก็ไม่จบ
   *
   * ✅ **วิธีที่ใช้อยู่**: pdf.js วาดทุกหน้าเป็น <canvas> ในหน้าเว็บของเราเอง
   *    แล้วสั่ง `window.print()` ของหน้าเรา — ทางเดียวกับ printReport() ที่พิสูจน์แล้วว่า
   *    ใช้ได้บน iPad และเคยยืนยันด้วยกระดาษจริง (21-07-2569)
   *    🔒 ห้ามกลับไปใช้ <iframe> PDF อีก และห้ามพา user ออกจากหน้าเว็บ
   *
   * 🔒 ไบต์ที่เอามาวาด = ไบต์ที่จะบันทึก/พิมพ์จริง ตัวอย่างจึงโกหกไม่ได้
   * 🔒 ทุกอย่างอยู่ในหน่วยความจำ + revoke blob ตอนปิด — ไม่มีไฟล์ค้างในเครื่อง
   *    จนกว่าจะกดปุ่มบันทึกเอง (ข้อกังวลเรื่องข้อมูลสมาชิกของผู้จัดการ)
   */
  const PV_DPI_SCALE = 3;   // 72dpi × 3 = 216dpi — ภาพ 150dpi ไม่คมพอสำหรับฟอร์มราชการ

  const PV_CSS = `
  /* 100dvh = ความสูง "ที่มองเห็นจริง" — inset:0 เพียว ๆ อ้าง layout viewport ซึ่งบน iOS
   * สูงกว่าพื้นที่จริง (แถบที่อยู่ยุบ/กางได้) แล้วเหลือพื้นดำเกินท้ายสุด (ผจก เจอ 10-08-2569) */
  #pdfPreview{position:fixed;inset:0;height:100dvh;z-index:9999;display:flex;flex-direction:column;
    background:#0d1117f2;backdrop-filter:blur(2px)}
  #pdfPreview .pv-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;
    padding:10px 12px;background:#111827;color:#e5e7eb;border-bottom:1px solid #374151}
  #pdfPreview .pv-title{font-weight:800;margin-right:auto;font-size:15px}
  #pdfPreview .pv-btn{border:1.5px solid #4b8f5f;background:#166534;color:#fff;font:inherit;
    font-size:15px;font-weight:800;padding:9px 16px;border-radius:10px;cursor:pointer}
  #pdfPreview .pv-btn.ghost{background:transparent;color:#a7f3c0}
  #pdfPreview .pv-note{width:100%;font-size:12.5px;color:#9ca3af;font-weight:400}
  #pdfPreview .pv-body{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;
    overscroll-behavior:contain;
    padding:12px;padding-bottom:max(12px,env(safe-area-inset-bottom));
    display:flex;flex-direction:column;align-items:center;gap:14px}
  #pdfPreview .pv-sheet{width:min(100%,840px);background:#fff;border-radius:4px;
    box-shadow:0 6px 20px -8px #000}
  /* canvas กว้างเต็มแผ่น สูงตามสัดส่วนจริงของหน้านั้น (ไม่ล็อก A4 — บางฟอร์มไม่ใช่ A4 เป๊ะ) */
  #pdfPreview .pv-canvas{display:block;width:100%;height:auto;border-radius:4px}
  #pdfPreview .pv-cap{width:min(100%,840px);color:#9ca3af;font-size:12.5px;line-height:1.5}
  #pdfPreview .pv-cap b{color:#e5e7eb}
  html.pv-open,body.pv-open{overflow:hidden}

  /* ── โหมดพิมพ์: พิมพ์ "หน้าเว็บของเรา" ไม่ใช่ฝากตัวแสดง PDF ──────────────
   *
   * 🔴 **ห้ามให้กฎพิมพ์ขึ้นกับคลาสที่ JS สลับ** — เคยทำแล้วพังบน iPad (10-08-2569):
   *    iOS เปิดกล่องพิมพ์แบบไม่บล็อก แล้วไปเรนเดอร์ภาพตัวอย่าง **หลัง** print() คืนค่า
   *    โค้ดล้างคลาสทำงานก่อน ⇒ กฎไม่ทำงานเลย ⇒ พิมพ์ออกมาเป็นภาพหน้าจอทั้งแผง หน้าเดียว
   *    ลอกแบบแผนจาก printReport() ที่พิมพ์ได้จริงมาตลอด: **กฎคงที่ ไม่มีการสลับคลาส**
   *
   * กฎยึด "การมีอยู่ของแผงตัวอย่าง" — แผงอยู่ใน DOM แค่ตอนเปิดดูอยู่ ⇒ สโคปเองโดยธรรมชาติ
   * และ stylesheet นี้ถูกถอดออกตอนปิดแผง (ดู _pvClose) จึงไม่ไปแก้ @page ของรายงานคำนวณ */
  @media print{
    html, body{background:#fff!important;margin:0!important;padding:0!important;
      height:auto!important;min-height:0!important;overflow:visible!important}
    body > *{display:none!important}
    body > #pdfPreview{display:block!important;position:static!important;
      inset:auto!important;height:auto!important;margin:0!important;padding:0!important;
      background:#fff!important;backdrop-filter:none!important}
    #pdfPreview .pv-bar, #pdfPreview .pv-cap{display:none!important}
    #pdfPreview .pv-body{display:block!important;overflow:visible!important;
      margin:0!important;padding:0!important;gap:0!important;height:auto!important}
    /* 🔴 **ห้ามใช้ vh/dvh ในบล็อกนี้เด็ดขาด** — ในการพิมพ์ vh คือความสูง "หน้าจอ"
     * ไม่ใช่ความสูง "หน้ากระดาษ" · จอ iPad สูง ~312mm > A4 297mm ⇒ แผ่นเดียวถูกหั่น
     * เป็นหลายหน้า: เอกสาร 2 หน้าออกมา 8 หน้า หน้าเปล่าสลับกับเศษข้อความ
     * (ผจก เจอบน iPad 10-08-2569 · ผมเป็นคนใส่ vh เอง)
     * ⇒ วัดด้วยหน่วยกระดาษจริงเท่านั้น · 296mm = A4 หัก 1mm กันปัดเศษไปสร้างหน้าเปล่า */
    #pdfPreview .pv-sheet{width:210mm!important;height:296mm!important;
      margin:0 auto!important;overflow:hidden!important;
      display:flex!important;align-items:center;justify-content:center;
      box-shadow:none!important;border-radius:0!important;
      break-inside:avoid;page-break-inside:avoid;break-after:page;page-break-after:always}
    #pdfPreview .pv-sheet:last-child{break-after:auto;page-break-after:auto}
    /* ฟอร์มที่ไม่ใช่ A4 เป๊ะ (เช่น ส.-งก.13) ย่อพอดีแผ่นด้วย max-* ไม่ล้นออกไป */
    #pdfPreview .pv-canvas{width:auto!important;height:auto!important;
      max-width:210mm!important;max-height:296mm!important}
    @page{size:A4 portrait;margin:0}
  }
  `;

  /* 🔴 **แผงตัวอย่างต้องอยู่ "เอกสารบนสุด" เสมอ ไม่ใช่ในกรอบ iframe**
   *
   * เว็บแอปเงินกู้เปิดเครื่องคิดเงินกู้เป็น iframe ที่หน้า /print แล้วยืดกรอบให้สูงเท่าเนื้อหา
   * ถ้าแผงอยู่ในกรอบ จะพังสองอย่างพร้อมกัน (ผจก เจอบน iPad 10-08-2569):
   *   ① `position:fixed`/`100dvh` ในกรอบอ้างอิง "ความสูงกรอบ" (~3,000px) ไม่ใช่ความสูงจอ
   *      ⇒ แผงยาวเกินจอ เหลือพื้นดำยาวใต้แผ่นสุดท้าย
   *   ② `@page{margin:0}` อยู่ในเอกสารของกรอบ ไม่ใช่เอกสารที่ถูกพิมพ์
   *      ⇒ Safari เติม URL/วันที่/เลขหน้าที่มุมล่างกระดาษ
   * ทำได้เพราะกรอบมาจากเซิร์ฟเวอร์เดียวกัน (same-origin — print.html อ่าน contentDocument อยู่แล้ว)
   * เปิด /calc/ ตรง ๆ → คืนตัวเอง พฤติกรรมเดิมไม่เปลี่ยน */
  function _pvHost() {
    const chain = [global.top, global.parent, global];
    for (const w of chain) {
      try {
        if (w && w.document && w.document.body) return { win: w, doc: w.document };
      } catch (e) { /* คนละ origin → ไล่ตัวถัดไป */ }
    }
    return { win: global, doc: document };
  }

  /* 🔒 stylesheet นี้ต้องอยู่ "แค่ตอนแผงตัวอย่างเปิด" แล้วถอดออกตอนปิด
   * เพราะข้างในมี @page{margin:0} ซึ่งสโคปด้วย selector ไม่ได้ — ถ้าค้างไว้
   * รายงานคำนวณที่ตั้ง @page{margin:8mm} ไว้จะถูกแก้ขอบเงียบ ๆ (ไม่มีใครเห็นจนพิมพ์จริง) */
  /* 🔴 ต่อท้าย **body** ไม่ใช่ head — เพราะ @page ไม่มีตัวตัดสินอื่นนอกจาก "ใครมาทีหลัง"
   * หน้า /print ของเว็บแอปมี <style> @page{margin:8mm} อยู่ใน body (บล็อกเนื้อหา)
   * ถ้าเราใส่ที่ head จะถูกทับ ⇒ พิมพ์สัญญาได้ขอบ 8mm แล้ว Safari กลับมาเติม stamp
   * (จับได้ตอนกวาดทางพิมพ์ 10-08-2569 ด้วยการอ่านลำดับ cssRules ของจริง) */
  function _pvStyle(doc) {
    if (doc.getElementById('pdfPreviewCss')) return;
    const st = doc.createElement('style');
    st.id = 'pdfPreviewCss';
    st.textContent = PV_CSS;
    (doc.body || doc.head).appendChild(st);
  }

  let _pvUrls = [];                     // blob ทั้งหมดของรอบนี้ — ต้อง revoke ตอนปิด
  let _pvLast = null;                   // ไบต์ชุดล่าสุด (ในหน่วยความจำ) — เปิดตัวอย่างซ้ำได้

  function _pvClose() {
    // ล้างทั้งเอกสารบนสุดและเอกสารนี้ — เผื่อเคยเปิดคาไว้คนละชั้น
    const docs = [];
    try { const h = _pvHost(); if (h.doc) docs.push(h.doc); } catch (e) { /* ไม่มีก็ข้าม */ }
    if (docs.indexOf(document) < 0) docs.push(document);
    for (const d of docs) {
      const el = d.getElementById('pdfPreview');
      if (el) el.remove();
      const css = d.getElementById('pdfPreviewCss');
      if (css) css.remove();            // ถอดกฎพิมพ์ออกด้วย — ดูคำเตือนที่ _pvStyle
      d.documentElement.classList.remove('pv-open');
      if (d.body) d.body.classList.remove('pv-open');
    }
    _pvUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch (e) { /* ปิดซ้ำไม่เป็นไร */ } });
    _pvUrls = [];
  }

  function _pdfjs() {
    const lib = global.pdfjsLib;
    if (!lib) return null;
    // worker อยู่ในเครื่องเดียวกัน — ไม่เรียกเน็ต (เว็บแอปต้องทำงานได้ตอนเน็ตล่ม)
    if (!lib.GlobalWorkerOptions.workerSrc) {
      lib.GlobalWorkerOptions.workerSrc = _ab() + 'vendor/pdf.worker.min.js';
    }
    return lib;
  }

  /* มีหมึกลงบน canvas จริงไหม — สุ่มพิกเซล ไม่ไล่ทั้งภาพ (4.5 ล้านพิกเซลต่อหน้า)
   * ใช้เป็นเกณฑ์ "วาดเสร็จ" แทนการเชื่อ promise ของ pdf.js (ดูคำเตือนใน _pvRender) */
  function _pvHasInk(cv) {
    try {
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      for (let i = 0; i < d.length; i += 4 * 401) {
        if ((d[i] + d[i + 1] + d[i + 2]) / 3 < 200) return true;
      }
    } catch (e) { /* อ่านไม่ได้ = ถือว่ายังไม่พร้อม */ }
    return false;
  }

  /* วาดทุกหน้าเป็น canvas ต่อท้ายใน body ที่ให้มา
   * ⚠️ ต้องส่ง "สำเนา" ของไบต์ให้ pdf.js — มันยึด ArrayBuffer ไปใช้ (detach)
   *    แล้วปุ่มบันทึก/เปิดตัวอย่างซ้ำจะได้ไฟล์ว่างเปล่าโดยไม่มีสัญญาณเตือน
   * 🔴 **ห้ามผูกอะไรไว้กับ `render().promise` ว่าจะ resolve** — วัดจริง 10-08-2569:
   *    ภาพขึ้นบน canvas ครบแล้วแต่ promise ยังค้าง (เกี่ยวกับการหยุดจ่าย rAF ของแท็บ
   *    ที่ไม่ได้แสดงอยู่) ⇒ ถ้าเอา promise เป็นเงื่อนไข คำบรรยาย/ปุ่มพิมพ์จะไม่มาเลย
   *    จึงกันเวลาไว้ต่อหน้า แล้วตัดสิน "เสร็จ" จากหมึกบนภาพจริง (_pvHasInk) */
  async function _pvRender(bytes, body, onProgress) {
    const lib = _pdfjs();
    if (!lib) throw new Error('ไม่พบ pdf.js (vendor/pdf.min.js)');
    /* 🔴 ownerDocument ต้องเป็นเอกสารที่ canvas อยู่จริง
     * pdf.js ฝัง @font-face ของฟอนต์ในไฟล์ PDF ลง "เอกสารเจ้าของ" ก่อนวาด
     * ถ้าไม่บอก มันใช้เอกสารของสคริปต์นี้ (ในกรอบ iframe) แต่ canvas อยู่หน้าบนสุด
     * ⇒ ฟอนต์ไม่ถูกโหลดในเอกสารนั้น ตัวอักษรออกมาเป็นกล่องสี่เหลี่ยมทั้งหน้า
     * 🪤 ตัวนับพิกเซลจับไม่ได้เลย (กล่องก็เป็นหมึก) — จับได้เพราะดูภาพจริง */
    const owner = body.ownerDocument || document;
    const doc = await lib.getDocument({ data: bytes.slice(0), ownerDocument: owner }).promise;
    const n = doc.numPages;
    if (onProgress) onProgress(0, n);     // รู้จำนวนหน้าทันที ไม่ต้องรอวาดเสร็จ
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const vp = page.getViewport({ scale: PV_DPI_SCALE });
      // ล้างเฉพาะข้อความ "กำลังเตรียมตัวอย่าง…" — ห้ามใช้ textContent='' ล้างทั้ง body
      // เพราะจะกวาดคำบรรยาย (.pv-cap) ที่เพิ่งใส่ไปด้วยแบบเงียบ ๆ (เจอจริง 10-08-2569)
      if (i === 1) {
        const ld = body.querySelector('.pv-loading');
        if (ld) ld.remove();
      }
      // สร้าง element ในเอกสารเดียวกับ body ที่จะเอาไปแปะ (อาจเป็นเอกสารบนสุด ไม่ใช่ของกรอบ)
      const hdoc = body.ownerDocument || document;
      const sheet = hdoc.createElement('div');
      sheet.className = 'pv-sheet';
      const cv = hdoc.createElement('canvas');
      cv.className = 'pv-canvas';
      cv.width = Math.round(vp.width);
      cv.height = Math.round(vp.height);
      cv.setAttribute('data-page', String(i));
      sheet.appendChild(cv);
      body.appendChild(sheet);
      const task = page.render({ canvasContext: cv.getContext('2d'), viewport: vp });
      await Promise.race([
        task.promise.catch(() => null),
        new Promise(r => setTimeout(r, 15000)),   // promise ค้างก็ต้องไปหน้าถัดไปได้
      ]);
      if (onProgress) onProgress(i, n);
    }
    return n;
  }

  function deliverPdf(bytes, filename, okText) {
    const safeName = String(filename).replace(/"/g, '');
    _pvClose();                         // ล้างรอบก่อน (revoke blob เก่า) ก่อนสร้างของใหม่เสมอ
    _pvLast = { bytes: bytes, filename: filename, okText: okText };
    const full = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    _pvUrls.push(full);
    // แผงไปอยู่เอกสารบนสุด (ดูคำเตือนที่ _pvHost) — เปิด /calc/ ตรง ๆ ก็คือเอกสารนี้เอง
    const host = _pvHost();
    const hdoc = host.doc;
    _pvStyle(hdoc);

    const wrap = hdoc.createElement('div');
    wrap.id = 'pdfPreview';
    wrap.innerHTML =
      '<div class="pv-bar no-print">'
      + '<span class="pv-title">' + okText + '</span>'
      + '<button class="pv-btn" data-pv="print">🖨 พิมพ์</button>'
      + '<a class="pv-btn ghost" data-pv="save" href="' + full + '" download="' + safeName
      + '" style="text-decoration:none">⬇ บันทึกไฟล์</a>'
      + '<button class="pv-btn ghost" data-pv="close">✕ ปิด</button>'
      // 🚫 ไม่มีปุ่ม "เปิดเต็มหน้า" อีก — มันพา user ออกจากหน้าเว็บแล้วกลับไม่ได้
      //    (ผจก เจอบน iPad 10-08-2569: เมนูหายหมด) · ปุ่มบันทึกไฟล์คือทางออกที่ปลอดภัย
      + '<div class="pv-note">ปุ่ม <b>พิมพ์</b> ขึ้นกล่องพิมพ์ของเครื่อง '
      + 'ครบทุกหน้าในครั้งเดียว (ใช้ได้ทั้งคอมพิวเตอร์และ iPad) '
      + '· เอกสารอยู่ในหน่วยความจำเท่านั้น ยังไม่ถูกบันทึกลงเครื่องจนกดปุ่มบันทึก</div>'
      + '</div><div class="pv-body">กำลังเตรียมตัวอย่าง…</div>';
    hdoc.body.appendChild(wrap);
    hdoc.documentElement.classList.add('pv-open');
    hdoc.body.classList.add('pv-open');

    const body = wrap.querySelector('.pv-body');
    wrap.addEventListener('click', ev => {
      const act = ev.target.getAttribute && ev.target.getAttribute('data-pv');
      if (!act) return;
      if (act === 'close') { ev.preventDefault(); _pvClose(); }
      /* พิมพ์ = สั่งจากหน้าเว็บของเราเอง (canvas ที่วาดไว้) ทางเดียว ทุกแพลตฟอร์ม
       * 🔒 ต้อง sync ในจังหวะที่นิ้วแตะ ห้ามมี await คั่นก่อน window.print()
       *    ไม่งั้น Safari ถือว่าไม่ได้เกิดจากการแตะแล้วเงียบไปเลย (บทเรียนเดิม printReport)
       * ⚠️ ถ้ายังวาดไม่เสร็จ ห้ามพิมพ์ — จะได้กระดาษว่างหรือขาดหน้า */
      if (act === 'print') {
        ev.preventDefault();
        /* 🔒 ห้ามพิมพ์ก่อนภาพครบ — เกณฑ์คือ "มีหมึกบนทุกหน้า" ไม่ใช่ promise ของ pdf.js
         *    (promise ค้างได้ทั้งที่ภาพขึ้นครบ — วัดจริง 10-08-2569) */
        const cvs = [...body.querySelectorAll('canvas.pv-canvas')];
        const ready = cvs.length === (wrap._pvPages || 0) && cvs.length > 0
          && cvs.every(_pvHasInk);
        if (!ready) {
          alert('ยังเตรียมตัวอย่างไม่เสร็จ (' + cvs.filter(_pvHasInk).length + '/'
            + (wrap._pvPages || '?') + ' หน้า) — รอให้เอกสารขึ้นครบทุกแผ่นก่อนสั่งพิมพ์');
          return;
        }
        /* 🔒 sync ล้วน — ห้ามมี await/setTimeout ก่อน print() (Safari ถือว่าไม่ได้เกิดจากการแตะ)
         * และห้ามไปยุ่งกับ DOM/คลาสใด ๆ ตอนนี้ กฎพิมพ์เป็นค่าคงที่อยู่แล้ว
         * 🔑 สั่งพิมพ์จาก window ของเอกสารบนสุด — ถ้าสั่งจากในกรอบ Safari จะเติม
         *    URL/วันที่/เลขหน้าที่มุมล่างกระดาษ เพราะ @page ของเราไม่ใช่ของงานพิมพ์นั้น */
        host.win.print();
      }
    });

    /* วาดเอกสารด้วย pdf.js — ไม่บล็อกผู้เรียก (คืนข้อความสถานะไปก่อน) */
    body.textContent = '';
    const loading = hdoc.createElement('div');
    loading.className = 'pv-cap pv-loading no-print';
    loading.textContent = 'กำลังเตรียมตัวอย่าง…';
    body.appendChild(loading);
    const cap = hdoc.createElement('div');
    cap.className = 'pv-cap no-print';
    _pvRender(bytes, body, (done, total) => {
      wrap._pvPages = total;             // ปุ่มพิมพ์ใช้ค่านี้เทียบว่าครบหรือยัง
      cap.innerHTML = done >= total
        ? '<b>เอกสาร ' + total + ' หน้า</b> — เลื่อนดูให้ครบทุกแผ่นก่อนสั่งพิมพ์'
        : '<b>เอกสาร ' + total + ' หน้า</b> — กำลังวาด ' + done + '/' + total + ' …';
      if (!cap.parentNode) body.insertBefore(cap, body.firstChild);
    })
      .catch(err => {
        /* วาดไม่ได้ → บอกตรง ๆ + เหลือทางบันทึกไฟล์ไว้ ห้ามเหลือจอเปล่าให้เดา */
        console.error(err);
        body.textContent = '';
        cap.innerHTML = '<b>แสดงตัวอย่างในหน้านี้ไม่ได้</b> — ' + (err && err.message || err)
          + ' · ใช้ปุ่ม <b>บันทึกไฟล์</b> ด้านบนแล้วเปิดไฟล์เพื่อพิมพ์แทน';
        body.appendChild(cap);
      });

    return '✅ ' + okText + ' — เปิดหน้าตัวอย่างให้แล้ว'
      + ' <button type="button" onclick="ContractFill.reopenPreview()"'
      + ' style="margin-left:6px;padding:4px 12px;border-radius:8px;border:0;'
      + 'background:var(--fill);color:var(--on-fill);font-weight:800;cursor:pointer">'
      + 'เปิดตัวอย่างอีกครั้ง</button>';
  }

  /* สั่งพิมพ์ที่เอกสารบนสุด — ใช้ร่วมกับงานพิมพ์อื่นในหน้า (เช่น printReport ของรายงานคำนวณ)
   * เพราะเมื่อหน้านี้ถูกฝังเป็น iframe งานพิมพ์เป็นของหน้าบนสุด ถ้าสั่งจากในกรอบ
   * `@page` ของกรอบจะถูกเมิน แล้วได้ขอบ/stamp ของหน้าแม่มาแทน
   * 🔒 ต้องเรียก sync ในจังหวะที่นิ้วแตะ ห้ามมี await คั่น */
  function printHost() {
    _pvHost().win.print();
  }

  /* ปิดตัวอย่างไปแล้วอยากดูซ้ำ — สร้างจากไบต์ชุดเดิม ไม่ต้องกดสร้างเอกสารใหม่ */
  function reopenPreview() {
    if (!_pvLast) return alert('ยังไม่มีเอกสารที่สร้างไว้ — กดปุ่มสร้างเอกสารก่อน');
    deliverPdf(_pvLast.bytes, _pvLast.filename, _pvLast.okText);
  }

  // _PV_CSS = test hook ให้ test_print_pages.html ใช้ "กฎตัวจริง" ไม่ใช่สำเนา
  // (สำเนาจะทำให้ด่านผ่านทั้งที่ของจริงพัง)
  global.ContractFill = { generateContract, generateGuarantee, generateShare, generateLoanRequest, generateJanong, generateDebtcontact, bahtText, thaiDate, fmtNum, deliverPdf, reopenPreview, closePreview: _pvClose, printHost, _PV_CSS: PV_CSS, debugOverlayCanvas, debugOverlayCanvasFM, _fitDebug, _SCALE: SCALE };
})(window);
