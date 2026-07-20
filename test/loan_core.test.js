/* เทสต์แกนคำนวณเงินกู้ — loan_core.js
 * รันด้วย: node test/run.js   (ไม่มี dependency ภายนอก)
 *
 * เน้น "สิ่งที่ถ้าพังแล้วสัญญาผิด" ไม่ใช่ coverage ตัวเลข:
 *   invariant ผลรวม · ปีอธิกสุรทิน · ตัดดอก 30 ก.ย. · การปัดงวด · grace ·
 *   เพดานค้ำประกัน · เบี้ยปรับ · ยอดปิด · และ pattern *Total (ยอดรวม = ผลบวกจริง)
 */
'use strict';
const C = require('../loan_core.js');

const D = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const sum = (a) => a.reduce((s, x) => s + x, 0);

module.exports = function (T) {

  // ═══════════════════════════════════════════════════════════════════
  // 1. INVARIANT — ผลรวมงวดต้น = เงินต้นเป๊ะ · จบที่ 0 · ไม่มีงวดติดลบ
  // ═══════════════════════════════════════════════════════════════════
  T.test('invariant รายปี: Σ เงินต้นที่ส่ง = เงินต้น · คงเหลือสุดท้าย = 0 · ไม่มีงวดติดลบ (สวีปกว้าง)', () => {
    let n = 0;
    for (const P of [1000, 3000, 12345, 50000, 100000, 250000, 999999]) {
      for (let N = 1; N <= 15; N++) {
        for (const rate of [0, 5, 6.5, 8, 15]) {
          for (const d of ['2024-01-15', '2024-02-29', '2024-09-29', '2024-09-30', '2024-10-01', '2024-12-31', '2025-05-31']) {
            const r = C.calcCoopCore({ P, d0: D(d), rate, N });
            const key = `P${P} N${N} r${rate} ${d}`;
            T.eq(sum(r.rows.map(x => x.principalPaid)), P, 'Σ ต้น ' + key);
            T.eq(r.rows[r.rows.length - 1].balAfter, 0, 'คงเหลือสุดท้าย ' + key);
            T.ok(r.rows.every(x => x.principalPaid >= 0), 'งวดต้นติดลบ ' + key);
            T.ok(r.rows.every(x => x.interest >= 0), 'ดอกเบี้ยติดลบ ' + key);
            T.ok(r.rows.every(x => x.balAfter >= 0), 'ยอดคงเหลือติดลบ ' + key);
            T.eq(r.rows.filter(x => x.isPrincipal).length, N, 'จำนวนงวดต้น ' + key);
            n++;
          }
        }
      }
    }
    T.ok(n === 3675, 'จำนวนเคสที่สวีป (got ' + n + ')');
  });

  T.test('invariant รายเดือน (fixed + annuity): Σ เงินต้น = เงินต้น · จบที่ 0 · ไม่มีงวดติดลบ', () => {
    for (const mode of ['fixed', 'annuity']) {
      for (const P of [3000, 50000, 100000, 999999]) {
        for (const N of [1, 2, 5, 10, 15]) {
          for (const rate of [0, 6.5, 15]) {
            for (const d of ['2024-02-29', '2024-09-29', '2024-09-30', '2024-10-01', '2025-05-31']) {
              const r = C.calcMonthlyCore({ P, d0: D(d), rate, N, mode });
              const key = `${mode} P${P} N${N} r${rate} ${d}`;
              T.near(sum(r.rows.map(x => x.principalPaid)), P, 1e-6, 'Σ ต้น ' + key);
              T.near(r.rows[r.rows.length - 1].balAfter, 0, 1e-6, 'คงเหลือสุดท้าย ' + key);
              T.ok(r.rows.every(x => x.interest >= -1e-9), 'ดอกเบี้ยติดลบ ' + key);
              T.eq(r.rows.filter(x => x.yearEnd).length, N, 'จำนวนงวดครบกำหนดปี ' + key);
              // โหมด (ก) ต้นเท่ากัน: ห้ามมีงวดต้นติดลบเด็ดขาด
              // โหมด (ข) annuity: แถวทดเศษสิ้นปีติดลบได้ในเคสสุดขั้ว (ดู FINDING-1 ท้ายไฟล์)
              //   — เป็นพฤติกรรมเดิมของระบบ ไม่ใช่ผลจากการแยกแกน · เทสต์เฝ้าไม่ให้ลามเกินแถวทดเศษ
              if (mode === 'fixed') {
                T.ok(r.rows.every(x => x.principalPaid >= -1e-6), 'งวดต้นติดลบ ' + key);
              } else {
                T.ok(r.rows.every(x => x.principalPaid >= -1e-6 || x.yearEnd),
                     'annuity: งวดต้นติดลบนอกแถวทดเศษสิ้นปี ' + key);
              }
            }
          }
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // 2. pattern *Total — ทุก "ยอดรวม" ต้องเท่าผลบวกส่วนย่อยจริง
  //    (บั๊กชนิดนี้เคยเกิด 3 ครั้งในระบบนี้ — ข้อนี้สำคัญที่สุด)
  // ═══════════════════════════════════════════════════════════════════
  T.test('*Total รายปี: totI/totPay = ผลบวกแถวจริง (ไม่ใช่ค่าที่ยัดใส่ช่องรวม)', () => {
    for (const P of [3000, 100000, 999999]) for (const N of [1, 3, 7, 15]) for (const rate of [0, 6.5, 15])
      for (const d of ['2024-02-29', '2024-09-30', '2024-10-01', '2025-05-31']) {
        const r = C.calcCoopCore({ P, d0: D(d), rate, N });
        const key = `P${P} N${N} r${rate} ${d}`;
        T.eq(r.totI, C.round2(sum(r.rows.map(x => C.round2(x.interest)))), 'totI ' + key);
        T.eq(r.totPay, C.round2(sum(r.rows.map(x => C.round2(x.pay)))), 'totPay ' + key);
        // ชำระรวม = ดอกรวม + เงินต้นรวม (ตัวเลขที่ปรากฏบนแถว "รวมทั้งสิ้น")
        T.near(r.totPay, C.round2(r.totI + P), 0.02, 'totPay = totI + P ' + key);
        // ทุกแถว: รวมชำระ = ดอก + ต้น
        r.rows.forEach((x, i) => T.near(x.pay, x.interest + x.principalPaid, 1e-9, `row${i} pay ` + key));
      }
  });

  T.test('*Total รายเดือน: totI/totPay = ผลบวกแถวจริง', () => {
    for (const mode of ['fixed', 'annuity']) for (const P of [3000, 100000]) for (const N of [1, 5, 15])
      for (const rate of [0, 6.5]) for (const d of ['2024-09-29', '2024-10-01']) {
        const r = C.calcMonthlyCore({ P, d0: D(d), rate, N, mode });
        const key = `${mode} P${P} N${N} r${rate} ${d}`;
        T.eq(r.totI, sum(r.rows.map(x => C.round2(x.interest))), 'totI ' + key);
        T.eq(r.totPay, sum(r.rows.map(x => C.round2(x.pay))), 'totPay ' + key);
        r.rows.forEach((x, i) => T.near(x.pay, x.interest + x.principalPaid, 1e-9, `row${i} pay ` + key));
      }
  });

  T.test('*Total ปปน. (รายปี + รายเดือน): totI/totPay/graceInt = ผลบวกแถวจริง', () => {
    for (const A of [50000, 250000, 1234567.89]) for (const B of [0, 15000]) for (const N of [2, 5, 15])
      for (const G of [0, 1, 3]) for (const rate of [0, 6.5]) for (const d of ['2024-09-30', '2025-05-31']) {
        const key = `A${A} B${B} N${N} G${G} r${rate} ${d}`;
        const r = C.calcRestructureCore({ A, B, d0: D(d), rate, nYears: N, nGrace: G });
        T.eq(r.totI, C.round2(sum(r.rows.map(x => C.round2(x.interest)))), 'ปปน totI ' + key);
        T.eq(r.totPay, C.round2(sum(r.rows.map(x => C.round2(x.pay)))), 'ปปน totPay ' + key);
        r.rows.forEach((x, i) => T.near(x.pay, x.interest + x.payA + x.payB, 1e-9, `ปปน row${i} pay ` + key));
        /* ⚠️ อย่าเขียน T.near(totPay, totI+A+B) เป็นเกณฑ์ที่นี่
         * รายปี: สองสูตรนี้ให้ค่าเท่ากันเสมอ (payA/payB มีไม่เกิน 2 ตำแหน่ง → เป็นเอกลักษณ์ทางพีชคณิต)
         *   ⇒ เอามาเป็นเกณฑ์แล้วจะ "อวยพร" บั๊กชนิดยัดค่าลงช่องรวม แทนที่จะจับมัน (พิสูจน์ด้วย mutation M4)
         * รายเดือน: ppB = tB ÷ จำนวนงวด → ทศนิยมไม่ลงตัว → สองสูตรต่างกันได้ถึง ~0.12 บาท
         *   ⇒ เกณฑ์ที่เชื่อได้มีอย่างเดียว = เทียบกับผลบวกแถวจริง (บรรทัดล่าง) */

        for (const mode of ['fixed', 'annuity']) {
          const m = C.calcRestructMonthlyCore({ A, B, d0: D(d), rate, nYears: N, nGrace: G, mode });
          T.eq(m.totI, C.round2(sum(m.rows.map(x => C.round2(x.interest)))), `ปปน/เดือน ${mode} totI ` + key);
          T.eq(m.totPay, C.round2(sum(m.rows.map(x => C.round2(x.pay)))), `ปปน/เดือน ${mode} totPay ` + key);
          m.rows.forEach((x, i) => T.near(x.pay, x.interest + x.ppA + x.ppB, 1e-9, `ปปน/เดือน ${mode} row${i} pay ` + key));
        }
      }
  });

  T.test('*Total เบี้ยปรับ + ยอดปิด: total = ผลบวกส่วนย่อย', () => {
    const p = C.calcPenaltyCore({ Op: 250000, Dd: D('2024-09-30'), Pd: D('2025-03-31'), fineRate: 3 });
    T.eq(p.total, p.Op + p.penalty, 'penalty total');
    const y = C.calcPayoffCore({ P: 100000, d0: D('2024-01-15'), rate: 6.5, N: 5, X: D('2025-06-30') });
    T.eq(y.payoff, y.outstanding + y.accrued, 'payoff = ต้นคงเหลือ + ดอกค้าง');
  });

  T.test('ปปน.: Σ ส่งต้น A = A · Σ ส่งต้น B = B · คงเหลือจบที่ 0', () => {
    for (const A of [50000, 250000, 1234567.89]) for (const B of [0, 15000, 987654.32])
      for (const N of [1, 2, 5, 15]) for (const G of [0, 1, 2, 3]) for (const d of ['2024-09-29', '2024-10-01']) {
        const r = C.calcRestructureCore({ A, B, d0: D(d), rate: 6.5, nYears: N, nGrace: G });
        const key = `A${A} B${B} N${N} G${G} ${d}`;
        T.near(sum(r.rows.map(x => x.payA)), A, 1e-6, 'Σ payA ' + key);
        T.near(sum(r.rows.map(x => x.payB)), B, 1e-6, 'Σ payB ' + key);
        T.near(r.rows[r.rows.length - 1].balAafter, 0, 1e-6, 'A คงเหลือ ' + key);
        T.near(r.rows[r.rows.length - 1].balBafter, 0, 1e-6, 'B คงเหลือ ' + key);
      }
  });

  // ═══════════════════════════════════════════════════════════════════
  // 3. ปีอธิกสุรทิน + การนับวัน
  // ═══════════════════════════════════════════════════════════════════
  T.test('ปีอธิกสุรทิน: นับวันถูก (2024 มี 29 ก.พ. · 2023/2025 ไม่มี)', () => {
    T.eq(C.daysBetween(D('2024-02-28'), D('2024-03-01')), 2, 'ก.พ. 2024 (อธิกสุรทิน)');
    T.eq(C.daysBetween(D('2023-02-28'), D('2023-03-01')), 1, 'ก.พ. 2023');
    T.eq(C.daysBetween(D('2025-02-28'), D('2025-03-01')), 1, 'ก.พ. 2025');
    T.eq(C.daysBetween(D('2024-01-01'), D('2025-01-01')), 366, 'ปี 2024 = 366 วัน');
    T.eq(C.daysBetween(D('2023-01-01'), D('2024-01-01')), 365, 'ปี 2023 = 365 วัน');
    T.eq(C.lastDay(2024, 1), 29, 'ก.พ. 2024');
    T.eq(C.lastDay(2100, 1), 28, 'ก.พ. 2100 (หาร 100 ลงตัว ไม่ใช่อธิกสุรทิน)');
    T.eq(C.lastDay(2000, 1), 29, 'ก.พ. 2000 (หาร 400 ลงตัว = อธิกสุรทิน)');
    // clamp วันสิ้นเดือน
    T.eqDate(C.addMonthsClamp(D('2024-01-31'), 1), '2024-02-29', '31 ม.ค. + 1 เดือน (ปีอธิกสุรทิน)');
    T.eqDate(C.addMonthsClamp(D('2023-01-31'), 1), '2023-02-28', '31 ม.ค. + 1 เดือน (ปีปกติ)');
    T.eqDate(C.addMonthsClamp(D('2024-03-31'), -1), '2024-02-29', 'ถอยหลัง 1 เดือน');
    T.eqDate(C.addMonthsClamp(D('2024-01-15'), 12), '2025-01-15', 'ข้ามปี');
    T.eqDate(C.addMonthsClamp(D('2024-01-15'), -13), '2022-12-15', 'ถอยข้ามปี');
    // 🔑 ดอกเบี้ยต้องไวต่อปีอธิกสุรทิน: ช่วงปีบัญชีที่คร่อม 29 ก.พ. ยาวกว่า 1 วัน
    T.eq(C.daysBetween(D('2023-10-01'), D('2024-09-30')), 365, 'ปีบัญชีคร่อม 29 ก.พ. 2024');
    T.eq(C.daysBetween(D('2024-10-01'), D('2025-09-30')), 364, 'ปีบัญชีไม่คร่อม');
    const leapYr = C.calcCoopCore({ P: 100000, d0: D('2023-10-01'), rate: 6.5, N: 2 });
    const plainYr = C.calcCoopCore({ P: 100000, d0: D('2024-10-01'), rate: 6.5, N: 2 });
    T.eq(leapYr.rows[0].days, 365, 'แถวปีแรก (คร่อม 29 ก.พ.)');
    T.eq(plainYr.rows[0].days, 364, 'แถวปีแรก (ไม่คร่อม)');
    T.ok(leapYr.rows[0].interest > plainYr.rows[0].interest,
         'ดอกเบี้ยปีที่คร่อม 29 ก.พ. ต้องมากกว่า (ถ้าเท่ากัน = ไม่ได้นับวันจริง)');
    T.near(leapYr.rows[0].interest - plainYr.rows[0].interest, 100000 * 6.5 / 100 * 1 / 365, 1e-9, 'ส่วนต่าง = ดอก 1 วันพอดี');
  });

  T.test('สูตรดอกเบี้ย = ต้น × อัตรา% × วัน ÷ 365 (ไม่ใช่ ÷360)', () => {
    // 30 ก.ย. 2024 → 30 ก.ย. 2025 = 365 วันพอดี → ดอกต้องเท่าอัตราต่อปีเป๊ะ ๆ
    const r = C.calcCoopCore({ P: 100000, d0: D('2024-09-30'), rate: 6.5, N: 1 });
    const row = r.rows.find(x => x.days === 365);
    T.ok(!!row, 'ต้องมีแถวช่วง 365 วัน — พบ ' + JSON.stringify(r.rows.map(x => x.days)));
    if (row) T.eq(row.interest, 6500, '100,000 × 6.5% × 365 ÷ 365 = 6,500 (÷360 จะได้ 6,590.28)');
    // ยอดปิดกลางคาบ: ดอกรายวัน ÷365 จากจุดชำระล่าสุด
    const p = C.calcPayoffCore({ P: 100000, d0: D('2024-10-01'), rate: 6.5, N: 5, X: D('2025-01-01') });
    T.eq(p.days, 92, 'วันจาก 1 ต.ค. ถึง 1 ม.ค.');
    T.near(p.accrued, 100000 * 6.5 / 100 * 92 / 365, 1e-9, 'ดอกค้าง ÷365');
    // ตัวหาร 365 คงที่แม้ในปีอธิกสุรทิน (ไม่ใช่ 366 ไม่ใช่ 360)
    const leap = C.calcPayoffCore({ P: 100000, d0: D('2024-02-29'), rate: 6.5, N: 5, X: D('2024-03-31') });
    T.eq(leap.days, 31, 'วันในปีอธิกสุรทิน');
    T.near(leap.accrued, 100000 * 6.5 / 100 * 31 / 365, 1e-9, 'ตัวหารยังเป็น 365');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 4. ตัดดอกสิ้นปีบัญชี 30 ก.ย. + วันรับเงิน 29/30 ก.ย. และ 1 ต.ค.
  // ═══════════════════════════════════════════════════════════════════
  T.test('ตัดดอก 30 ก.ย.: มีแถวตัดดอกทุกสิ้นปีบัญชีที่อยู่ในช่วงสัญญา', () => {
    const r = C.calcCoopCore({ P: 100000, d0: D('2024-10-01'), rate: 6.5, N: 3 });
    const closes = r.rows.filter(x => x.isClose);
    closes.forEach(x => { T.eq(x.date.getMonth(), 8, 'เดือนตัดดอก'); T.eq(x.date.getDate(), 30, 'วันตัดดอก'); });
    T.ok(r.rows.every(x => !(x.isClose && x.principalPaid !== 0)), 'แถวตัดดอกต้องไม่ส่งเงินต้น');
    // แถวตัดดอกจ่ายเฉพาะดอกเบี้ย
    closes.forEach(x => T.near(x.pay, x.interest, 1e-9, 'แถวตัดดอกจ่ายเฉพาะดอก'));
  });

  T.test('วันรับเงิน 29 ก.ย. / 30 ก.ย. / 1 ต.ค. — ขอบปีบัญชี', () => {
    // 29 ก.ย.: วันรุ่งขึ้นคือ 30 ก.ย. → ต้องมีแถวตัดดอก 1 วันทันที
    const a = C.calcCoopCore({ P: 100000, d0: D('2024-09-29'), rate: 6.5, N: 3 });
    T.eqDate(a.rows[0].date, '2024-09-30', '29 ก.ย. → แถวแรก');
    T.eq(a.rows[0].days, 1, '29 ก.ย. → 1 วัน');
    T.near(a.rows[0].interest, 100000 * 6.5 / 100 * 1 / 365, 1e-9, 'ดอก 1 วัน');
    // 30 ก.ย.: cd > d0 เป็นเท็จ → ไม่มีแถวตัดดอกวันเดียวกัน
    const b = C.calcCoopCore({ P: 100000, d0: D('2024-09-30'), rate: 6.5, N: 3 });
    T.ok(!b.rows.some(x => x.date.getTime() === D('2024-09-30').getTime()), '30 ก.ย. ไม่มีแถววันเดียวกัน');
    T.eqDate(b.rows[0].date, '2025-09-30', '30 ก.ย. → แถวแรกคือปีถัดไป');
    // 1 ต.ค.: ปีบัญชีใหม่
    const c = C.calcCoopCore({ P: 100000, d0: D('2024-10-01'), rate: 6.5, N: 3 });
    T.eqDate(c.rows[0].date, '2025-09-30', '1 ต.ค. → แถวแรก');
    T.eq(c.rows[0].days, 364, '1 ต.ค. → 30 ก.ย. = 364 วัน');
    // ทั้งสามยังคง invariant
    [a, b, c].forEach((r, i) => { T.eq(sum(r.rows.map(x => x.principalPaid)), 100000, 'Σ ต้น เคส ' + i); });
  });

  T.test('quarterInfo + firstDueDate — คาบกู้ → วันครบกำหนด (ระเบียบ ข้อ 5-7)', () => {
    T.eqArr([8, 9, 10].map(m => C.quarterInfo(m).due), ['30 ก.ย.', '30 ก.ย.', '30 ก.ย.'], 'ก.ย.–พ.ย.');
    T.eqArr([11, 0, 1].map(m => C.quarterInfo(m).due), ['31 ธ.ค.', '31 ธ.ค.', '31 ธ.ค.'], 'ธ.ค.–ก.พ.');
    T.eqArr([2, 3, 4].map(m => C.quarterInfo(m).due), ['31 มี.ค.', '31 มี.ค.', '31 มี.ค.'], 'มี.ค.–พ.ค.');
    T.eqArr([5, 6, 7].map(m => C.quarterInfo(m).due), ['30 มิ.ย.', '30 มิ.ย.', '30 มิ.ย.'], 'มิ.ย.–ส.ค.');
    // ครบกำหนดแรกต้องอยู่หลังวันรับเงิน + 3 เดือนเสมอ
    for (const d of ['2024-01-15', '2024-02-29', '2024-06-30', '2024-09-29', '2024-09-30', '2024-10-01', '2024-12-31']) {
      const d0 = D(d), q = C.quarterInfo(d0.getMonth());
      const fd = C.firstDueDate(d0, q);
      T.ok(fd > C.addMonthsClamp(d0, 3), 'ครบกำหนดแรกต้องหลัง d0+3 เดือน (' + d + ')');
      T.eq(fd.getMonth(), q.am, 'เดือนครบกำหนด (' + d + ')');
      T.eq(fd.getDate(), q.ad, 'วันครบกำหนด (' + d + ')');
    }
    T.eqDate(C.firstDueDate(D('2024-09-29'), C.quarterInfo(8)), '2025-09-30', '29 ก.ย. 2024');
    T.eqDate(C.firstDueDate(D('2024-10-01'), C.quarterInfo(9)), '2025-09-30', '1 ต.ค. 2024');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 5. การปัดงวด instAmounts + ทดเศษงวดสุดท้าย
  // ═══════════════════════════════════════════════════════════════════
  T.test('autoUnit: หน่วยปัดตามกติกา (≥10,000→1,000 · ≥1,000→100 · ≥100→10 · ต่ำกว่า→1)', () => {
    T.eq(C.autoUnit(10000), 1000, '10,000');
    T.eq(C.autoUnit(9999.99), 100, '9,999.99');
    T.eq(C.autoUnit(1000), 100, '1,000');
    T.eq(C.autoUnit(999.99), 10, '999.99');
    T.eq(C.autoUnit(100), 10, '100');
    T.eq(C.autoUnit(99.99), 1, '99.99');
    T.eq(C.autoUnit(0), 1, '0');
    T.eq(C.autoUnit(-5), 1, 'ติดลบ');
    T.eq(C.autoUnit(1e9), 1000, 'ใหญ่มาก');
  });

  T.test('instAmounts: งวด 1..N-1 ปัดตามหน่วย · งวดสุดท้ายทดเศษ · Σ = เงินต้นเป๊ะ', () => {
    // ปัดหลัก 1,000 (งวด ≥ 10,000)
    T.eqArr(C.instAmounts(100000, 3), [33000, 33000, 34000], '100,000 / 3 งวด');
    T.eqArr(C.instAmounts(999999, 5), [200000, 200000, 200000, 200000, 199999], '999,999 / 5 งวด');
    // ปัดหลัก 100 (งวด ≥ 1,000 แต่ < 10,000)
    T.eqArr(C.instAmounts(12345, 3), [4100, 4100, 4145], '12,345 / 3 งวด');
    // ปัดหลัก 10 (งวด ≥ 100)
    T.eqArr(C.instAmounts(3000, 10), [300, 300, 300, 300, 300, 300, 300, 300, 300, 300], '3,000 / 10 งวด');
    T.eqArr(C.instAmounts(1000, 4), [250, 250, 250, 250], '1,000 / 4 งวด');
    // งวดเดียว = เต็มจำนวน (ไม่มีการปัด)
    T.eqArr(C.instAmounts(12345, 1), [12345], 'งวดเดียว');
    T.eqArr(C.instAmounts(0, 1), [0], 'ศูนย์');
    // สวีป: Σ ต้องเท่าเป๊ะ + งวด 1..N-1 ต้องหารด้วยหน่วยลงตัว + งวดสุดท้ายทดเศษ
    for (const P of [1000, 3000, 12345, 50000, 100000, 250000, 999999, 1234567]) {
      for (let N = 1; N <= 15; N++) {
        const a = C.instAmounts(P, N);
        T.eq(a.length, N, `จำนวนงวด P${P} N${N}`);
        T.eq(sum(a), P, `Σ งวด = เงินต้น P${P} N${N}`);
        const u = C.autoUnit(P / N);
        for (let k = 0; k < N - 1; k++) T.eq(a[k] % u, 0, `งวด ${k + 1} ต้องลงตัวกับหน่วย ${u} (P${P} N${N})`);
        if (N > 1) T.ok(a[0] === a[N - 2] || N === 2, `งวด 1..N-1 ต้องเท่ากันหมด (P${P} N${N})`);
      }
    }
  });

  T.test('ทดเศษงวดสุดท้าย: งวดสุดท้ายรับส่วนต่างจริง (ต่างจากงวดอื่นได้)', () => {
    const a = C.instAmounts(100000, 3);
    T.eq(a[2], 100000 - a[0] - a[1], 'งวดสุดท้าย = เงินต้น − งวดก่อนหน้า');
    T.ok(a[2] !== a[0], '100,000/3 งวดสุดท้ายต้องไม่เท่างวดอื่น');
    const b = C.instAmounts(12345, 3);
    T.eq(b[2], 12345 - b[0] - b[1], 'ทดเศษ 12,345');
    // ในตารางจริง งวดสุดท้ายปิดยอดพอดี
    const r = C.calcCoopCore({ P: 12345, d0: D('2024-10-01'), rate: 6.5, N: 3 });
    T.eq(r.rows[r.rows.length - 1].balAfter, 0, 'ตารางจริงปิดที่ 0');
    T.eq(r.instArr[2], 4145, 'งวดสุดท้ายทดเศษในตารางจริง');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 6. GRACE (ปลอดชำระ) — 0, 1, 3, N, > N · ดอกสะสมไม่ทบต้น
  // ═══════════════════════════════════════════════════════════════════
  T.test('grace clamp: 0/1/3 ผ่าน · เกิน 3 ตัดที่ 3 · ห้ามเกิน N−1 · ติดลบ = 0', () => {
    T.eq(C.clampRestructG(0, 5), 0, 'G=0');
    T.eq(C.clampRestructG(1, 5), 1, 'G=1');
    T.eq(C.clampRestructG(3, 5), 3, 'G=3');
    T.eq(C.clampRestructG(4, 5), 3, 'G=4 → ตัดที่ 3');
    T.eq(C.clampRestructG(99, 5), 3, 'G=99 → ตัดที่ 3');
    T.eq(C.clampRestructG(3, 2), 1, 'G ต้องไม่เกิน N−1');
    T.eq(C.clampRestructG(1, 1), 0, 'N=1 → G=0');
    T.eq(C.clampRestructG(-5, 5), 0, 'ติดลบ → 0');
    T.eq(C.clampRestructN(0), 1, 'N=0 → 1');
    T.eq(C.clampRestructN(99), 15, 'N=99 → 15');
    T.eq(C.clampRestructN(NaN), 1, 'NaN → 1');
  });

  T.test('grace: ช่วงปลอดไม่ส่งต้น/ไม่เก็บดอก · ดอกสะสมเก็บงวดแรกหลังพ้น · ไม่ทบต้น', () => {
    for (const G of [0, 1, 2, 3]) {
      const A = 250000, rate = 6.5, N = 8;
      const r = C.calcRestructureCore({ A, B: 15000, d0: D('2024-10-01'), rate, nYears: N, nGrace: G });
      T.eq(r.G, G, 'G ที่ใช้จริง');
      T.eq(r.R, N - G, 'ปีผ่อนจริง R = N − G');
      const inG = r.rows.filter(x => x.inGrace);
      inG.forEach(x => {
        T.eq(x.payA, 0, `grace${G}: ไม่ส่งต้น A`);
        T.eq(x.payB, 0, `grace${G}: ไม่ส่งต้น B`);
        T.eq(x.interest, 0, `grace${G}: ไม่เก็บดอก`);
        T.eq(x.pay, 0, `grace${G}: จ่าย 0`);
      });
      if (G > 0) {
        T.ok(inG.length > 0, `grace${G}: ต้องมีแถวปลอดชำระ`);
        T.ok(r.graceInt > 0, `grace${G}: ต้องมีดอกสะสม`);
        // 🔒 ดอกสะสม "ไม่ทบต้น" — ต้นคงเหลือ A ระหว่าง grace ต้องคงที่ = A
        inG.forEach(x => T.eq(x.balAafter, A, `grace${G}: ต้น A ต้องไม่โต (ไม่ทบต้น)`));
        // ดอกสะสม = A × rate × วันรวมช่วง grace ÷ 365 (คิดจากต้นเดิม ไม่ทบ)
        const graceDays = sum(inG.map(x => x.days));
        T.near(r.graceInt, C.round2(A * rate / 100 * graceDays / 365), 0.02, `grace${G}: สูตรดอกสะสมไม่ทบต้น`);
        // งวดแรกหลังพ้น grace ต้องเก็บดอกสะสมด้วย (ดอกงวดนั้น > ดอกช่วงปกติ)
        const firstAfter = r.rows[inG.length];
        T.ok(firstAfter && firstAfter.interest >= r.graceInt - 0.01, `grace${G}: งวดแรกหลังพ้นต้องรวมดอกสะสม`);
      } else {
        T.eq(r.graceInt, 0, 'G=0: ไม่มีดอกสะสม');
        T.eq(inG.length, 0, 'G=0: ไม่มีแถวปลอดชำระ');
      }
      // invariant ยังต้องอยู่
      T.near(sum(r.rows.map(x => x.payA)), A, 1e-6, `grace${G}: Σ payA`);
    }
  });

  T.test('grace = N และ > N: ถูกตัดให้เหลืออย่างมาก min(3, N−1) — ต้องมีปีผ่อนเสมอ', () => {
    for (const N of [1, 2, 3, 5]) for (const G of [N, N + 1, 99]) {
      const r = C.calcRestructureCore({ A: 100000, B: 0, d0: D('2024-10-01'), rate: 6.5, nYears: N, nGrace: G });
      T.ok(r.R >= 1, `N${N} G${G}: ต้องเหลือปีผ่อน ≥ 1 (ได้ R=${r.R})`);
      T.eq(r.G, Math.max(0, Math.min(3, N - 1)), `N${N} G${G}: G ที่ clamp`);
      T.near(sum(r.rows.map(x => x.payA)), 100000, 1e-6, `N${N} G${G}: Σ payA`);
    }
  });

  T.test('ปปน. รายเดือน + grace: เดือนปลอดไม่มีงวด · ดอกสะสมรวมในงวดแรก', () => {
    for (const G of [0, 1, 3]) {
      const A = 250000, rate = 6.5;
      const m = C.calcRestructMonthlyCore({ A, B: 15000, d0: D('2024-10-01'), rate, nYears: 8, nGrace: G, mode: 'fixed' });
      if (G > 0) {
        T.ok(m.deferred > 0, `G${G}: มีดอกสะสม`);
        T.eq(m.rows.filter(x => x.firstDefer).length, 1, `G${G}: ดอกสะสมรวมในงวดแรกงวดเดียว`);
        T.ok(m.rows[0].firstDefer, `G${G}: งวดแรกคือแถวที่รับดอกสะสม`);
        // ดอกสะสมคิดจากต้นเดิม ไม่ทบต้น
        T.near(m.deferred, A * rate / 100 * C.daysBetween(D('2024-10-01'), m.dues[G - 1]) / 365, 1e-9, `G${G}: สูตรดอกสะสม`);
      } else {
        T.eq(m.deferred, 0, 'G=0: ไม่มีดอกสะสม');
      }
      T.near(sum(m.rows.map(x => x.ppA)), A, 1e-6, `G${G}: Σ ต้น A รายเดือน`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════
  // 7. ceilingFor — ทุกเส้นทาง รวม null และเคสขอบ 50,000 / 80,000 / 60%
  // ═══════════════════════════════════════════════════════════════════
  T.test('ceilingFor: บุคคลค้ำ — พื้น 50,000 · 2 เท่าของหุ้น · เพดานแข็ง 80,000', () => {
    T.eq(C.GUAR_CEILING, 80000, 'เพดานบุคคลค้ำ (ข้อ 8(2))');
    T.eq(C.SHARE_PAR, 10, 'มูลค่าหุ้นละ (ข้อบังคับ ข้อ 5)');
    T.eq(C.ceilingFor('person', 0), 50000, 'ไม่มีหุ้น → พื้น 50,000');
    T.eq(C.ceilingFor('person', 100), 50000, 'หุ้น 1,000 บาท → 2 เท่า = 2,000 < พื้น → 50,000');
    T.eq(C.ceilingFor('person', 2499), 50000, 'หุ้น 24,990 → 2 เท่า = 49,980 < พื้น → 50,000');
    T.eq(C.ceilingFor('person', 2500), 50000, 'ขอบพอดี: หุ้น 25,000 → 2 เท่า = 50,000 = พื้น');
    T.eq(C.ceilingFor('person', 2501), 50020, 'เกินพื้นแล้ว → ใช้ 2 เท่า');
    T.eq(C.ceilingFor('person', 3999), 79980, 'ใกล้เพดาน');
    T.eq(C.ceilingFor('person', 4000), 80000, 'ขอบพอดี: หุ้น 40,000 → 2 เท่า = 80,000 = เพดาน');
    T.eq(C.ceilingFor('person', 4001), 80000, 'เกินเพดาน → ตัดที่ 80,000');
    T.eq(C.ceilingFor('person', 100000), 80000, 'หุ้นเยอะมาก → ยังตัดที่ 80,000');
    T.eq(C.ceilingFor('person', -10), 50000, 'หุ้นติดลบ → พื้น 50,000');
    T.eq(C.ceilingFor('person', NaN), 50000, 'NaN → พื้น 50,000');
    T.eq(C.ceilingFor('person', ''), 50000, 'ว่าง → พื้น 50,000');
    T.eq(C.ceilingFor('person', '1000'), 50000, 'สตริงตัวเลข (หุ้น 10,000 → 2 เท่า = 20,000 < พื้น)');
    T.eq(C.ceilingFor('person', '4001'), 80000, 'สตริงตัวเลขเกินเพดาน');
  });

  T.test('ceilingFor: หุ้นค้ำ = 60% ของมูลค่าหุ้น · จำนอง/เงินฝาก = null (ห้ามบล็อก)', () => {
    T.eq(C.ceilingFor('share', 0), 0, 'ไม่มีหุ้น');
    T.eq(C.ceilingFor('share', 1000), 6000, 'หุ้น 10,000 → 60% = 6,000');
    T.eq(C.ceilingFor('share', 10000), 60000, 'หุ้น 100,000 → 60% = 60,000');
    T.eq(C.ceilingFor('share', 8333), 49998, 'ขอบ 60%');
    T.eq(C.ceilingFor('share', 100000), 600000, 'หุ้นเยอะ → 60% ไม่มีเพดานแข็ง');
    // 🔒 null = ระเบียบไม่ผูกเพดานกับตัวเลขที่เว็บรู้ → ห้ามบล็อก
    T.eq(C.ceilingFor('mortgage', 5000), null, 'จำนอง (ข้อ 8(1)) → null');
    T.eq(C.ceilingFor('deposit', 5000), null, 'เงินฝาก (ข้อ 8(3)) → null');
    T.eq(C.ceilingFor('', 5000), null, 'ค่าว่าง → null');
    T.eq(C.ceilingFor(null, 5000), null, 'null → null');
    T.eq(C.ceilingFor(undefined, 5000), null, 'undefined → null');
    T.eq(C.ceilingFor('PERSON', 5000), null, 'ตัวพิมพ์ใหญ่ ≠ person → null');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 8. เบี้ยปรับ 3% (ข้อ 16 ว.3)
  // ═══════════════════════════════════════════════════════════════════
  T.test('เบี้ยปรับ 3%/ปี = ต้นค้าง × 3% × วันผิดนัด ÷ 365', () => {
    const r = C.calcPenaltyCore({ Op: 100000, Dd: D('2024-09-30'), Pd: D('2025-09-30'), fineRate: 3 });
    T.eq(r.daysLate, 365, 'วันผิดนัด 1 ปี');
    T.eq(r.penalty, 3000, '100,000 × 3% × 365 ÷ 365 = 3,000');
    T.eq(r.total, 103000, 'รวมต้นค้าง + เบี้ยปรับ');
    const d30 = C.calcPenaltyCore({ Op: 250000, Dd: D('2024-09-30'), Pd: D('2024-10-30'), fineRate: 3 });
    T.eq(d30.daysLate, 30, '30 วัน');
    T.near(d30.penalty, 250000 * 3 / 100 * 30 / 365, 1e-9, 'เบี้ยปรับ 30 วัน');
    // ปีอธิกสุรทิน
    const leap = C.calcPenaltyCore({ Op: 100000, Dd: D('2024-02-28'), Pd: D('2024-03-01'), fineRate: 3 });
    T.eq(leap.daysLate, 2, 'ข้าม 29 ก.พ.');
    // ยังไม่ผิดนัด
    T.ok(C.calcPenaltyCore({ Op: 100000, Dd: D('2024-09-30'), Pd: D('2024-09-30'), fineRate: 3 }).notLate, 'ชำระวันครบกำหนด = ไม่ผิดนัด');
    T.ok(C.calcPenaltyCore({ Op: 100000, Dd: D('2024-09-30'), Pd: D('2024-09-29'), fineRate: 3 }).notLate, 'ชำระก่อนกำหนด = ไม่ผิดนัด');
    // ข้อมูลไม่ครบ
    T.eq(C.calcPenaltyCore({ Op: 0, Dd: D('2024-09-30'), Pd: D('2024-10-01'), fineRate: 3 }), null, 'ต้นค้าง 0');
    T.eq(C.calcPenaltyCore({ Op: -5, Dd: D('2024-09-30'), Pd: D('2024-10-01'), fineRate: 3 }), null, 'ต้นค้างติดลบ');
    T.eq(C.calcPenaltyCore({ Op: 1000, Dd: null, Pd: D('2024-10-01'), fineRate: 3 }), null, 'ไม่มีวันครบกำหนด');
    T.eq(C.calcPenaltyCore({ Op: 1000, Dd: D('2024-09-30'), Pd: null, fineRate: 3 }), null, 'ไม่มีวันชำระ');
    // อัตราอื่น
    T.eq(C.calcPenaltyCore({ Op: 100000, Dd: D('2024-09-30'), Pd: D('2025-09-30'), fineRate: 0 }).penalty, 0, 'อัตรา 0%');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 9. ยอดปิด ณ วันที่ — ต้องตรงกับตารางทุกวันครบกำหนด
  // ═══════════════════════════════════════════════════════════════════
  T.test('ยอดปิด ณ วันครบกำหนดทุกงวด = ต้นคงเหลือในตารางรายปี (ต้องไม่มีสองสูตร)', () => {
    for (const P of [3000, 12345, 100000, 999999]) for (const N of [1, 3, 7, 15]) for (const rate of [0, 6.5, 15])
      for (const d of ['2024-02-29', '2024-09-29', '2024-09-30', '2024-10-01', '2025-05-31']) {
        const d0 = D(d);
        const sch = C.calcCoopCore({ P, d0, rate, N });
        for (const row of sch.rows.filter(x => x.isPrincipal)) {
          const y = C.calcPayoffCore({ P, d0, rate, N, X: row.date });
          const key = `P${P} N${N} r${rate} ${d} @${row.date.getFullYear()}`;
          T.eq(y.outstanding, row.balAfter, 'ต้นคงเหลือ ' + key);
          T.eq(y.days, 0, 'วันครบกำหนด = ไม่มีดอกค้าง ' + key);
          T.eq(y.accrued, 0, 'ดอกค้าง ' + key);
        }
        // ณ วันครบกำหนดสุดท้าย ต้องปิดสัญญา
        const last = C.calcPayoffCore({ P, d0, rate, N, X: sch.finalP });
        T.eq(last.outstanding, 0, 'ครบกำหนดสุดท้าย ต้นคงเหลือ 0');
        T.ok(last.closed, 'ครบกำหนดสุดท้าย = ปิดสัญญา');
        T.eq(last.payoff, 0, 'ยอดปิด = 0');
      }
  });

  T.test('ยอดปิด: ณ วันรับเงิน = เงินต้นเต็ม · หลังครบสัญญา = ปิดแล้ว · ก่อนวันรับเงิน = tooEarly', () => {
    const d0 = D('2024-10-01');
    const y0 = C.calcPayoffCore({ P: 100000, d0, rate: 6.5, N: 5, X: d0 });
    T.eq(y0.outstanding, 100000, 'ณ วันรับเงิน = เต็มจำนวน');
    T.eq(y0.days, 0, 'ยังไม่มีดอก');
    T.eq(y0.payoff, 100000, 'ยอดปิด = เงินต้น');
    const after = C.calcPayoffCore({ P: 100000, d0, rate: 6.5, N: 5, X: D('2040-01-01') });
    T.ok(after.closed, 'หลังครบสัญญา = ปิดแล้ว');
    T.eq(after.payoff, 0, 'ยอดปิด 0');
    T.ok(C.calcPayoffCore({ P: 100000, d0, rate: 6.5, N: 5, X: D('2024-09-30') }).tooEarly, 'ก่อนวันรับเงิน');
    T.eq(C.calcPayoffCore({ P: 0, d0, rate: 6.5, N: 5, X: d0 }), null, 'เงินต้น 0');
    T.eq(C.calcPayoffCore({ P: 100000, d0: null, rate: 6.5, N: 5, X: d0 }), null, 'ไม่มีวันรับเงิน');
    T.eq(C.calcPayoffCore({ P: 100000, d0, rate: 6.5, N: 5, X: null }), null, 'ไม่มีวันที่คำนวณ');
    // ชำระก่อนกำหนดกลางทาง: ดอกคิดจากจุดชำระล่าสุดเท่านั้น
    const mid = C.calcPayoffCore({ P: 100000, d0, rate: 6.5, N: 5, X: D('2025-12-31') });
    T.eqDate(mid.lastSettle, '2025-09-30', 'จุดชำระล่าสุด = ครบกำหนดงวดที่ผ่านมา');
    T.eq(mid.days, 92, 'วันนับจากจุดชำระล่าสุด');
    T.near(mid.accrued, mid.outstanding * 6.5 / 100 * 92 / 365, 1e-9, 'ดอกค้างจากจุดชำระล่าสุด');
  });

  // ═══════════════════════════════════════════════════════════════════
  // 10. guard / ค่าขอบของฟังก์ชัน pure ที่เหลือ
  // ═══════════════════════════════════════════════════════════════════
  T.test('guard: ข้อมูลไม่ครบ → null ทุกตัว (ไม่ใช่ throw ไม่ใช่ตัวเลขมั่ว)', () => {
    T.eq(C.calcCoopCore({ P: 0, d0: D('2024-10-01'), rate: 6.5, N: 3 }), null, 'coop เงินต้น 0');
    T.eq(C.calcCoopCore({ P: -1, d0: D('2024-10-01'), rate: 6.5, N: 3 }), null, 'coop เงินต้นติดลบ');
    T.eq(C.calcCoopCore({ P: 100000, d0: null, rate: 6.5, N: 3 }), null, 'coop ไม่มีวันรับเงิน');
    T.eq(C.calcMonthlyCore({ P: 0, d0: D('2024-10-01'), rate: 6.5, N: 3, mode: 'fixed' }), null, 'monthly เงินต้น 0');
    T.eq(C.calcRestructureCore({ A: 0, d0: D('2024-10-01'), rate: 6.5, nYears: 5, nGrace: 0 }), null, 'ปปน A = 0');
    T.eq(C.calcRestructureCore({ A: 100000, d0: null, rate: 6.5, nYears: 5, nGrace: 0 }), null, 'ปปน ไม่มีวันอนุมัติ');
    T.eq(C.calcRestructMonthlyCore({ A: 0, d0: D('2024-10-01'), rate: 6.5, nYears: 5, nGrace: 0, mode: 'fixed' }), null, 'ปปน/เดือน A = 0');
  });

  T.test('round2 / fmt / fmt0 / thDate / parseDate / daysBetween / monthsBetween', () => {
    T.eq(C.round2(1.005), 1.01, 'round2 ปัดขึ้นครึ่ง');
    T.eq(C.round2(2.675), 2.68, 'round2 กันปัญหา float');
    T.eq(C.round2(-1234.5678), -1234.57, 'round2 ติดลบ');
    T.eq(C.round2(0), 0, 'round2 ศูนย์');
    T.eq(C.fmt(0.004), '0.00', 'fmt ปัดเศษจิ๋วเป็น 0');
    T.eq(C.fmt(-0.004), '0.00', 'fmt เศษจิ๋วติดลบเป็น 0');
    T.eq(C.fmt(1234567.891), '1,234,567.89', 'fmt คั่นหลักพัน 2 ตำแหน่ง');
    T.eq(C.fmt0(1234567.6), '1,234,568', 'fmt0 ปัดจำนวนเต็ม');
    T.eq(C.fmt0(0), '0', 'fmt0 ศูนย์');
    T.eq(C.thDate(D('2026-07-20')), '20 ก.ค. 2569', 'thDate = พ.ศ. ย่อ');
    T.eq(C.thDate(D('2024-01-01')), '1 ม.ค. 2567', 'thDate ต้นปี');
    T.eq(C.thDate(D('2024-12-31')), '31 ธ.ค. 2567', 'thDate ปลายปี');
    T.eq(C.TH_MONTH.length, 12, 'ชื่อเดือน 12 ตัว');
    T.eqDate(C.parseDate('2024-02-29'), '2024-02-29', 'parseDate');
    T.eq(C.parseDate(''), null, 'parseDate ว่าง');
    T.eq(C.parseDate(null), null, 'parseDate null');
    T.eq(C.parseDate(undefined), null, 'parseDate undefined');
    T.eq(C.daysBetween(D('2024-10-01'), D('2024-10-01')), 0, 'daysBetween วันเดียวกัน');
    T.eq(C.daysBetween(D('2024-10-02'), D('2024-10-01')), -1, 'daysBetween ย้อนหลัง');
    T.eq(C.monthsBetween(D('2024-10-01'), D('2025-09-30')), 11, 'monthsBetween');
    T.eq(C.monthsBetween(D('2024-10-31'), D('2024-10-01')), 0, 'monthsBetween เดือนเดียวกัน');
    T.eq(C.monthsBetween(D('2025-01-01'), D('2024-01-01')), -12, 'monthsBetween ย้อนหลัง');
  });

  T.test('solveAnnuity: หายอดคงที่ที่ผ่อนได้ครบเป้าพอดี · rate 0 → เฉลี่ยเท่ากัน', () => {
    const start = D('2024-10-01');
    const dates = []; for (let i = 1; i <= 12; i++) dates.push(C.addMonthsClamp(start, i));
    // rate 0: ยอดรวมต่องวด = เป้า / จำนวนงวด
    const a0 = C.solveAnnuity(120000, start, dates, 0, 120000);
    T.near(a0, 10000, 1e-6, 'rate 0 → 120,000 / 12');
    // rate > 0: ผ่อนตามยอดที่ solve ได้ ต้องปิดเป้าพอดี
    const A = C.solveAnnuity(100000, start, dates, 6.5, 100000);
    let bal = 100000, base = start, paid = 0;
    for (const pd of dates) { const it = bal * 6.5 / 100 * C.daysBetween(base, pd) / 365; const pp = A - it; paid += pp; bal -= pp; base = pd; }
    T.near(paid, 100000, 1e-6, 'ผ่อนครบเป้าพอดี');
    T.near(bal, 0, 1e-6, 'ปิดยอดพอดี');
    T.ok(A > 100000 / 12, 'ยอด/งวดต้องมากกว่าต้นเฉลี่ย (มีดอก)');
  });

  T.test('ปปน.: ยอด B ดอกเบี้ย 0% (ข้อ 12(2)) — ดอกเบี้ยคิดจากยอด A เท่านั้น', () => {
    const noB = C.calcRestructureCore({ A: 250000, B: 0, d0: D('2024-10-01'), rate: 6.5, nYears: 5, nGrace: 0 });
    const bigB = C.calcRestructureCore({ A: 250000, B: 987654.32, d0: D('2024-10-01'), rate: 6.5, nYears: 5, nGrace: 0 });
    T.eq(noB.totI, bigB.totI, 'ยอด B ไม่ว่าเท่าไหร่ ดอกเบี้ยรวมต้องเท่าเดิม (B = 0%)');
    T.near(bigB.totPay - noB.totPay, 987654.32, 0.05, 'ส่วนต่างชำระรวม = ยอด B พอดี (ไม่มีดอก)');
  });

  /* ═══════════════════════════════════════════════════════════════════
   * 11. CHARACTERIZATION — ตรึงค่าความละเอียดเต็มของตารางจริง
   * ───────────────────────────────────────────────────────────────────
   * ค่าเหล่านี้สกัดจากโค้ดที่พิสูจน์แล้วว่าเหมือนของเดิม "ทุกบิต"
   * (golden 20,325 เคส · ก่อน/หลังแยกแกน ตรงกันแบบ exact)
   * หน้าที่ = จับความเปลี่ยนแปลงระดับ 1e-11 ที่ invariant/tolerance มองไม่เห็น
   * เช่น การถอดบรรทัด "ทดเศษเดือนสุดท้าย" ออก (mutation M6)
   * 🔒 ถ้าข้อนี้แดง: ห้ามแก้ตัวเลขให้ตรงกับผลใหม่ — ต้องหาว่าอะไรทำให้สูตรเปลี่ยน
   * ═════════════════════════════════════════════════════════════════ */
  T.test('characterization: ตารางรายเดือน annuity ตรึงค่าเต็มความละเอียด (จับ drift 1e-11)', () => {
    const r = C.calcMonthlyCore({ P: 100000, d0: D('2024-10-01'), rate: 6.5, N: 3, mode: 'annuity' });
    T.eq(r.rows.length, 35, 'จำนวนงวด');
    T.eq(r.totI, 10013.72, 'ดอกเบี้ยรวม');
    T.eq(r.totPay, 110013.59000000001, 'ชำระรวม (ความละเอียดเต็ม)');
    T.eq(r.aFirst, 3493.572120339937, 'ยอดคงที่ปีแรกจาก solveAnnuity');
    T.eq(r.rows[0].principalPaid, 2941.517325819389, 'งวดแรก — เงินต้น');
    // 🔑 แถวทดเศษสิ้นปี: ค่านี้มาจาก target − paidThis (ไม่ใช่ A − it)
    //    ถ้าถอดบรรทัดทดเศษออก ค่าจะเพี้ยนระดับ 1e-11 → ข้อนี้จับได้ tolerance จับไม่ได้
    T.eq(r.rows[10].principalPaid, 2748.3161396694995, 'แถวทดเศษสิ้นปีที่ 1');
    T.ok(r.rows[10].yearEnd, 'แถวที่ 11 ต้องเป็นสิ้นปีสัญญาที่ 1');
    T.eq(r.rows[22].principalPaid, 2828.3017767835554, 'แถวทดเศษสิ้นปีที่ 2');
    T.eq(r.rows[34].principalPaid, 2917.647912092958, 'งวดสุดท้าย');
    // ปิดยอดพอดีระดับบิต
    const s = r.rows.reduce((a, x) => a + x.principalPaid, 0);
    T.ok(Math.abs(s - 100000) < 1e-9, 'Σ เงินต้นปิดพอดี (ได้ส่วนต่าง ' + (s - 100000).toExponential(3) + ')');
  });

  T.test('characterization: ตารางรายปีตรึงค่าเต็มความละเอียด', () => {
    const r = C.calcCoopCore({ P: 100000, d0: D('2024-09-29'), rate: 6.5, N: 3 });
    T.eq(r.rows.length, 4, 'จำนวนแถว (3 งวดต้น + ตัดดอก 1 วันแรก)');
    T.eqArr(r.instArr, [33000, 33000, 34000], 'งวดต้น');
    T.eq(r.rows[0].days, 1, 'แถวแรก 1 วัน');
    T.eq(r.rows[0].interest, 17.80821917808219, 'ดอก 1 วัน (ความละเอียดเต็ม)');
    T.eq(r.totI, 13082.81, 'ดอกเบี้ยรวม');
    T.eq(r.totPay, 113082.81, 'ชำระรวม');
    T.eqDate(r.finalP, '2027-09-30', 'ครบกำหนดสุดท้าย');
  });

  T.test('อัตราดอกเบี้ย 0% → ดอกเบี้ยรวม 0 ทุกโหมด', () => {
    T.eq(C.calcCoopCore({ P: 100000, d0: D('2024-10-01'), rate: 0, N: 5 }).totI, 0, 'รายปี');
    T.eq(C.calcMonthlyCore({ P: 100000, d0: D('2024-10-01'), rate: 0, N: 5, mode: 'fixed' }).totI, 0, 'รายเดือน fixed');
    T.eq(C.calcMonthlyCore({ P: 100000, d0: D('2024-10-01'), rate: 0, N: 5, mode: 'annuity' }).totI, 0, 'รายเดือน annuity');
    T.eq(C.calcRestructureCore({ A: 100000, B: 0, d0: D('2024-10-01'), rate: 0, nYears: 5, nGrace: 2 }).totI, 0, 'ปปน');
    T.eq(C.calcPayoffCore({ P: 100000, d0: D('2024-10-01'), rate: 0, N: 5, X: D('2026-01-01') }).accrued, 0, 'ยอดปิด');
  });
};

/* ═══════════════════════════════════════════════════════════════════════════
 * บันทึกข้อสังเกต (พบตอนแยกแกน 20-07-2569 — ยังไม่แก้ รอผู้จัดการตัดสิน)
 * ═══════════════════════════════════════════════════════════════════════════
 * FINDING-1 · annuity: แถวทดเศษสิ้นปีติดลบได้ในเคสสุดขั้ว
 *   เงื่อนไข: โหมด (ข) ยอดรวมเท่ากัน + อัตราสูง + จำนวนปีมาก
 *   ตัวอย่าง: P=100,000 · 15%/ปี · 15 ปี · รับเงิน 1 ต.ค. 2567
 *             → งวดที่ 11 (สิ้นปีสัญญาที่ 1) เงินต้น = −373.53 บาท (1 แถวจาก 179)
 *   เหตุ: บรรทัด pp = target − paidThis บังคับให้ปีนั้นส่งต้นครบเป้าพอดี
 *         เมื่อ target ของปีแรกเล็กกว่าดอกที่เดินไปแล้ว ผลต่างจึงติดลบ
 *   ผล: ยอดรวมยังถูก (Σ ต้น = เงินต้นเป๊ะ · ปิดที่ 0) แต่ตารางแสดง "เงินต้น" ติดลบ 1 แถว
 *   ⚠️ เป็นพฤติกรรมเดิมของระบบก่อนแยกแกน (golden 20,325 เคส ยืนยันว่าไม่ได้เกิดจากการแยก)
 *   ยังไม่แก้ — การแก้กระทบตัวเลขบนสัญญาจริง ต้องให้ผู้จัดการเคาะก่อน
 *
 * FINDING-2 · "totPay = totI + A + B" เป็นเอกลักษณ์เฉพาะรายปี ห้ามยกไปใช้รายเดือน
 *   ปปน. รายปี: payA/payB มีไม่เกิน 2 ตำแหน่ง → สองสูตรให้ค่าเท่ากันเสมอ
 *               (สวีป 3,072 เคส + golden 20,325 เคส ไม่พบที่ต่างกันเลย)
 *   ปปน. รายเดือน: ppB = tB ÷ จำนวนงวด → ทศนิยมไม่ลงตัว → ต่างกันได้ถึง ~0.12 บาท
 *   ⇒ ถ้าใครมา "ลดรูป" ให้เหลือสูตรเดียว จะถูกที่รายปีแต่ผิดเงียบที่รายเดือน
 *   ⇒ เกณฑ์ที่เชื่อได้มีอย่างเดียว = เทียบกับผลบวกแถวจริง (ดูหมวด *Total)
 * ═════════════════════════════════════════════════════════════════════════ */
