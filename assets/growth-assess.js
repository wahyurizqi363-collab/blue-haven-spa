/* =========================================================
   PENILAIAN STATUS GIZI & PERTUMBUHAN ANAK (0-18 tahun)
   Acuan : WHO Child Growth Standards 2006 (0-60 bulan)
           WHO Growth Reference 2007 (5-19 tahun)
   Kategori : Permenkes RI No. 2 Tahun 2020 (Standar Antropometri Anak)
   Data LMS : growth-who-lms.js  (harus dimuat sebelum file ini dipakai)
   Bergantung pada ageInMonths() & calcBMI() di growth-data.js

   Indikator yang dinilai
     0-60 bln   : BB/U, PB/U atau TB/U, BB/PB atau BB/TB, IMT/U
     61-120 bln : BB/U, TB/U, IMT/U
     > 120 bln  : TB/U, IMT/U
========================================================= */

/* ---------- matematika LMS ---------- */
function gaInterp(rows, pos){
  const n = rows.length;
  const p = Math.max(0, Math.min(n - 1, pos));
  const i = Math.floor(p), t = p - i;
  const a = rows[i], b = rows[Math.min(n - 1, i + 1)];
  return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])];
}

// Ambil parameter [L, M, S] untuk indikator, jenis kelamin, usia (bulan) & tinggi (cm, hanya untuk BB/TB)
function gaGetLMS(ind, sex, ageM, hCm){
  if(typeof WHO_LMS === 'undefined') return null;
  const D = WHO_LMS[sex];
  if(!D) return null;
  if(ind === 'wfa'){
    if(ageM <= 60)  return gaInterp(D.wfa, ageM);
    if(ageM <= 120) return gaInterp(D.w7, ageM - 60);
    return null;                                    // BB/U WHO hanya sampai 10 tahun
  }
  if(ind === 'hfa'){
    if(ageM < 24)   return gaInterp(D.len, ageM);   // < 2 th: panjang badan (berbaring)
    if(ageM <= 60)  return gaInterp(D.hgt, ageM - 24);
    return gaInterp(D.h7, Math.min(ageM - 60, 168));
  }
  if(ind === 'bfa'){
    if(ageM < 24)   return gaInterp(D.bmiL, ageM);
    if(ageM <= 60)  return gaInterp(D.bmiH, ageM - 24);
    return gaInterp(D.b7, Math.min(ageM - 60, 168));
  }
  if(ind === 'wfh'){
    if(ageM > 60) return null;
    if(ageM < 24){ if(!(hCm >= 45 && hCm <= 110)) return null; return gaInterp(D.wfl, (hCm - 45) / 0.5); }
    if(!(hCm >= 65 && hCm <= 120)) return null;
    return gaInterp(D.wfh, (hCm - 65) / 0.5);
  }
  return null;
}

function gaValueAtZ(lms, z){
  const L = lms[0], M = lms[1], S = lms[2];
  return L === 0 ? M * Math.exp(S * z) : M * Math.pow(1 + L * S * z, 1 / L);
}

// z-score WHO. adjust=true: penyesuaian WHO untuk |z| > 3 pada indikator berbasis berat badan
function gaZ(y, lms, adjust){
  const L = lms[0], M = lms[1], S = lms[2];
  const raw = L === 0 ? Math.log(y / M) / S : (Math.pow(y / M, L) - 1) / (L * S);
  if(!adjust || Math.abs(raw) <= 3) return { z: raw, raw };
  if(raw > 3){
    const sd3 = gaValueAtZ(lms, 3), sd23 = sd3 - gaValueAtZ(lms, 2);
    return { z: 3 + (y - sd3) / sd23, raw };
  }
  const sd3n = gaValueAtZ(lms, -3), sd23n = gaValueAtZ(lms, -2) - sd3n;
  return { z: -3 + (y - sd3n) / sd23n, raw };
}

function gaPct(z){
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return (z > 0 ? 1 - p : p) * 100;
}
function gaPctText(z){
  const p = gaPct(z);
  if(p < 1) return '<1';
  if(p > 99) return '>99';
  return String(Math.round(p));
}
function gaNum(n, d){ return Number(n).toFixed(d); }
function gaSigned(n, d){ const v = Number(n); return (v > 0.0000001 ? '+' : v < -0.0000001 ? '-' : '') + Math.abs(v).toFixed(d); }

