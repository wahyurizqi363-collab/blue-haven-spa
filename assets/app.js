const API_SERVICES = 'api/services.php';
const API_BOOKINGS = 'api/bookings.php';
const API_LOYALTY  = 'api/loyalty.php';
const API_GROWTH   = 'api/growth.php';
const API_SETTINGS = 'api/settings.php';

let appSettings = {};
const SESSIONS_PER_REWARD = 10;

let services = [];
let currentServiceCategory = 'newborn';
const CATEGORY_LABELS = {
  newborn: 'Newborn Care (0-30 Hari)',
  newborn_pkg: 'Paket Newborn Care',
  baby: 'Baby Treatment (0-24 Bulan)',
  therapy: 'Baby & Kids Therapy',
  kids: 'Kids Treatment (2 Tahun ke Atas)',
  mom: 'Mom Care (Home Care)',
  traditional: 'Traditional Care'
};

// Catatan yang tampil di atas daftar layanan untuk kategori tertentu
const HOME_CARE_NOTE = 'Semua layanan bisa Home Care. Biaya transportasi Rp3.500 / km.';
const CATEGORY_NOTES = {
  newborn_pkg: HOME_CARE_NOTE + ' Paket Istimewa 15 & 30 hari mendapat bonus cukur gundul 1x.'
};

// Durasi angka -> "20-30 menit"; teks lain (mis. "7 Hari") tampil apa adanya; "-" disembunyikan
function fmtDuration(d){
  const v = String(d == null ? '' : d).trim();
  if(!v || v === '-') return '';
  return /^[\d\s\-–]+$/.test(v) ? v + ' menit' : v;
}

function fmtRupiah(n){ return 'Rp' + Number(n).toLocaleString('id-ID'); }

/* =========================================================
   TAB NAVIGATION
========================================================= */
function switchTab(name){
  document.querySelectorAll('.tabfolder button').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-'+name).classList.add('active');
}
document.getElementById('tabfolder').addEventListener('click', e=>{
  const btn = e.target.closest('button[data-tab]');
  if(btn) switchTab(btn.dataset.tab);
});

/* =========================================================
   SERVICES
========================================================= */
document.getElementById('serviceCatTabs').addEventListener('click', e=>{
  const btn = e.target.closest('button[data-cat]');
  if(!btn) return;
  document.querySelectorAll('#serviceCatTabs button').forEach(b=>b.classList.toggle('active', b===btn));
  currentServiceCategory = btn.dataset.cat;
  renderServiceGrid();
});

function renderServiceGrid(){
  const grid = document.getElementById('serviceGrid');
  const filtered = services.filter(s => s.category === currentServiceCategory);
  if(filtered.length === 0){
    grid.innerHTML = '<div class="notice info">Belum ada layanan di kategori ini.</div>';
    return;
  }
  const note = `<div class="svc-note"><span class="svc-note-ic">🏠</span><div>${escapeHtml(CATEGORY_NOTES[currentServiceCategory] || HOME_CARE_NOTE)}</div></div>`;
  grid.innerHTML = note + filtered.map(s=>`
    <div class="service">
      <h3>${escapeHtml(s.name)}</h3>
      ${fmtDuration(s.duration) ? `<div class="meta"><span class="svc-dur">⏱ ${escapeHtml(fmtDuration(s.duration))}</span></div>` : ''}
      <p>${escapeHtml(s.description||'')}</p>
      <div class="svc-foot">
        <span class="svc-home">🏠 Bisa Home Care</span>
        <span class="price">${fmtRupiah(s.price)}</span>
      </div>
    </div>`).join('');
}
function serviceOptionsHtml(selectedId){
  const groups = {newborn:[], newborn_pkg:[], baby:[], therapy:[], kids:[], mom:[], traditional:[]};
  services.forEach(s => { if(groups[s.category]) groups[s.category].push(s); });
  return Object.entries(groups).map(([cat, list])=>{
    if(list.length === 0) return '';
    const options = list.map(s=>{
      const dur = fmtDuration(s.duration);
      const sel = selectedId != null && Number(s.id) === Number(selectedId) ? ' selected' : '';
      return `<option value="${s.id}"${sel}>${escapeHtml(s.name)}${dur ? ' (' + escapeHtml(dur) + ')' : ''} — ${fmtRupiah(s.price)}</option>`;
    }).join('');
    return `<optgroup label="${CATEGORY_LABELS[cat]}">${options}</optgroup>`;
  }).join('');
}
// Dipanggil tiap daftar layanan dimuat ulang: segarkan semua pilihan layanan tanpa menghapus pilihan yang sudah dibuat
function renderServiceSelect(){
  document.querySelectorAll('#b_kids .bk-service').forEach(sel=>{
    const prev = sel.value;
    sel.innerHTML = serviceOptionsHtml();
    if(prev && sel.querySelector(`option[value="${prev}"]`)) sel.value = prev;
  });
}
// Jam buka 08.00-16.00 (istirahat 12.00-13.00). Tiap jam tersedia 2 slot karena ada 2 terapis.
const TIME_SLOTS = ['08:00','09:00','10:00','11:00','13:00','14:00','15:00'];
const MAX_PER_SLOT = 2;

