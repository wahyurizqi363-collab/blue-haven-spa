const API_SERVICES = 'api/services.php';
const API_BOOKINGS = 'api/bookings.php';
const API_LOYALTY  = 'api/loyalty.php';
const API_GROWTH   = 'api/growth.php';
const SESSIONS_PER_REWARD = 10;
// Jika sesi login habis, server membalas 401 -> muat ulang halaman supaya kembali ke layar login
const _origFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const res = await _origFetch(...args);
  if (res.status === 401 && String(args[0]).indexOf('api/login.php') < 0) location.reload();
  return res;
};

let services = [];
let bookingListCache = [];
let loyaltyListCache = [];

function fmtRupiah(n){ return 'Rp' + Number(n).toLocaleString('id-ID'); }
function escapeHtml(str){
  const d = document.createElement('div');
  d.innerText = str ?? '';
  return d.innerHTML;
}
function statusLabel(s){
  const map = {pending:['Menunggu Konfirmasi','pending'], confirmed:['Dikonfirmasi','confirmed'], done:['Selesai','done'], cancelled:['Dibatalkan','cancelled']};
  return map[s] || ['-','pending'];
}

/* =========================================================
   PIN GATE
========================================================= */
async function doLogin(){
  const pw = document.getElementById('adminPassword').value;
  const msg = document.getElementById('pinMsg');
  if(!pw){ msg.innerHTML = '<div class="notice danger">Isi password dulu.</div>'; return; }
  try{
    const res = await fetch('api/login.php', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:pw})});
    const d = await res.json().catch(()=>({}));
    if(res.ok && d.success){ location.reload(); return; }
    msg.innerHTML = '';
    const n = document.createElement('div'); n.className='notice danger';
    n.textContent = d.error || 'Login gagal, coba lagi.'; msg.appendChild(n);
  }catch(e){
    msg.innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
  }
}
async function logout(){
  try{ await fetch('api/login.php', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'logout'})}); }catch(e){}
  location.reload();
}
document.getElementById('adminPassword').addEventListener('keydown', e=>{ if(e.key==='Enter') doLogin(); });

document.querySelectorAll('.subtabs button').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.subtabs button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('sub-bookings').style.display = btn.dataset.sub==='bookings' ? 'block':'none';
    document.getElementById('sub-services').style.display = btn.dataset.sub==='services' ? 'block':'none';
    document.getElementById('sub-loyalty').style.display = btn.dataset.sub==='loyalty' ? 'block':'none';
    document.getElementById('sub-growth').style.display = btn.dataset.sub==='growth' ? 'block':'none';
    document.getElementById('sub-revenue').style.display = btn.dataset.sub==='revenue' ? 'block':'none';
    if(btn.dataset.sub==='loyalty') renderLoyaltyList();
    if(btn.dataset.sub==='growth') renderGrowthAdminList();
    if(btn.dataset.sub==='revenue') revCheckGate();
  });
});

document.getElementById('growthSearch').addEventListener('input', debounce(renderGrowthAdminList, 300));

function debounce(fn, delay){
  let t;
  return (...args)=>{ clearTimeout(t); t = setTimeout(()=>fn(...args), delay); };
}

/* =========================================================
   GROWTH RECORDS (riwayat tumbuh kembang)
========================================================= */
let growthGroupCache = [];
let growthDetailKey = null;

function growthKey(r){ return [r.phone, r.baby_name, r.baby_dob].join('|'); }

// Penghitung jumlah anak (1 anak = no. WA + nama anak + tanggal lahir) untuk menyamakan 3 menu
function uniqueChildCount(items){
  return new Set(items.map(x => [x.phone, x.baby_name, x.baby_dob].join('|'))).size;
}
function childCountBar(mainText, extraText){
  return `<div class="notice info" style="display:flex;gap:6px 16px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">
    <strong>👶 ${mainText}</strong>${extraText ? `<span>${extraText}</span>` : ''}
  </div>`;
}
function growthStatusChip(z, cls, label){
  const c = {ok:['#EAF6EE','#1E7B3F'], warn:['#FFF4DD','#8A5A00'], danger:['#FDECEE','#A32A2A']}[cls] || ['#EEF3FA','#12407A'];
  return `<span class="badge" style="background:${c[0]};color:${c[1]};">${escapeHtml(label)}</span>`;
}