/* ---------- kategori (Permenkes 2/2020) ----------
   k : vlow | low | ok | high | vhigh   -> dipakai untuk teks keterangan & saran */
function gaCatBBU(z){
  if(z < -3) return { k:'vlow', cls:'danger', label:'Berat badan sangat kurang', short:'Sangat kurang' };
  if(z < -2) return { k:'low',  cls:'warn',   label:'Berat badan kurang',        short:'Kurang' };
  if(z <= 1) return { k:'ok',   cls:'ok',     label:'Berat badan normal',        short:'Normal' };
  return            { k:'high', cls:'warn',   label:'Risiko berat badan lebih',  short:'Risiko lebih' };
}
function gaCatTBU(z, ageM){
  const nm = ageM < 24 ? 'Panjang badan' : 'Tinggi badan';
  if(z < -3) return { k:'vlow', cls:'danger', label:'Sangat pendek (severely stunted)', short:'Sangat pendek' };
  if(z < -2) return { k:'low',  cls:'warn',   label:'Pendek (stunted)',                 short:'Pendek' };
  if(z <= 3) return { k:'ok',   cls:'ok',     label:nm + ' normal',                     short:'Normal' };
  return            { k:'high', cls:'ok',     label:nm + ' di atas rata-rata',          short:'Tinggi' };
}
function gaCatGizi05(z){      // BB/PB, BB/TB, dan IMT/U untuk usia 0-60 bulan
  if(z < -3) return { k:'vlow',  cls:'danger', label:'Gizi buruk (severely wasted)', short:'Gizi buruk' };
  if(z < -2) return { k:'low',   cls:'warn',   label:'Gizi kurang (wasted)',         short:'Gizi kurang' };
  if(z <= 1) return { k:'ok',    cls:'ok',     label:'Gizi baik (normal)',           short:'Gizi baik' };
  if(z <= 2) return { k:'high',  cls:'warn',   label:'Berisiko gizi lebih',          short:'Risiko gizi lebih' };
  if(z <= 3) return { k:'high',  cls:'warn',   label:'Gizi lebih (overweight)',      short:'Gizi lebih' };
  return            { k:'vhigh', cls:'danger', label:'Obesitas',                     short:'Obesitas' };
}
function gaCatIMT5(z){        // IMT/U untuk usia 5-18 tahun
  if(z < -3) return { k:'vlow',  cls:'danger', label:'Gizi buruk (sangat kurus)', short:'Gizi buruk' };
  if(z < -2) return { k:'low',   cls:'warn',   label:'Gizi kurang (kurus)',       short:'Gizi kurang' };
  if(z <= 1) return { k:'ok',    cls:'ok',     label:'Gizi baik (normal)',        short:'Gizi baik' };
  if(z <= 2) return { k:'high',  cls:'warn',   label:'Gizi lebih (overweight)',   short:'Gizi lebih' };
  return            { k:'vhigh', cls:'danger', label:'Obesitas',                  short:'Obesitas' };
}

// pita warna untuk bar z-score: [dari, sampai, warna]
const GA_RED = '#F3B6B0', GA_AMB = '#F9D9A8', GA_GRN = '#BFE6BE', GA_BLU = '#B9D9F7', GA_LAMB = '#FBE8BE';
const GA_ZONES = {
  bbu:  [[-4,-3,GA_RED],[-3,-2,GA_AMB],[-2,1,GA_GRN],[1,4,GA_AMB]],
  tbu:  [[-4,-3,GA_RED],[-3,-2,GA_AMB],[-2,3,GA_GRN],[3,4,GA_BLU]],
  g05:  [[-4,-3,GA_RED],[-3,-2,GA_AMB],[-2,1,GA_GRN],[1,2,GA_LAMB],[2,3,GA_AMB],[3,4,GA_RED]],
  imt5: [[-4,-3,GA_RED],[-3,-2,GA_AMB],[-2,1,GA_GRN],[1,2,GA_AMB],[2,4,GA_RED]],
};