let slotCounts = {};
let slotMax = MAX_PER_SLOT;
let slotToday = '';   // tanggal hari ini menurut server (WIB)
let slotNow = '';     // jam sekarang menurut server (HH:MM)

function pad2(n){ return String(n).padStart(2, '0'); }
// Slot hangus: tanggal yang dipilih = hari ini dan jam slot sudah tiba/terlewat
function isSlotExpired(t){
  const date = document.getElementById('b_date').value;
  const d = new Date();
  const today = slotToday || `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const now = slotNow || `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if(!date) return false;
  if(date < today) return true;
  return date === today && t <= now;
}

// Setiap anak punya pilihan jam sendiri. Sisa slot sudah dikurangi anak lain yang memilih jam yang sama di form ini.
function renderTimeOptions(counts, max, clock){
  if(counts) slotCounts = counts;
  if(max) slotMax = max;
  if(clock){ slotToday = clock.today || slotToday; slotNow = clock.now || slotNow; }
  const sels = Array.from(document.querySelectorAll('#b_kids .bk-time'));
  const chosen = sels.map(x => x.value);
  sels.forEach((sel, i)=>{
    const prev = chosen[i];
    const others = {};
    chosen.forEach((v, j)=>{ if(j !== i && v) others[v] = (others[v] || 0) + 1; });
    sel.innerHTML = TIME_SLOTS.map(t=>{
      if(isSlotExpired(t)) return `<option value="${t}" disabled>${t} — Sudah lewat</option>`;
      const left = Math.max(0, slotMax - (slotCounts[t] || 0) - (others[t] || 0));
      const label = left === 0 ? 'Penuh' : (left === slotMax ? `${left} slot tersedia` : `sisa ${left} slot`);
      return `<option value="${t}" ${left === 0 ? 'disabled' : ''}>${t} — ${label}</option>`;
    }).join('');
    const keep = prev && Array.from(sel.options).some(o => o.value === prev && !o.disabled);
    if(keep) sel.value = prev;
    chosen[i] = sel.value;
  });
}

async function refreshTimeSlots(){
  const date = document.getElementById('b_date').value;
  if(!date){ renderTimeOptions({}, MAX_PER_SLOT); return; }
  try{
    const res = await fetch(`${API_BOOKINGS}?availability=1&date=${encodeURIComponent(date)}`);
    const data = await res.json();
    renderTimeOptions(data.counts || {}, data.max || MAX_PER_SLOT, {today: data.today, now: data.now});
  }catch(err){
    renderTimeOptions({}, MAX_PER_SLOT);
  }
}
document.getElementById('b_date').addEventListener('change', refreshTimeSlots);
setInterval(()=>{ if(!document.hidden && document.getElementById('b_date').value) refreshTimeSlots(); }, 60000);
function escapeHtml(str){
  const d = document.createElement('div');
  d.innerText = str;
  return d.innerHTML;
}

/* =========================================================
   BOOKING FORM
========================================================= */
document.getElementById('b_date').min = new Date().toISOString().split('T')[0];

/* ---- Isian per anak (sama dengan form "Daftar Pijat Langsung" di admin) ---- */
const MAX_KIDS = 4;

function kidHTML(){
  return `<div class="b-kid" style="border:1px dashed var(--line);border-radius:12px;padding:12px;margin-top:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <strong class="b-kid-title">Anak 1</strong>
      <button type="button" class="btn-small btn-del b-kid-remove">Hapus</button>
    </div>
    <div class="row2">
      <div><label>Nama Bayi/Balita</label><input type="text" class="bk-name" required></div>
      <div><label>Tanggal Lahir</label><input type="date" class="bk-dob" required></div>
    </div>
    <div class="row2">
      <div><label>Jenis Kelamin</label>
        <select class="bk-sex"><option value="">- pilih -</option><option value="boy">Laki-laki</option><option value="girl">Perempuan</option></select></div>
      <div></div>
    </div>
    <div class="row2">
      <div><label>Berat Badan (kg)</label><input type="number" class="bk-weight" step="0.01" min="0" inputmode="decimal" placeholder="mis. 7.5"></div>
      <div><label>Tinggi Badan (cm)</label><input type="number" class="bk-height" step="0.1" min="0" inputmode="decimal" placeholder="mis. 65"></div>
    </div>
    <p class="hint" style="margin:4px 0 0;">Berat &amp; tinggi opsional. Kalau diisi, otomatis masuk Riwayat Tumbuh Kembang (jenis kelamin wajib). Anak di atas 60 bulan (5 tahun ke atas): isi <strong>jenis kelamin, tanggal lahir, berat (kg) &amp; tinggi (cm)</strong> — IMT dihitung otomatis untuk penilaian IMT/U.</p>
    <label>Layanan</label>
    <div class="bk-services"></div>
    <button type="button" class="btn-small btn-edit bk-add-svc" style="margin-top:8px;">+ Tambah layanan</button>
    <label>Jam</label>
    <select class="bk-time" required></select>
  </div>`;
}

