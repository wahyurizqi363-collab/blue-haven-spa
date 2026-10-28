/* =========================================================
   GRAFIK PITA GAYA KMS (Berat/Tinggi Badan menurut Umur)
   Merah = di bawah normal, Hijau = normal, Biru = di atas normal
   + garis tren dari riwayat pengukuran anak (kalau lebih dari 1 data)
========================================================= */
let lastGrowthInput = null;   // {sex, ageMonths, weight, height}
let lastGrowthHistory = [];   // [{measurement_date, weight, height, ageMonths}, ...] urut lama->baru

const CHART_W = 680, CHART_H = 320;
const PAD = {left:44, right:16, top:18, bottom:32};
const CHART_INNER_W = CHART_W - PAD.left - PAD.right;
const CHART_INNER_H = CHART_H - PAD.top - PAD.bottom;

function niceMax(v){
  const step = v > 40 ? 10 : v > 15 ? 5 : 2;
  return Math.ceil(v / step) * step;
}
function xForAge(age){ return PAD.left + (age/60) * CHART_INNER_W; }
function yForVal(val, maxY){ return PAD.top + CHART_INNER_H - (val/maxY) * CHART_INNER_H; }
function pathFromPoints(points){
  return points.map((p,i)=> (i===0?'M':'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
}

/**
 * historyPoints: array of {ageMonths, value} urut lama -> baru (minimal 1 elemen)
 */
function buildGrowthChartSVG(type, sex, historyPoints){
  const series = boundsSeries(type, sex);
  const values = historyPoints.map(p=>p.value);
  const rawMax = Math.max(...series.map(s=>s.upper), ...values) * 1.15;
  const maxY = niceMax(rawMax);

  const lowerPts = series.map(s => [xForAge(s.age), yForVal(Math.max(0,s.lower), maxY)]);
  const upperPts = series.map(s => [xForAge(s.age), yForVal(s.upper, maxY)]);
  const yBase = yForVal(0, maxY);
  const yTop  = PAD.top;

  const redPath   = pathFromPoints(lowerPts) + ` L${xForAge(60).toFixed(1)},${yBase.toFixed(1)} L${xForAge(0).toFixed(1)},${yBase.toFixed(1)} Z`;
  const greenPath = pathFromPoints(lowerPts) + ' ' + pathFromPoints([...upperPts].reverse()).replace('M','L') + ' Z';
  const bluePath  = pathFromPoints(upperPts) + ` L${xForAge(60).toFixed(1)},${yTop.toFixed(1)} L${xForAge(0).toFixed(1)},${yTop.toFixed(1)} Z`;

  let gridLines = '', xLabels = '';
  for(let a=0; a<=60; a+=6){
    const x = xForAge(a);
    gridLines += `<line x1="${x}" y1="${PAD.top}" x2="${x}" y2="${yBase}" stroke="#DCE9F7" stroke-width="1"/>`;
    xLabels += `<text x="${x}" y="${CHART_H-10}" font-size="10" fill="#5D7291" text-anchor="middle">${a}</text>`;
  }
  let yLabels = '';
  for(let i=0;i<=4;i++){
    const val = (maxY/4)*i;
    const y = yForVal(val, maxY);
    yLabels += `<text x="${PAD.left-8}" y="${y+3}" font-size="10" fill="#5D7291" text-anchor="end">${Math.round(val)}</text>`;
    gridLines += `<line x1="${PAD.left}" y1="${y}" x2="${CHART_W-PAD.right}" y2="${y}" stroke="#EDF3FA" stroke-width="1"/>`;
  }

  const measuredPts = historyPoints.map(p => [xForAge(Math.min(60,Math.max(0,p.ageMonths))), yForVal(Math.min(maxY,p.value), maxY)]);
  const trendPath = measuredPts.length > 1 ? pathFromPoints(measuredPts) : '';
  const dots = measuredPts.map((p,i)=>{
    const isLast = i === measuredPts.length - 1;
    return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${isLast?6:4}" fill="${isLast?'#F0538A':'#fff'}" stroke="#F0538A" stroke-width="2"/>`;
  }).join('');

  const last = historyPoints[historyPoints.length-1];
  const mx = xForAge(Math.min(60, Math.max(0, last.ageMonths)));

  const chartId = 'gchart_' + type;

  const sexLabel = sex === 'boy' ? 'laki-laki' : 'perempuan';
  const sexIcon = sex === 'boy' ? '♂' : '♀';
  const sexColor = sex === 'boy' ? '#3E7FC7' : '#F0538A';

  return `
  <div class="chart-wrap">
    <div class="sex-standard-note" style="border-left-color:${sexColor};">
      <span class="sex-standard-icon" style="background:${sexColor};">${sexIcon}</span>
      Grafik ini memakai standar pertumbuhan WHO khusus anak <strong>${sexLabel}</strong> — nilai normalnya memang berbeda dari anak lawan jenisnya, jadi jangan dibandingkan langsung dengan grafik anak ${sex==='boy'?'perempuan':'laki-laki'}.
    </div>
    <svg id="${chartId}" viewBox="0 0 ${CHART_W} ${CHART_H}" style="width:100%;height:auto;display:block;">
      <path d="${redPath}" fill="#F3B6B0" opacity="0.75"/>
      <path d="${greenPath}" fill="#BFE6BE" opacity="0.75"/>
      <path d="${bluePath}" fill="#B9D9F7" opacity="0.6"/>
      ${gridLines}
      <path d="${pathFromPoints(lowerPts)}" fill="none" stroke="#D6473A" stroke-width="1.5"/>
      <path d="${pathFromPoints(upperPts)}" fill="none" stroke="#3E7FC7" stroke-width="1.5"/>
      <line x1="${PAD.left}" y1="${yBase}" x2="${CHART_W-PAD.right}" y2="${yBase}" stroke="#B9C6D6" stroke-width="1"/>
      ${xLabels}${yLabels}
      ${trendPath ? `<path d="${trendPath}" fill="none" stroke="#F0538A" stroke-width="2"/>` : ''}
      ${dots}
      <line id="${chartId}_guide" x1="${mx}" y1="${PAD.top}" x2="${mx}" y2="${yBase}" stroke="#132A44" stroke-width="1" stroke-dasharray="3,3" opacity="0.4"/>
      <rect id="${chartId}_overlay" x="${PAD.left}" y="${PAD.top}" width="${CHART_INNER_W}" height="${CHART_INNER_H}" fill="transparent" style="cursor:crosshair;"/>
    </svg>
    <div class="growth-tooltip" id="${chartId}_tooltip" style="display:none;"></div>
    <div class="chart-legend">
      <span class="legend-item"><span class="legend-swatch" style="background:#F0538A;"></span>Hasil Pengukuran</span>
      <span class="legend-item"><span class="legend-swatch" style="background:#F3B6B0;"></span>Di Bawah Normal</span>
      <span class="legend-item"><span class="legend-swatch" style="background:#BFE6BE;"></span>Normal</span>
      <span class="legend-item"><span class="legend-swatch" style="background:#B9D9F7;"></span>Di Atas Normal</span>
    </div>
  </div>`;
}

function attachChartInteractivity(type, sex){
  const chartId = 'gchart_' + type;
  const svg = document.getElementById(chartId);
  const overlay = document.getElementById(chartId+'_overlay');
  const guide = document.getElementById(chartId+'_guide');
  const tooltip = document.getElementById(chartId+'_tooltip');
  if(!svg || !overlay) return;
  const series = boundsSeries(type, sex);

  overlay.addEventListener('mousemove', (e)=>{
    const rect = svg.getBoundingClientRect();
    const scaleX = CHART_W / rect.width;
    const relX = (e.clientX - rect.left) * scaleX;
    let age = Math.round(((relX - PAD.left) / CHART_INNER_W) * 60);
    age = Math.max(0, Math.min(60, age));
    const point = series[age];
    const gx = xForAge(age);
    guide.setAttribute('x1', gx); guide.setAttribute('x2', gx);

    const unit = type==='weight' ? 'kg' : 'cm';
    tooltip.innerHTML = `
      <strong>${age} bulan</strong><br>
      <span class="tooltip-row"><span class="tooltip-swatch" style="background:#D6473A;"></span>Di bawah normal: ${point.lower.toFixed(1)} ${unit}</span><br>
      <span class="tooltip-row"><span class="tooltip-swatch" style="background:#3DAA5C;"></span>Normal: ${point.median.toFixed(1)} ${unit}</span><br>
      <span class="tooltip-row"><span class="tooltip-swatch" style="background:#3E7FC7;"></span>Di atas normal: ${point.upper.toFixed(1)} ${unit}</span>`;
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(rect.width-160, Math.max(0, (e.clientX - rect.left) + 12)) + 'px';
    tooltip.style.top = Math.max(0, (e.clientY - rect.top) - 70) + 'px';
  });
  overlay.addEventListener('mouseleave', ()=>{ tooltip.style.display='none'; });
}

/* Grafik tren pengukuran anak sendiri (tanpa pita WHO) - dipakai untuk anak > 60 bulan */
function buildTrendChartSVG(type, pts){
  const W=680,H=300,P={l:48,r:20,t:20,b:40}, iw=W-P.l-P.r, ih=H-P.t-P.b;
  const unit = type==='weight' ? 'kg' : 'cm';
  const vals = pts.map(p=>p.value);
  let vmin = Math.min(...vals), vmax = Math.max(...vals);
  const pad = Math.max(1, (vmax-vmin)*0.25); vmin = Math.max(0, vmin-pad); vmax = vmax+pad;
  let amin = Math.min(...pts.map(p=>p.ageMonths)), amax = Math.max(...pts.map(p=>p.ageMonths));
  if(amax-amin < 6){ const c=(amin+amax)/2; amin=c-3; amax=c+3; }
  const x = a => P.l + (a-amin)/(amax-amin)*iw;
  const y = v => P.t + ih - (v-vmin)/(vmax-vmin)*ih;
  let grid='';
  for(let i=0;i<=4;i++){
    const v = vmin+(vmax-vmin)*i/4, yy=y(v);
    grid += `<line x1="${P.l}" y1="${yy}" x2="${W-P.r}" y2="${yy}" stroke="#EDF3FA"/><text x="${P.l-8}" y="${yy+3}" font-size="10" fill="#5D7291" text-anchor="end">${v.toFixed(1)}</text>`;
  }
  for(let i=0;i<=4;i++){
    const a = amin+(amax-amin)*i/4;
    grid += `<text x="${x(a)}" y="${H-16}" font-size="10" fill="#5D7291" text-anchor="middle">${(a/12).toFixed(1)} th</text>`;
  }
  const path = pts.length>1 ? 'M'+pts.map(p=>x(p.ageMonths).toFixed(1)+','+y(p.value).toFixed(1)).join(' L') : '';
  const dots = pts.map((p,i)=>{
    const last = i===pts.length-1;
    return `<circle cx="${x(p.ageMonths).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="${last?6:4}" fill="${last?'#F0538A':'#fff'}" stroke="#F0538A" stroke-width="2"/><text x="${x(p.ageMonths).toFixed(1)}" y="${(y(p.value)-10).toFixed(1)}" font-size="10" fill="#132A44" text-anchor="middle">${p.value.toFixed(1)} ${unit}</text>`;
  }).join('');
  return `<div class="chart-wrap"><svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${grid}${path?`<path d="${path}" fill="none" stroke="#F0538A" stroke-width="2"/>`:''}${dots}</svg>
    <p class="hint" style="margin-top:6px;">Grafik tren pengukuran ${type==='weight'?'berat':'tinggi'} badan anak (sumbu bawah = usia). Tanpa pita normal WHO karena usia di atas 60 bulan.</p></div>`;
}

function renderGrowthCharts(){
  if(!lastGrowthInput || lastGrowthHistory.length===0) return;
  const {sex} = lastGrowthInput;
  const holder = document.getElementById('growthChartHolder');
  const activeType = document.querySelector('#growthResult .chart-tabs button.active')?.dataset.chart || 'weight';

  const points = lastGrowthHistory.map(r => ({
    ageMonths: r.ageMonths,
    value: activeType === 'weight' ? Number(r.weight) : Number(r.height)
  }));

  if(lastGrowthInput.ageMonths > 60){ holder.innerHTML = buildTrendChartSVG(activeType, points); return; }
  holder.innerHTML = buildGrowthChartSVG(activeType, sex, points);
  attachChartInteractivity(activeType, sex);
}

function showGrowthChart(type){
  document.querySelectorAll('#growthResult .chart-tabs button').forEach(b=>b.classList.toggle('active', b.dataset.chart===type));
  renderGrowthCharts();
}

function renderGrowthHistoryTable(forceRows){
  const el = document.getElementById('growthHistoryTable');
  if(!el) return;
  if(lastGrowthHistory.length <= 1 && !forceRows){
    el.innerHTML = '<p class="hint">Baru ada 1 catatan pengukuran. Pengukuran di kunjungan berikutnya akan otomatis muncul di sini sehingga tren pertumbuhannya bisa terlihat.</p>';
    return;
  }
  const rows = lastGrowthHistory.map(r => `
    <div class="booking-item">
      <div class="info">
        <strong>${r.measurement_date}</strong> · usia ${r.ageMonths.toFixed(1)} bulan
        <div>Berat: ${Number(r.weight).toFixed(1)} kg &nbsp;·&nbsp; Tinggi: ${Number(r.height).toFixed(1)} cm</div>
      </div>
    </div>`).join('');
  el.innerHTML = `<h3 class="section-title" style="font-size:1.1rem;margin-top:20px;">Riwayat Pengukuran</h3>${rows}`;
}