const GA_WHAT = {
  bbu:  'Membandingkan berat badan dengan anak seusia dan berjenis kelamin sama. Dipakai untuk memantau berat badan secara umum.',
  tbu:  'Membandingkan panjang/tinggi badan dengan anak seusia. Menggambarkan pertumbuhan jangka panjang; nilai rendah menandakan stunting.',
  bbtb: 'Membandingkan berat badan dengan panjang/tinggi badannya. Menggambarkan apakah tubuh anak proporsional saat ini (kurus atau gemuk).',
  imt:  'Indeks Massa Tubuh (berat ÷ tinggi²) dibandingkan anak seusia dan sejenis kelamin. Menggambarkan status gizi: kurus, normal, atau gemuk.',
};
const GA_MEANING = {
  bbu:  { vlow:'Berat badan jauh di bawah standar untuk usianya.',
          low:'Berat badan di bawah standar untuk usianya.',
          ok:'Berat badan sesuai standar untuk usianya.',
          high:'Berat badan di atas standar usianya. Lihat juga IMT/U atau BB/TB untuk memastikan apakah masih proporsional dengan tingginya.',
          vhigh:'Berat badan jauh di atas standar usianya.' },
  tbu:  { vlow:'Jauh lebih pendek dari standar usianya (stunting berat).',
          low:'Lebih pendek dari standar usianya (stunting).',
          ok:'Pertumbuhan tinggi/panjang badan sesuai standar usianya.',
          high:'Lebih tinggi dari rata-rata usianya. Biasanya bukan masalah, bandingkan dengan tinggi kedua orang tuanya.',
          vhigh:'Jauh lebih tinggi dari rata-rata usianya.' },
  bbtb: { vlow:'Sangat kurus untuk tinggi badannya (gizi buruk). Perlu penanganan segera.',
          low:'Kurus untuk tinggi badannya (gizi kurang).',
          ok:'Berat badan proporsional dengan tinggi badannya.',
          high:'Berat badan di atas proporsi tinggi badannya (kecenderungan gizi lebih).',
          vhigh:'Berat badan jauh di atas proporsi tinggi badannya (obesitas).' },
  imt:  { vlow:'Sangat kurus untuk usianya (gizi buruk). Perlu penanganan segera.',
          low:'Kurus untuk usianya (gizi kurang).',
          ok:'Status gizi baik: berat badan seimbang dengan tinggi badannya.',
          high:'Kelebihan berat badan dibanding tinggi badannya (gizi lebih).',
          vhigh:'Kelebihan berat badan yang tinggi dibanding tinggi badannya (obesitas).' },
};

// batas wajar WHO: di luar ini hampir pasti salah ukur / salah input
const GA_IMPLAUSIBLE = { bbu:[-6, 5], tbu:[-6, 6], bbtb:[-5, 5], imt:[-5, 5] };

/* ---------- penilaian 1 pengukuran ----------
   m = { sex:'boy'|'girl', ageMonths, weight(kg), height(cm) } */