function addServiceRow(box, selectedId){
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;margin-top:6px;align-items:center;';
  const removable = box.children.length > 0;
  row.innerHTML = `<select class="bk-service" required style="flex:1;min-width:0;">${serviceOptionsHtml(selectedId)}</select>`
    + (removable ? '<button type="button" class="btn-small btn-del" title="Hapus layanan ini">✕</button>' : '');
  box.appendChild(row);
  const rm = row.querySelector('button');
  if(rm) rm.onclick = () => row.remove();
}

function renumberKids(){
  const kids = document.querySelectorAll('#b_kids .b-kid');
  kids.forEach((el, i)=>{
    el.querySelector('.b-kid-title').textContent = 'Anak ' + (i + 1);
    el.querySelector('.b-kid-remove').style.display = i === 0 ? 'none' : '';
  });
  document.getElementById('b_addKid').style.display = kids.length >= MAX_KIDS ? 'none' : '';
}

function addKid(){
  const box = document.getElementById('b_kids');
  if(box.children.length >= MAX_KIDS) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = kidHTML();
  const el = wrap.firstElementChild;
  box.appendChild(el);
  addServiceRow(el.querySelector('.bk-services'), null);
  el.querySelector('.bk-add-svc').onclick = () => addServiceRow(el.querySelector('.bk-services'), null);
  el.querySelector('.bk-time').addEventListener('change', () => renderTimeOptions());
  el.querySelector('.b-kid-remove').addEventListener('click', ()=>{ el.remove(); renumberKids(); renderTimeOptions(); });
  renumberKids();
  renderTimeOptions();
  if(box.children.length > 1) el.querySelector('.bk-name').focus();
}
document.getElementById('b_addKid').addEventListener('click', addKid);
addKid();

