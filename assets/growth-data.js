/* =========================================================
   WHO GROWTH REFERENCE (median & SD perkiraan, 0–60 bulan)
   Sumber acuan: WHO Child Growth Standards (disederhanakan untuk estimasi)
========================================================= */
const AGE_M = [0,1,2,3,4,5,6,7,8,9,10,11,12,15,18,21,24,27,30,33,36,39,42,45,48,51,54,57,60];

const REF = {
  boy: {
    w: [3.3,4.5,5.6,6.4,7.0,7.5,7.9,8.3,8.6,8.9,9.2,9.4,9.6,10.3,10.9,11.5,12.2,12.7,13.3,13.8,14.3,14.8,15.3,15.8,16.3,16.8,17.2,17.8,18.3],
    wsd:[0.45,0.55,0.65,0.72,0.78,0.82,0.86,0.89,0.92,0.95,0.98,1.0,1.02,1.08,1.14,1.2,1.25,1.3,1.36,1.42,1.48,1.54,1.6,1.66,1.72,1.78,1.84,1.9,1.96],
    h: [49.9,54.7,58.4,61.4,63.9,65.9,67.6,69.2,70.6,72.0,73.3,74.5,75.7,79.1,82.3,85.1,87.8,89.9,91.9,94.1,96.1,98.0,99.9,101.6,103.3,105.0,106.7,108.4,110.0],
    hsd:[1.9,2.0,2.1,2.2,2.3,2.4,2.5,2.6,2.7,2.75,2.8,2.85,2.9,3.05,3.15,3.25,3.35,3.45,3.55,3.65,3.75,3.85,3.95,4.0,4.1,4.15,4.2,4.3,4.4]
  },
  girl: {
    w: [3.2,4.2,5.1,5.8,6.4,6.9,7.3,7.6,7.9,8.2,8.5,8.7,8.9,9.6,10.2,10.9,11.5,12.1,12.5,13.0,13.5,14.0,14.6,15.1,15.6,16.1,16.6,17.2,17.7],
    wsd:[0.42,0.52,0.6,0.68,0.74,0.79,0.83,0.86,0.9,0.93,0.96,0.99,1.02,1.1,1.17,1.24,1.3,1.37,1.43,1.5,1.56,1.63,1.7,1.76,1.83,1.9,1.97,2.03,2.1],
    h: [49.1,53.7,57.1,59.8,62.1,64.0,65.7,67.3,68.7,70.1,71.5,73.0,74.0,77.5,80.7,83.7,86.4,88.6,90.7,92.9,95.1,97.1,99.0,100.9,102.7,104.5,106.2,107.8,109.4],
    hsd:[1.8,1.9,2.0,2.1,2.2,2.3,2.4,2.5,2.55,2.65,2.7,2.75,2.8,2.95,3.05,3.15,3.25,3.35,3.45,3.55,3.65,3.75,3.85,3.95,4.0,4.1,4.2,4.3,4.4]
  }
};

function interp(ageMonths, arr){
  ageMonths = Math.max(0, Math.min(60, ageMonths));
  if(ageMonths <= AGE_M[0]) return arr[0];
  for(let i=0;i<AGE_M.length-1;i++){
    if(ageMonths >= AGE_M[i] && ageMonths <= AGE_M[i+1]){
      const t = (ageMonths - AGE_M[i]) / (AGE_M[i+1]-AGE_M[i]);
      return arr[i] + t*(arr[i+1]-arr[i]);
    }
  }
  return arr[arr.length-1];
}

// Acuan di file ini hanya WHO Child Growth Standards 0-60 bulan. Di atas itu hasilnya NaN
// (bukan angka palsu dari data usia 60 bulan yang "terpotong").
const WHO_MAX_MONTHS = 60;
function calcZ(ageMonths, sex, weight, height){
  if(ageMonths > WHO_MAX_MONTHS) return {wz: NaN, hz: NaN};
  // Pakai tabel LMS WHO resmi (growth-who-lms.js + growth-assess.js) kalau tersedia
  if(typeof WHO_LMS !== 'undefined' && typeof gaGetLMS === 'function'){
    const lw = gaGetLMS('wfa', sex, ageMonths), lh = gaGetLMS('hfa', sex, ageMonths);
    if(lw && lh) return {wz: gaZ(weight, lw, true).z, hz: gaZ(height, lh, false).z};
  }
  const ref = REF[sex];
  const wMed = interp(ageMonths, ref.w), wSD = interp(ageMonths, ref.wsd);
  const hMed = interp(ageMonths, ref.h), hSD = interp(ageMonths, ref.hsd);
  const wz = (weight - wMed)/wSD;
  const hz = (height - hMed)/hSD;
  return {wz, hz};
}

function classifyBBU(z){
  if(!isFinite(z)) return {label:'Di luar jangkauan standar WHO (usia > 60 bulan)', cls:'info'};
  if(z < -3) return {label:'Berat badan sangat kurang', cls:'danger'};
  if(z < -2) return {label:'Berat badan kurang', cls:'warn'};
  if(z <= 1) return {label:'Berat badan normal', cls:'ok'};
  return {label:'Risiko berat badan lebih', cls:'warn'};
}
function classifyTBU(z){
  if(!isFinite(z)) return {label:'Di luar jangkauan standar WHO (usia > 60 bulan)', cls:'info'};
  if(z < -3) return {label:'Sangat pendek (severely stunted)', cls:'danger'};
  if(z < -2) return {label:'Pendek (stunted)', cls:'warn'};
  if(z <= 3) return {label:'Panjang/tinggi normal', cls:'ok'};
  return {label:'Tinggi', cls:'ok'};
}

// IMT = berat (kg) / tinggi (m)^2. Dipakai untuk anak > 60 bulan (indikator IMT/U, Permenkes 2/2020).
function calcBMI(weightKg, heightCm){
  const m = Number(heightCm) / 100;
  return m > 0 ? Number(weightKg) / (m * m) : NaN;
}

function ageInMonths(dob, refDate){
  const d1 = new Date(dob), d2 = new Date(refDate);
  const diffDays = (d2 - d1) / (1000*60*60*24);
  return diffDays / 30.4368;
}

/* =========================================================
   BATAS KURVA UNTUK GRAFIK GAYA KMS (band chart)
   - weight: batas bawah = median-2SD, batas atas = median+1SD
   - height: batas bawah = median-2SD, batas atas = median+3SD
   (angka ini konsisten dengan classifyBBU/classifyTBU di atas)
========================================================= */
function boundsSeries(type, sex){
  const arr = [];
  const useLMS = typeof WHO_LMS !== 'undefined' && typeof gaGetLMS === 'function';
  for(let age=0; age<=60; age++){
    if(useLMS){
      const lms = gaGetLMS(type==='weight' ? 'wfa' : 'hfa', sex, age);
      arr.push({
        age,
        median: gaValueAtZ(lms, 0),
        lower:  gaValueAtZ(lms, -2),
        upper:  gaValueAtZ(lms, type==='weight' ? 1 : 3)
      });
      continue;
    }
    const median = type==='weight' ? interp(age, REF[sex].w)  : interp(age, REF[sex].h);
    const sd     = type==='weight' ? interp(age, REF[sex].wsd) : interp(age, REF[sex].hsd);
    const lower  = median - 2*sd;
    const upper  = type==='weight' ? median + 1*sd : median + 3*sd;
    arr.push({age, median, lower, upper});
  }
  return arr;
}
