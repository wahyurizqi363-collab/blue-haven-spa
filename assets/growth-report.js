/* =========================================================
   LAPORAN TUMBUH KEMBANG untuk orang tua
   - buildGrowthWAText(records)  -> pesan WhatsApp (kalimat)
   - buildGrowthPDF(records)     -> dokumen PDF (jsPDF) berisi status, grafik, dan tabel pengukuran
   Bergantung pada growth-data.js, growth-who-lms.js & growth-assess.js (ageInMonths, gaAssessRecord, boundsSeries)
   records: array pengukuran 1 anak, urut lama -> baru
========================================================= */
const GR_BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const GR_BULAN_PNDK = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

function grDate(str, short){
  const m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return String(str || '');
  const names = short ? GR_BULAN_PNDK : GR_BULAN;
  return `${Number(m[3])} ${names[Number(m[2]) - 1]} ${m[1]}`;
}
function grAge(months){
  const total = Math.max(0, months);
  let m = Math.floor(total);
  let d = Math.round((total - m) * 30.4368);
  if(d >= 30){ m += 1; d = 0; }
  if(m >= 24){
    const y = Math.floor(m / 12), r = m % 12;
    return r ? `${y} tahun ${r} bulan` : `${y} tahun`;
  }
  if(m === 0) return `${d} hari`;
  return d ? `${m} bulan ${d} hari` : `${m} bulan`;
}
function grNum(n, dec){ return Number(n).toFixed(dec).replace('.', ','); }
function grSigned(n, dec){ const v = Number(n); return (v > 0 ? '+' : v < 0 ? '-' : '') + grNum(Math.abs(v), dec); }