document.getElementById('bookingForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const msgEl = document.getElementById('bookingMsg');
  const submitBtn = e.target.querySelector('button[type=submit]');

  const kids = Array.from(document.querySelectorAll('#b_kids .b-kid')).map(el => ({
    baby_name: el.querySelector('.bk-name').value.trim(),
    baby_dob: el.querySelector('.bk-dob').value,
    service_ids: Array.from(el.querySelectorAll('.bk-service')).map(x => parseInt(x.value)).filter(Boolean),
    booking_time: el.querySelector('.bk-time').value,
    sex: el.querySelector('.bk-sex').value,
    weight: el.querySelector('.bk-weight').value.trim(),
    height: el.querySelector('.bk-height').value.trim(),
  }));

  for(let i = 0; i < kids.length; i++){
    const k = kids[i], who = kids.length > 1 ? `Anak ${i + 1}: ` : '';
    if(!k.service_ids.length || !k.booking_time){
      msgEl.innerHTML = `<div class="notice danger">${who}Pilih layanan dan jam terlebih dahulu.</div>`; return;
    }
    if(k.weight || k.height){
      if(!k.weight || !k.height){ msgEl.innerHTML = `<div class="notice danger">${who}Isi berat DAN tinggi badan, atau kosongkan keduanya.</div>`; return; }
      if(!k.sex){ msgEl.innerHTML = `<div class="notice danger">${who}Pilih jenis kelamin supaya tumbuh kembang bisa dicatat.</div>`; return; }
      if(Number(k.weight) <= 0 || Number(k.weight) > 120){ msgEl.innerHTML = `<div class="notice danger">${who}Berat badan tidak wajar (isi dalam kg, mis. 7.5).</div>`; return; }
      if(Number(k.height) < 20 || Number(k.height) > 200){ msgEl.innerHTML = `<div class="notice danger">${who}Tinggi badan tidak wajar (isi dalam cm, mis. 65).</div>`; return; }
    }
  }

  submitBtn.disabled = true;
  msgEl.innerHTML = '';

  const payload = {
    parent_name: document.getElementById('b_parent').value.trim(),
    phone: document.getElementById('b_phone').value.trim(),
    booking_date: document.getElementById('b_date').value,
    notes: document.getElementById('b_notes').value.trim(),
    kids,
  };
  // lebih dari 1 anak = 1 kunjungan (dibayar bersama, struk satu)
  if(kids.length > 1){
    payload.visit_id = ('V' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase().slice(0, 20);
  }

  try{
    const res = await fetch(API_BOOKINGS, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(()=>({}));

    if(!res.ok){
      msgEl.innerHTML = `<div class="notice danger">${escapeHtml(data.error || 'Gagal mengirim reservasi.')}</div>`;
      await refreshTimeSlots(); // sinkronkan lagi kalau ternyata jam sudah keburu diambil orang lain
    } else {
      const codes = (data.ids && data.ids.length ? data.ids : [data.id]).map(i => '#' + i).join(', ');
      msgEl.innerHTML = `<div class="notice ok">Reservasi terkirim! Kode booking kamu: <strong>${codes}</strong>. Kami akan konfirmasi lewat WhatsApp. Kamu bisa cek status kapan saja lewat tab "Cek Status Reservasi".</div>`;
      e.target.reset();
      document.getElementById('b_kids').innerHTML = '';
      addKid();
      document.getElementById('b_date').min = new Date().toISOString().split('T')[0];
      slotCounts = {};
      renderTimeOptions({}, MAX_PER_SLOT);
    }
  }catch(err){
    msgEl.innerHTML = `<div class="notice danger">Koneksi sedang bermasalah. Mohon coba lagi sebentar lagi, atau hubungi kami lewat WhatsApp.</div>`;
  }
  submitBtn.disabled = false;
});

/* =========================================================
   STATUS CHECK (customer)
========================================================= */
function statusLabel(s){
  const map = {pending:['Menunggu Konfirmasi','pending'], confirmed:['Dikonfirmasi','confirmed'], done:['Selesai','done'], cancelled:['Dibatalkan','cancelled']};
  return map[s] || ['-','pending'];
}

async function checkStatus(){
  const phone = document.getElementById('s_phone').value.trim();
  const result = document.getElementById('statusResult');
  if(!phone){ result.innerHTML = '<div class="notice warn">Masukkan nomor WhatsApp terlebih dahulu.</div>'; return; }

  result.innerHTML = '<div class="notice info">Mencari...</div>';

  try{
    const [bookingsRes, loyaltyRes] = await Promise.all([
      fetch(`${API_BOOKINGS}?phone=${encodeURIComponent(phone)}`),
      fetch(`${API_LOYALTY}?phone=${encodeURIComponent(phone)}`)
    ]);
    const found = await bookingsRes.json();
    const loyaltyEntries = await loyaltyRes.json(); // array: 1 baris per anak dari no. WA ini

    if(!Array.isArray(found) || found.length===0){
      result.innerHTML = '<div class="notice warn">Tidak ditemukan reservasi dengan nomor tersebut.</div>';
      return;
    }

    // Urutkan terbaru dulu di masing-masing kelompok
    const sorted = [...found].sort((a,b)=> new Date(b.booking_date+'T'+b.booking_time) - new Date(a.booking_date+'T'+a.booking_time));
    const upcoming = sorted.filter(b => b.status === 'pending' || b.status === 'confirmed');
    const history  = sorted.filter(b => b.status === 'done' || b.status === 'cancelled');

    const renderBookingRow = (b)=>{
      const [label, cls] = statusLabel(b.status);
      return `<div class="booking-item">
        <div class="info">
          <strong>${escapeHtml(b.baby_name)}</strong> — ${escapeHtml(b.service_name || '(layanan dihapus)')}<br>
          <div>${b.booking_date} · ${b.booking_time}</div>
        </div>
        <span class="badge ${cls}">${label}</span>
      </div>`;
    };

    let html = '';

    if(upcoming.length > 0){
      html += `<h3 class="section-title" style="font-size:1.05rem;">Reservasi Mendatang</h3>`;
      html += upcoming.map(renderBookingRow).join('');
    } else {
      html += `<div class="notice info">Tidak ada reservasi yang akan datang saat ini.</div>`;
    }

    if(history.length > 0){
      html += `<h3 class="section-title" style="font-size:1.05rem;margin-top:22px;">Riwayat Reservasi</h3>`;
      html += history.map(renderBookingRow).join('');
    }

    // Tampilkan 1 kartu Poin Loyalitas TERPISAH untuk setiap anak
    // (bukan digabung per nomor WA), sesuai kebijakan: gratis 1x per 10 sesi per anak.
    if(Array.isArray(loyaltyEntries) && loyaltyEntries.length > 0){
      const cards = loyaltyEntries
        .filter(e => e.completed_count > 0)
        .map(e=>{
          const inCycle = e.completed_count % SESSIONS_PER_REWARD;
          const pct = Math.round((inCycle/SESSIONS_PER_REWARD)*100);
          const rewards = Math.floor(e.completed_count / SESSIONS_PER_REWARD) - e.rewards_redeemed;
          return `<div class="loyalty-item">
            <div class="loyalty-top">
              <strong>Poin Loyalitas — ${escapeHtml(e.baby_name)}</strong>
              <span class="mono">${e.completed_count} sesi selesai</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="hint">${inCycle}/${SESSIONS_PER_REWARD} sesi menuju sesi gratis berikutnya</div>
            ${rewards > 0 ? `<div class="reward-banner">🎉 Selamat! ${escapeHtml(e.baby_name)} berhak dapat ${rewards} sesi pijat gratis. Tunjukkan halaman ini ke kami saat kunjungan berikutnya.</div>` : ''}
          </div>`;
        }).join('');
      if(cards) html += `<h3 class="section-title" style="font-size:1.05rem;margin-top:22px;">Poin Loyalitas</h3>${cards}`;
    }

    result.innerHTML = html;
  }catch(err){
    result.innerHTML = '<div class="notice danger">Koneksi sedang bermasalah. Mohon coba lagi sebentar lagi, atau hubungi kami lewat WhatsApp.</div>';
  }
}

/* =========================================================
   GROWTH CHECK (murni di browser, tidak butuh database)
========================================================= */
document.getElementById('g_date').value = new Date().toISOString().split('T')[0];

function updateAgeDisplay(){
  const dob = document.getElementById('g_dob').value;
  const date = document.getElementById('g_date').value;
  const ageEl = document.getElementById('g_age');
  if(!dob || !date){ ageEl.value=''; return; }
  const months = ageInMonths(dob, date);
  if(months < 0){ ageEl.value = 'Tanggal tidak valid'; return; }
  const y = Math.floor(months/12), m = Math.floor(months%12);
  ageEl.value = `${y>0? y+' th ':''}${m} bln`;
}
function updateOlderInfo(){
  const box = document.getElementById('g_olderInfo');
  const dob = document.getElementById('g_dob').value, date = document.getElementById('g_date').value;
  const w = parseFloat(document.getElementById('g_weight').value), h = parseFloat(document.getElementById('g_height').value);
  const sex = document.getElementById('g_sex').value;
  if(!dob || !date){ box.innerHTML = ''; return; }
  const months = ageInMonths(dob, date);
  if(months <= 60){ box.innerHTML = ''; return; }
  const bmi = (w > 0 && h > 0) ? calcBMI(w, h) : NaN;
  let status = '';
  if(isFinite(bmi) && months <= 216 && typeof gaAssess === 'function'){
    const a = gaAssess({sex, ageMonths: months, weight: w, height: h});
    if(a.primary) status = ` Perkiraan status gizi (IMT/U): <strong>${escapeHtml(a.primary.cat.label)}</strong> (z ${gaSigned(a.primary.z, 2)}).`;
  }
  box.innerHTML = `<div class="notice info" style="margin-bottom:10px;">Usia ${(months/12).toFixed(1)} tahun (di atas 60 bulan): pengukuran tetap disimpan. ${isFinite(bmi) ? `<strong>IMT: ${bmi.toFixed(1)} kg/m²</strong> (dihitung otomatis).` : 'Isi berat &amp; tinggi badan untuk melihat IMT.'}${status}</div>`;
}
['g_dob','g_date','g_weight','g_height','g_sex'].forEach(id => document.getElementById(id).addEventListener('input', updateOlderInfo));
document.getElementById('g_dob').addEventListener('change', updateAgeDisplay);
document.getElementById('g_date').addEventListener('change', updateAgeDisplay);

document.getElementById('growthForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = document.getElementById('g_name').value.trim();
  const phone = document.getElementById('g_phone').value.trim();
  const sex = document.getElementById('g_sex').value;
  const dob = document.getElementById('g_dob').value;
  const date = document.getElementById('g_date').value;
  const weight = parseFloat(document.getElementById('g_weight').value);
  const height = parseFloat(document.getElementById('g_height').value);
  const resultEl = document.getElementById('growthResult');
  const submitBtn = e.target.querySelector('button[type=submit]');

  const months = ageInMonths(dob, date);
  if(months < 0 || months > 216){
    resultEl.innerHTML = `<div class="notice danger">Alat ini berlaku untuk usia 0–18 tahun. Periksa kembali tanggal lahir &amp; tanggal pengukuran yang dimasukkan.</div>`;
    return;
  }

  // Cek dulu apakah anak ini (phone+nama+tgl lahir sama) sudah pernah tercatat dengan
  // jenis kelamin BERBEDA dari yang dipilih sekarang — supaya salah pilih ketahuan
  // sebelum data tersimpan, bukan sesudahnya.
  try{
    const existingRes = await fetch(`${API_GROWTH}?phone=${encodeURIComponent(phone)}&baby_name=${encodeURIComponent(name)}&baby_dob=${encodeURIComponent(dob)}`);
    const existing = await existingRes.json();
    if(Array.isArray(existing) && existing.length > 0){
      const prevSex = existing[existing.length-1].sex;
      if(prevSex !== sex){
        const sexLabel = {boy:'Laki-laki', girl:'Perempuan'};
        const ok = confirm(
          `Riwayat sebelumnya untuk "${name}" tercatat sebagai ${sexLabel[prevSex]}, tapi sekarang kamu pilih ${sexLabel[sex]}.\n\n` +
          `Kalau ini murni salah pilih, klik Cancel lalu perbaiki dropdown Jenis Kelamin.\n` +
          `Kalau memang sebelumnya salah input dan sekarang mau dikoreksi, klik OK untuk lanjut menyimpan.`
        );
        if(!ok) return;
      }
    }
  }catch(err){ /* kalau gagal cek, lanjut simpan seperti biasa */ }

  submitBtn.disabled = true;
  try{
    // simpan pengukuran ini sebagai 1 catatan riwayat
    await fetch(API_GROWTH, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({phone, baby_name: name, baby_dob: dob, sex, measurement_date: date, weight, height})
    });
  }catch(err){
    resultEl.innerHTML = `<div class="notice danger">Koneksi sedang bermasalah. Mohon coba lagi sebentar lagi, atau hubungi kami lewat WhatsApp.</div>`;
    submitBtn.disabled = false;
    return;
  }

  await loadAndRenderGrowth(phone, name, sex, dob);
  submitBtn.disabled = false;
});