async function renderGrowthAdminList(){
  const list = document.getElementById('growthAdminList');
  const keyword = document.getElementById('growthSearch').value.trim();
  list.innerHTML = '<div class="notice info">Memuat...</div>';

  try{
    const url = keyword ? `${API_GROWTH}?search=${encodeURIComponent(keyword)}` : API_GROWTH;
    const res = await fetch(url);
    const records = await res.json();

    if(!Array.isArray(records) || records.length===0){
      list.innerHTML = childCountBar('Jumlah anak: 0', keyword ? 'hasil pencarian' : '') + '<div class="notice info">Belum ada catatan pengukuran.</div>';
      return;
    }

    // kelompokkan per anak (nomor WA + nama + tanggal lahir)
    const map = new Map();
    records.forEach(r => {
      const k = growthKey(r);
      if(!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    growthGroupCache = Array.from(map.values()).map(arr => {
      arr.sort((p, q) => String(p.measurement_date).localeCompare(String(q.measurement_date)) || p.id - q.id);
      return arr;
    });

    const sexLabel = {boy:'Laki-laki', girl:'Perempuan'};
    list.innerHTML = childCountBar(`Jumlah anak: ${growthGroupCache.length}`, `${records.length} pengukuran${keyword ? ' · hasil pencarian' : ''}`) + growthGroupCache.map((arr, idx) => {
      const last = arr[arr.length - 1];
      const age = ageInMonths(last.baby_dob, last.measurement_date);
      const A = gaAssess({sex: last.sex, ageMonths: age, weight: Number(last.weight), height: Number(last.height)});
      const chipsHtml = [A.primary, gaFind(A, 'bbu'), gaFind(A, 'tbu')].filter(Boolean)
        .map(i => growthStatusChip(i.z, i.cat.cls, `${i.short}: ${i.cat.short} (z ${gaSigned(i.z, 1)})`)).join('');
      return `<div class="booking-item">
        <div class="info">
          <strong>${escapeHtml(last.baby_name)}</strong> (${sexLabel[last.sex]||last.sex}) · ${escapeHtml(last.phone)}<br>
          <div>${arr.length} pengukuran · terakhir ${last.measurement_date} · Berat: ${Number(last.weight).toFixed(1)} kg · Tinggi: ${Number(last.height).toFixed(1)} cm</div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">${chipsHtml}</div>
        </div>
        <div class="booking-actions">
          <button class="btn-small btn-wa" onclick="growthSendWA(${idx})">💬 Kirim WA</button>
          <button class="btn-small btn-receipt" onclick="openGrowthDetail(${idx})">📈 Detail &amp; Grafik</button>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    list.innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
  }
}

// Detail 1 anak: status terakhir, grafik berat/tinggi (standar WHO) dan daftar pengukuran
async function openGrowthDetail(idx, type){
  const grp = growthGroupCache[idx];
  if(!grp) return;
  const f = grp[grp.length - 1];
  growthDetailKey = { idx, phone: f.phone, baby_name: f.baby_name, baby_dob: f.baby_dob };
  await loadGrowthDetail(type || 'weight');
}

async function loadGrowthDetail(type){
  const k = growthDetailKey;
  closeCashier();
  const overlay = document.createElement('div');
  overlay.className = 'cashier-overlay';
  overlay.innerHTML = '<div class="cashier-modal" style="max-width:760px;"><div class="notice info">Memuat...</div></div>';
  document.body.appendChild(overlay);

  let records;
  try{
    const qs = new URLSearchParams({phone: k.phone, baby_name: k.baby_name, baby_dob: k.baby_dob});
    records = await (await fetch(`${API_GROWTH}?${qs}`)).json();
  }catch(e){ overlay.remove(); alert('Tidak bisa terhubung ke server.'); return; }
  if(!Array.isArray(records) || !records.length){ overlay.remove(); renderGrowthAdminList(); return; }

  const last = records[records.length - 1];
  const sex = last.sex;
  const sexLabel = sex === 'boy' ? 'Laki-laki' : 'Perempuan';
  const ageNow = ageInMonths(last.baby_dob, last.measurement_date);
  const assessHtml = gaRender(records, {});
  const rowsDesc = records.slice().reverse().map(r => {
    const a = ageInMonths(r.baby_dob, r.measurement_date);
    return `<div class="booking-item" style="padding:10px 14px;">
      <div class="info">
        <strong>${r.measurement_date}</strong> · usia ${a.toFixed(1)} bulan
        <div>Berat: ${Number(r.weight).toFixed(1)} kg &nbsp;·&nbsp; Tinggi: ${Number(r.height).toFixed(1)} cm${a > 60 ? ` &nbsp;·&nbsp; IMT: ${calcBMI(r.weight, r.height).toFixed(1)} kg/m²` : ''}</div>
        <div class="hint" style="margin-top:2px;">${gaBriefText(r)}</div>
      </div>
      <div class="booking-actions">
        <button class="btn-small btn-edit" onclick="editGrowthRecord(${r.id})">✏️ Edit</button>
        <button class="btn-small btn-del" onclick="deleteGrowthRecordDetail(${r.id})">Hapus</button>
      </div>
    </div>`;
  }).join('');

  const modal = overlay.firstElementChild;
  modal.innerHTML = `
    <h2 class="section-title" style="margin-bottom:2px;">${escapeHtml(last.baby_name)}</h2>
    <p class="hint" style="margin-bottom:12px;">${sexLabel} · lahir ${last.baby_dob} · usia ${ageNow.toFixed(1)} bulan · ${escapeHtml(last.phone)}</p>
    ${assessHtml}
    <div class="chart-tabs" id="gdTabs">
      <button type="button" data-chart="weight" class="${type === 'height' ? '' : 'active'}">Berat Badan menurut Umur</button>
      <button type="button" data-chart="height" class="${type === 'height' ? 'active' : ''}">Tinggi Badan menurut Umur</button>
    </div>
    <div id="gdChart"></div>
    ${records.length === 1 ? '<p class="hint">Baru ada 1 pengukuran. Garis tren muncul setelah ada pengukuran berikutnya.</p>' : ''}
    <h3 class="section-title" style="font-size:1.05rem;margin-top:18px;">Riwayat Pengukuran (${records.length})</h3>
    ${rowsDesc}
    <h3 class="section-title" style="font-size:1.05rem;margin-top:18px;">Kirim ke Orang Tua</h3>
    <div class="booking-actions">
      <button class="btn-small btn-wa" onclick="growthSendWA('detail')">💬 Kirim WA (kalimat)</button>
      <button class="btn-small btn-receipt" id="gdPdfBtn" onclick="growthDownloadPDF('detail')">📄 Unduh PDF</button>
      ${growthCanSharePDF() ? '<button class="btn-small btn-edit" id="gdSharePdfBtn" onclick="growthSharePDF(\'detail\')">📤 Bagikan PDF</button>' : ''}
    </div>
    <div id="gdShareMsg"></div>
    <div class="cashier-actions"><button class="btn-ghost" onclick="closeCashier()">Tutup</button></div>`;

  const draw = t => {
    modal.querySelectorAll('#gdTabs button').forEach(b => b.classList.toggle('active', b.dataset.chart === t));
    const pts = records.map(r => ({
      ageMonths: ageInMonths(r.baby_dob, r.measurement_date),
      value: Number(t === 'weight' ? r.weight : r.height),
    }));
    if(ageNow > 60){
      document.getElementById('gdChart').innerHTML = buildTrendChartSVG(t, pts);
    } else {
      document.getElementById('gdChart').innerHTML = buildGrowthChartSVG(t, sex, pts);
      attachChartInteractivity(t, sex);
    }
    growthDetailKey.type = t;
  };
  modal.querySelectorAll('#gdTabs button').forEach(b => b.onclick = () => draw(b.dataset.chart));
  draw(type === 'height' ? 'height' : 'weight');
  growthDetailKey.records = records;
}

/* ---- Kirim riwayat tumbuh kembang ke orang tua (WhatsApp kalimat / PDF) ---- */
function growthRecordsFor(src){
  if(src === 'detail') return (growthDetailKey && growthDetailKey.records) || null;
  return growthGroupCache[src] || null;
}

function growthSendWA(src){
  const recs = growthRecordsFor(src);
  if(!recs || !recs.length){ alert('Data tidak ditemukan, coba muat ulang daftarnya.'); return; }
  window.open(waLink(recs[recs.length - 1].phone, buildGrowthWAText(recs)), '_blank');
}

function growthLoadScript(src){
  return new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = src; el.onload = resolve; el.onerror = () => reject(new Error('Gagal memuat ' + src));
    document.head.appendChild(el);
  });
}
// Library PDF cukup besar, jadi baru dimuat saat tombol PDF pertama kali ditekan
async function growthEnsurePDFLib(){
  if(window.jspdf && window.jspdf.jsPDF) return;
  await growthLoadScript('assets/jspdf.umd.min.js?v=2.5.2');
}

function growthCanSharePDF(){
  try{
    return !!(navigator.canShare && typeof File === 'function'
      && navigator.canShare({files: [new File([''], 'a.pdf', {type: 'application/pdf'})]}));
  }catch(e){ return false; }
}

function growthShareMsg(html){
  const el = document.getElementById('gdShareMsg');
  if(el) el.innerHTML = html;
  else alert(html.replace(/<[^>]+>/g, ''));
}

async function growthMakePDF(src){
  const recs = growthRecordsFor(src);
  if(!recs || !recs.length) throw new Error('Data tidak ditemukan, coba muat ulang daftarnya.');
  await growthEnsurePDFLib();
  const doc = await buildGrowthPDF(recs);
  return { doc, name: growthPdfFileName(recs), recs };
}

async function growthDownloadPDF(src){
  const btn = document.getElementById('gdPdfBtn');
  if(btn) btn.disabled = true;
  growthShareMsg('');
  try{
    const { doc, name } = await growthMakePDF(src);
    doc.save(name);
    growthShareMsg('<div class="notice ok" style="margin-top:10px;">PDF sudah diunduh. Lampirkan file ini di chat WhatsApp orang tua.</div>');
  }catch(e){
    growthShareMsg(`<div class="notice danger" style="margin-top:10px;">${escapeHtml(e.message || 'Gagal membuat PDF.')}</div>`);
  }finally{
    if(btn) btn.disabled = false;
  }
}

async function growthSharePDF(src){
  const btn = document.getElementById('gdSharePdfBtn');
  if(btn) btn.disabled = true;
  growthShareMsg('');
  try{
    const { doc, name, recs } = await growthMakePDF(src);
    const last = recs[recs.length - 1];
    const file = new File([doc.output('blob')], name, {type: 'application/pdf'});
    try{
      await navigator.share({files: [file], title: `Tumbuh Kembang ${last.baby_name}`});
    }catch(err){
      if(err && err.name === 'AbortError') return;   // dibatalkan oleh pengguna
      doc.save(name);                                // browser menolak berbagi -> unduh saja
      growthShareMsg('<div class="notice warn" style="margin-top:10px;">Browser tidak mengizinkan berbagi langsung, jadi PDF diunduh. Lampirkan file ini di chat WhatsApp orang tua.</div>');
    }
  }catch(e){
    growthShareMsg(`<div class="notice danger" style="margin-top:10px;">${escapeHtml(e.message || 'Gagal membuat PDF.')}</div>`);
  }finally{
    if(btn) btn.disabled = false;
  }
}

// Lompat ke tab Riwayat Tumbuh Kembang dan buka detail + grafik anak tertentu
async function openGrowthForChild(phone, baby_name, baby_dob){
  closeCashier();
  const tab = document.querySelector('.subtabs button[data-sub="growth"]');
  if(tab) tab.click();
  growthDetailKey = { phone, baby_name, baby_dob };
  await loadGrowthDetail('weight');
}

function closeGrowthEdit(){
  const o = document.querySelector('.growth-edit-overlay');
  if(o) o.remove();
}

function editGrowthRecord(id){
  const r = (growthDetailKey.records || []).find(x => x.id === id);
  if(!r) return;
  closeGrowthEdit();
  const o = document.createElement('div');
  o.className = 'cashier-overlay growth-edit-overlay';
  o.style.zIndex = 120;
  o.innerHTML = `
    <div class="cashier-modal">
      <h2 class="section-title" style="margin-bottom:4px;">Edit Pengukuran</h2>
      <p class="hint" style="margin-bottom:12px;">${escapeHtml(r.baby_name)}</p>
      <label>Tanggal Pengukuran</label>
      <input type="date" id="geDate" value="${r.measurement_date}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label>Berat (kg)</label><input type="number" id="geW" step="0.01" min="0" value="${Number(r.weight)}"></div>
        <div><label>Tinggi (cm)</label><input type="number" id="geH" step="0.1" min="0" value="${Number(r.height)}"></div>
      </div>
      <label>Jenis Kelamin</label>
      <select id="geSex">
        <option value="boy" ${r.sex === 'boy' ? 'selected' : ''}>Laki-laki</option>
        <option value="girl" ${r.sex === 'girl' ? 'selected' : ''}>Perempuan</option>
      </select>
      <div id="geMsg"></div>
      <div class="cashier-actions">
        <button class="btn-ghost" onclick="closeGrowthEdit()">Batal</button>
        <button class="btn-primary" style="margin-top:0;" id="geSave">Simpan</button>
      </div>
    </div>`;
  document.body.appendChild(o);
  document.getElementById('geSave').onclick = async () => {
    const btn = document.getElementById('geSave'), msg = document.getElementById('geMsg');
    btn.disabled = true;
    try{
      const res = await fetch(API_GROWTH, {
        method: 'PUT', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({
          id, measurement_date: document.getElementById('geDate').value,
          weight: document.getElementById('geW').value, height: document.getElementById('geH').value,
          sex: document.getElementById('geSex').value,
        })
      });
      const d = await res.json().catch(() => ({}));
      if(!res.ok){ msg.innerHTML = `<div class="notice danger" style="margin-top:10px;">${escapeHtml(d.error || 'Gagal menyimpan.')}</div>`; btn.disabled = false; return; }
      closeGrowthEdit();
      await loadGrowthDetail(growthDetailKey.type || 'weight');
      renderGrowthAdminList();
    }catch(e){ msg.innerHTML = '<div class="notice danger" style="margin-top:10px;">Tidak bisa terhubung ke server.</div>'; btn.disabled = false; }
  };
}

async function deleteGrowthRecordDetail(id){
  if(!confirm('Hapus catatan pengukuran ini? Tindakan ini tidak bisa dibatalkan.')) return;
  await fetch(`${API_GROWTH}?id=${id}`, {method:'DELETE'});
  await loadGrowthDetail(growthDetailKey.type || 'weight');
  renderGrowthAdminList();
}

document.getElementById('filterStatus').addEventListener('change', renderBookingList);
document.getElementById('filterDate').addEventListener('change', renderBookingList);

/* =========================================================
   SERVICES
========================================================= */
async function loadServices(){
  try{
    const res = await fetch(API_SERVICES);
    services = await res.json();
  }catch(e){ services = []; }
}

const SERVICE_CATEGORY_LABELS = {
  newborn: 'Newborn Care (0-30 Hari)',
  newborn_pkg: 'Paket Newborn Care',
  baby: 'Baby Treatment (0-24 Bulan)',
  therapy: 'Baby & Kids Therapy',
  kids: 'Kids Treatment (2 Tahun ke Atas)',
  mom: 'Mom Care (Home Care)',
  traditional: 'Traditional Care'
};

function fmtDuration(d){
  const v = String(d == null ? '' : d).trim();
  if(!v || v === '-') return '';
  return /^[\d\s\-–]+$/.test(v) ? v + ' menit' : v;
}

function renderServiceAdminList(){
  const list = document.getElementById('serviceAdminList');
  const filterCat = document.getElementById('svcFilterCategory').value;
  const filtered = filterCat === 'all' ? services : services.filter(s => s.category === filterCat);

  if(filtered.length===0){ list.innerHTML = '<div class="notice info">Belum ada layanan.</div>'; return; }

  // urutkan per kategori biar rapi
  const order = {newborn:0, newborn_pkg:1, baby:2, therapy:3, kids:4, mom:5, traditional:6};
  const sorted = [...filtered].sort((a,b)=> (order[a.category]??9) - (order[b.category]??9));

  list.innerHTML = sorted.map(s=>`
    <div class="booking-item">
      <div class="info">
        <span class="badge pending">${SERVICE_CATEGORY_LABELS[s.category] || s.category}</span><br>
        <strong>${escapeHtml(s.name)}</strong><br>
        <div>${fmtDuration(s.duration) ? escapeHtml(fmtDuration(s.duration)) + ' · ' : ''}${fmtRupiah(s.price)}</div>
        <div>${escapeHtml(s.description||'')}</div>
      </div>
      <div class="booking-actions">
        <button class="btn-small btn-confirm" onclick="editService(${s.id})">Ubah</button>
        <button class="btn-small btn-del" onclick="removeService(${s.id})">Hapus</button>
      </div>
    </div>`).join('');
}
document.getElementById('svcFilterCategory').addEventListener('change', renderServiceAdminList);

function editService(id){
  const s = services.find(x=>x.id==id);
  if(!s) return;
  document.getElementById('m_svc_id').value = s.id;
  document.getElementById('m_svc_category').value = s.category || 'kids';
  document.getElementById('m_svc_name').value = s.name;
  document.getElementById('m_svc_duration').value = s.duration;
  document.getElementById('m_svc_price').value = s.price;
  document.getElementById('m_svc_desc').value = s.description || '';
  document.getElementById('m_svcMsg').innerHTML = '';
  document.getElementById('svcModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(()=>document.getElementById('m_svc_name').focus(), 50);
}

function closeEditModal(){
  document.getElementById('svcModal').style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && document.getElementById('svcModal').style.display !== 'none') closeEditModal();
});

async function saveServiceEdit(){
  const id = document.getElementById('m_svc_id').value;
  const category = document.getElementById('m_svc_category').value;
  const name = document.getElementById('m_svc_name').value.trim();
  const duration = document.getElementById('m_svc_duration').value.trim();
  const price = parseInt(document.getElementById('m_svc_price').value);
  const description = document.getElementById('m_svc_desc').value.trim();
  const msg = document.getElementById('m_svcMsg');
  const btn = document.getElementById('m_svcSaveBtn');

  if(!name || !duration || !price){ msg.innerHTML = '<div class="notice danger">Lengkapi nama, durasi, dan harga.</div>'; return; }

  btn.disabled = true;
  try{
    const res = await fetch(API_SERVICES, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({id, category, name, duration, price, description})
    });
    const data = await res.json();
    if(!res.ok){
      msg.innerHTML = `<div class="notice danger">${escapeHtml(data.error || 'Gagal menyimpan.')}</div>`;
      return;
    }
    closeEditModal();
    await loadServices();
    renderServiceAdminList();
  }catch(e){
    msg.innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
  }finally{
    btn.disabled = false;
  }
}

async function saveService(){
  const id = document.getElementById('svc_id').value;
  const category = document.getElementById('svc_category').value;
  const name = document.getElementById('svc_name').value.trim();
  const duration = document.getElementById('svc_duration').value.trim();
  const price = parseInt(document.getElementById('svc_price').value);
  const description = document.getElementById('svc_desc').value.trim();
  const msg = document.getElementById('svcMsg');

  if(!name || !duration || !price){ msg.innerHTML = '<div class="notice danger">Lengkapi nama, durasi, dan harga.</div>'; return; }

  const payload = {id: id || undefined, category, name, duration, price, description};
  try{
    const res = await fetch(API_SERVICES, {
      method: id ? 'PUT' : 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!res.ok){
      msg.innerHTML = `<div class="notice danger">${escapeHtml(data.error || 'Gagal menyimpan.')}</div>`;
      return;
    }
    ['svc_id','svc_name','svc_duration','svc_price','svc_desc'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('svc_category').value = 'kids';
    msg.innerHTML = '<div class="notice ok">Layanan tersimpan.</div>';
    await loadServices();
    renderServiceAdminList();
  }catch(e){
    msg.innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
  }
}

async function removeService(id){
  if(!confirm('Hapus layanan ini?')) return;
  await fetch(`${API_SERVICES}?id=${id}`, {method:'DELETE'});
  await loadServices();
  renderServiceAdminList();
}

/* =========================================================
   DAFTAR PIJAT LANGSUNG (WALK-IN, tanpa reservasi sebelumnya)
========================================================= */
function localDateStr(d = new Date()){
  const z = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}`;
}
function localTimeStr(d = new Date()){
  const z = n => String(n).padStart(2,'0');
  return `${z(d.getHours())}:${z(d.getMinutes())}`;
}

function walkinServiceOptions(selectedId){
  return Object.keys(SERVICE_CATEGORY_LABELS).map(cat=>{
    const list = services.filter(s => s.category === cat);
    if(!list.length) return '';
    return `<optgroup label="${escapeHtml(SERVICE_CATEGORY_LABELS[cat])}">`
      + list.map(s=>`<option value="${s.id}" ${selectedId != null && Number(s.id) === Number(selectedId) ? 'selected' : ''}>${escapeHtml(s.name)} — ${fmtRupiah(s.price)}</option>`).join('')
      + '</optgroup>';
  }).join('');
}

// Daftar layanan per anak: baris pertama = layanan utama, tombol "+ Tambah layanan" menambah baris lain.
// legacy = layanan lama (mis. sudah nonaktif) yang masih harus muncul sebagai pilihan.
function setupServiceRows(box, addBtn, initialIds, legacy){
  const optHtml = sel => {
    let h = walkinServiceOptions(sel);
    (legacy || []).forEach(l => {
      if(!services.some(x => Number(x.id) === Number(l.id))){
        h = `<option value="${l.id}" ${Number(l.id) === Number(sel) ? 'selected' : ''}>${escapeHtml(l.name)} (nonaktif) — ${fmtRupiah(l.price)}</option>` + h;
      }
    });
    return h;
  };
  const addRow = sel => {
    const row = document.createElement('div');
    row.className = 'svc-row';
    row.style.cssText = 'display:flex;gap:6px;margin-top:6px;align-items:center;';
    const removable = box.children.length > 0;
    row.innerHTML = `<select class="wk-service" style="flex:1;min-width:0;">${optHtml(sel)}</select>`
      + (removable ? '<button type="button" class="btn-small btn-del svc-remove" title="Hapus layanan ini">✕</button>' : '');
    box.appendChild(row);
    const rm = row.querySelector('.svc-remove');
    if(rm) rm.onclick = () => row.remove();
  };
  (initialIds && initialIds.length ? initialIds : [null]).forEach(addRow);
  addBtn.onclick = () => addRow(null);
}
function readServiceIds(root){
  return Array.from(root.querySelectorAll('.wk-service')).map(x => parseInt(x.value)).filter(Boolean);
}

function walkinKidHTML(){
  return `<div class="w-kid" style="border:1px dashed var(--line);border-radius:12px;padding:12px;margin-top:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <strong class="w-kid-title">Anak 1</strong>
      <button type="button" class="btn-small btn-del w-kid-remove">Hapus</button>
    </div>
    <div class="row2">
      <div><label>Nama Bayi/Balita</label><input type="text" class="wk-name"></div>
      <div><label>Tanggal Lahir</label><input type="date" class="wk-dob"></div>
    </div>
    <div class="row2">
      <div><label>Jenis Kelamin</label>
        <select class="wk-sex"><option value="">- pilih -</option><option value="boy">Laki-laki</option><option value="girl">Perempuan</option></select></div>
      <div></div>
    </div>
    <div class="row2">
      <div><label>Berat Badan (kg)</label><input type="number" class="wk-weight" step="0.01" min="0" inputmode="decimal" placeholder="mis. 7.5"></div>
      <div><label>Tinggi Badan (cm)</label><input type="number" class="wk-height" step="0.1" min="0" inputmode="decimal" placeholder="mis. 65"></div>
    </div>
    <p class="hint" style="margin:4px 0 0;">Berat &amp; tinggi opsional. Kalau diisi, otomatis masuk Riwayat Tumbuh Kembang (jenis kelamin wajib). Anak di atas 60 bulan (5 tahun ke atas): isi <strong>jenis kelamin, tanggal lahir, berat (kg) &amp; tinggi (cm)</strong> — IMT dihitung otomatis untuk penilaian IMT/U.</p>
    <label>Layanan</label>
    <div class="wk-services"></div>
    <button type="button" class="btn-small btn-edit wk-add-svc" style="margin-top:8px;">+ Tambah layanan</button>
    <label>Jam</label>
    <input type="time" class="wk-time">
  </div>`;
}

function renumberWalkinKids(){
  document.querySelectorAll('#w_kids .w-kid').forEach((el, i) => {
    el.querySelector('.w-kid-title').textContent = 'Anak ' + (i + 1);
    el.querySelector('.w-kid-remove').style.display = i === 0 ? 'none' : '';
  });
}

function addWalkinKid(){
  const box = document.getElementById('w_kids');
  const prevTime = box.querySelector('.w-kid:last-child .wk-time');
  const wrap = document.createElement('div');
  wrap.innerHTML = walkinKidHTML();
  const el = wrap.firstElementChild;
  box.appendChild(el);
  el.querySelector('.wk-time').value = prevTime ? prevTime.value : localTimeStr();
  el.querySelector('.w-kid-remove').addEventListener('click', () => { el.remove(); renumberWalkinKids(); });
  setupServiceRows(el.querySelector('.wk-services'), el.querySelector('.wk-add-svc'), null, null);
  renumberWalkinKids();
  if(box.children.length > 1) el.querySelector('.wk-name').focus();
}

function openWalkinModal(){
  ['w_parent','w_phone','w_notes'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('w_date').value = localDateStr();
  document.getElementById('w_msg').innerHTML = '';
  document.getElementById('w_kids').innerHTML = '';
  addWalkinKid();

  document.getElementById('walkinModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  setTimeout(()=>document.getElementById('w_parent').focus(), 50);
}

function closeWalkinModal(){
  document.getElementById('walkinModal').style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e=>{
  if(e.key === 'Escape' && document.getElementById('walkinModal').style.display !== 'none') closeWalkinModal();
});

async function saveWalkin(){
  const val = id => document.getElementById(id).value.trim();
  const msg = document.getElementById('w_msg');
  const btn = document.getElementById('w_saveBtn');

  const parent = val('w_parent'), phone = val('w_phone'), date = val('w_date');
  const kids = Array.from(document.querySelectorAll('#w_kids .w-kid')).map(el => ({
    baby_name: el.querySelector('.wk-name').value.trim(),
    baby_dob: el.querySelector('.wk-dob').value,
    service_ids: readServiceIds(el),
    booking_time: el.querySelector('.wk-time').value,
    sex: el.querySelector('.wk-sex').value,
    weight: el.querySelector('.wk-weight').value.trim(),
    height: el.querySelector('.wk-height').value.trim(),
  }));

  if(!parent || !phone || !date || !kids.length
     || kids.some(k => !k.baby_name || !k.baby_dob || !k.service_ids.length || !k.booking_time)){
    msg.innerHTML = '<div class="notice danger">Lengkapi semua data (selain catatan) terlebih dahulu.</div>';
    return;
  }

  for(let i = 0; i < kids.length; i++){
    const k = kids[i], who = kids.length > 1 ? `Anak ${i + 1}: ` : '';
    if(k.weight || k.height){
      if(!k.weight || !k.height){ msg.innerHTML = `<div class="notice danger">${who}Isi berat DAN tinggi badan, atau kosongkan keduanya.</div>`; return; }
      if(!k.sex){ msg.innerHTML = `<div class="notice danger">${who}Pilih jenis kelamin supaya tumbuh kembang bisa dicatat.</div>`; return; }
      if(Number(k.weight) <= 0 || Number(k.weight) > 120){ msg.innerHTML = `<div class="notice danger">${who}Berat badan tidak wajar (isi dalam kg, mis. 7.5).</div>`; return; }
      if(Number(k.height) < 20 || Number(k.height) > 200){ msg.innerHTML = `<div class="notice danger">${who}Tinggi badan tidak wajar (isi dalam cm, mis. 65).</div>`; return; }
    }
  }

  const notes = '[Datang langsung]' + (val('w_notes') ? ' ' + val('w_notes') : '');
  // lebih dari 1 anak = 1 kunjungan: ditandai visit_id yang sama supaya dibayar bersama & struknya satu
  const visitId = kids.length > 1
    ? ('V' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(0, 20)
    : null;

  btn.disabled = true;
  msg.innerHTML = '';
  try{
    // 1) Cek slot jam LEBIH DULU di sisi layar: kalau ada jam yang kelebihan, tidak ada yang dikirim sama sekali
    try{
      const av = await (await fetch(`${API_BOOKINGS}?availability=1&date=${encodeURIComponent(date)}`)).json();
      const max = av.max || 2, counts = av.counts || {};
      const need = {};
      kids.forEach(k => { const h = k.booking_time.slice(0, 2) + ':00'; need[h] = (need[h] || 0) + 1; });
      for(const h of Object.keys(need)){
        const free = Math.max(0, max - (counts[h] || 0));
        if(need[h] > free){
          msg.innerHTML = `<div class="notice danger">Jam ${h} hanya tersisa ${free} slot (maksimal ${max} bayi per jam), tetapi ${need[h]} anak dipilih di jam itu.<br>Belum ada data yang disimpan. Ubah jamnya lalu simpan lagi.</div>`;
          return;
        }
      }
    }catch(_){ /* kalau gagal mengecek, server tetap memeriksa lagi */ }

    // 2) Kirim SEMUA anak dalam satu permintaan; server menyimpan semuanya atau tidak sama sekali.
    //    status 'confirmed': pelanggan sudah ada di tempat -> langsung dikonfirmasi.
    const payload = { parent_name: parent, phone, booking_date: date, notes, status: 'confirmed', kids };
    if(visitId) payload.visit_id = visitId;
    const res = await fetch(API_BOOKINGS, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if(!res.ok){
      msg.innerHTML = `<div class="notice danger">${escapeHtml(data.error || 'Gagal menyimpan.')}</div>`;
      return;
    }

    closeWalkinModal();
    document.getElementById('filterStatus').value = 'all';
    document.getElementById('filterDate').value = '';
    await renderBookingList();
    // kunci daftar sebentar: klik/ketuk ganda pada tombol Simpan jangan sampai "menembus" ke tombol di daftar yang baru bergeser
    const listEl = document.getElementById('bookingList');
    listEl.style.pointerEvents = 'none';
    setTimeout(() => { listEl.style.pointerEvents = ''; }, 700);
  }catch(e){
    msg.innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
  }finally{
    btn.disabled = false;
  }
}

/* =========================================================
   BOOKINGS
========================================================= */
/* =========================================================
   BOOKINGS
========================================================= */
function toWhatsAppNumber(phone){
  let digits = String(phone).replace(/\D/g, '');
  if(digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if(!digits.startsWith('62')) digits = '62' + digits;
  return digits;
}

// "2026-10-05" -> "Senin, 5 Oktober 2026"
function formatTanggalID(dateStr){
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return String(dateStr || '');
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('id-ID', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
}

// Link chat WhatsApp berisi pesan. Di komputer dipakai WhatsApp Web (web.whatsapp.com) karena aplikasi
// WhatsApp Desktop di Windows sering merusak emoji (jadi tanda tanya). Di HP tetap pakai wa.me.
// Kalau mau kembali ke wa.me di semua perangkat, ubah WA_PAKAI_WEB menjadi false.
const WA_PAKAI_WEB = true;
function waLink(phone, text){
  const num = toWhatsAppNumber(phone);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const q = encodeURIComponent(text);
  return (WA_PAKAI_WEB && !mobile)
    ? `https://web.whatsapp.com/send?phone=${num}&text=${q}`
    : `https://wa.me/${num}?text=${q}`;
}

const CONFIRM_FOOTER = `Kami tunggu kedatangannya di outlet Blue Haven Baby & Kids SPA ya Bunda/Ayah. Mohon datang tepat waktu agar waktu treatment tidak terpotong.\n`
  + `Mohon untuk konfirmasi jika datang terlambat, cancel atau reschedule. Terima kasih 🙏☺️\n\n`
  + `Jika ada cancel di outlet maupun Homecare, maksimal cancel 1 jam sebelum jam reservasi. Jika lebih dari itu, akan dikenakan charge 25% dari harga treatment 😊 dan uang transport untuk Homecare 🙏`;

// Anak-anak yang 1 kunjungan (visit_id sama, atau nomor WA + tanggal sama) dan belum selesai/dibatalkan
function visitMates(b){
  return bookingListCache
    .filter(x => (x.status === 'pending' || x.status === 'confirmed')
      && (b.visit_id ? x.visit_id === b.visit_id : (!x.visit_id && x.phone === b.phone && x.booking_date === b.booking_date)))
    .sort((p, q) => p.id - q.id);
}

// Konfirmasi gabungan: semua anak 1 kunjungan dikonfirmasi sekaligus, lalu SATU pesan WA untuk semuanya
async function confirmGroup(id){
  const b = bookingListCache.find(x => x.id === id);
  if(!b){ alert('Data reservasi tidak ditemukan, coba muat ulang daftarnya.'); return; }
  const mates = visitMates(b);
  if(mates.length < 2){ setStatus(id, 'confirmed'); return; }

  // susun pesan SEKARANG (data sudah ada di daftar), salin ke clipboard sebagai cadangan, lalu buka tab WA
  // selagi masih dalam klik supaya tidak diblokir pop-up blocker
  const sameDate = mates.every(m => m.booking_date === mates[0].booking_date);
  const lines = mates.map((m, i) => {
    const jam = String(m.booking_time || '').slice(0, 5);
    return `${i + 1}. 👶 *${m.baby_name}*\n   💆 ${m.service_name || '-'}\n   🕒 ${sameDate ? '' : formatTanggalID(m.booking_date) + ', '}${jam} WIB`;
  }).join('\n\n');
  const names = mates.map(m => m.baby_name);
  const nameText = names.slice(0, -1).join(', ') + ' dan ' + names[names.length - 1];
  const message = `Halo Bunda/Ayah ${b.parent_name}, orang tua dari *${nameText}* 🌊\n\n`
    + `Reservasi si kecil sudah kami konfirmasi ya ✅\n\n`
    + (sameDate ? `📅 Hari/Tanggal: ${formatTanggalID(mates[0].booking_date)}\n\n` : '')
    + lines + `\n\n` + CONFIRM_FOOTER;
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(message).catch(() => {}); }
  const waWin = window.open('', '_blank');

  for(const m of mates.filter(x => x.status === 'pending')){
    const res = await fetch(API_BOOKINGS, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({id: m.id, status: 'confirmed'})
    });
    if(!res.ok){
      const d = await res.json().catch(() => ({}));
      alert(`Gagal mengonfirmasi ${m.baby_name}: ` + (d.error || 'terjadi kesalahan.'));
      if(waWin) waWin.close();
      await renderBookingList();
      return;
    }
  }

  const link = waLink(b.phone, message);
  await renderBookingList();
  if(waWin) waWin.location.href = link; else window.open(link, '_blank');
}

function openBookingWhatsApp(id){
  const b = bookingListCache.find(x => x.id === id);
  if(!b){ alert('Data reservasi tidak ditemukan, coba muat ulang daftarnya.'); return; }

  const serviceName = b.service_name || 'layanan yang dipilih';
  let message = '';

  if(b.status === 'pending'){
    message = `Halo Bunda/Ayah ${b.parent_name}, ini dari Blue Haven Baby & Kids Spa 🌊\n\n`
      + `Kami terima reservasi untuk ${b.baby_name} — ${serviceName}, pada ${b.booking_date} pukul ${b.booking_time}.\n\n`
      + `Mohon dikonfirmasi apakah jadwal ini sudah pas ya, Bunda/Ayah? 🙏`;
  } else if(b.status === 'confirmed'){
    const tanggal = formatTanggalID(b.booking_date);
    const jam = String(b.booking_time || '').slice(0, 5);
    message = `Halo Bunda/Ayah ${b.parent_name}, reservasi *${b.baby_name}* sudah kami konfirmasi ya 🌊\n\n`
      + `📋 Layanan: ${serviceName}\n`
      + `📅 Hari/Tanggal: ${tanggal}\n`
      + `🕒 Jam: ${jam} WIB\n\n`
      + CONFIRM_FOOTER;
  } else if(b.status === 'done'){
    message = `Halo Bunda/Ayah ${b.parent_name}, terima kasih sudah mempercayakan ${b.baby_name} untuk ${serviceName} di Blue Haven Baby & Kids Spa 🌊 Semoga si kecil semakin sehat & bahagia ya!`;
  } else {
    message = `Halo Bunda/Ayah ${b.parent_name}, ini dari Blue Haven Baby & Kids Spa. Terkait reservasi ${b.baby_name} pada ${b.booking_date} pukul ${b.booking_time} yang berstatus dibatalkan, boleh kami bantu jadwalkan ulang?`;
  }

  window.open(waLink(b.phone, message), '_blank');
}

/* =========================================================
   STRUK / RESI (cetak + kirim WA)
========================================================= */
const BUSINESS_NAME = 'BLUE HAVEN BABY & KIDS SPA';
const BUSINESS_ADDRESS = 'Jl. Masjid Nur Rohman, Selojeneng, Sumberdadi\nKec. Sumbergempol, Kab. Tulungagung';

/* Biaya jarak Home Care: Rp3.500 per 1 km. Jarak (km) diinput admin di kasir / edit reservasi.
   (Tarif yang sama ada di api/bookings.php -> HOMECARE_RATE_PER_KM; ubah keduanya kalau tarif berubah.) */
const HOMECARE_RATE_PER_KM = 3500;
function homecareFeeOf(km){ return Math.round((parseFloat(String(km).replace(',', '.')) || 0) * HOMECARE_RATE_PER_KM); }
function fmtKm(km){ return String(Math.round((Number(km) || 0) * 10) / 10).replace('.', ','); }
// Baris biaya jarak di struk (kosong kalau tidak ada biaya jarak)
function homecareReceiptRow(o){
  const fee = Number(o.homecare_fee || 0);
  if(!(fee > 0)) return '';
  return `<div class="row"><span>Transport Home Care (${fmtKm(o.homecare_km)} km x ${fmtRupiah(HOMECARE_RATE_PER_KM)})</span><span>${fmtRupiah(fee)}</span></div>`;
}

function receiptNumber(b){
  const d = new Date(b.created_at || (b.booking_date + 'T00:00:00'));
  const ymd = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
  const seq = String(b.daily_number || 1).padStart(3,'0');
  return `${ymd}-${seq}`;
}

function buildReceiptText(b){
  const price = b.service_price != null ? fmtRupiah(b.service_price) : '-';
  const [label] = statusLabel(b.status);
  const total = b.final_total != null ? fmtRupiah(b.final_total) : fmtRupiah(Number(b.service_price||0) + Number(b.homecare_fee||0));
  let lines = `*${BUSINESS_NAME}*\n${BUSINESS_ADDRESS}\n\n`
    + `No. Struk: ${receiptNumber(b)}\n`
    + `Tanggal  : ${b.booking_date} ${b.booking_time}\n\n`
    + `Nama Anak : ${b.baby_name}\n`
    + `Orang Tua : ${b.parent_name}\n\n`
    + ((b.service_lines && b.service_lines.length > 1)
        ? b.service_lines.map(l => `${l.name}  ${fmtRupiah(l.price)}`).join('\n') + '\n'
        : `${b.service_name || '-'}\n`)
    + `Harga     : ${price}\n`;
  const hcFee = Number(b.homecare_fee || 0);
  if(hcFee > 0){
    lines += `Transport Home Care (${fmtKm(b.homecare_km)} km x ${fmtRupiah(HOMECARE_RATE_PER_KM)}): ${fmtRupiah(hcFee)}\n`;
  }
  const gross = Number(b.service_price||0) + hcFee;
  if(b.final_total != null && gross > Number(b.final_total||0)){
    lines += `Diskon${b.discount_percent > 0 ? ' ' + b.discount_percent + '%' : ''}: -${fmtRupiah(gross - Number(b.final_total||0))}\n`;
  }
  lines += `------------------------\n`
    + `Total     : ${total}\n`;
  if(b.cash_received != null){
    lines += `Tunai     : ${fmtRupiah(b.cash_received)}\n`
      + `Kembali   : ${fmtRupiah(b.change_given || 0)}\n`;
  }
  lines += `Status    : ${label}\n\n`
    + `Terima kasih sudah mempercayakan si kecil kepada kami! 💙`;
  return lines;
}

// Isi bagian tengah struk: 1 anak (biasa) atau beberapa anak (struk gabungan, b.items terisi)
function receiptBodyHTML(b, price, label){
  const svcRows = (o, priceText) => (Array.isArray(o.service_lines) && o.service_lines.length > 1)
    ? o.service_lines.map(l => `<div class="row"><span>${escapeHtml(l.name)}</span><span>${fmtRupiah(l.price)}</span></div>`).join('')
    : `<div class="row"><span>${escapeHtml(o.service_name || '-')}</span><span>${priceText}</span></div>`;
  // diskon = (harga layanan + biaya jarak Home Care) - total dibayar
  const gross = (it) => Number(it.service_price||0) + Number(it.homecare_fee||0);
  const hasDisc = (it) => it.final_total != null && gross(it) > Number(it.final_total||0);
  const discRow = (it) => hasDisc(it)
    ? `<div class="row"><span>Diskon${it.discount_percent > 0 ? ' ' + it.discount_percent + '%' : ''}</span><span>-${fmtRupiah(gross(it) - Number(it.final_total||0))}</span></div>`
    : '';

  if(Array.isArray(b.items) && b.items.length > 1){
    const itemsHtml = b.items.map((it, i) =>
      `<div><strong>${i + 1}. ${escapeHtml(it.baby_name)}</strong></div>
    ${svcRows(it, fmtRupiah(it.service_price))}
    ${homecareReceiptRow(it)}
    ${discRow(it)}`).join('\n    <div style="height:4px"></div>\n    ');
    return `<div>Orang Tua: ${escapeHtml(b.parent_name)}</div>
    <div>No. WA: ${escapeHtml(b.phone)}</div>
    <hr>
    ${itemsHtml}
    <hr>
    <div class="row"><strong>Total (${b.items.length} anak)</strong><strong>${fmtRupiah(b.final_total)}</strong></div>
    ${b.cash_received != null ? `
    <div class="row"><span>Tunai</span><span>${fmtRupiah(b.cash_received)}</span></div>
    <div class="row"><span>Kembali</span><span>${fmtRupiah(b.change_given || 0)}</span></div>` : ''}
    <div class="row"><span>Status</span><span>${label}</span></div>`;
  }

  return `<div>Nama Anak: <strong>${escapeHtml(b.baby_name)}</strong></div>
    <div>Orang Tua: ${escapeHtml(b.parent_name)}</div>
    <div>No. WA: ${escapeHtml(b.phone)}</div>
    <hr>
    ${svcRows(b, price)}
    ${homecareReceiptRow(b)}
    ${discRow(b)}
    <hr>
    <div class="row"><strong>Total</strong><strong>${b.final_total != null ? fmtRupiah(b.final_total) : fmtRupiah(gross(b))}</strong></div>
    ${b.cash_received != null ? `
    <div class="row"><span>Tunai</span><span>${fmtRupiah(b.cash_received)}</span></div>
    <div class="row"><span>Kembali</span><span>${fmtRupiah(b.change_given || 0)}</span></div>` : ''}
    <div class="row"><span>Status</span><span>${label}</span></div>`;
}

function buildReceiptHTML(b, waChatLink){
  const price = b.service_price != null ? fmtRupiah(b.service_price) : '-';
  const [label] = statusLabel(b.status);
  const js = v => JSON.stringify(v).replace(/</g, '\\u003c');
  const uploadUrl = new URL('api/receipt.php', location.href).href;
  const baseUrl = new URL('./', location.href).href;
  const waMessage = `Halo Bunda/Ayah ${b.parent_name}, berikut struk reservasi ${b.baby_name} di Blue Haven Baby & Kids Spa 🧾💙`;
  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><title>Struk #${b.id}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
<style>
  body{ font-family:'Plus Jakarta Sans', sans-serif; margin:20px auto; padding:0 12px; max-width:320px; color:#000; }
  #receiptCard{ font-family:'Courier New', monospace; font-size:13px; background:#fff; padding:16px; }
  .center{ text-align:center; }
  hr{ border:none; border-top:1px dashed #000; margin:8px 0; }
  .row{ display:flex; justify-content:space-between; gap:8px; }
  .actions{ margin-top:18px; display:flex; flex-direction:column; gap:8px; }
  .actions button{
    padding:12px; border:none; border-radius:6px; font-weight:bold;
    text-align:center; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; font-size:13px;
  }
  .btn-print{ background:#12407A; color:#fff; }
  .btn-share{ background:#25D366; color:#fff; }
  .btn-share:disabled{ opacity:0.6; cursor:wait; }
  .btn-share2{ background:#eef3fa; color:#12407A; }
  .result{ margin-top:12px; padding:10px; border-radius:8px; font-size:12px; line-height:1.45; }
  .result.ok{ background:#e8f7ee; border:1px solid #25D366; color:#0b5a2a; }
  .result.err{ background:#fdecee; border:1px solid #d63e72; color:#8a1f45; }
  .result input{ width:100%; margin-top:8px; padding:7px; font-size:11px; border:1px solid #ccc; border-radius:5px; }
  .result button{ margin-top:8px; padding:9px; width:100%; border:none; border-radius:6px; font-weight:bold; cursor:pointer; background:#12407A; color:#fff; font-size:12px; }
  @media print{ .result{ display:none !important; } }
  .note{ font-size:11px; color:#666; text-align:center; margin-top:4px; }
  .row span:first-child{ word-break:break-word; }
  .row span:last-child{ white-space:nowrap; text-align:right; }
  /* ===== CETAK THERMAL 58mm: struk dicetak sebagai gambar hitam-putih 384 dot ===== */
  #printArea{ display:none; }
  @page{ size:58mm auto; margin:0; }
  @media print{
    html, body{ margin:0 !important; padding:0 !important; max-width:none !important; background:#fff; }
    .actions, .note, .result, #receiptCard{ display:none !important; }
    #printArea{ display:block !important; }
    #printArea img{ display:block; width:100%; height:auto; }
  }
</style></head>
<body>
  <div id="receiptCard">
    <div class="center"><strong>${escapeHtml(BUSINESS_NAME)}</strong><br>${escapeHtml(BUSINESS_ADDRESS).replace(/\n/g,'<br>')}</div>
    <hr>
    <div class="row"><span>No. Struk</span><span>${receiptNumber(b)}</span></div>
    <div class="row"><span>Tanggal</span><span>${b.booking_date} ${b.booking_time}</span></div>
    <hr>
${receiptBodyHTML(b, price, label)}
    <hr>
    <div class="center">Terima kasih sudah mempercayakan<br>si kecil kepada kami! <span class="emo">💙</span></div>
  </div>
  <div id="printArea"></div>
  <div class="actions">
    <button class="btn-print" id="printBtn" onclick="printThermal()">🖨️ Cetak</button>
    <button class="btn-share" id="shareBtn" onclick="sendToParentWA()">💬 Kirim ke WA Orang Tua</button>
    <button class="btn-share2" id="shareMobileBtn" style="display:none;" onclick="shareAsImage()">📲 Bagikan lewat menu HP (pilih kontak sendiri)</button>
  </div>
  <p class="note" id="shareNote"></p>
  <div id="shareResult" class="result" style="display:none;"></div>

  <script>
    var CHAT_LINK = '${waChatLink}';
    var UPLOAD_URL = ${js(uploadUrl)};
    var BASE_URL = ${js(baseUrl)};
    var WA_MESSAGE = ${js(waMessage)};
    var BOOKING_ID = ${b.id};
    var IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (IS_MOBILE) document.getElementById('shareMobileBtn').style.display = 'block';

    // ===== Cetak thermal 58mm: render struk -> gambar hitam putih 384 px -> print =====
    var PRINT_DOTS = 384;      // lebar cetak 58mm = 384 dot. Ubah ke 576 untuk kertas 80mm.
    var PRINT_CSS_W = 256;     // lebar struk (px layar). Makin kecil = tulisan makin besar.
    var PRINT_THRESHOLD = 150; // 0-255, makin besar = tulisan makin tebal (turunkan kalau menggumpal)
    var PRINT_FEED_DOTS = 130; // jarak kosong di bawah struk (8 dot = 1mm, 130 = sekitar 16mm)
    function printThermal(){
      var btn = document.getElementById('printBtn');
      var old = btn.textContent;
      btn.disabled = true; btn.textContent = 'Menyiapkan cetak...';
      var src = document.getElementById('receiptCard');
      var clone = src.cloneNode(true);
      clone.removeAttribute('id');
      var emo = clone.querySelectorAll('.emo');
      for (var i = 0; i < emo.length; i++) emo[i].style.display = 'none';
      clone.style.cssText = 'position:fixed;left:0;top:0;z-index:-1;box-sizing:border-box;'
        + 'width:' + PRINT_CSS_W + 'px;padding:8px;background:#fff;color:#000;'
        + 'font-family:"Courier New",monospace;font-size:13px;font-weight:bold;line-height:1.35;';
      document.body.appendChild(clone);
      var scale = (PRINT_DOTS / PRINT_CSS_W) * 2; // digambar 2x lebih besar, lalu dikecilkan halus supaya huruf tajam
      html2canvas(clone, { scale: scale, backgroundColor: '#ffffff' }).then(function(cv){
        document.body.removeChild(clone);
        var padBottom = PRINT_FEED_DOTS; // ruang kosong di bawah supaya baris terakhir tidak terpotong saat disobek
        var out = document.createElement('canvas');
        out.width = PRINT_DOTS;
        out.height = Math.round(cv.height * PRINT_DOTS / cv.width) + padBottom;
        var ctx = out.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out.width, out.height);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(cv, 0, 0, out.width, out.height - padBottom);
        var img = ctx.getImageData(0, 0, out.width, out.height);
        var d = img.data;
        for (var p = 0; p < d.length; p += 4){
          var g = (d[p] * 0.299 + d[p+1] * 0.587 + d[p+2] * 0.114);
          var v = g < PRINT_THRESHOLD ? 0 : 255;
          d[p] = d[p+1] = d[p+2] = v; d[p+3] = 255;
        }
        ctx.putImageData(img, 0, 0);
        // garis putus-putus di ujung bawah: driver membuang baris putih, jadi tanpa ini jarak kosong tidak ikut tercetak
        ctx.fillStyle = '#000';
        for (var x = 0; x < out.width; x += 16) ctx.fillRect(x, out.height - 10, 8, 3);
        var area = document.getElementById('printArea');
        area.innerHTML = '';
        var im = new Image();
        im.onload = function(){
          btn.disabled = false; btn.textContent = old;
          window.print();
        };
        im.src = out.toDataURL('image/png');
        area.appendChild(im);
      }).catch(function(err){
        if (clone.parentNode) document.body.removeChild(clone);
        btn.disabled = false; btn.textContent = old;
        alert('Gagal menyiapkan cetak: ' + (err && err.message ? err.message : err));
      });
    }

    function makeReceiptBlob(){
      return html2canvas(document.getElementById('receiptCard'), { scale: 2, backgroundColor: '#ffffff' })
        .then(function(canvas){ return new Promise(function(res){ canvas.toBlob(res, 'image/png'); }); });
    }
    function downloadBlob(blob){
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'struk-${b.id}.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
    function blobToDataURL(blob){
      return new Promise(function(res, rej){
        var r = new FileReader();
        r.onload = function(){ res(r.result); };
        r.onerror = rej;
        r.readAsDataURL(blob);
      });
    }

    // Panel hasil (besar & jelas) di bawah tombol
    function showResult(kind, text, build){
      var box = document.getElementById('shareResult');
      box.className = 'result ' + kind;
      box.textContent = '';
      var p = document.createElement('div');
      p.textContent = text;
      box.appendChild(p);
      if (build) build(box);
      box.style.display = 'block';
    }
    function addButton(box, label, onclick){
      var b = document.createElement('button');
      b.textContent = label;
      b.onclick = onclick;
      box.appendChild(b);
    }

    // Tombol utama: struk diunggah ke server, lalu chat WhatsApp orang tua terbuka
    // dengan pesan + tautan struk yang sudah terisi. Tinggal tekan Kirim.
    async function sendToParentWA(){
      var btn = document.getElementById('shareBtn');
      var label = '💬 Kirim ke WA Orang Tua';
      document.getElementById('shareResult').style.display = 'none';
      btn.disabled = true; btn.textContent = 'Menyiapkan struk...';
      var copied = false, blob, link = null, err = '';

      try {
        var blobPromise = makeReceiptBlob();
        // cadangan: salin gambar ke clipboard (bisa ditempel dengan Ctrl+V)
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blobPromise }) ]);
            copied = true;
          } catch (e1) { copied = false; }
        }
        blob = await blobPromise;
      } catch (e2) {
        showResult('err', 'Gagal membuat gambar struk: ' + (e2 && e2.message ? e2.message : e2));
        btn.disabled = false; btn.textContent = label;
        return;
      }

      // unggah ke server supaya bisa dikirim sebagai tautan
      btn.textContent = 'Mengunggah struk...';
      try {
        var dataUrl = await blobToDataURL(blob);
        var res = await fetch(UPLOAD_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: BOOKING_ID, image: dataUrl })
        });
        var raw = await res.text();
        var data = {};
        try { data = JSON.parse(raw); } catch (e3) {}
        if (res.ok && data.path) {
          link = BASE_URL + data.path;
        } else if (res.status === 404) {
          err = 'File api/receipt.php tidak ditemukan di hosting (HTTP 404). Upload file tersebut ke folder api di htdocs.';
        } else if (res.status === 403) {
          err = 'Server menolak (HTTP 403). ' + (data.error ? data.error : 'Kemungkinan diblokir keamanan hosting.');
        } else {
          err = data.error ? data.error + ' (HTTP ' + res.status + ')' : 'Server membalas HTTP ' + res.status + ' (bukan JSON).';
        }
      } catch (e4) {
        err = 'Tidak bisa terhubung ke server: ' + (e4 && e4.message ? e4.message : e4);
      }

      if (link) {
        var chat = CHAT_LINK + '?text=' + encodeURIComponent(WA_MESSAGE) + '%0A%0A' + encodeURIComponent(link);
        showResult('ok', 'Struk berhasil diunggah. Chat WhatsApp dibuka dengan tautan struk di kolom pesan, tinggal tekan Kirim. Kalau kolom pesan kosong, salin tautan di bawah lalu tempel di chat.', function(box){
          var inp = document.createElement('input');
          inp.readOnly = true; inp.value = link;
          inp.onclick = function(){ inp.select(); };
          box.appendChild(inp);
          addButton(box, 'Salin tautan', function(){
            inp.select();
            if (navigator.clipboard) { navigator.clipboard.writeText(link); } else { document.execCommand('copy'); }
          });
          addButton(box, 'Buka WhatsApp lagi', function(){ window.open(chat, '_blank'); });
        });
        window.open(chat, '_blank');
      } else {
        if (!copied) downloadBlob(blob);
        showResult('err', 'Struk gagal diunggah ke server. Penyebab: ' + err
          + (copied ? ' Gambar struk sudah disalin: di WhatsApp tekan Ctrl+V lalu Kirim.' : ' Gambar struk didownload: lampirkan di WhatsApp.'),
          function(box){ addButton(box, 'Tetap buka chat WhatsApp', function(){ window.open(CHAT_LINK, '_blank'); }); });
      }
      btn.disabled = false; btn.textContent = label;
    }

    // Khusus HP: bagikan lewat menu Bagikan bawaan (kontak dipilih manual)
    async function shareAsImage(){
      const btn = document.getElementById('shareMobileBtn');
      const note = document.getElementById('shareNote');
      btn.disabled = true; btn.textContent = 'Membuat gambar...';

      const canvas = await html2canvas(document.getElementById('receiptCard'), { scale: 2, backgroundColor: '#ffffff' });

      canvas.toBlob(async (blob) => {
        const file = new File([blob], 'struk-${b.id}.png', { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: 'Struk ${escapeHtml(BUSINESS_NAME)}',
              text: 'Struk reservasi #${b.id} untuk ${escapeHtml(b.baby_name)}'
            });
          } catch (err) { /* dibatalkan pengguna, tidak apa-apa */ }
          btn.disabled = false; btn.textContent = '📲 Bagikan lewat menu HP (pilih kontak sendiri)';
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'struk-${b.id}.png';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          note.textContent = 'Gambar struk sudah didownload. WhatsApp akan dibuka di tab baru \u2014 lampirkan file gambar tadi secara manual di sana.';
          setTimeout(() => window.open('${waChatLink}', '_blank'), 800);
          btn.disabled = false; btn.textContent = '📲 Bagikan lewat menu HP (pilih kontak sendiri)';
        }
      }, 'image/png');
    }
  </script>
</body></html>`;
}

function openReceipt(id){
  const b = bookingListCache.find(x => x.id === id);
  if(!b){ alert('Data reservasi tidak ditemukan, coba muat ulang daftarnya.'); return; }

  // Link langsung ke chat WA nomor orang tua (tanpa teks bawaan, supaya gambar struk bisa langsung ditempel)
  const waChatLink = `https://wa.me/${toWhatsAppNumber(b.phone)}`;
  const receiptWin = window.open('', '_blank', 'width=380,height=680');
  if(!receiptWin){ alert('Pop-up diblokir browser. Izinkan pop-up untuk halaman ini agar struk bisa dibuka.'); return; }
  receiptWin.document.write(buildReceiptHTML(b, waChatLink));
  receiptWin.document.close();
}

// Struk gabungan: semua anak dalam 1 pembayaran gabungan. Kalau belum tercatat sebagai pembayaran gabungan,
// dipakai anak "Selesai" dengan nomor WA + tanggal yang sama.
function groupKey(x){ return x.payment_group_id ? 'g' + x.payment_group_id : x.phone + '|' + x.booking_date; }

function openGroupReceipt(id){
  const b = bookingListCache.find(x => x.id === id);
  if(!b){ alert('Data reservasi tidak ditemukan, coba muat ulang daftarnya.'); return; }
  const grp = bookingListCache
    .filter(x => x.status === 'done' && groupKey(x) === groupKey(b))
    .sort((p, q) => p.id - q.id);
  if(grp.length < 2){ openReceipt(id); return; }

  // sudah tercatat sebagai 1 pembayaran -> langsung tampilkan (window.open dipanggil langsung dari klik)
  if(b.payment_group_id){
    const win = window.open('', '_blank', 'width=380,height=680');
    if(!win){ alert('Pop-up diblokir browser. Izinkan pop-up untuk halaman ini agar struk bisa dibuka.'); return; }
    const cash = b.group_cash_received != null ? Number(b.group_cash_received) : null;
    const chg  = b.group_cash_received != null ? Number(b.group_change_given || 0) : null;
    renderGroupReceipt(win, grp, cash, chg);
    return;
  }

  // belum tercatat -> tanya uang diterima lewat dialog (bukan prompt() yang sering diblokir browser)
  const items = groupItems(grp);
  const total = items.reduce((t, i) => t + i.final_total, 0);
  closeCashier();
  const overlay = document.createElement('div');
  overlay.className = 'cashier-overlay';
  overlay.innerHTML = `
    <div class="cashier-modal">
      <h2 class="section-title" style="margin-bottom:4px;">Struk Gabungan</h2>
      <p class="hint" style="margin-bottom:12px;">${items.map(i => escapeHtml(i.baby_name)).join(', ')}</p>
      <div class="cashier-row cashier-total"><span>Total</span><strong>${fmtRupiah(total)}</strong></div>
      <label>Uang Diterima (Rp) <span class="hint">- boleh dikosongkan</span></label>
      <input type="number" id="grpCash" min="0" step="1000" inputmode="numeric" placeholder="Contoh: 200000">
      <div class="cashier-row cashier-change"><span>Kembalian</span><strong id="grpChange">Rp0</strong></div>
      <div id="grpMsg"></div>
      <div class="cashier-actions">
        <button class="btn-ghost" id="grpCancel">Batal</button>
        <button class="btn-primary" style="margin-top:0;" id="grpOk">Tampilkan Struk</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const cashEl = document.getElementById('grpCash');
  cashEl.focus();
  cashEl.addEventListener('input', () => {
    const c = parseInt(cashEl.value) || 0;
    document.getElementById('grpChange').textContent = fmtRupiah(Math.max(0, c - total));
  });
  document.getElementById('grpCancel').onclick = closeCashier;

  document.getElementById('grpOk').onclick = async () => {
    const msg = document.getElementById('grpMsg');
    const raw = cashEl.value.trim();
    const cash = raw === '' ? null : (parseInt(raw) || 0);
    if(cash !== null && cash < total){
      msg.innerHTML = `<div class="notice danger" style="margin-top:10px;">Uang diterima kurang dari total ${fmtRupiah(total)}.</div>`;
      return;
    }
    // buka jendela struk SEKARANG (masih di dalam klik) supaya tidak diblokir pop-up blocker
    const win = window.open('', '_blank', 'width=380,height=680');
    if(!win){ msg.innerHTML = '<div class="notice danger" style="margin-top:10px;">Pop-up diblokir browser. Izinkan pop-up untuk halaman ini lalu coba lagi.</div>'; return; }
    win.document.write('<p style="font-family:sans-serif;padding:20px;">Memuat struk...</p>');
    closeCashier();

    let saveErr = '';
    if(cash !== null){
      try{
        const res = await fetch(API_BOOKINGS, {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ action: 'link_group', ids: grp.map(x => x.id), cash_received: cash })
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok) saveErr = data.error || 'Gagal menyimpan pembayaran gabungan.';
      }catch(e){ saveErr = 'Tidak bisa terhubung ke server.'; }
    }
    // struk tetap ditampilkan walau penyimpanan gagal
    renderGroupReceipt(win, grp, cash, cash !== null ? cash - total : null);
    if(cash !== null && !saveErr) renderBookingList();
    if(saveErr) alert('Struk ditampilkan, tetapi pembayaran gabungan belum tersimpan:\n' + saveErr);
  };
}

function groupItems(grp){
  return grp.map(x => {
    const price = Number(x.service_price || 0);
    return {
      baby_name: x.baby_name,
      service_name: x.service_name,
      service_lines: x.service_lines,
      service_price: price,
      homecare_km: x.homecare_km,
      homecare_fee: Number(x.homecare_fee || 0),
      final_total: x.final_total != null ? Number(x.final_total) : price + Number(x.homecare_fee || 0),
      discount_percent: x.discount_percent,
    };
  });
}

function renderGroupReceipt(win, grp, cashReceived, changeGiven){
  const items = groupItems(grp);
  const names = items.map(i => i.baby_name);
  const total = items.reduce((t, i) => t + i.final_total, 0);
  const g = Object.assign({}, grp[0], {
    items,
    baby_name: names.slice(0, -1).join(', ') + ' dan ' + names[names.length - 1],
    service_price: items.reduce((t, i) => t + i.service_price, 0),
    final_total: total,
    discount_percent: 0,
    cash_received: cashReceived,
    change_given: changeGiven,
    status: 'done',
  });
  const waChatLink = `https://wa.me/${toWhatsAppNumber(g.phone)}`;
  win.document.open();
  win.document.write(buildReceiptHTML(g, waChatLink));
  win.document.close();
}

/* =========================================================
   EDIT RESERVASI — membetulkan salah input
========================================================= */
async function openEditBooking(id){
  const b = bookingListCache.find(x => x.id === id);
  if(!b){ alert('Data reservasi tidak ditemukan, coba muat ulang daftarnya.'); return; }
  if(!services.length) await loadServices();

  // catatan tumbuh kembang anak ini: yang tanggalnya sama dengan reservasi dipakai untuk mengisi form
  let gRecs = [];
  try{
    const qs = new URLSearchParams({phone: b.phone, baby_name: b.baby_name, baby_dob: String(b.baby_dob).slice(0, 10)});
    const gr = await (await fetch(`${API_GROWTH}?${qs}`)).json();
    if(Array.isArray(gr)) gRecs = gr;
  }catch(_){}
  const gHere = gRecs.find(r => String(r.measurement_date).slice(0, 10) === String(b.booking_date).slice(0, 10)) || null;
  const gSex = (gHere || gRecs[gRecs.length - 1] || {}).sex || '';

  const grouped = !!b.payment_group_id;
  const canEditPay = b.status === 'done' && !grouped;
  const timeVal = String(b.booking_time || '').slice(0, 5);
  const showKm = true;   // kolom biaya jarak tersedia untuk SEMUA layanan (opsional, diisi admin kalau perlu)
  const e = v => escapeHtml(v == null ? '' : String(v)).replace(/"/g, '&quot;');

  closeCashier();
  const overlay = document.createElement('div');
  overlay.className = 'cashier-overlay';
  overlay.innerHTML = `
    <div class="cashier-modal">
      <h2 class="section-title" style="margin-bottom:4px;">Edit Reservasi</h2>
      <p class="hint" style="margin-bottom:14px;">Betulkan data yang salah input, lalu simpan.</p>

      <label>Nama Orang Tua</label>
      <input type="text" id="edParent" value="${e(b.parent_name)}">
      <label>Nomor WA</label>
      <input type="text" id="edPhone" value="${e(b.phone)}" inputmode="tel" ${grouped ? 'readonly title="Terkunci: sudah masuk pembayaran gabungan"' : ''}>
      ${grouped ? '<p class="hint" style="margin:4px 0 0;">Nomor WA terkunci karena sudah masuk pembayaran gabungan.</p>' : ''}
      <label>Nama Anak</label>
      <input type="text" id="edBaby" value="${e(b.baby_name)}">
      <label>Tanggal Lahir Anak</label>
      <input type="date" id="edDob" value="${e(String(b.baby_dob || '').slice(0, 10))}">
      <label>Layanan</label>
      <div id="edServices"></div>
      <button type="button" class="btn-small btn-edit" id="edAddSvc" style="margin-top:8px;">+ Tambah layanan</button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label>Tanggal</label><input type="date" id="edDate" value="${e(b.booking_date)}"></div>
        <div><label>Jam</label><input type="time" id="edTime" value="${e(timeVal)}"></div>
      </div>
      <label>Catatan</label>
      <textarea id="edNotes" rows="2">${escapeHtml(b.notes || '')}</textarea>

      <div style="margin-top:16px;padding:12px;border:1px dashed var(--line);border-radius:12px;">
        <strong style="font-size:0.9rem;">Tumbuh Kembang</strong>
        <p class="hint" style="margin:2px 0 0;">${gHere ? 'Sudah tercatat untuk kunjungan ini. Ubah angkanya untuk membetulkan.' : 'Belum ada catatan untuk kunjungan ini. Isi untuk memasukkannya ke Riwayat Tumbuh Kembang.'}</p>
        <label>Jenis Kelamin</label>
        <select id="edSex">
          <option value="">- pilih -</option>
          <option value="boy" ${gSex === 'boy' ? 'selected' : ''}>Laki-laki</option>
          <option value="girl" ${gSex === 'girl' ? 'selected' : ''}>Perempuan</option>
        </select>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><label>Berat Badan (kg)</label><input type="number" id="edWeight" step="0.01" min="0" inputmode="decimal" value="${gHere ? Number(gHere.weight) : ''}" placeholder="mis. 7.5"></div>
          <div><label>Tinggi Badan (cm)</label><input type="number" id="edHeight" step="0.1" min="0" inputmode="decimal" value="${gHere ? Number(gHere.height) : ''}" placeholder="mis. 65"></div>
        </div>
        ${gRecs.length ? `<button type="button" class="btn-small btn-receipt" style="margin-top:10px;" id="edGrowthLink">📈 Lihat Riwayat &amp; Grafik (${gRecs.length} pengukuran)</button>` : ''}
      </div>

      ${showKm ? `
      <label>Biaya Jarak / Transport (km) - opsional</label>
      <input type="number" id="edKm" min="0" step="0.1" inputmode="decimal" value="${Number(b.homecare_km) > 0 ? Number(b.homecare_km) : ''}" placeholder="Contoh: 7">
      <p class="hint" id="edKmHint" style="margin:4px 0 0;"></p>` : ''}

      ${canEditPay ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div><label>Total Dibayar (Rp)</label><input type="number" id="edTotal" min="0" step="500" value="${b.final_total != null ? Number(b.final_total) : Number(b.service_price || 0)}"></div>
        <div><label>Uang Diterima (Rp)</label><input type="number" id="edCash" min="0" step="1000" value="${b.cash_received != null ? Number(b.cash_received) : ''}"></div>
      </div>
      <p class="hint" style="margin:4px 0 0;">Kembalian dihitung otomatis. Kosongkan uang diterima bila tidak ingin ditampilkan di struk.</p>` : ''}

      <div id="edMsg"></div>
      <div class="cashier-actions">
        <button class="btn-ghost" onclick="closeCashier()">Batal</button>
        <button class="btn-primary" style="margin-top:0;" id="edSave">Simpan Perubahan</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setupServiceRows(document.getElementById('edServices'), document.getElementById('edAddSvc'),
    (b.service_ids && b.service_ids.length) ? b.service_ids : [b.service_id], b.service_lines || []);

  // Jarak Home Care: biaya jarak otomatis (Rp3.500/km); kalau total sudah terisi, selisih biayanya ikut menyesuaikan
  const edKm = document.getElementById('edKm');
  if(edKm){
    let lastFee = Number(b.homecare_fee || 0);
    const syncKm = () => {
      const km = parseFloat(String(edKm.value).replace(',', '.')) || 0;
      const nf = homecareFeeOf(km);
      document.getElementById('edKmHint').textContent = km > 0 ? `Biaya jarak: ${fmtKm(km)} km x ${fmtRupiah(HOMECARE_RATE_PER_KM)} = ${fmtRupiah(nf)}` : `Biaya jarak ${fmtRupiah(HOMECARE_RATE_PER_KM)} / km`;
      const tot = document.getElementById('edTotal');
      if(tot){ tot.value = Math.max(0, (Number(tot.value) || 0) + nf - lastFee); }
      lastFee = nf;
    };
    edKm.addEventListener('input', syncKm);
    document.getElementById('edKmHint').textContent = lastFee > 0 ? `Biaya jarak: ${fmtKm(b.homecare_km)} km x ${fmtRupiah(HOMECARE_RATE_PER_KM)} = ${fmtRupiah(lastFee)}` : `Biaya jarak ${fmtRupiah(HOMECARE_RATE_PER_KM)} / km`;
  }

  const gLink = document.getElementById('edGrowthLink');
  if(gLink) gLink.onclick = () => openGrowthForChild(b.phone, b.baby_name, String(b.baby_dob).slice(0, 10));

  document.getElementById('edSave').onclick = async () => {
    const msg = document.getElementById('edMsg');
    const btn = document.getElementById('edSave');
    const v = i => document.getElementById(i).value.trim();
    const payload = {
      action: 'edit', id,
      parent_name: v('edParent'), phone: v('edPhone'), baby_name: v('edBaby'), baby_dob: v('edDob'),
      service_ids: readServiceIds(document.getElementById('edServices')),
      booking_date: v('edDate'), booking_time: v('edTime'), notes: v('edNotes'),
    };
    if(!payload.parent_name || !payload.phone || !payload.baby_name || !payload.baby_dob || !payload.booking_date || !payload.booking_time || !payload.service_ids.length){
      msg.innerHTML = '<div class="notice danger" style="margin-top:10px;">Lengkapi semua kolom (selain catatan).</div>';
      return;
    }
    const gW = v('edWeight'), gH = v('edHeight'), gS = document.getElementById('edSex').value;
    if(gW || gH){
      if(!gW || !gH){ msg.innerHTML = '<div class="notice danger" style="margin-top:10px;">Isi berat DAN tinggi badan, atau kosongkan keduanya.</div>'; return; }
      if(!gS){ msg.innerHTML = '<div class="notice danger" style="margin-top:10px;">Pilih jenis kelamin supaya tumbuh kembang bisa dicatat.</div>'; return; }
      if(Number(gW) <= 0 || Number(gW) > 120){ msg.innerHTML = '<div class="notice danger" style="margin-top:10px;">Berat badan tidak wajar (isi dalam kg, mis. 7.5).</div>'; return; }
      if(Number(gH) < 20 || Number(gH) > 200){ msg.innerHTML = '<div class="notice danger" style="margin-top:10px;">Tinggi badan tidak wajar (isi dalam cm, mis. 65).</div>'; return; }
    }
    payload.growth = { sex: gS, weight: gW, height: gH };
    if(edKm) payload.homecare_km = edKm.value.trim() === '' ? 0 : edKm.value.trim();
    if(canEditPay){
      payload.final_total = v('edTotal');
      payload.cash_received = v('edCash');
    }
    btn.disabled = true; btn.textContent = 'Menyimpan...';
    try{
      const res = await fetch(API_BOOKINGS, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        msg.innerHTML = `<div class="notice danger" style="margin-top:10px;">${escapeHtml(data.error || 'Gagal menyimpan perubahan.')}</div>`;
        btn.disabled = false; btn.textContent = 'Simpan Perubahan';
        return;
      }
      closeCashier();
      await renderBookingList();
      if(document.getElementById('sub-growth').style.display !== 'none') renderGrowthAdminList();
      if(document.getElementById('sub-loyalty').style.display !== 'none') renderLoyaltyList();
    }catch(err){
      msg.innerHTML = '<div class="notice danger" style="margin-top:10px;">Tidak bisa terhubung ke server.</div>';
      btn.disabled = false; btn.textContent = 'Simpan Perubahan';
    }
  };
}

async function renderBookingList(){
  const list = document.getElementById('bookingList');
  const status = document.getElementById('filterStatus').value;
  const date = document.getElementById('filterDate').value;

  const params = new URLSearchParams();
  if(status !== 'all') params.set('status', status);
  if(date) params.set('date', date);

  list.innerHTML = '<div class="notice info">Memuat...</div>';
  try{
    const res = await fetch(`${API_BOOKINGS}?${params.toString()}`);
    const items = await res.json();

    if(!Array.isArray(items) || items.length===0){
      list.innerHTML = childCountBar('Jumlah anak: 0') + '<div class="notice info">Belum ada reservasi yang cocok dengan filter ini.</div>';
      return;
    }

    bookingListCache = items;
    const filtered = (status !== 'all' || !!date) ? 'sesuai filter' : '';
    const doneKids = uniqueChildCount(items.filter(x => x.status === 'done'));
    const countBar = childCountBar(`Jumlah anak: ${uniqueChildCount(items)}`,
      `${items.length} reservasi · ${doneKids} anak sudah selesai${filtered ? ' · ' + filtered : ''}`);

    // hitung berapa anak "Selesai" per orang tua (nomor WA) + tanggal, untuk tombol struk gabungan
    const gkey = groupKey;
    const mateCount = {};
    items.forEach(x => { if(x.status === 'pending' || x.status === 'confirmed'){ mateCount[x.id] = visitMates(x).length; } });
    const doneCount = {};
    items.forEach(x => { if(x.status === 'done'){ const k = gkey(x); doneCount[k] = (doneCount[k] || 0) + 1; } });

    list.innerHTML = countBar + items.map(b=>{
      const [label, cls] = statusLabel(b.status);
      return `<div class="booking-item" data-booking-id="${b.id}">
        <div class="info">
          <strong>${escapeHtml(b.baby_name)}</strong> (${escapeHtml(b.parent_name)}, ${escapeHtml(b.phone)}) <span class="badge ${cls}">${label}</span>${b.visit_id ? ' <span class="badge" style="background:#EAF3FC;color:#12407A;">Satu kunjungan</span>' : ''}<br>
          <div>${escapeHtml(b.service_name || '(layanan dihapus)')} · ${b.booking_date} · ${b.booking_time}</div>
          ${b.notes ? `<div>Catatan: ${escapeHtml(b.notes)}</div>` : ''}
        </div>
        <div class="booking-actions">
          <button class="btn-small btn-receipt" onclick="openReceipt(${b.id})">🧾 Struk</button>
          ${(b.status === 'done' && doneCount[gkey(b)] > 1) ? `<button class="btn-small btn-receipt" onclick="openGroupReceipt(${b.id})">🧾 Struk Gabungan (${doneCount[gkey(b)]})</button>` : ''}
          ${b.status === 'done' ? '' : `${mateCount[b.id] > 1
            ? `<button class="btn-small btn-confirm" onclick="confirmGroup(${b.id})">Konfirmasi Semua (${mateCount[b.id]})</button>`
            : `<button class="btn-small btn-confirm" onclick="setStatus(${b.id},'confirmed')">Konfirmasi</button>`}
          <button class="btn-small btn-done" onclick="openCashier(${b.id})">Selesai</button>`}
          <button class="btn-small btn-edit" onclick="openEditBooking(${b.id})">✏️ Edit</button>
          <button class="btn-small btn-cancel" onclick="setStatus(${b.id},'cancelled')">Batalkan</button>
          <button class="btn-small btn-del" onclick="deleteBooking(${b.id})">Hapus</button>
        </div>
      </div>`;
    }).join('');
  }catch(e){
    list.innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
  }
}

/* =========================================================
   KASIR — tagihan, diskon, uang diterima, kembalian
========================================================= */
function openCashier(id){
  const b = bookingListCache.find(x => x.id === id);
  if(!b){ alert('Data reservasi tidak ditemukan, coba muat ulang daftarnya.'); return; }

  // anak yang didaftarkan sekaligus (1 kunjungan) otomatis dibayar bersama
  if(b.visit_id){
    const mates = bookingListCache.filter(x => x.visit_id === b.visit_id && (x.status === 'pending' || x.status === 'confirmed'));
    if(mates.length >= 2){ openGroupCashier(mates.map(x => x.id)); return; }
  }

  const basePrice = Number(b.service_price || 0);
  const isHomeCare = true;   // kolom biaya jarak tersedia untuk SEMUA layanan (opsional, kosongkan kalau tidak perlu)

  // anak lain dari orang tua yang sama, tanggal sama, yang belum selesai -> tawarkan bayar sekaligus
  const sibs = bookingListCache
    .filter(x => x.id !== id && x.phone === b.phone && x.booking_date === b.booking_date
                 && (x.status === 'pending' || x.status === 'confirmed'))
    .sort((p, q) => p.id - q.id);

  const overlay = document.createElement('div');
  overlay.className = 'cashier-overlay';
  overlay.innerHTML = `
    <div class="cashier-modal">
      <h2 class="section-title" style="margin-bottom:4px;">Pembayaran</h2>
      <p class="hint" style="margin-bottom:16px;">
        ${escapeHtml(b.baby_name)} · ${escapeHtml(b.service_name || '-')}
      </p>
      ${sibs.length ? `<div class="notice info" style="margin-bottom:14px;">
        ${escapeHtml(b.parent_name)} juga punya ${sibs.length} anak lain hari ini (${sibs.map(x => escapeHtml(x.baby_name)).join(', ')}).<br>
        <button class="btn-ghost" style="margin-top:8px;" id="cashierGroupBtn">Bayar semua anak sekaligus</button>
      </div>` : ''}

      <div class="cashier-row"><span>Harga Layanan</span><strong>${fmtRupiah(basePrice)}</strong></div>

      ${isHomeCare ? `
      <label>Biaya Jarak / Transport (km) - opsional</label>
      <input type="number" id="cashierKm" min="0" step="0.1" inputmode="decimal" placeholder="Kosongkan kalau tanpa biaya jarak. Contoh: 7" value="${Number(b.homecare_km) > 0 ? Number(b.homecare_km) : ''}">
      <div class="cashier-row"><span id="cashierFeeLabel">Biaya Jarak (${fmtRupiah(HOMECARE_RATE_PER_KM)} / km)</span><strong id="cashierFee">Rp0</strong></div>
      ` : ''}

      <label>Diskon (isi salah satu)</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <input type="number" id="cashierDiscPct" min="0" max="100" step="any" placeholder="Persen, mis. 10" inputmode="decimal">
          <p class="hint" style="margin:4px 0 0;">Diskon (%)</p>
        </div>
        <div>
          <input type="number" id="cashierDiscRp" min="0" step="500" placeholder="Rupiah, mis. 10000" inputmode="numeric">
          <p class="hint" style="margin:4px 0 0;">Potongan (Rp)</p>
        </div>
      </div>
      <p class="hint" id="cashierDiscHint" style="margin:6px 0 0;"></p>

      <div class="cashier-row cashier-total">
        <span>Total Tagihan</span>
        <strong id="cashierTotal">${fmtRupiah(basePrice)}</strong>
      </div>

      <label>Uang Diterima (Rp)</label>
      <input type="number" id="cashierReceived" min="0" step="1000" placeholder="Contoh: 100000" inputmode="numeric">

      <div class="cashier-row cashier-change">
        <span>Kembalian</span>
        <strong id="cashierChange">Rp0</strong>
      </div>

      <div id="cashierMsg"></div>

      <div class="cashier-actions">
        <button class="btn-ghost" onclick="closeCashier()">Batal</button>
        <button class="btn-primary" style="margin-top:0;" id="cashierSubmit">Selesaikan & Simpan</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const groupBtn = document.getElementById('cashierGroupBtn');
  if(groupBtn) groupBtn.addEventListener('click', () => {
    closeCashier();
    openGroupCashier([id].concat(sibs.map(x => x.id)));
  });

  const pctEl = document.getElementById('cashierDiscPct');
  const discRpEl = document.getElementById('cashierDiscRp');
  const discHintEl = document.getElementById('cashierDiscHint');
  const receivedEl = document.getElementById('cashierReceived');
  const totalEl = document.getElementById('cashierTotal');
  const changeEl = document.getElementById('cashierChange');
  const msgEl = document.getElementById('cashierMsg');

  const HINT_DEFAULT = 'Isi persen atau rupiah, kolom satunya terhitung otomatis.';
  let discSource = null;   // 'pct' = admin mengisi persen, 'rp' = admin mengisi rupiah

  function fmtPct(n){ return String(Math.round(n * 10) / 10).replace('.', ','); }
  function pctValue(){ return Math.min(Math.max(parseFloat(pctEl.value) || 0, 0), 100); }
  function discountAmount(){
    if(discSource === 'pct') return Math.round(basePrice * pctValue() / 100);
    if(discSource === 'rp') return Math.min(Math.max(parseInt(discRpEl.value) || 0, 0), basePrice);
    return 0;
  }
  function storedPercent(){
    // kolom discount_percent di database bilangan bulat: persen desimal / diskon rupiah disimpan 0 (nominalnya tetap tercatat lewat final_total)
    if(discSource !== 'pct') return 0;
    const pct = pctValue();
    return Number.isInteger(pct) ? pct : 0;
  }
  const kmEl = document.getElementById('cashierKm');
  function currentFee(){ return kmEl ? homecareFeeOf(kmEl.value) : 0; }
  // diskon hanya untuk harga layanan; biaya jarak Home Care ditambahkan di luar diskon
  function currentTotal(){ return basePrice - discountAmount() + currentFee(); }

  function onPctInput(){
    if(pctEl.value === ''){ discSource = null; discRpEl.value = ''; discHintEl.textContent = HINT_DEFAULT; recalc(); return; }
    discSource = 'pct';
    if(parseFloat(pctEl.value) > 100) pctEl.value = 100;
    if(parseFloat(pctEl.value) < 0) pctEl.value = 0;
    const amt = discountAmount();
    discRpEl.value = amt > 0 ? amt : '';
    discHintEl.textContent = amt > 0 ? ('Potongan ' + fmtRupiah(amt) + ' dari ' + fmtRupiah(basePrice)) : HINT_DEFAULT;
    recalc();
  }
  function onRpInput(){
    if(discRpEl.value === ''){ discSource = null; pctEl.value = ''; discHintEl.textContent = HINT_DEFAULT; recalc(); return; }
    discSource = 'rp';
    let rp = parseInt(discRpEl.value) || 0;
    let note = '';
    if(rp > basePrice){ rp = basePrice; discRpEl.value = rp; note = 'Potongan melebihi harga layanan, dibatasi sampai ' + fmtRupiah(basePrice) + '. '; }
    if(rp < 0){ rp = 0; discRpEl.value = 0; }
    pctEl.value = (rp > 0 && basePrice > 0) ? String(Math.round(rp / basePrice * 1000) / 10) : '';
    discHintEl.textContent = note + (rp > 0 && basePrice > 0 ? ('≈ ' + fmtPct(rp / basePrice * 100) + '% dari harga layanan') : '');
    recalc();
  }
  function recalc(){
    const total = currentTotal();
    const feeEl = document.getElementById('cashierFee');
    if(feeEl){
      const km = parseFloat(String(kmEl.value).replace(',', '.')) || 0;
      feeEl.textContent = fmtRupiah(currentFee());
      document.getElementById('cashierFeeLabel').textContent = km > 0
        ? `Biaya Jarak (${fmtKm(km)} km x ${fmtRupiah(HOMECARE_RATE_PER_KM)})`
        : `Biaya Jarak (${fmtRupiah(HOMECARE_RATE_PER_KM)} / km)`;
    }
    totalEl.textContent = fmtRupiah(total);
    const received = parseInt(receivedEl.value) || 0;
    const change = received - total;
    changeEl.textContent = fmtRupiah(Math.max(0, change));
    changeEl.style.color = (received > 0 && change < 0) ? 'var(--danger)' : 'var(--ok)';
    if(received > 0 && change < 0){
      msgEl.innerHTML = `<div class="notice warn">Uang kurang ${fmtRupiah(Math.abs(change))}.</div>`;
    } else {
      msgEl.innerHTML = '';
    }
  }
  pctEl.addEventListener('input', onPctInput);
  discRpEl.addEventListener('input', onRpInput);
  discHintEl.textContent = HINT_DEFAULT;
  receivedEl.addEventListener('input', recalc);
  if(kmEl) kmEl.addEventListener('input', recalc);
  recalc();

  document.getElementById('cashierSubmit').addEventListener('click', async ()=>{
    const total = currentTotal();
    const received = parseInt(receivedEl.value) || 0;
    if(received < total){
      msgEl.innerHTML = `<div class="notice danger">Uang yang diterima belum mencukupi total tagihan.</div>`;
      return;
    }
    const payload = {
      id,
      status: 'done',
      discount_percent: storedPercent(),
      final_total: total,
      cash_received: received,
      change_given: received - total,
    };
    if(kmEl) payload.homecare_km = kmEl.value === '' ? 0 : kmEl.value;
    try{
      const res = await fetch(API_BOOKINGS, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      if(!res.ok){
        const data = await res.json();
        msgEl.innerHTML = `<div class="notice danger">${escapeHtml(data.error || 'Gagal menyimpan transaksi.')}</div>`;
        return;
      }
      closeCashier();
      await renderBookingList();
      if(document.getElementById('sub-loyalty').style.display !== 'none') renderLoyaltyList();
    }catch(e){
      msgEl.innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
    }
  });
}

// Kasir untuk beberapa anak sekaligus: diskon diisi per anak, uang diterima satu kali
function openGroupCashier(ids){
  const kids = ids.map(i => bookingListCache.find(x => x.id === i)).filter(Boolean).sort((p, q) => p.id - q.id);
  if(kids.length < 2){ alert('Data reservasi tidak ditemukan, coba muat ulang daftarnya.'); return; }
  const st = kids.map(k => ({ b: k, base: Number(k.service_price || 0), src: null, hc: true }));   // biaya jarak tersedia untuk semua layanan (opsional)

  const cards = st.map((s, i) => `
    <div style="border:1px dashed var(--line);border-radius:12px;padding:12px;margin-top:12px;">
      <strong>${i + 1}. ${escapeHtml(s.b.baby_name)}</strong>
      <div class="hint" style="margin:2px 0 8px;">${escapeHtml(s.b.service_name || '-')} · ${fmtRupiah(s.base)}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
        <input type="number" id="gcPct${s.b.id}" min="0" max="100" step="any" placeholder="Diskon %" inputmode="decimal">
        <input type="number" id="gcRp${s.b.id}" min="0" step="500" placeholder="Potongan Rp" inputmode="numeric">
      </div>
      <p class="hint" id="gcHint${s.b.id}" style="margin:4px 0 0;"></p>
      ${s.hc ? `
      <label style="margin-top:8px;">Biaya Jarak / Transport (km) - opsional</label>
      <input type="number" id="gcKm${s.b.id}" min="0" step="0.1" inputmode="decimal" placeholder="Contoh: 7" value="${Number(s.b.homecare_km) > 0 ? Number(s.b.homecare_km) : ''}">
      <p class="hint" id="gcFee${s.b.id}" style="margin:4px 0 0;"></p>` : ''}
      <div class="cashier-row" style="border-bottom:none;padding-bottom:0;"><span>Subtotal</span><strong id="gcSub${s.b.id}">${fmtRupiah(s.base)}</strong></div>
    </div>`).join('');

  const overlay = document.createElement('div');
  overlay.className = 'cashier-overlay';
  overlay.innerHTML = `
    <div class="cashier-modal">
      <h2 class="section-title" style="margin-bottom:4px;">Pembayaran Sekaligus</h2>
      <p class="hint" style="margin-bottom:4px;">${escapeHtml(kids[0].parent_name)} · ${kids.length} anak. Isi diskon tiap layanan (persen atau rupiah, boleh dikosongkan), lalu uang diterima satu kali.</p>
      ${cards}
      <div class="cashier-row cashier-total" style="margin-top:14px;">
        <span>Total Tagihan</span>
        <strong id="gcTotal">${fmtRupiah(st.reduce((t, s) => t + s.base, 0))}</strong>
      </div>
      <label>Uang Diterima (Rp)</label>
      <input type="number" id="gcReceived" min="0" step="1000" placeholder="Contoh: 200000" inputmode="numeric">
      <div class="cashier-row cashier-change">
        <span>Kembalian</span>
        <strong id="gcChange">Rp0</strong>
      </div>
      <div id="gcMsg"></div>
      <div class="cashier-actions">
        <button class="btn-ghost" onclick="closeCashier()">Batal</button>
        <button class="btn-primary" style="margin-top:0;" id="gcSubmit">Selesaikan Semua & Simpan</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const $ = el => document.getElementById(el);
  const fmtPct = n => String(Math.round(n * 10) / 10).replace('.', ',');
  const pctVal = s => Math.min(Math.max(parseFloat($('gcPct' + s.b.id).value) || 0, 0), 100);
  const amt = s => s.src === 'pct' ? Math.round(s.base * pctVal(s) / 100)
                 : s.src === 'rp'  ? Math.min(Math.max(parseInt($('gcRp' + s.b.id).value) || 0, 0), s.base)
                 : 0;
  const fee = s => s.hc ? homecareFeeOf($('gcKm' + s.b.id).value) : 0;
  const sub = s => s.base - amt(s) + fee(s);   // diskon hanya untuk harga layanan; biaya jarak di luar diskon
  const grand = () => st.reduce((t, s) => t + sub(s), 0);
  // kolom discount_percent di database bilangan bulat: persen desimal / diskon rupiah disimpan 0 (nominalnya tetap tercatat di final_total)
  const storedPct = s => { if(s.src !== 'pct') return 0; const p = pctVal(s); return Number.isInteger(p) ? p : 0; };

  function recalc(){
    st.forEach(s => {
      $('gcSub' + s.b.id).textContent = fmtRupiah(sub(s));
      if(s.hc){
        const km = parseFloat(String($('gcKm' + s.b.id).value).replace(',', '.')) || 0;
        $('gcFee' + s.b.id).textContent = km > 0 ? `Biaya jarak: ${fmtKm(km)} km x ${fmtRupiah(HOMECARE_RATE_PER_KM)} = ${fmtRupiah(fee(s))}` : `Biaya jarak ${fmtRupiah(HOMECARE_RATE_PER_KM)} / km`;
      }
    });
    const total = grand();
    $('gcTotal').textContent = fmtRupiah(total);
    const received = parseInt($('gcReceived').value) || 0;
    $('gcChange').textContent = fmtRupiah(Math.max(received - total, 0));
  }

  st.forEach(s => { if(s.hc) $('gcKm' + s.b.id).addEventListener('input', recalc); });
  st.forEach(s => {
    const pEl = $('gcPct' + s.b.id), rEl = $('gcRp' + s.b.id), hEl = $('gcHint' + s.b.id);
    pEl.addEventListener('input', () => {
      if(pEl.value === ''){ s.src = null; rEl.value = ''; hEl.textContent = ''; recalc(); return; }
      s.src = 'pct';
      if(parseFloat(pEl.value) > 100) pEl.value = 100;
      if(parseFloat(pEl.value) < 0) pEl.value = 0;
      const a = amt(s);
      rEl.value = a > 0 ? a : '';
      hEl.textContent = a > 0 ? 'Potongan ' + fmtRupiah(a) : '';
      recalc();
    });
    rEl.addEventListener('input', () => {
      if(rEl.value === ''){ s.src = null; pEl.value = ''; hEl.textContent = ''; recalc(); return; }
      s.src = 'rp';
      let rp = parseInt(rEl.value) || 0, note = '';
      if(rp > s.base){ rp = s.base; rEl.value = rp; note = 'Dibatasi sampai harga layanan. '; }
      if(rp < 0){ rp = 0; rEl.value = 0; }
      pEl.value = (rp > 0 && s.base > 0) ? String(Math.round(rp / s.base * 1000) / 10) : '';
      hEl.textContent = note + ((rp > 0 && s.base > 0) ? '≈ ' + fmtPct(rp / s.base * 100) + '%' : '');
      recalc();
    });
  });
  $('gcReceived').addEventListener('input', recalc);
  recalc();

  $('gcSubmit').addEventListener('click', async () => {
    const total = grand();
    const received = parseInt($('gcReceived').value) || 0;
    const msgEl = $('gcMsg');
    if(received < total){
      msgEl.innerHTML = '<div class="notice danger">Uang yang diterima belum mencukupi total tagihan.</div>';
      return;
    }
    const btn = $('gcSubmit');
    btn.disabled = true;
    // jendela struk dibuka SEKARANG (masih dalam klik), supaya tidak diblokir browser setelah proses simpan
    const receiptWin = window.open('', '_blank', 'width=380,height=680');
    const payload = {
      action: 'group_payment',
      cash_received: received,
      items: st.map(s => {
        const it = { id: s.b.id, discount_percent: storedPct(s), final_total: sub(s) };
        if(s.hc) it.homecare_km = $('gcKm' + s.b.id).value === '' ? 0 : $('gcKm' + s.b.id).value;
        return it;
      }),
    };
    try{
      const res = await fetch(API_BOOKINGS, {
        method: 'PUT',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok){
        msgEl.innerHTML = `<div class="notice danger">${escapeHtml(data.error || 'Gagal menyimpan transaksi.')}</div>`;
        btn.disabled = false;
        if(receiptWin) receiptWin.close();
        return;
      }
      closeCashier();
      await renderBookingList();
      if(document.getElementById('sub-loyalty').style.display !== 'none') renderLoyaltyList();
      openGroupReceipt(st[0].b.id, receiptWin);
    }catch(e){
      msgEl.innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
      btn.disabled = false;
      if(receiptWin) receiptWin.close();
    }
  });
}

function closeCashier(){
  const overlay = document.querySelector('.cashier-overlay');
  if(overlay) overlay.remove();
}

async function setStatus(id, status){
  const res = await fetch(API_BOOKINGS, {
    method: 'PUT',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({id, status})
  });
  if(res.ok){
    await renderBookingList();
    if(document.getElementById('sub-loyalty').style.display !== 'none') renderLoyaltyList();
    if(status === 'confirmed'){
      // Begitu dikonfirmasi, langsung buka WA ke orang tua dengan draft pesan konfirmasi
      openBookingWhatsApp(id);
    }
  } else {
    const data = await res.json();
    alert(data.error || 'Gagal mengubah status.');
  }
}

async function deleteBooking(id){
  if(!confirm('Hapus reservasi ini?')) return;
  await fetch(`${API_BOOKINGS}?id=${id}`, {method:'DELETE'});
  renderBookingList();
}

/* =========================================================
   LOYALTY
========================================================= */
async function renderLoyaltyList(){
  const list = document.getElementById('loyaltyList');
  list.innerHTML = '<div class="notice info">Memuat...</div>';
  try{
    const res = await fetch(API_LOYALTY);
    const entries = await res.json();
    loyaltyListCache = entries;

    if(!Array.isArray(entries) || entries.length===0){
      list.innerHTML = childCountBar('Jumlah anak: 0') + '<div class="notice info">Belum ada sesi yang selesai dicatat.</div>';
      return;
    }

    const totalSessions = entries.reduce((a, e) => a + Number(e.completed_count || 0), 0);
    list.innerHTML = childCountBar(`Jumlah anak: ${entries.length}`, `${totalSessions} sesi selesai`) + entries.map((e, idx)=>{
      const inCycle = e.completed_count % SESSIONS_PER_REWARD;
      const pct = Math.round((inCycle/SESSIONS_PER_REWARD)*100);
      const rewards = Math.floor(e.completed_count / SESSIONS_PER_REWARD) - e.rewards_redeemed;
      return `<div class="loyalty-item">
        <div class="loyalty-top">
          <div><strong>${escapeHtml(e.baby_name)}</strong> (${escapeHtml(e.name || 'tanpa nama ortu')}, ${escapeHtml(e.phone)})</div>
          <div class="mono">${e.completed_count} sesi selesai</div>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="hint">${inCycle}/${SESSIONS_PER_REWARD} sesi menuju gratis berikutnya</div>
        <div class="booking-actions" style="margin-top:10px;">
          <button class="btn-small btn-edit" onclick="openLoyaltyEdit(${idx})">✏️ Edit</button>
          <button class="btn-small btn-del" onclick="deleteLoyalty(${idx})">🗑 Hapus</button>
        </div>
        ${rewards > 0 ? `
          <div class="reward-banner">🎁 ${rewards} sesi gratis tersedia
            <button class="btn-small btn-wa" style="margin-left:auto;" onclick="notifyLoyaltyWhatsApp(${idx})">💬 Kabari WA</button>
            <button class="btn-small" style="background:#3A0E22;color:#fff;" onclick="redeemReward(${idx})">Tandai Terpakai</button>
          </div>` : ''}
      </div>`;
    }).join('');
  }catch(e){
    list.innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
  }
}

async function redeemReward(idx){
  const e = loyaltyListCache[idx];
  if(!e){ alert('Data tidak ditemukan, coba muat ulang daftarnya.'); return; }
  const res = await fetch(API_LOYALTY, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({phone: e.phone, baby_name: e.baby_name, baby_dob: e.baby_dob})
  });
  if(res.ok){
    renderLoyaltyList();
  } else {
    const data = await res.json();
    alert(data.error || 'Gagal menandai reward.');
  }
}

/* ---- Edit & hapus data loyalitas (untuk membereskan data percobaan/salah input) ---- */
function openLoyaltyEdit(idx){
  const e = loyaltyListCache[idx];
  if(!e){ alert('Data tidak ditemukan, coba muat ulang daftarnya.'); return; }
  document.getElementById('l_idx').value = idx;
  document.getElementById('l_who').textContent = `${e.baby_name} · ${e.phone}`;
  document.getElementById('l_name').value = e.name || '';
  document.getElementById('l_count').value = e.completed_count;
  document.getElementById('l_redeemed').value = e.rewards_redeemed;
  document.getElementById('l_msg').innerHTML = '';
  document.getElementById('l_saveBtn').disabled = false;
  updateLoyaltyHint();
  document.getElementById('loyaltyModal').style.display = 'flex';
}

function closeLoyaltyEdit(){
  document.getElementById('loyaltyModal').style.display = 'none';
}

function updateLoyaltyHint(){
  const c = parseInt(document.getElementById('l_count').value, 10) || 0;
  const earned = Math.floor(c / SESSIONS_PER_REWARD);
  document.getElementById('l_hint').textContent =
    `Dengan ${c} sesi, reward yang diperoleh: ${earned} (maksimal reward terpakai = ${earned}). Progres: ${c % SESSIONS_PER_REWARD}/${SESSIONS_PER_REWARD}.`;
}
document.getElementById('l_count').addEventListener('input', updateLoyaltyHint);

document.addEventListener('keydown', ev=>{
  if(ev.key === 'Escape' && document.getElementById('loyaltyModal').style.display !== 'none') closeLoyaltyEdit();
});

async function saveLoyaltyEdit(){
  const e = loyaltyListCache[parseInt(document.getElementById('l_idx').value, 10)];
  const msg = document.getElementById('l_msg');
  const btn = document.getElementById('l_saveBtn');
  if(!e){ msg.innerHTML = '<div class="notice danger" style="margin-top:10px;">Data tidak ditemukan, muat ulang daftarnya.</div>'; return; }
  btn.disabled = true;
  try{
    const res = await fetch(API_LOYALTY, {
      method: 'PUT',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        phone: e.phone, baby_name: e.baby_name, baby_dob: e.baby_dob,
        name: document.getElementById('l_name').value,
        completed_count: document.getElementById('l_count').value,
        rewards_redeemed: document.getElementById('l_redeemed').value
      })
    });
    const d = await res.json().catch(()=>({}));
    if(!res.ok){
      msg.innerHTML = `<div class="notice danger" style="margin-top:10px;">${escapeHtml(d.error || 'Gagal menyimpan.')}</div>`;
      btn.disabled = false;
      return;
    }
    closeLoyaltyEdit();
    renderLoyaltyList();
  }catch(err){
    msg.innerHTML = '<div class="notice danger" style="margin-top:10px;">Tidak bisa terhubung ke server.</div>';
    btn.disabled = false;
  }
}

async function deleteLoyalty(idx){
  const e = loyaltyListCache[idx];
  if(!e){ alert('Data tidak ditemukan, coba muat ulang daftarnya.'); return; }
  if(!confirm(`Hapus data loyalitas ${e.baby_name} (${e.phone})?\n\nHanya hitungan sesi & reward yang dihapus. Riwayat reservasinya tetap ada. Tindakan ini tidak bisa dibatalkan.`)) return;
  try{
    const qs = new URLSearchParams({phone: e.phone, baby_name: e.baby_name, baby_dob: e.baby_dob});
    const res = await fetch(`${API_LOYALTY}?${qs.toString()}`, {method:'DELETE'});
    if(!res.ok){
      const d = await res.json().catch(()=>({}));
      alert(d.error || 'Gagal menghapus data loyalitas.');
      return;
    }
    renderLoyaltyList();
  }catch(err){
    alert('Tidak bisa terhubung ke server.');
  }
}

function notifyLoyaltyWhatsApp(idx){
  const e = loyaltyListCache[idx];
  if(!e){ alert('Data tidak ditemukan, coba muat ulang daftarnya.'); return; }

  const rewards = Math.floor(e.completed_count / SESSIONS_PER_REWARD) - e.rewards_redeemed;
  const parentName = e.name || 'Bunda/Ayah';
  const message = `Halo ${parentName}, kabar baik dari Blue Haven Baby & Kids Spa 🎉🌊\n\n`
    + `Terima kasih sudah rutin membawa ${e.baby_name} ke tempat kami! Sekarang ${e.baby_name} sudah menyelesaikan ${e.completed_count} sesi, dan berhak mendapatkan ${rewards} sesi pijat/spa GRATIS 🎁.\n\n`
    + `Silakan hubungi kami untuk jadwalkan sesi gratisnya ya. Ditunggu kedatangannya kembali!`;

  const link = waLink(e.phone, message);
  window.open(link, '_blank');
}

// Jika sudah login (cookie masih berlaku), langsung muat data
if (typeof ADMIN_LOGGED_IN !== 'undefined' && ADMIN_LOGGED_IN) {
  loadServices().then(()=>{ renderBookingList(); renderServiceAdminList(); });
}


/* =========================================================
   PENDAPATAN — harian / bulanan / tahunan + grafik
========================================================= */
const API_REVENUE = 'api/revenue.php';
let revPeriod = 'daily';
let revChart = null;
let revData = null;
let revInited = false;

function revMonthNow(){ return localDateStr().slice(0,7); }

function initRevenue(){
  if(!revInited){
    revInited = true;
    document.getElementById('revMonth').value = revMonthNow();

    const ySel = document.getElementById('revYear');
    const thisYear = new Date().getFullYear();
    for(let y = thisYear; y >= thisYear - 5; y--){
      const o = document.createElement('option'); o.value = y; o.textContent = y; ySel.appendChild(o);
    }

    document.querySelectorAll('#revPeriodTabs button').forEach(b=>{
      b.addEventListener('click', ()=>{
        document.querySelectorAll('#revPeriodTabs button').forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        revPeriod = b.dataset.period;
        document.getElementById('revMonth').style.display = revPeriod==='daily'   ? '' : 'none';
        document.getElementById('revYear').style.display  = revPeriod==='monthly' ? '' : 'none';
        loadRevenue();
      });
    });
    document.getElementById('revMonth').addEventListener('change', loadRevenue);
    document.getElementById('revYear').addEventListener('change', loadRevenue);
  }
  loadRevenue();
}

async function loadRevenue(){
  const msg = document.getElementById('revChartMsg');
  msg.innerHTML = '';
  const params = new URLSearchParams({period: revPeriod});
  if(revPeriod==='daily')   params.set('month', document.getElementById('revMonth').value || revMonthNow());
  if(revPeriod==='monthly') params.set('year',  document.getElementById('revYear').value);

  try{
    const res = await fetch(`${API_REVENUE}?${params.toString()}`);
    const d = await res.json();
    if(res.status === 403 && d.owner_locked){ revCheckGate(); return; }
    if(!res.ok){ msg.innerHTML = `<div class="notice danger">${escapeHtml(d.error || 'Gagal memuat pendapatan.')}</div>`; return; }
    revData = d;
    renderRevenueCards(d);
    renderRevenueSummary(d);
    renderRevenueChart(d);
    renderRevenueBreakdown(d);
    renderRevenueTable(d);
  }catch(e){
    msg.innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
  }
}

function renderRevenueCards(d){
  const c = d.cards;
  document.getElementById('revCards').innerHTML = [
    ['Hari Ini', c.today, `${c.today_trx} transaksi`],
    ['Bulan Ini', c.month, ''],
    ['Tahun Ini', c.year, ''],
    ['Total Keseluruhan', c.all, ''],
  ].map(([label, val, sub])=>`
    <div class="rev-card">
      <div class="rev-card-label">${label}</div>
      <div class="rev-card-value">${fmtRupiah(val)}</div>
      ${sub ? `<div class="rev-card-sub">${sub}</div>` : ''}
    </div>`).join('');
}

function revPeriodTitle(d){
  if(d.period==='daily'){
    const [y,m] = d.range.from.split('-');
    const bln = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    return `${bln[parseInt(m)-1]} ${y}`;
  }
  if(d.period==='monthly') return `Tahun ${d.range.from.slice(0,4)}`;
  return 'Semua Tahun';
}

function renderRevenueSummary(d){
  const s = d.summary;
  const unit = d.period==='daily' ? 'Hari' : d.period==='monthly' ? 'Bulan' : 'Tahun';
  const bestTxt = s.best ? `${s.best.label}${d.period==='daily' ? ' ' + revPeriodTitle(d) : ''} (${fmtRupiah(s.best.total)})` : '-';
  document.getElementById('revSummary').innerHTML = `
    <div><span>Periode</span><strong>${revPeriodTitle(d)}</strong></div>
    <div><span>Total Pendapatan</span><strong>${fmtRupiah(s.total)}</strong></div>
    <div><span>Jumlah Transaksi</span><strong>${s.trx}</strong></div>
    <div><span>Rata-rata / Transaksi</span><strong>${fmtRupiah(s.average)}</strong></div>
    <div><span>${unit} Terbaik</span><strong>${bestTxt}</strong></div>`;
}

function renderRevenueChart(d){
  const msg = document.getElementById('revChartMsg');
  if(typeof Chart === 'undefined'){
    msg.innerHTML = '<div class="notice warn">Library grafik (Chart.js) gagal dimuat — cek koneksi internet. Angka di bawah tetap bisa dilihat di tabel Rincian.</div>';
    return;
  }
  const labels = d.series.map(p=>p.label);
  const totals = d.series.map(p=>p.total);
  const trx    = d.series.map(p=>p.trx);
  const css = getComputedStyle(document.documentElement);
  const colBar  = (css.getPropertyValue('--sage') || '#3E97E8').trim();
  const colLine = (css.getPropertyValue('--sage-deep') || '#1E6FC4').trim();

  if(revChart) revChart.destroy();
  revChart = new Chart(document.getElementById('revChart'), {
    data: {
      labels,
      datasets: [
        { type:'bar',  label:'Pendapatan (Rp)', data: totals, backgroundColor: colBar + 'CC', borderRadius:6, yAxisID:'y', order:2 },
        { type:'line', label:'Jumlah transaksi', data: trx, borderColor: colLine, backgroundColor: colLine,
          tension:0.3, pointRadius:3, borderWidth:2, yAxisID:'y1', order:1 },
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{
        legend:{ position:'bottom' },
        tooltip:{ callbacks:{ label: ctx => ctx.dataset.yAxisID==='y'
          ? ' Pendapatan: ' + fmtRupiah(ctx.parsed.y)
          : ' Transaksi: ' + ctx.parsed.y } }
      },
      scales:{
        y:  { beginAtZero:true, ticks:{ callback: v => v >= 1e6 ? (v/1e6) + ' jt' : v >= 1e3 ? (v/1e3) + ' rb' : v } },
        y1: { beginAtZero:true, position:'right', grid:{ drawOnChartArea:false }, ticks:{ precision:0 } },
        x:  { grid:{ display:false } }
      }
    }
  });
}

function renderRevenueBreakdown(d){
  const names = {cash:'Tunai', qris:'QRIS', transfer:'Transfer'};
  const total = d.summary.total || 0;

  const bar = (label, val, trx) => {
    const pct = total > 0 ? Math.round(val / total * 100) : 0;
    return `<div style="margin-bottom:12px;">
      <div style="display:flex; justify-content:space-between; gap:8px; font-size:0.86rem;">
        <span>${escapeHtml(label)} <span class="mono" style="opacity:.7;">· ${trx}x</span></span>
        <strong>${fmtRupiah(val)} <span class="mono" style="opacity:.7;">(${pct}%)</span></strong>
      </div>
      <div class="rev-bar"><i style="width:${pct}%"></i></div>
    </div>`;
  };

  document.getElementById('revMethod').innerHTML = d.by_method.length
    ? d.by_method.map(m => bar(names[m.method] || m.method, m.total, m.trx)).join('')
    : '<div class="hint">Belum ada data pada periode ini.</div>';

  document.getElementById('revTop').innerHTML = d.top_services.length
    ? d.top_services.map(s => bar(s.name, s.total, s.trx)).join('')
    : '<div class="hint">Belum ada data pada periode ini.</div>';
}

function renderRevenueTable(d){
  const head = d.period==='daily' ? 'Tanggal' : d.period==='monthly' ? 'Bulan' : 'Tahun';
  const rows = d.series.map(p=>{
    const lbl = d.period==='daily' ? p.key.split('-').reverse().join('/') : p.label;
    return `<tr class="${p.total===0 ? 'rev-zero' : ''}"><td>${escapeHtml(lbl)}</td><td>${p.trx}</td><td>${fmtRupiah(p.total)}</td></tr>`;
  }).join('');
  document.getElementById('revTable').innerHTML = `
    <thead><tr><th>${head}</th><th>Transaksi</th><th>Pendapatan</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td>Total</td><td>${d.summary.trx}</td><td>${fmtRupiah(d.summary.total)}</td></tr></tfoot>`;
}

function downloadRevenueCSV(){
  if(!revData){ return; }
  const head = revData.period==='daily' ? 'Tanggal' : revData.period==='monthly' ? 'Bulan' : 'Tahun';
  const lines = [[head,'Transaksi','Pendapatan'].join(',')]
    .concat(revData.series.map(p => [p.key, p.trx, p.total].join(',')))
    .concat([['TOTAL', revData.summary.trx, revData.summary.total].join(',')]);
  const blob = new Blob(['\ufeff' + lines.join('\n')], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pendapatan-${revData.period}-${revData.range.from.slice(0, revData.period==='daily' ? 7 : 4)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}


/* =========================================================
   KUNCI OWNER untuk menu Pendapatan
========================================================= */
const API_OWNER = 'api/owner.php';
let revGateMode = 'unlock'; // unlock | setup | change

function revShowContent(){
  document.getElementById('revGate').style.display = 'none';
  document.getElementById('revContent').style.display = 'block';
}

async function revCheckGate(){
  document.getElementById('revContent').style.display = 'none';
  document.getElementById('revGate').style.display = 'block';
  try{
    const res = await fetch(API_OWNER, {cache:'no-store'});
    const d = await res.json();
    if(d.unlocked){ revShowContent(); initRevenue(); return; }
    revGateMode_set(d.configured ? 'unlock' : 'setup');
  }catch(e){
    document.getElementById('revGateMsg').innerHTML = '<div class="notice danger">Tidak bisa terhubung ke server.</div>';
  }
}

function revGateMode_set(mode){
  revGateMode = mode;
  document.getElementById('revContent').style.display = 'none';
  document.getElementById('revGate').style.display = 'block';
  const p1 = document.getElementById('revGatePw1'), p2 = document.getElementById('revGatePw2'), p3 = document.getElementById('revGatePw3');
  [p1,p2,p3].forEach(i=>i.value='');
  document.getElementById('revGateMsg').innerHTML = '';
  document.getElementById('revGateCancel').style.display = mode === 'change' ? '' : 'none';
  p2.style.display = p3.style.display = 'none';
  if(mode === 'unlock'){
    document.getElementById('revGateTitle').textContent = 'Khusus Owner';
    document.getElementById('revGateDesc').textContent = 'Menu Pendapatan dikunci. Masukkan password owner untuk membukanya.';
    p1.placeholder = 'Password owner';
    document.getElementById('revGateBtn').textContent = 'Buka';
  } else if(mode === 'setup'){
    document.getElementById('revGateTitle').textContent = 'Buat Password Owner';
    document.getElementById('revGateDesc').textContent = 'Belum ada password owner. Buat sekarang (minimal 6 karakter, harus berbeda dari password admin). Jangan dibagikan ke karyawan.';
    p1.placeholder = 'Password owner baru';
    p2.placeholder = 'Ulangi password owner';
    p2.style.display = '';
    document.getElementById('revGateBtn').textContent = 'Simpan Password';
  } else {
    document.getElementById('revGateTitle').textContent = 'Ubah Password Owner';
    document.getElementById('revGateDesc').textContent = 'Masukkan password owner yang lama, lalu password barunya.';
    p1.placeholder = 'Password owner lama';
    p2.placeholder = 'Password owner baru';
    p3.placeholder = 'Ulangi password baru';
    p2.style.display = p3.style.display = '';
    document.getElementById('revGateBtn').textContent = 'Ubah Password';
  }
  p1.focus();
}

async function revGateSubmit(){
  const v1 = document.getElementById('revGatePw1').value;
  const v2 = document.getElementById('revGatePw2').value;
  const v3 = document.getElementById('revGatePw3').value;
  const msg = document.getElementById('revGateMsg');
  const fail = t => { msg.innerHTML = `<div class="notice danger">${escapeHtml(t)}</div>`; };
  let body;
  if(revGateMode === 'unlock'){
    if(!v1) return fail('Masukkan password owner.');
    body = {action:'unlock', password:v1};
  } else if(revGateMode === 'setup'){
    if(v1.length < 6) return fail('Password minimal 6 karakter.');
    if(v1 !== v2) return fail('Ulangi password tidak sama.');
    body = {action:'setup', password:v1};
  } else {
    if(!v1) return fail('Masukkan password owner yang lama.');
    if(v2.length < 6) return fail('Password baru minimal 6 karakter.');
    if(v2 !== v3) return fail('Ulangi password baru tidak sama.');
    body = {action:'change', password:v1, new_password:v2};
  }
  try{
    const res = await fetch(API_OWNER, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
    const d = await res.json();
    if(!res.ok) return fail(d.error || 'Gagal.');
    revShowContent();
    initRevenue();
    if(revGateMode !== 'unlock') alert(revGateMode === 'setup' ? 'Password owner berhasil dibuat.' : 'Password owner berhasil diubah.');
  }catch(e){ fail('Tidak bisa terhubung ke server.'); }
}

async function revLock(){
  try{ await fetch(API_OWNER, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'lock'})}); }catch(e){}
  revCheckGate();
}

['revGatePw1','revGatePw2','revGatePw3'].forEach(id=>{
  document.getElementById(id).addEventListener('keydown', e=>{ if(e.key==='Enter') revGateSubmit(); });
});
