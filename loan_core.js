/* ═══════════════════════════════════════════════════════════════════════════
 * loan_core.js — แกนคำนวณเงินกู้ (แยกจาก loan_calculator.html 20-07-2569)
 * ───────────────────────────────────────────────────────────────────────────
 * 🔒 กติกาของไฟล์นี้:
 *   • โค้ดคณิตทั้งหมด "ยกก้อนมา" จาก loan_calculator.html แบบ verbatim
 *     ห้ามปรับปรุง/optimize/เปลี่ยนชื่อตัวแปร — พฤติกรรมต้องเหมือนเดิมทุกบิต
 *   • ห้ามแตะ DOM ในไฟล์นี้เด็ดขาด (นั่นคือเหตุผลที่แยกออกมา)
 *     ค่าที่เคยอ่านจาก document.getElementById(...).value → รับผ่าน inputs แทน
 *   • ฝั่ง .html เหลือแค่ wrapper บาง ๆ: อ่าน DOM → เรียก core → วาดผล
 *
 * โหลดได้ 2 ทาง:
 *   • เบราว์เซอร์  <script src="loan_core.js"></script>  → window.LoanCore
 *                  (+ ผูกชื่อทุกตัวไว้บน window ด้วย เพราะ contract_print/*.js
 *                   เรียก fmt0/thDate/parseDate/ceilingFor ด้วยชื่อเปล่า)
 *   • node        require('./loan_core.js')
 * ไม่มี dependency ภายนอก
 * ═══════════════════════════════════════════════════════════════════════════ */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.LoanCore = api;
    // ผูกชื่อเปล่าไว้บน global ด้วย — ของเดิมเป็น function declaration ระดับบนสุด
    // ของ <script> จึงเป็น global อยู่แล้ว · ไฟล์อื่นเรียกด้วยชื่อเดิมต้องยังเรียกได้
    for (var k in api) if (Object.prototype.hasOwnProperty.call(api, k)) root[k] = api[k];
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

/* ═══ กฎรูปแบบวันที่ในเอกสาร (มติผู้จัดการ 14-07-2569) ═══
 * ใช้ทั้ง ส.-งก.14 และ หนังสือค้ำประกัน — แบ่งตาม "ความหมาย" ไม่ใช่ตามพื้นที่ว่าง
 *   • วันที่ของเอกสารฉบับนั้นเอง (วันที่นิติกรรมเกิด) → เต็ม   ContractFill.thaiDate() = "9 กรกฎาคม 2569"
 *   • วันที่อ้างอิงถึงสิ่งอื่น (เอกสารอื่น/กำหนดชำระ/ตาราง) → ย่อ  thDate() = "9 ก.ค. 2569"
 * ปีใช้ 4 หลักเสมอ (เคยใช้ 2 หลักที่ approveRepayBy — วัดแล้วปี 4 หลักก็พอดี ไม่ต้องบีบ)
 */