async function loadAndRenderGrowth(phone, name, sex, dob, preloaded){
  const resultEl = document.getElementById('growthResult');
  let records = [];
  if(Array.isArray(preloaded)){
    records = preloaded;
  } else {
    resultEl.innerHTML = '<div class="notice info">Memuat riwayat...</div>';
    try{
      const res = await fetch(`${API_GROWTH}?phone=${encodeURIComponent(phone)}&baby_name=${encodeURIComponent(name)}&baby_dob=${encodeURIComponent(dob)}`);
      records = await res.json();
    }catch(err){
      resultEl.innerHTML = `<div class="notice danger">Tidak bisa terhubung ke server.</div>`;
      return;
    }
  }

  if(!Array.isArray(records) || records.length===0){
    resultEl.innerHTML = `<div class="notice warn">Belum ada riwayat pengukuran untuk anak ini. Isi form dan klik "Hitung & Simpan Pengukuran" dulu.</div>`;
    return;
  }

  // Pakai jenis kelamin dari catatan TERBARU di database sebagai acuan resmi anak ini,
  // bukan dari dropdown form saat ini — supaya tidak keliru retroaktif kalau ada salah pilih.
  const last = records[records.length-1];
  const actualSex = last.sex;
  const distinctSexes = [...new Set(records.map(r=>r.sex))];

  lastGrowthHistory = records.map(r => ({
    measurement_date: r.measurement_date,
    weight: r.weight,
    height: r.height,
    ageMonths: ageInMonths(r.baby_dob, r.measurement_date)
  }));
  const lastMonths = lastGrowthHistory[lastGrowthHistory.length-1].ageMonths;
  lastGrowthInput = { sex: actualSex, ageMonths: lastMonths };

  const assessHtml = gaRender(records.map(r => ({...r, sex: actualSex})), {dateFmt: mkFmtDate});

  const sexMismatchWarning = distinctSexes.length > 1 ? `
    <div class="notice danger">
      ⚠️ Terdeteksi jenis kelamin yang tidak konsisten pada riwayat "${escapeHtml(last.baby_name)}". Ini kemungkinan salah input di salah satu kunjungan. Grafik memakai jenis kelamin dari catatan <strong>terbaru</strong>. Mohon hubungi admin untuk memeriksa catatan yang salah.
    </div>` : '';

  const rowsDesc = records.slice().reverse().map(r => {
    const a = ageInMonths(r.baby_dob, r.measurement_date);
    return `<div class="booking-item" style="padding:10px 14px;">
      <div class="info">
        <strong>${mkFmtDate(r.measurement_date)}</strong> · usia ${a.toFixed(1)} bulan
        <div>Berat: ${Number(r.weight).toFixed(1)} kg &nbsp;·&nbsp; Tinggi: ${Number(r.height).toFixed(1)} cm${a > 60 ? ` &nbsp;·&nbsp; IMT: ${calcBMI(r.weight, r.height).toFixed(1)} kg/m²` : ''}</div>
        <div class="hint" style="margin-top:2px;">${gaBriefText({...r, sex: actualSex})}</div>
      </div>
    </div>`;
  }).join('');

  resultEl.innerHTML = `
    <h2 class="section-title" style="margin-bottom:2px;">${escapeHtml(last.baby_name)}</h2>
    <p class="hint" style="margin-bottom:12px;">${actualSex === 'boy' ? 'Laki-laki' : 'Perempuan'} · lahir ${mkFmtDate(last.baby_dob)} · usia ${lastMonths.toFixed(1)} bulan</p>
    ${sexMismatchWarning}
    ${assessHtml}
    <div class="chart-tabs">
      <button class="active" data-chart="weight" onclick="showGrowthChart('weight')">Berat Badan menurut Umur</button>
      <button data-chart="height" onclick="showGrowthChart('height')">Tinggi Badan menurut Umur</button>
    </div>
    <div id="growthChartHolder"></div>
    ${records.length === 1 ? '<p class="hint">Baru ada 1 pengukuran. Garis tren muncul setelah ada pengukuran berikutnya.</p>' : ''}
    <h3 class="section-title" style="font-size:1.05rem;margin-top:18px;">Riwayat Pengukuran (${records.length})</h3>
    ${rowsDesc}
  `;

  renderGrowthCharts();
}