// teks aman untuk PDF (font bawaan jsPDF hanya Latin-1) + koma desimal gaya Indonesia
function grAscii(str){
  return String(str).replace(/[\u2013\u2014\u2212]/g, '-').replace(/\u2192/g, '->').replace(/\u2265/g, '>=')
    .replace(/\u00F7/g, '/').replace(/\u00B2/g, '2').replace(/[\u2191\u2193]/g, '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
}
function grDec(str){ return String(str).replace(/(\d)\.(\d)/g, '$1,$2'); }
function grT(str){ return grDec(grAscii(str)); }

function grSummary(records){
  const last = records[records.length - 1];
  const prev = records.length > 1 ? records[records.length - 2] : null;
  const A = gaAssessRecord(last);
  return { last, prev, age: A.ageMonths, A };
}

/* ---------- 1) Pesan WhatsApp ---------- */
function buildGrowthWAText(records){
  const { last, prev, age, A } = grSummary(records);
  const lines = [];
  const hLabel = age < 24 ? 'Panjang' : 'Tinggi';
  lines.push(`Halo Bunda/Ayah, berikut ringkasan tumbuh kembang *${last.baby_name}* dari Blue Haven Baby & Kids Spa 🌊`);
  lines.push('');
  lines.push(`📅 Pengukuran terakhir: ${grDate(last.measurement_date)} (usia ${grAge(age)})`);
  lines.push(`⚖️ Berat badan: *${grNum(last.weight, 1)} kg*`);
  lines.push(`📏 ${hLabel} badan: *${grNum(last.height, 1)} cm*`);
  if(A.indicators.length) lines.push(`🧮 IMT: ${grNum(A.bmi, 1)} kg/m²`);
  if(A.indicators.length){
    lines.push('');
    lines.push('📊 *Hasil penilaian (standar WHO)*');
    A.indicators.forEach(i => {
      lines.push(`• ${i.short}: ${i.cat.label} (Z-score ${grSigned(i.z, 2)}; normal ${grDec(i.rangeText)})`);
    });
    if(A.primary){
      lines.push('');
      lines.push(`✅ Kesimpulan status gizi: *${A.primary.cat.label}*`);
      lines.push(grDec(A.primary.meaning));
    }
  }
  if(prev){
    lines.push('');
    lines.push(`📈 Sejak ${grDate(prev.measurement_date, true)}: berat ${grSigned(Number(last.weight) - Number(prev.weight), 1)} kg, ${hLabel.toLowerCase()} ${grSigned(Number(last.height) - Number(prev.height), 1)} cm`);
  }
  if(records.length > 1){
    lines.push('');
    lines.push('Riwayat pengukuran:');
    records.slice(-5).reverse().forEach(r => {
      lines.push(`• ${grDate(r.measurement_date, true)}: ${grNum(r.weight, 1)} kg / ${grNum(r.height, 1)} cm`);
    });
  }
  if(A.advice && A.advice.length){
    lines.push('');
    lines.push('💡 *Saran*');
    A.advice.forEach(t => lines.push(`• ${grDec(t)}`));
  }
  lines.push('');
  if(A.indicators.some(i => ['warn', 'danger'].includes(i.cat.cls))){
    lines.push('Mohon konsultasikan hasil ini dengan bidan/dokter anak atau posyandu terdekat ya, Bunda/Ayah, supaya bisa dipantau lebih lanjut 🙏');
  }
  lines.push('_Catatan: ini perkiraan berdasarkan standar pertumbuhan WHO, bukan diagnosis._');
  lines.push('');
  lines.push('Terima kasih sudah mempercayakan si kecil kepada kami 💙');
  return lines.join('\n');
}

/* ---------- 2) PDF ---------- */
function grHex(hex){
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function grFill(doc, hex){ const c = grHex(hex); doc.setFillColor(c[0], c[1], c[2]); }
function grDraw(doc, hex){ const c = grHex(hex); doc.setDrawColor(c[0], c[1], c[2]); }
function grText(doc, hex){ const c = grHex(hex); doc.setTextColor(c[0], c[1], c[2]); }

function grPolygon(doc, pts, hex){
  if(pts.length < 3) return;
  const deltas = [];
  for(let i = 1; i < pts.length; i++) deltas.push([pts[i][0] - pts[i-1][0], pts[i][1] - pts[i-1][1]]);
  grFill(doc, hex);
  doc.lines(deltas, pts[0][0], pts[0][1], [1, 1], 'F', true);
}

function grNiceMax(v){
  const step = v > 40 ? 10 : v > 15 ? 5 : 2;
  return Math.ceil(v / step) * step;
}

// Grafik pita gaya KMS (merah = di bawah normal, hijau = normal, biru = di atas normal) digambar sebagai vektor
function grDrawChart(doc, type, sex, records, x, y, w, h){
  const title = type === 'weight' ? 'Berat Badan menurut Umur (kg)' : 'Tinggi Badan menurut Umur (cm)';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); grText(doc, '#12407A');
  doc.text(title, x, y);

  const padL = 9, padR = 2, padT = 3, padB = 8;
  const px = x + padL, py = y + padT, pw = w - padL - padR, ph = h - padT - padB;
  const series = boundsSeries(type, sex);
  const pts = records.map(r => ({ age: ageInMonths(r.baby_dob, r.measurement_date), v: Number(type === 'weight' ? r.weight : r.height) }));
  const maxY = grNiceMax(Math.max(...series.map(s => s.upper), ...pts.map(p => p.v)) * 1.15);
  const X = a => px + (Math.min(60, Math.max(0, a)) / 60) * pw;
  const Y = v => py + ph - (Math.min(maxY, Math.max(0, v)) / maxY) * ph;
  const yBase = Y(0), yTop = py;

  const lower = series.map(s => [X(s.age), Y(Math.max(0, s.lower))]);
  const upper = series.map(s => [X(s.age), Y(s.upper)]);
  grPolygon(doc, [...lower, [X(60), yBase], [X(0), yBase]], '#F5C5C0');
  grPolygon(doc, [...lower, ...upper.slice().reverse()], '#CBEBCA');
  grPolygon(doc, [...upper, [X(60), yTop], [X(0), yTop]], '#D1E7F9');

  // garis bantu + label sumbu
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); grText(doc, '#5D7291');
  doc.setLineWidth(0.1);
  for(let a = 0; a <= 60; a += 6){
    grDraw(doc, '#DCE9F7'); doc.line(X(a), yTop, X(a), yBase);
    doc.text(String(a), X(a), yBase + 3.5, { align: 'center' });
  }
  const tickStep = [1, 2, 5, 10, 20, 25, 50].find(st => maxY / st <= 6) || 50;
  for(let val = 0; val <= maxY + 0.001; val += tickStep){
    grDraw(doc, '#EDF3FA'); doc.line(px, Y(val), px + pw, Y(val));
    doc.text(String(Math.round(val)), px - 1.5, Y(val) + 0.8, { align: 'right' });
  }
  doc.text('Umur (bulan)', px + pw / 2, yBase + 7, { align: 'center' });

  // batas bawah (merah) & atas (biru)
  doc.setLineWidth(0.3);
  grDraw(doc, '#D6473A'); for(let i = 1; i < lower.length; i++) doc.line(lower[i-1][0], lower[i-1][1], lower[i][0], lower[i][1]);
  grDraw(doc, '#3E7FC7'); for(let i = 1; i < upper.length; i++) doc.line(upper[i-1][0], upper[i-1][1], upper[i][0], upper[i][1]);
  grDraw(doc, '#B9C6D6'); doc.setLineWidth(0.2); doc.line(px, yBase, px + pw, yBase);

  // garis tren + titik pengukuran
  const mp = pts.map(p => [X(p.age), Y(p.v)]);
  doc.setLineWidth(0.5); grDraw(doc, '#F0538A');
  for(let i = 1; i < mp.length; i++) doc.line(mp[i-1][0], mp[i-1][1], mp[i][0], mp[i][1]);
  mp.forEach((p, i) => {
    const isLast = i === mp.length - 1;
    doc.setLineWidth(0.5); grDraw(doc, '#F0538A');
    if(isLast) grFill(doc, '#F0538A'); else doc.setFillColor(255, 255, 255);
    doc.circle(p[0], p[1], isLast ? 1.5 : 1, 'FD');
  });
  return py + ph + 11; // y paling bawah (di bawah label sumbu)
}