const TH_MONTH=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
function round2(n){ return Math.round((n+Number.EPSILON)*100)/100; }
function fmt(n){ if(Math.abs(n)<0.005) n=0; return round2(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmt0(n){ return Math.round(n).toLocaleString('en-US'); }
function thDate(d){ return d.getDate()+' '+TH_MONTH[d.getMonth()]+' '+(d.getFullYear()+543); }  // ย่อ "9 ก.ค. 2569" — ใช้กับวันที่อ้างอิง
function daysBetween(a,b){ return Math.round((b-a)/86400000); }
function lastDay(y,m){ return new Date(y,m+1,0).getDate(); }
function addMonthsClamp(base,g){
  const y=base.getFullYear(), m=base.getMonth()+g, d=base.getDate();
  const ny=y+Math.floor(m/12), nm=((m%12)+12)%12;
  return new Date(ny,nm,Math.min(d,lastDay(ny,nm)));
}
function monthsBetween(a,b){ return (b.getFullYear()*12+b.getMonth()) - (a.getFullYear()*12+a.getMonth()); }
// คาบที่กู้ -> วันครบกำหนดส่งต้น (anchor) ; anchor month 0-based (ระเบียบเงินกู้ฯ 2566 ข้อ 5-7)
function quarterInfo(month0){
  const m=month0+1;
  if(m===9||m===10||m===11) return {am:8,  ad:30, label:'ก.ย.–พ.ย.', due:'30 ก.ย.'};
  if(m===12||m===1||m===2)  return {am:11, ad:31, label:'ธ.ค.–ก.พ.', due:'31 ธ.ค.'};
  if(m===3||m===4||m===5)   return {am:2,  ad:31, label:'มี.ค.–พ.ค.', due:'31 มี.ค.'};
  return                    {am:5,  ad:30, label:'มิ.ย.–ส.ค.', due:'30 มิ.ย.'};
}
function firstDueDate(d0,q){
  const ref=addMonthsClamp(d0,3);
  let cand=new Date(ref.getFullYear(), q.am, q.ad);
  if(cand<=ref) cand=new Date(ref.getFullYear()+1, q.am, q.ad);
  return cand;
}
// หน่วยปัดอัตโนมัติ: งวด ≥ 10,000 → หลัก 1,000 · ต่ำกว่า → หลัก 100 · เล็กมาก → เต็มบาท
function autoUnit(per){ if(per>=10000) return 1000; if(per>=1000) return 100; if(per>=100) return 10; return 1; }
// SSOT งวดต้นรายปี: งวด 1..N-1 = ปัดจำนวนเต็ม (auto หลัก) · งวดสุดท้าย = ทดเศษที่เหลือ
function instAmounts(P,N){
  const per=P/N;
  const u=autoUnit(per);
  const base=Math.round(per/u)*u;
  const arr=[]; let acc=0;
  for(let k=0;k<N-1;k++){ arr.push(base); acc+=base; }
  arr.push(P-acc);   // งวดสุดท้ายทดเศษ (อาจมากหรือน้อยกว่างวดอื่น)
  return arr;
}
function parseDate(v){ if(!v) return null; const [y,m,d]=v.split('-').map(Number); return new Date(y,m-1,d); }

/* ===== หลักค้ำประกัน (ระเบียบเงินกู้ ข้อ 8) =====
 * เพดานบุคคลค้ำ = 80,000 (ข้อ 8(2): "ไม่สูงกว่า 80,000" · ผู้จัดการยืนยัน 14-07-2569) */
const GUAR_CEILING = 80000;
const SHARE_PAR = 10;      // มูลค่าหุ้นละ 10 บาท — ข้อบังคับ ข้อ 5

/* ค่าหุ้นที่ต้องถือเมื่อกู้ — ข้อบังคับ ข้อ 6(2) (ยกข้อความจริง):
 *   "ถือหุ้นตามส่วนแห่งเงินกู้ ในอัตราห้าหุ้นต่อจำนวนเงินกู้ทุก ๆ หนึ่งพันบาท
 *    เศษของหนึ่งพันบาทให้ถือเป็นห้าหุ้น"
 * มูลค่าหุ้นละ 10 บาท (ข้อ 5) → 5 หุ้น/พัน = 50 บาท/พัน
 *
 * 🔑 "เศษของหนึ่งพันบาทให้ถือเป็นห้าหุ้น" = ปัดเศษพัน "ขึ้น" เต็มขั้น
 *    ไม่ใช่คิดสัดส่วน 5% แล้วปัดตามปกติ — สองวิธีนี้เท่ากันเฉพาะเมื่อวงเงิน
 *    ลงตัวพันบาท ถ้าไม่ลงตัวจะเก็บค่าหุ้นขาด (10,001 บาท → 5% ได้ 500 แต่
 *    ข้อบังคับต้องได้ 550)
 *
 * 📌 มติผู้จัดการ 21-07-2569: ใช้ตามข้อบังคับ — ยกเลิกกติกา "5% ตายตัว"
 *    ที่เคยตกลงไว้ 20-07 (เกิดจากตัวอย่างจริงที่วงเงินลงตัวพันพอดี จึงดูเท่ากัน) */
function shareRequired(P){
  const amt = Number(P) || 0;
  if(amt <= 0) return { units: 0, baht: 0 };
  const units = Math.ceil(amt / 1000) * 5;
  return { units: units, baht: units * SHARE_PAR };
}

/* เพดานรวมทุกสัญญา — ระเบียบ 101 ข้อ 6 วรรคท้าย (ยกข้อความจริง):
 *   "จำนวนขั้นสูงของเงินกู้ระยะสั้นและระยะปานกลางรวมทุกรายการของสมาชิกคนหนึ่ง
 *    ในเวลาใดเวลาหนึ่ง จะเกิน 1,000,000 บาท ไม่ได้"
 * 🔑 อ่านให้ครบ 3 จุด: "รวมทุกรายการ" (ไม่ใช่ต่อสัญญา) · "ระยะสั้นและระยะปานกลาง"
 *    (ระยะยาวไม่นับ) · "ในเวลาใดเวลาหนึ่ง" (คือยอดคงเหลือ ณ ตอนนี้ ไม่ใช่ยอดกู้เดิม)
 * มติผู้จัดการ 21-07-2569: นับหนี้เดิมที่กรอกไว้ด้วย · เกินแล้วบล็อก ไม่พิมพ์ */
const TOTAL_CEILING = 1000000;
const CAPPED_TYPES = ['ระยะสั้น', 'ระยะปานกลาง'];

/* รวมยอดที่นับเข้าเพดาน — คืนรายละเอียดให้ผู้เรียกเอาไปเขียนข้อความเองได้
 * debts = [{type, remain}] จากตารางหนี้เดิมใน ส.-งก.13
 * ⚠️ ข้อจำกัดที่ต้องบอกผู้ใช้: เว็บรู้เฉพาะหนี้ที่เจ้าหน้าที่พิมพ์ลงตารางเท่านั้น
 *    ผ่านด่านนี้ไม่ได้แปลว่ายอดรวมจริงไม่เกิน — ห้ามเขียนข้อความให้เข้าใจว่ารับประกัน */
function loanTotalCounted(newP, debts){
  const counted = [], skipped = [];
  (debts || []).forEach(function(d){
    const type = String(d && d.type || '').trim();
    if(!type) return;
    const n = Number(String(d.remain == null ? '' : d.remain).replace(/,/g, ''));
    if(CAPPED_TYPES.indexOf(type) === -1){ skipped.push(type); return; }
    if(isNaN(n) || n <= 0) return;
    counted.push({ type: type, amount: n });
  });
  const debtSum = counted.reduce(function(s, c){ return s + c.amount; }, 0);
  const P = Number(newP) || 0;
  return { sum: P + debtSum, newLoan: P, debtSum: debtSum, counted: counted, skipped: skipped };
}

/* เพดานวงเงินตามเส้นทางหลักค้ำประกัน — SSOT จุดเดียว ทั้งข้อความเตือนและปุ่มบล็อกเรียกใช้ตัวนี้
 * ห้ามคำนวณเพดานซ้ำที่อื่น: สองสูตรที่ตั้งใจให้เหมือนกันจะเพี้ยนจากกันเงียบ ๆ วันที่แก้ทีละที่
 * คืน null = ระเบียบไม่ได้ผูกเพดานไว้กับตัวเลขที่เว็บรู้ → ห้ามบล็อก (คณะกรรมการเป็นคนพิจารณา)
 *   person   ข้อ 8(2) ก./ข. — ได้ 50,000 เป็นพื้น · มีหุ้นมากพอขยายเป็น 2 เท่าของหุ้น · เพดานแข็งที่ 80,000
 *   share    ข้อ 8 วรรคแรก — 60% ของมูลค่าหุ้น
 *   mortgage ข้อ 8(1) — ผูกกับราคาประเมิน ซึ่งเว็บไม่รู้
 *   deposit  ข้อ 8(3) — ผูกกับยอดเงินฝาก ซึ่งเว็บยังไม่ถาม (ผู้จัดการสั่ง 15-07: ทำบุคคลค้ำ+หุ้นก่อน) */
function ceilingFor(security, shares){
  const shareBaht = (Number(shares)||0) * SHARE_PAR;
  if(security==='person') return Math.min(GUAR_CEILING, Math.max(50000, 2*shareBaht));
  if(security==='share')  return 0.6 * shareBaht;
  return null;
}

// ---------- COOP schedule ----------
// inputs: {P, d0, rate, N}
function calcCoopCore(inputs){
  const P=inputs.P, d0=inputs.d0, rate=inputs.rate, N=inputs.N;
  if(!P||P<=0||!d0){ return null; }
  const q=quarterInfo(d0.getMonth());
  const instArr=instAmounts(P,N);
  const fd=firstDueDate(d0,q);
  const finalP=new Date(fd.getFullYear()+(N-1), q.am, q.ad);
  const map=new Map();
  const put=(date,kind)=>{const k=+date; const e=map.get(k)||{date,principal:false,close:false}; e[kind]=true; map.set(k,e);};
  for(let k=0;k<N;k++) put(new Date(fd.getFullYear()+k, q.am, q.ad),'principal');
  for(let y=d0.getFullYear();y<=finalP.getFullYear();y++){ const cd=new Date(y,8,30); if(cd>d0 && cd<=finalP) put(cd,'close'); }
  const events=[...map.values()].sort((a,b)=>a.date-b.date);
  let lastPrincipalTime=0; events.forEach(e=>{if(e.principal) lastPrincipalTime=Math.max(lastPrincipalTime,+e.date);});
  let base=d0, bal=P, rows=[], totI=0, totPay=0, pIdx=0;
  for(const e of events){
    const dd=daysBetween(base,e.date);
    const interest=bal*rate/100*dd/365;
    let principalPaid=0;
    if(e.principal){ principalPaid=(+e.date===lastPrincipalTime)? bal : instArr[pIdx]; pIdx++; }
    const balAfter=bal-principalPaid, pay=interest+principalPaid;
    const type=e.principal ? (e.close?'ครบกำหนดต้น + สิ้นปี':'ครบกำหนดต้น') : 'ตัดดอกสิ้นปี 30 ก.ย.';
    rows.push({date:e.date,type,days:dd,balBefore:bal,interest,principalPaid,pay,balAfter,
               isPrincipal:e.principal,isClose:e.close&&!e.principal});
    totI+=round2(interest); totPay+=round2(pay); bal=balAfter; base=e.date;
  }
  return {P,d0,rate,N,q,rows,totI:round2(totI),totPay:round2(totPay),finalP,instArr};
}

// ---------- MONTHLY (ผูกกับสัญญา · กระจายต่อปี) ----------
function solveAnnuity(startBal, startBase, dates, rate, target){
  function paidFor(A){
    let bal=startBal, base=startBase, paid=0;
    for(const pd of dates){ const dd=daysBetween(base,pd); const it=bal*rate/100*dd/365; const pp=A-it; paid+=pp; bal-=pp; base=pd; }
    return paid;
  }
  let lo=0, hi=target+startBal+1;
  for(let i=0;i<80;i++){ const mid=(lo+hi)/2; if(paidFor(mid)<target) lo=mid; else hi=mid; }
  return (lo+hi)/2;
}
// inputs: {P, d0, rate, N, mode}
function calcMonthlyCore(inputs){
  const P=inputs.P, d0=inputs.d0, rate=inputs.rate, N=inputs.N, mode=inputs.mode;
  if(!P||P<=0||!d0){ return null; }
  const q=quarterInfo(d0.getMonth());
  const instArr=instAmounts(P,N);
  const fd=firstDueDate(d0,q);
  const dueDates=[]; for(let k=0;k<N;k++) dueDates.push(new Date(fd.getFullYear()+k,q.am,q.ad));
  let outstanding=P, base=d0, rows=[], totI=0, totPay=0, gno=0, aFirst=0;
  for(let yr=0; yr<N; yr++){
    const periodStart=(yr===0)? d0 : dueDates[yr-1];
    const due=dueDates[yr];
    let m=monthsBetween(periodStart, due); if(m<1) m=1;
    const dates=[]; for(let i=1;i<m;i++) dates.push(addMonthsClamp(periodStart,i)); dates.push(due);
    const target=(yr===N-1)? outstanding : instArr[yr];
    let A=0; if(mode==='annuity') A=solveAnnuity(outstanding, base, dates, rate, target);
    const fixedInst=(mode!=='annuity')? instAmounts(target, dates.length) : null; // (ก) ปัดเลขสวยเหมือนรายปี
    if(yr===0) aFirst=(mode==='annuity')? A : fixedInst[0];
    let paidThis=0;
    dates.forEach((pd,idx)=>{
      gno++;
      const dd=daysBetween(base,pd);
      const it=outstanding*rate/100*dd/365;
      let pp=(mode==='annuity')? (A-it) : fixedInst[idx];
      if(idx===dates.length-1) pp=target-paidThis;                         // เดือนสุดท้ายของปีทดเศษ
      paidThis+=pp; const pay=it+pp;
      rows.push({no:gno,yr:yr+1,date:pd,days:dd,balBefore:outstanding,interest:it,principalPaid:pp,pay,balAfter:outstanding-pp,yearEnd:idx===dates.length-1});
      totI+=round2(it); totPay+=round2(pay); outstanding-=pp; base=pd;
    });
  }
  return {P,d0,rate,N,mode,q,instArr,dueDates,rows,totI,totPay,aFirst};
}

// ---------- PAYOFF (ยอดปิด ณ วันที่) ----------
// inputs: {P, d0, rate, N, X} · คืน null = ข้อมูลไม่ครบ · {tooEarly:true} = X ก่อนวันรับเงินกู้
function calcPayoffCore(inputs){
  const P=inputs.P, d0=inputs.d0, rate=inputs.rate, N=inputs.N, X=inputs.X;
  if(!P||P<=0||!d0||!X){ return null; }
  if(X<d0){ return {tooEarly:true}; }
  const q=quarterInfo(d0.getMonth()); const instArr=instAmounts(P,N); const fd=firstDueDate(d0,q);
  const dues=[]; for(let k=0;k<N;k++) dues.push(new Date(fd.getFullYear()+k,q.am,q.ad));
  const finalP=dues[N-1];
  let paidCount=0; dues.forEach(d=>{ if(d<=X) paidCount++; });
  let paidPrincipal=0; for(let k=0;k<paidCount;k++) paidPrincipal+=instArr[k];
  let outstanding=(paidCount>=N)? 0 : P-paidPrincipal; if(outstanding<0) outstanding=0;
  let lastSettle=d0;
  dues.forEach(d=>{ if(d<=X && d>lastSettle) lastSettle=d; });
  for(let y=d0.getFullYear();y<=X.getFullYear();y++){ const cd=new Date(y,8,30); if(cd>d0 && cd<=X && cd>lastSettle) lastSettle=cd; }
  const closed = outstanding<=0;
  const days=daysBetween(lastSettle,X);
  const accrued=outstanding*rate/100*days/365;
  const payoff=outstanding+accrued;
  return {P,d0,rate,N,X,q,instArr,dues,finalP,paidCount,paidPrincipal,outstanding,lastSettle,closed,days,accrued,payoff};
}

// ---------- PENALTY (เบี้ยปรับผิดนัด 3%/ปี — ข้อ 16 ว.3) ----------
// inputs: {Op, Dd, Pd, fineRate} · คืน null = ข้อมูลไม่ครบ · {notLate:true} = ยังไม่ผิดนัด
function calcPenaltyCore(inputs){
  const Op=inputs.Op, Dd=inputs.Dd, Pd=inputs.Pd, fineRate=inputs.fineRate;
  if(!Op||Op<=0||!Dd||!Pd){ return null; }
  if(Pd<=Dd){ return {notLate:true}; }
  const daysLate=daysBetween(Dd,Pd);
  const penalty=Op*fineRate/100*daysLate/365;
  return {Op,Dd,Pd,fineRate,daysLate,penalty,total:Op+penalty};
}

// ---------- RESTRUCTURE (ปรับโครงสร้างหนี้ — ระเบียบ 302) ----------
// nYears/nGrace = ค่าดิบจากช่องกรอก · clamp ตามระเบียบทำที่นี่ (เดิมทำตอนอ่าน DOM)
function clampRestructN(nYears){ return Math.max(1,Math.min(15,Math.round(nYears||1))); }
function clampRestructG(nGrace,N){ return Math.max(0,Math.min(3,N-1,Math.round(nGrace||0))); }

// inputs: {A, B, d0, rate, nYears, nGrace}
function calcRestructureCore(inputs){
  const A=inputs.A, B=inputs.B, d0=inputs.d0, rate=inputs.rate;
  const N=clampRestructN(inputs.nYears);
  const G=clampRestructG(inputs.nGrace,N);
  if(!A||A<=0||!d0){ return null; }
  const q=quarterInfo(d0.getMonth());
  const R=N-G;                                 // ปีที่ผ่อนจริง (หลังพ้น grace)
  const instA=instAmounts(A,R), instB=instAmounts(B,R);   // ต้นผ่อนใน R ปี
  const fd=firstDueDate(d0,q);
  const dues=[]; for(let k=0;k<N;k++) dues.push(new Date(fd.getFullYear()+k, q.am, q.ad));
  const finalP=dues[N-1];
  const graceEnd = G>0 ? dues[G-1] : null;     // งวดครบกำหนดสุดท้ายที่ยังปลอดชำระ
  const map=new Map();
  const put=(date,kind)=>{const k=+date; const e=map.get(k)||{date,principal:false,close:false}; e[kind]=true; map.set(k,e);};
  for(let k=0;k<N;k++) put(dues[k],'principal');
  for(let y=d0.getFullYear();y<=finalP.getFullYear();y++){ const cd=new Date(y,8,30); if(cd>d0 && cd<=finalP) put(cd,'close'); }
  const events=[...map.values()].sort((a,b)=>a.date-b.date);
  const lastPT=+dues[N-1];
  let base=d0, balA=A, balB=B, rows=[], totI=0, totPay=0, pIdx=0, deferred=0, graceInt=0;
  for(const e of events){
    const dd=daysBetween(base,e.date);
    const accrued=balA*rate/100*dd/365;        // ดอก A เดินต่อเนื่อง (ข้อ 16) · B=0% (ข้อ 12(2))
    const inGrace = graceEnd && e.date<=graceEnd;
    let payA=0, payB=0, intColl=0;
    if(inGrace){ deferred+=accrued; graceInt+=accrued; }   // พักจ่าย — ดอกสะสม (ข้อ 9 ว.2)
    else {
      intColl=accrued+deferred; deferred=0;                // งวดแรกหลัง grace เก็บดอกสะสมด้วย
      if(e.principal){ const last=(+e.date===lastPT); payA=last?balA:instA[pIdx]; payB=last?balB:instB[pIdx]; pIdx++; }
    }
    const pay=intColl+payA+payB;
    let type;
    if(inGrace) type=e.principal?'ปลอดชำระ (ครบกำหนด)':'ปลอดชำระ (ดอกสะสม)';
    else type=e.principal ? (e.close?'ครบกำหนด + สิ้นปี':'ครบกำหนดงวด') : 'ตัดดอก A สิ้นปี 30 ก.ย.';
    rows.push({date:e.date,type,days:dd,interest:intColl,payA,payB,pay,balAafter:balA-payA,balBafter:balB-payB,
               isPrincipal:e.principal,isClose:e.close&&!e.principal,inGrace});
    totI+=round2(intColl); totPay+=round2(pay); balA-=payA; balB-=payB; base=e.date;
  }
  totI=round2(totI); totPay=round2(totPay); graceInt=round2(graceInt);
  return {A,B,d0,rate,N,G,R,q,instA,instB,dues,finalP,graceEnd,rows,totI,totPay,graceInt};
}

// รายเดือนของ ปปน. — กระจายต่อปี (reset) · ต้น A+B เต็มบาท · grace เดือนปลอด=0 (ดอกสะสมเก็บงวดแรก)
// inputs: {A, B, d0, rate, nYears, nGrace, mode}
function calcRestructMonthlyCore(inputs){
  const A=inputs.A, B=inputs.B, d0=inputs.d0, rate=inputs.rate, mode=inputs.mode;
  const N=clampRestructN(inputs.nYears);
  const G=clampRestructG(inputs.nGrace,N);
  if(!A||A<=0||!d0){ return null; }
  const q=quarterInfo(d0.getMonth());
  const R=N-G;
  const instA=instAmounts(A,R), instB=instAmounts(B,R);
  const fd=firstDueDate(d0,q);
  const dues=[]; for(let k=0;k<N;k++) dues.push(new Date(fd.getFullYear()+k,q.am,q.ad));
  const deferred = G>0 ? A*rate/100*daysBetween(d0,dues[G-1])/365 : 0;
  let outA=A, outB=B, base=(G>0?dues[G-1]:d0), rows=[], totI=0, totPay=0, gno=0, firstAmt=0, firstRow=true;
  for(let yr=G; yr<N; yr++){
    const pStart=(yr===G)? (G>0?dues[G-1]:d0) : dues[yr-1];
    const due=dues[yr];
    let m=monthsBetween(pStart,due); if(m<1) m=1;
    const dates=[]; for(let i=1;i<m;i++) dates.push(addMonthsClamp(pStart,i)); dates.push(due);
    const tA=instA[yr-G], tB=instB[yr-G];
    const Aann = mode==='annuity' ? solveAnnuity(outA, base, dates, rate, tA) : 0;
    const fixedA=(mode!=='annuity')? instAmounts(tA, dates.length) : null; // ปัดเลขสวยเหมือนรายปี
    const fixedB=(mode!=='annuity')? instAmounts(tB, dates.length) : null;
    let paidA=0, paidB=0;
    dates.forEach((pd,idx)=>{
      gno++;
      const dd=daysBetween(base,pd);
      const itA=outA*rate/100*dd/365;
      let extra=0; if(firstRow){ extra=deferred; firstRow=false; }
      let ppA, ppB;
      if(mode==='annuity'){ ppA=Aann-itA; ppB=tB/dates.length; }
      else { ppA=fixedA[idx]; ppB=fixedB[idx]; }
      if(idx===dates.length-1){ ppA=tA-paidA; ppB=tB-paidB; }
      paidA+=ppA; paidB+=ppB;
      const itShown=itA+extra, pay=itShown+ppA+ppB;
      if(gno===1) firstAmt=pay;
      rows.push({no:gno,yr:yr+1,date:pd,days:dd,interest:itShown,ppA,ppB,pay,outAafter:outA-ppA,outBafter:outB-ppB,yearEnd:idx===dates.length-1,firstDefer:extra>0});
      totI+=round2(itShown); totPay+=round2(pay); outA-=ppA; outB-=ppB; base=pd;
    });
  }
  totI=round2(totI); totPay=round2(totPay);
  return {A,B,d0,rate,N,G,R,mode,q,instA,instB,dues,deferred,rows,totI,totPay,firstAmt};
}

return {
  TH_MONTH, GUAR_CEILING, SHARE_PAR, TOTAL_CEILING, CAPPED_TYPES, loanTotalCounted, shareRequired,
  round2, fmt, fmt0, thDate, daysBetween, lastDay, addMonthsClamp, monthsBetween,
  quarterInfo, firstDueDate, autoUnit, instAmounts, solveAnnuity, parseDate, ceilingFor,
  clampRestructN, clampRestructG,
  calcCoopCore, calcMonthlyCore, calcPayoffCore, calcPenaltyCore,
  calcRestructureCore, calcRestructMonthlyCore,
};
});