/* =========================================================
   TUMBUH KEMBANG ANAK SAYA
   Orang tua cukup memasukkan no. WA -> muncul daftar anak + status terakhir,
   klik anak untuk melihat grafik & riwayat (data dicatat admin saat kunjungan).
========================================================= */
const MK_PHONE_KEY = 'bh_mk_phone';
let myKids = [];
let myKidsPhone = '';

function mkAgeText(months){
  const m = Math.max(0, Math.floor(months));
  if(m < 24) return m + ' bulan';
  const y = Math.floor(m/12), r = m % 12;
  return r ? `${y} th ${r} bln` : `${y} th`;
}
function mkFmtDate(str){
  const m = String(str||'').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(!m) return String(str||'');
  const bln = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  return `${Number(m[3])} ${bln[Number(m[2])-1]} ${m[1]}`;
}

async function loadMyKids(){
  const phone = document.getElementById('mk_phone').value.trim();
  const list = document.getElementById('myKidsList');
  const btn = document.getElementById('mk_btn');
  document.getElementById('growthResult').innerHTML = '';
  if(!phone){ list.innerHTML = '<div class="notice warn">Masukkan nomor WhatsApp terlebih dahulu.</div>'; return; }

  list.innerHTML = '<div class="notice info">Mencari...</div>';
  btn.disabled = true;
  try{
    const res = await fetch(`${API_GROWTH}?children=1&phone=${encodeURIComponent(phone)}`, {cache:'no-store'});
    const data = await res.json().catch(()=>null);
    if(!res.ok){
      list.innerHTML = `<div class="notice danger">${escapeHtml((data && data.error) || 'Gagal memuat data.')}</div>`;
      return;
    }
    myKids = Array.isArray(data) ? data : [];
    myKidsPhone = phone;
    try{ localStorage.setItem(MK_PHONE_KEY, phone); }catch(e){}

    if(myKids.length === 0){
      list.innerHTML = `<div class="notice warn">Belum ada catatan tumbuh kembang untuk nomor ini. Catatan muncul setelah petugas kami mengukur berat &amp; tinggi si kecil saat kunjungan. Pastikan nomor yang dimasukkan sama dengan nomor saat reservasi, atau hubungi kami lewat <a href="https://wa.me/6281392450033" target="_blank" rel="noopener">WhatsApp</a>.</div>`;
      return;
    }

    list.innerHTML = myKids.map((k, i) => {
      const sexLabel = k.sex === 'boy' ? 'Laki-laki' : 'Perempuan';
      const months = ageInMonths(k.baby_dob, k.last_date);
      let badges = '';
      if(months >= 0 && months <= 216){
        const a = gaAssess({sex: k.sex, ageMonths: months, weight: Number(k.last_weight), height: Number(k.last_height)});
        const tb = gaFind(a, 'tbu');
        const parts = [a.primary, tb].filter(Boolean).map(i => `<span class="notice ${i.cat.cls === 'danger' ? 'danger' : i.cat.cls}">${escapeHtml(i.short)}: ${escapeHtml(i.cat.short)}</span>`);
        badges = parts.length ? `<div class="mk-badges">${parts.join('')}</div>` : '';
      }
      return `<div class="mykid">
        <div class="mk-info">
          <strong>${escapeHtml(k.baby_name)}</strong> <span class="mk-meta">· ${sexLabel} · ${mkAgeText(months)}</span>
          <div class="mk-meta">Pengukuran terakhir ${mkFmtDate(k.last_date)} · Berat ${Number(k.last_weight).toFixed(1)} kg · Tinggi ${Number(k.last_height).toFixed(1)} cm · ${k.count} catatan</div>
          ${badges}
        </div>
        <button type="button" class="btn-primary" style="width:auto;padding:10px 16px;" onclick="openMyKid(${i})">Lihat Grafik &amp; Riwayat</button>
      </div>`;
    }).join('');

    // Kalau hanya 1 anak, langsung tampilkan grafiknya (satu langkah lebih singkat)
    if(myKids.length === 1) openMyKid(0, false);
  }catch(err){
    list.innerHTML = '<div class="notice danger">Koneksi sedang bermasalah. Mohon coba lagi sebentar lagi, atau hubungi kami lewat WhatsApp.</div>';
  }finally{
    btn.disabled = false;
  }
}