function gaAssess(m){
  const ageM = Number(m.ageMonths), w = Number(m.weight), h = Number(m.height), sex = m.sex;
  const bmi = calcBMI(w, h);
  const out = { sex, ageMonths: ageM, weight: w, height: h, bmi, indicators: [], primary: null, notes: [], flags: [] };
  if(!(ageM >= 0) || !(w > 0) || !(h > 0) || !WHO_LMS[sex]) return out;

  const young = ageM <= 60;
  const hName = ageM < 24 ? 'panjang' : 'tinggi';
  const HU = ageM < 24 ? 'PB' : 'TB';

  const specs = [];
  if(ageM <= 120) specs.push({ key:'bbu', ind:'wfa', short:'BB/U', title:'Berat badan menurut umur', y:w, unit:'kg', dec:1, adjust:true, zr:[-2,1], cat:gaCatBBU, zones:GA_ZONES.bbu });
  specs.push({ key:'tbu', ind:'hfa', short:HU + '/U', title:(ageM < 24 ? 'Panjang' : 'Tinggi') + ' badan menurut umur', y:h, unit:'cm', dec:1, adjust:false, zr:[-2,3], cat:z => gaCatTBU(z, ageM), zones:GA_ZONES.tbu });
  if(young) specs.push({ key:'bbtb', ind:'wfh', short:'BB/' + HU, title:'Berat badan menurut ' + hName + ' badan', y:w, unit:'kg', dec:1, adjust:true, zr:[-2,1], cat:gaCatGizi05, zones:GA_ZONES.g05 });
  specs.push({ key:'imt', ind:'bfa', short:'IMT/U', title:'Indeks massa tubuh menurut umur', y:bmi, unit:'kg/m²', dec:1, adjust:true, zr:[-2,1], cat: young ? gaCatGizi05 : gaCatIMT5, zones: young ? GA_ZONES.g05 : GA_ZONES.imt5 });

  specs.forEach(s => {
    const lms = gaGetLMS(s.ind, sex, ageM, h);
    if(!lms){
      if(s.key === 'bbtb') out.notes.push(`BB/${HU} tidak dapat dihitung karena ${hName} badan ${gaNum(h,1)} cm berada di luar rentang tabel WHO (${ageM < 24 ? '45–110' : '65–120'} cm). Cek kembali angka yang dimasukkan.`);
      return;
    }
    const r = gaZ(s.y, lms, s.adjust);
    const cat = s.cat(r.z);
    const lo = gaValueAtZ(lms, s.zr[0]), hi = gaValueAtZ(lms, s.zr[1]);
    const lim = GA_IMPLAUSIBLE[s.key];
    if(r.raw < lim[0] || r.raw > lim[1]) out.flags.push(s.short);
    out.indicators.push({
      key: s.key, short: s.short, title: s.title, unit: s.unit,
      value: s.y, valueText: gaNum(s.y, s.dec) + ' ' + s.unit,
      z: r.z, zRaw: r.raw, pct: gaPctText(r.z), cat, zones: s.zones,
      median: gaValueAtZ(lms, 0), lo, hi,
      rangeText: `${gaNum(lo, 1)}–${gaNum(hi, 1)} ${s.unit}`,
      rangeSD: `${gaSigned(s.zr[0], 0)} s/d ${gaSigned(s.zr[1], 0)} SD`,
      what: GA_WHAT[s.key], meaning: GA_MEANING[s.key][cat.k],
    });
  });

  if(ageM > 120) out.notes.push('Untuk usia di atas 10 tahun, WHO tidak menyediakan standar BB/U, sehingga status berat badan dinilai lewat IMT/U.');
  if(ageM > 60 && ageM <= 120) out.notes.push('Usia 5–10 tahun: BB/U, TB/U, dan IMT/U memakai Acuan Pertumbuhan WHO 2007.');
  if(ageM < 24) out.notes.push('Anak di bawah 2 tahun idealnya diukur dalam posisi berbaring (panjang badan). Jika diukur berdiri, hasil bisa selisih ±0,7 cm.');

  out.primary = out.indicators.find(i => i.key === 'bbtb') || out.indicators.find(i => i.key === 'imt') || null;
  out.advice = gaAdvice(out);
  return out;
}

function gaFind(a, key){ return a.indicators.find(i => i.key === key) || null; }

function gaAdvice(a){
  const tips = [];
  const p = a.primary, tb = gaFind(a, 'tbu'), bb = gaFind(a, 'bbu');
  const infant = a.ageMonths < 24;
  if(p){
    if(p.cat.k === 'vlow') tips.push('Status gizi masuk kategori gizi buruk. Segera periksakan ke dokter anak, puskesmas, atau posyandu untuk pemeriksaan dan penanganan lebih lanjut.');
    else if(p.cat.k === 'low') tips.push('Berat badan belum ideal untuk ' + (p.key === 'bbtb' ? 'tinggi badannya' : 'usianya') + '. Tingkatkan asupan makanan bergizi seimbang (utamakan protein hewani seperti telur, ikan, daging, hati ayam) dan konsultasikan ke tenaga kesehatan.');
    else if(p.cat.k === 'vhigh') tips.push('Anak masuk kategori obesitas. Konsultasikan ke dokter anak atau ahli gizi untuk penilaian dan program yang aman' + (infant ? ' — jangan membatasi makanan tanpa arahan tenaga kesehatan.' : '.'));
    else if(p.cat.k === 'high') tips.push(infant
      ? 'Berat badan cenderung berlebih. Konsultasikan ke tenaga kesehatan untuk menilai pola menyusu/MPASI — jangan membatasi makanan tanpa arahan.'
      : 'Berat badan cenderung berlebih. Batasi minuman manis dan makanan tinggi gula/lemak, perbanyak aktivitas fisik, dan pantau secara berkala.');
    else tips.push('Status gizi baik. Pertahankan pola makan gizi seimbang, aktivitas fisik, dan tidur yang cukup.');
  }
  if(tb && (tb.cat.k === 'vlow' || tb.cat.k === 'low')){
    tips.push('Tinggi/panjang badan di bawah standar (indikasi stunting). Konsultasikan ke puskesmas atau dokter anak untuk menilai asupan gizi dan riwayat kesehatan, serta ukur tinggi badan secara rutin.');
    if(bb && (bb.cat.k === 'vlow' || bb.cat.k === 'low') && p && p.cat.k === 'ok')
      tips.push('Berat badan rendah menurut usia terutama karena tubuh yang pendek (berat sudah proporsional dengan tingginya). Fokus pada perbaikan gizi agar pertumbuhan tinggi mengejar standar.');
  }
  if(a.ageMonths <= 24) tips.push('Pantau berat dan panjang badan setiap bulan (timbang di posyandu/puskesmas).');
  else if(a.ageMonths <= 60) tips.push('Pantau berat dan tinggi badan setiap 1–3 bulan.');
  else tips.push('Pantau berat dan tinggi badan setiap 3–6 bulan.');
  if(a.flags.length) tips.unshift('Hasil ' + a.flags.join(', ') + ' tampak tidak wajar (terlalu ekstrem). Ukur ulang dan periksa kembali angka berat/tinggi yang dimasukkan.');
  return tips;
}