function grStatusColors(cls){
  return ({ ok: ['#EAF6EE', '#1E7B3F'], warn: ['#FFF4DD', '#8A5A00'], danger: ['#FDECEE', '#A32A2A'] })[cls] || ['#EEF3FA', '#12407A'];
}

// logo opsional (kalau gagal dimuat, PDF tetap dibuat tanpa logo)
function grLoadLogo(){
  return new Promise(resolve => {
    try{
      const img = new Image();
      img.onload = () => {
        try{
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve({ data: c.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight });
        }catch(e){ resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = 'assets/logo.png';
    }catch(e){ resolve(null); }
  });
}

async function buildGrowthPDF(records, opts){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 15, CW = W - 2 * M;
  const { last, prev, age, A } = grSummary(records);
  const sexLabel = last.sex === 'boy' ? 'Laki-laki' : 'Perempuan';
  const hLabel = age < 24 ? 'Panjang' : 'Tinggi';
  const logo = (opts && opts.logo !== undefined) ? opts.logo : await grLoadLogo();
  const printed = (opts && opts.printedAt) || new Date();

  const footer = () => {
    const n = doc.getNumberOfPages();
    for(let i = 1; i <= n; i++){
      doc.setPage(i);
      grDraw(doc, '#DCE9F7'); doc.setLineWidth(0.2); doc.line(M, 284, W - M, 284);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); grText(doc, '#5D7291');
      const note = doc.splitTextToSize('Laporan ini perkiraan berdasarkan standar pertumbuhan WHO dan kategori Permenkes 2/2020, bukan diagnosis. Konsultasikan dengan bidan, dokter anak, atau posyandu untuk penilaian lebih lanjut.', CW - 20);
      doc.text(note, M, 288);
      doc.text(`Halaman ${i}/${n}`, W - M, 288, { align: 'right' });
    }
  };

  let y = 12;
  const ensure = h => { if(y + h > 276){ doc.addPage(); y = 20; } };
  const para = (text, size, color, bold, indent, lh) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); grText(doc, color);
    doc.splitTextToSize(grT(text), CW - indent).forEach(l => { ensure(lh); doc.text(l, M + indent, y); y += lh; });
  };
  const sectionTitle = txt => {
    ensure(14);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); grText(doc, '#12407A');
    doc.text(grT(txt), M, y); y += 5;
  };

  // ---- kepala laporan ----
  if(logo){
    const lh = 20, lw = lh * (logo.w / logo.h);
    doc.addImage(logo.data, 'PNG', M, y, lw, lh);
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); grText(doc, '#12407A');
  doc.text('Laporan Tumbuh Kembang', W - M, y + 9, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); grText(doc, '#5D7291');
  doc.text('Blue Haven Baby & Kids Spa', W - M, y + 15, { align: 'right' });
  y += 24;
  grDraw(doc, '#12407A'); doc.setLineWidth(0.7); doc.line(M, y, W - M, y);
  y += 9;

  // ---- identitas anak ----
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); grText(doc, '#132A44');
  doc.text(String(last.baby_name), M, y);
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); grText(doc, '#5D7291');
  doc.text(`${sexLabel}  \u00B7  Lahir ${grDate(last.baby_dob)}  \u00B7  Usia ${grAge(age)}`, M, y);
  y += 7;

  // ---- ringkasan pengukuran terakhir ----
  const boxH = prev ? 35 : 28;
  grFill(doc, '#F4F8FD'); grDraw(doc, '#DCE9F7'); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, boxH, 2.5, 2.5, 'FD');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); grText(doc, '#12407A');
  doc.text(`Pengukuran terakhir: ${grDate(last.measurement_date)}`, M + 5, y + 6.5);
  const col = (cx, label, value) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); grText(doc, '#5D7291');
    doc.text(label, cx, y + 13);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); grText(doc, '#132A44');
    doc.text(value, cx, y + 21);
  };
  col(M + 5, 'Berat badan', `${grNum(last.weight, 1)} kg`);
  col(M + 5 + CW / 3, `${hLabel} badan`, `${grNum(last.height, 1)} cm`);
  col(M + 5 + 2 * CW / 3, 'IMT', `${grNum(A.bmi, 1)} kg/m2`);
  if(prev){
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); grText(doc, '#5D7291');
    doc.text(`Sejak ${grDate(prev.measurement_date, true)}: berat ${grSigned(Number(last.weight) - Number(prev.weight), 1)} kg, ${hLabel.toLowerCase()} ${grSigned(Number(last.height) - Number(prev.height), 1)} cm`, M + 5, y + 30);
  }
  y += boxH + 8;

  // ---- hasil penilaian status gizi ----
  if(A.indicators.length){
    sectionTitle('Hasil Penilaian Status Gizi (standar WHO)');
    const tc = [
      { h: 'Indikator', x: M + 2, a: 'left' },
      { h: 'Hasil ukur', x: M + 78, a: 'right' },
      { h: 'Z-score', x: M + 96, a: 'right' },
      { h: 'Persentil', x: M + 115, a: 'right' },
      { h: 'Kategori', x: M + 121, a: 'left' },
    ];
    ensure(7 + 11 * A.indicators.length);
    grFill(doc, '#12407A'); doc.rect(M, y, CW, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    tc.forEach(c => doc.text(c.h, c.x, y + 4.7, { align: c.a }));
    y += 7;
    A.indicators.forEach((i, idx) => {
      if(idx % 2 === 1){ grFill(doc, '#F4F8FD'); doc.rect(M, y, CW, 11, 'F'); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); grText(doc, '#132A44');
      doc.text(grT(i.short), tc[0].x, y + 4.6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); grText(doc, '#5D7291');
      doc.text(grT(i.title), tc[0].x, y + 8.6);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); grText(doc, '#132A44');
      doc.text(grT(i.valueText), tc[1].x, y + 6.3, { align: 'right' });
      doc.text(grSigned(i.z, 2), tc[2].x, y + 6.3, { align: 'right' });
      doc.text(grT(i.pct), tc[3].x, y + 6.3, { align: 'right' });
      const cc = grStatusColors(i.cat.cls);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2);
      let lab = grT(i.cat.label);
      if(doc.getTextWidth(lab) + 6 > CW - 121) lab = grT(i.cat.short);
      const tw = doc.getTextWidth(lab) + 6;
      grFill(doc, cc[0]); doc.roundedRect(tc[4].x, y + 2.3, tw, 6, 3, 3, 'F');
      grText(doc, cc[1]); doc.text(lab, tc[4].x + 3, y + 6.3);
      y += 11;
    });
    y += 5;

    if(A.primary){
      const cc = grStatusColors(A.primary.cat.cls);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      const mLines = doc.splitTextToSize(grT(A.primary.meaning), CW - 10);
      const bh = 16 + mLines.length * 4;
      ensure(bh + 4);
      grFill(doc, cc[0]); doc.roundedRect(M, y, CW, bh, 2.5, 2.5, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); grText(doc, cc[1]);
      doc.text(grT(`KESIMPULAN STATUS GIZI (${A.primary.short})`), M + 5, y + 5.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
      doc.text(grT(A.primary.cat.label), M + 5, y + 11.5);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      mLines.forEach((l, k) => doc.text(l, M + 5, y + 16.2 + k * 4));
      y += bh + 6;
    }

    sectionTitle('Keterangan');
    A.indicators.forEach(i => {
      para(`${i.short}: ${i.meaning} Rentang normal untuk anak seusia ini ${i.rangeText} (${i.rangeSD}); rata-rata WHO ${gaNum(i.median, 1)} ${i.unit}.`, 8.2, '#132A44', false, 0, 4);
      y += 1.5;
    });
    y += 2;
    para('Z-score adalah selisih hasil ukur dari rata-rata WHO dalam satuan simpangan baku (SD). Umumnya normal antara -2 dan +1 SD (tinggi badan: -2 sampai +3 SD).', 7.5, '#5D7291', false, 0, 3.6);
    y += 4;

    sectionTitle('Saran tindak lanjut');
    A.advice.forEach(t => {
      ensure(5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.2); grText(doc, '#12407A');
      doc.text('-', M + 1, y);
      para(t, 8.2, '#132A44', false, 5, 4);
      y += 1.2;
    });
    y += 4;
  }

  // ---- grafik (pita WHO hanya tersedia untuk usia 0-60 bulan) ----
  const sexColor = last.sex === 'boy' ? '#3E7FC7' : '#F0538A';
  if(age <= 60){
    ensure(62 * 2 + 30);
    if(y + 62 * 2 + 30 > 276){ doc.addPage(); y = 20; }
    y = grDrawChart(doc, 'weight', last.sex, records, M, y, CW, 62);
    y += 4;
    y = grDrawChart(doc, 'height', last.sex, records, M, y, CW, 62);
    const legend = [['#F0538A', 'Hasil pengukuran'], ['#F5C5C0', 'Di bawah normal'], ['#CBEBCA', 'Normal'], ['#D1E7F9', 'Di atas normal']];
    let lx = M;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    legend.forEach(([hex, txt]) => {
      grFill(doc, hex); doc.rect(lx, y - 2.6, 3, 3, 'F');
      grText(doc, '#5D7291'); doc.text(txt, lx + 4.5, y);
      lx += 4.5 + doc.getTextWidth(txt) + 6;
    });
    y += 4;
    grText(doc, sexColor);
    doc.text(`Grafik memakai standar WHO khusus anak ${last.sex === 'boy' ? 'laki-laki' : 'perempuan'}.`, M, y);
    y += 8;
  } else {
    para('Grafik pita normal WHO tersedia untuk usia 0-60 bulan. Untuk usia di atas itu, perkembangan dinilai lewat Z-score IMT/U dan TB/U pada tabel di atas.', 7.8, '#5D7291', false, 0, 3.8);
    y += 5;
  }

  // ---- tabel riwayat pengukuran ----
  const cols = [
    { h: 'Tanggal', x: M + 2, a: 'left' },
    { h: 'Usia', x: M + 40, a: 'left' },
    { h: 'Berat (kg)', x: M + 88, a: 'right' },
    { h: 'Selisih', x: M + 106, a: 'right' },
    { h: 'Tinggi (cm)', x: M + 128, a: 'right' },
    { h: 'Selisih', x: M + 146, a: 'right' },
    { h: 'IMT', x: M + CW - 2, a: 'right' },
  ];
  const header = () => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); grText(doc, '#12407A');
    doc.text(`Riwayat Pengukuran (${records.length})`, M, y);
    y += 3;
    grFill(doc, '#12407A'); doc.rect(M, y, CW, 7, 'F');
    doc.setFontSize(8); doc.setTextColor(255, 255, 255);
    cols.forEach(c => doc.text(c.h, c.x, y + 4.7, { align: c.a }));
    y += 7;
  };
  const tableNeed = 10 + 7 + records.length * 6.5;
  if(y + tableNeed > 276 && tableNeed <= 250){ doc.addPage(); y = 20; }
  else if(y > 250){ doc.addPage(); y = 20; }
  header();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  records.forEach((r, i) => {
    if(y > 274){ doc.addPage(); y = 20; header(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); }
    if(i % 2 === 1){ grFill(doc, '#F4F8FD'); doc.rect(M, y, CW, 6.5, 'F'); }
    const p = i > 0 ? records[i - 1] : null;
    const a = ageInMonths(r.baby_dob, r.measurement_date);
    grText(doc, '#132A44');
    const vals = [
      grDate(r.measurement_date), grAge(a), grNum(r.weight, 1),
      p ? grSigned(Number(r.weight) - Number(p.weight), 1) : '-',
      grNum(r.height, 1), p ? grSigned(Number(r.height) - Number(p.height), 1) : '-',
      grNum(calcBMI(r.weight, r.height), 1),
    ];
    cols.forEach((c, k) => doc.text(vals[k], c.x, y + 4.5, { align: c.a }));
    y += 6.5;
  });
  y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); grText(doc, '#5D7291');
  doc.text(`Dicetak pada ${grDate(`${printed.getFullYear()}-${String(printed.getMonth()+1).padStart(2,'0')}-${String(printed.getDate()).padStart(2,'0')}`)}`, M, y);

  footer();
  return doc;
}

function growthPdfFileName(records){
  const last = records[records.length - 1];
  const safe = String(last.baby_name).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'anak';
  return `Tumbuh-Kembang-${safe}-${last.measurement_date}.pdf`;
}

if(typeof module !== 'undefined'){ module.exports = { buildGrowthWAText, buildGrowthPDF, growthPdfFileName }; }