async function openMyKid(i, scroll = true){
  const k = myKids[i];
  if(!k) return;
  const resultEl = document.getElementById('growthResult');
  resultEl.innerHTML = '<div class="notice info">Memuat riwayat...</div>';
  try{
    const res = await fetch(`${API_GROWTH}?children=1&phone=${encodeURIComponent(myKidsPhone)}&baby_name=${encodeURIComponent(k.baby_name)}&baby_dob=${encodeURIComponent(k.baby_dob)}`, {cache:'no-store'});
    const records = await res.json();
    if(!res.ok || !Array.isArray(records) || records.length === 0){
      resultEl.innerHTML = '<div class="notice danger">Riwayat tidak bisa dimuat. Coba lagi sebentar lagi.</div>';
      return;
    }
    await loadAndRenderGrowth(myKidsPhone, k.baby_name, k.sex, k.baby_dob, records);
    if(scroll) resultEl.scrollIntoView({behavior:'smooth', block:'start'});
  }catch(err){
    resultEl.innerHTML = '<div class="notice danger">Koneksi sedang bermasalah. Mohon coba lagi sebentar lagi.</div>';
  }
}

document.getElementById('mk_btn').addEventListener('click', loadMyKids);
document.getElementById('mk_phone').addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); loadMyKids(); } });