/* ---------- perbandingan dengan pengukuran sebelumnya ---------- */
function gaAssessRecord(r){
  return gaAssess({ sex: r.sex, ageMonths: ageInMonths(r.baby_dob, r.measurement_date), weight: Number(r.weight), height: Number(r.height) });
}

function gaTrend(prevRec, lastRec, aPrev, aLast){
  const days = (new Date(lastRec.measurement_date) - new Date(prevRec.measurement_date)) / 86400000;
  const months = days / 30.4368;
  const dW = Number(lastRec.weight) - Number(prevRec.weight);
  const dH = Number(lastRec.height) - Number(prevRec.height);
  const t = { days, months, dW, dH, notes: [], zdiff: [] };
  if(months > 0.1){
    t.dWm = dW / months; t.dHm = dH / months;
  }
  if(months < 1) t.notes.push('Jarak antar pengukuran kurang dari 1 bulan, sehingga selisih yang kecil bisa hanya karena variasi alat/cara ukur.');
  if(dW < 0) t.notes.push('Berat badan turun dibanding pengukuran sebelumnya. Jika anak sedang sakit atau nafsu makan menurun, pantau dan konsultasikan bila berlanjut.');
  if(dH < -0.4) t.notes.push('Tinggi badan lebih rendah dari pengukuran sebelumnya — kemungkinan beda alat/cara ukur. Sebaiknya diukur ulang.');
  else if(dH <= 0.05 && months >= 3 && aLast.ageMonths < 60) t.notes.push('Tinggi badan tidak bertambah dalam ≥3 bulan. Pantau dan ukur ulang pada kunjungan berikutnya.');
  aLast.indicators.forEach(i => {
    const pi = aPrev.indicators.find(x => x.key === i.key);
    if(pi) t.zdiff.push({ key: i.key, short: i.short, from: pi.z, to: i.z, d: i.z - pi.z });
  });
  return t;
}

// Ringkasan 1 baris untuk daftar riwayat: "BB/U Normal (z -0.3) · TB/U Normal (z +0.1) · ..."
function gaBriefText(r){
  const a = gaAssessRecord(r);
  if(!a.indicators.length) return '';
  return a.indicators.map(i => `${i.short} ${i.cat.short} (z ${gaSigned(i.z, 1)})`).join(' · ');
}

/* ---------- tampilan HTML ---------- */
const GA_COLORS = { ok:['#EAF6EE','#1E7B3F'], warn:['#FFF4DD','#8A5A00'], danger:['#FDECEE','#A32A2A'], info:['#EEF3FA','#12407A'] };

function gaEsc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function gaInjectCSS(){
  if(document.getElementById('ga-css')) return;
  const st = document.createElement('style');
  st.id = 'ga-css';
  st.textContent = `
  .ga-card{background:#fff;border:1px solid #DCE9F7;border-radius:14px;padding:14px 14px 10px;margin:10px 0 14px;color:#132A44;}
  .ga-title{font-weight:700;font-size:1.02rem;color:#12407A;margin:0;}
  .ga-sub{font-size:.8rem;color:#5D7291;margin:2px 0 10px;}
  .ga-primary{border-radius:12px;padding:10px 12px;margin-bottom:10px;}
  .ga-primary .ga-plabel{font-size:.74rem;opacity:.85;text-transform:uppercase;letter-spacing:.04em;}
  .ga-primary .ga-pval{font-size:1.08rem;font-weight:700;margin:1px 0;}
  .ga-primary .ga-ptxt{font-size:.85rem;}
  .ga-alert{border-radius:10px;padding:8px 10px;margin-bottom:8px;font-size:.83rem;background:#FDECEE;color:#A32A2A;}
  .ga-note{border-radius:10px;padding:7px 10px;margin-bottom:6px;font-size:.8rem;background:#EEF3FA;color:#12407A;}
  .ga-ind{border-top:1px solid #EDF3FA;padding:10px 0;}
  .ga-ind:first-of-type{border-top:0;}
  .ga-top{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap;}
  .ga-name{font-size:.92rem;}
  .ga-name small{display:block;color:#5D7291;font-size:.76rem;}
  .ga-badge{display:inline-block;border-radius:999px;padding:3px 10px;font-size:.78rem;font-weight:600;white-space:nowrap;}
  .ga-stats{display:flex;gap:6px 14px;flex-wrap:wrap;font-size:.83rem;margin:6px 0 4px;}
  .ga-stats span{color:#5D7291;} .ga-stats b{color:#132A44;}
  .ga-zbar{position:relative;height:10px;border-radius:5px;overflow:hidden;display:flex;margin:6px 0 2px;}
  .ga-zbar i{display:block;height:100%;}
  .ga-zwrap{position:relative;}
  .ga-zmark{position:absolute;top:-2px;width:3px;height:14px;background:#132A44;border-radius:2px;transform:translateX(-50%);}
  .ga-zlab{display:flex;justify-content:space-between;font-size:.65rem;color:#5D7291;margin-bottom:4px;}
  .ga-txt{font-size:.82rem;color:#3d5573;line-height:1.45;margin:4px 0 0;}
  .ga-sec{font-weight:700;font-size:.9rem;color:#12407A;margin:12px 0 6px;}
  .ga-trend{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:6px;}
  .ga-trend div{background:#F4F8FD;border-radius:10px;padding:8px 10px;font-size:.8rem;color:#5D7291;}
  .ga-trend b{display:block;font-size:1rem;color:#132A44;}
  .ga-list{margin:0;padding-left:18px;font-size:.84rem;line-height:1.5;}
  .ga-list li{margin-bottom:4px;}
  .ga-foot{font-size:.74rem;color:#5D7291;margin:10px 0 2px;}
  `;
  document.head.appendChild(st);
}

function gaZBar(ind){
  const lo = -4, hi = 4, span = hi - lo;
  const segs = ind.zones.map(([a, b, c]) => `<i style="width:${((b - a) / span * 100).toFixed(2)}%;background:${c};"></i>`).join('');
  const pos = (Math.max(lo, Math.min(hi, ind.z)) - lo) / span * 100;
  const labs = [-3,-2,-1,0,1,2,3].map(v => `<span>${v > 0 ? '+' + v : v}</span>`).join('');
  return `<div class="ga-zwrap"><div class="ga-zbar">${segs}</div><div class="ga-zmark" style="left:${pos.toFixed(2)}%;"></div></div>
          <div class="ga-zlab" style="padding:0 ${(100 / span).toFixed(1)}%;">${labs}</div>`;
}

function gaBadge(cls, text){
  const c = GA_COLORS[cls] || GA_COLORS.info;
  return `<span class="ga-badge" style="background:${c[0]};color:${c[1]};">${gaEsc(text)}</span>`;
}

function gaAgeText(months){
  const m = Math.floor(months);
  if(m < 24) return m + ' bulan';
  const y = Math.floor(m / 12), r = m % 12;
  return r ? `${y} tahun ${r} bulan` : `${y} tahun`;
}