// Nomor yang terakhir dipakai diingat di HP/browser ini: tab dibuka -> hasil langsung muncul
(function initMyKids(){
  let saved = '';
  try{ saved = localStorage.getItem(MK_PHONE_KEY) || ''; }catch(e){}
  if(!saved) return;
  document.getElementById('mk_phone').value = saved;
  let done = false;
  document.getElementById('tabfolder').addEventListener('click', e=>{
    const b = e.target.closest('button[data-tab="tumbuhkembang"]');
    if(b && !done){ done = true; loadMyKids(); }
  });
})();

/* =========================================================
   INIT
========================================================= */
let lastServicesSig = '';

// Ambil daftar layanan terbaru dari server. Dipanggil saat halaman dibuka,
// lalu otomatis lagi setiap kali halaman dibuka kembali / tiap 60 detik,
// supaya perubahan dari admin (durasi, harga, layanan baru) langsung terlihat.
async function loadServices(){
  try{
    const res = await fetch(API_SERVICES, {cache:'no-store'});
    const data = await res.json();
    if(!Array.isArray(data)) throw new Error('Respon layanan tidak valid');
    const sig = JSON.stringify(data);
    if(sig === lastServicesSig) return true;   // tidak ada perubahan -> jangan render ulang
    lastServicesSig = sig;
    services = data;
    renderServiceGrid();
    renderServiceSelect();
    return true;
  }catch(err){
    return false;
  }
}

document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) loadServices(); });
setInterval(()=>{ if(!document.hidden) loadServices(); }, 60000);

(async function init(){
  const ok = await loadServices();
  if(!ok){
    services = [];
    document.getElementById('serviceGrid').innerHTML =
      '<div class="notice danger">Tidak bisa memuat layanan. Coba muat ulang halaman, atau hubungi kami lewat WhatsApp.</div>';
    renderServiceSelect();
  }
  renderTimeOptions();
})();


/* =========================================================
   SLIDESHOW FOTO BERANDA
   - ganti otomatis tiap 2,5 detik
   - berhenti saat disentuh / kursor di atasnya / tab tidak aktif
   - bisa digeser (swipe) di HP, atau klik titik di bawah
========================================================= */
(function heroSlider(){
  const root = document.getElementById('heroSlider');
  if(!root) return;
  const slides = Array.from(root.querySelectorAll('.hero-slide'));
  const dots = Array.from(root.querySelectorAll('.hero-dot'));
  if(slides.length < 2) return;

  let current = 0, timer = null;
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function show(n){
    current = (n + slides.length) % slides.length;
    slides.forEach((el, i)=>el.classList.toggle('active', i === current));
    dots.forEach((el, i)=>el.classList.toggle('active', i === current));
  }
  function stop(){ if(timer){ clearInterval(timer); timer = null; } }
  function start(){
    stop();
    if(reduceMotion) return;
    timer = setInterval(()=>show(current + 1), 2500);
  }

  dots.forEach((d, i)=>d.addEventListener('click', ()=>{ show(i); start(); }));
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', start);

  // geser jari di HP
  let startX = null;
  root.addEventListener('touchstart', e=>{ startX = e.touches[0].clientX; stop(); }, {passive:true});
  root.addEventListener('touchend', e=>{
    if(startX !== null){
      const dx = e.changedTouches[0].clientX - startX;
      if(Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    }
    startX = null; start();
  }, {passive:true});

  document.addEventListener('visibilitychange', ()=>{ document.hidden ? stop() : start(); });
  start();
})();