// records: urut lama -> baru. opts.dateFmt(str) opsional untuk format tanggal.
function gaRender(records, opts){
  gaInjectCSS();
  opts = opts || {};
  const fmtDate = opts.dateFmt || (s => s);
  const last = records[records.length - 1];
  const prev = records.length > 1 ? records[records.length - 2] : null;
  const A = gaAssessRecord(last);
  if(!A.indicators.length) return '<div class="notice warn">Data pengukuran belum bisa dinilai. Periksa kembali berat, tinggi, dan tanggal lahir.</div>';

  let html = `<div class="ga-card">
    <p class="ga-title">Hasil Penilaian Status Gizi</p>
    <p class="ga-sub">Standar WHO &amp; Permenkes 2/2020 · pengukuran ${gaEsc(fmtDate(last.measurement_date))} · usia ${gaAgeText(A.ageMonths)} · IMT ${gaNum(A.bmi, 1)} kg/m²</p>`;

  if(A.primary){
    const c = GA_COLORS[A.primary.cat.cls] || GA_COLORS.info;
    html += `<div class="ga-primary" style="background:${c[0]};color:${c[1]};">
      <div class="ga-plabel">Kesimpulan status gizi (${gaEsc(A.primary.short)})</div>
      <div class="ga-pval">${gaEsc(A.primary.cat.label)}</div>
      <div class="ga-ptxt">${gaEsc(A.primary.meaning)}</div>
    </div>`;
  }
  if(A.flags.length) html += `<div class="ga-alert">⚠️ Nilai ${gaEsc(A.flags.join(', '))} tampak tidak wajar (terlalu ekstrem). Kemungkinan salah ukur atau salah input — mohon ukur ulang / periksa angka berat &amp; tinggi.</div>`;

  A.indicators.forEach(i => {
    html += `<div class="ga-ind">
      <div class="ga-top">
        <div class="ga-name"><strong>${gaEsc(i.short)}</strong><small>${gaEsc(i.title)}</small></div>
        ${gaBadge(i.cat.cls, i.cat.label)}
      </div>
      <div class="ga-stats">
        <span>Hasil ukur: <b>${gaEsc(i.valueText)}</b></span>
        <span>Z-score: <b>${gaSigned(i.z, 2)}</b></span>
        <span>Persentil: <b>${i.pct}</b></span>
      </div>
      ${gaZBar(i)}
      <p class="ga-txt">${gaEsc(i.meaning)} <em>Rentang normal untuk anak seusia ini: <b>${gaEsc(i.rangeText)}</b> (${gaEsc(i.rangeSD)}); rata-rata WHO ${gaNum(i.median, 1)} ${gaEsc(i.unit)}.</em></p>
      <p class="ga-txt" style="color:#5D7291;">${gaEsc(i.what)}</p>
    </div>`;
  });

  // perkembangan dibanding pengukuran sebelumnya
  if(prev){
    const T = gaTrend(prev, last, gaAssessRecord(prev), A);
    html += `<div class="ga-sec">Perkembangan sejak ${gaEsc(fmtDate(prev.measurement_date))}</div>
      <div class="ga-trend">
        <div>Berat badan<b>${gaSigned(T.dW, 1)} kg</b>${T.dWm !== undefined ? `<span>${gaSigned(T.dWm, 2)} kg/bulan</span>` : ''}</div>
        <div>${A.ageMonths < 24 ? 'Panjang' : 'Tinggi'} badan<b>${gaSigned(T.dH, 1)} cm</b>${T.dHm !== undefined ? `<span>${gaSigned(T.dHm, 2)} cm/bulan</span>` : ''}</div>
        <div>Selang waktu<b>${T.months >= 1 ? gaNum(T.months, 1) + ' bulan' : Math.round(T.days) + ' hari'}</b></div>
      </div>`;
    if(T.zdiff.length){
      html += `<p class="ga-txt">Perubahan Z-score: ${T.zdiff.map(d => `${gaEsc(d.short)} ${gaSigned(d.from, 2)} → <b>${gaSigned(d.to, 2)}</b> ${Math.abs(d.d) < 0.3 ? '(stabil)' : d.d > 0 ? '(naik ↑)' : '(turun ↓)'}`).join(' · ')}.</p>`;
    }
    T.notes.forEach(n => { html += `<div class="ga-note">${gaEsc(n)}</div>`; });
  }

  html += `<div class="ga-sec">Saran tindak lanjut</div><ul class="ga-list">${A.advice.map(t => `<li>${gaEsc(t)}</li>`).join('')}</ul>`;
  A.notes.forEach(n => { html += `<div class="ga-note" style="margin-top:8px;">${gaEsc(n)}</div>`; });
  html += `<p class="ga-foot">Z-score = selisih hasil ukur dari rata-rata WHO dalam satuan simpangan baku (SD). Normal umumnya antara -2 dan +1 SD (tinggi badan: -2 sampai +3 SD). Ini perkiraan berdasarkan standar WHO, <strong>bukan diagnosis medis</strong> — konsultasikan dengan bidan, dokter anak, atau posyandu untuk penilaian lebih lanjut.</p></div>`;
  return html;
}
