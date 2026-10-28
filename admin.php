<?php
require_once __DIR__ . '/assets_version.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/auth.php';
$isAdmin = admin_is_logged_in();
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Panel Admin — Blue Haven Baby & Kids Spa</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?php echo asset_url('assets/style.css'); ?>">
<link rel="stylesheet" href="<?php echo asset_url('assets/notif.css'); ?>">
<link rel="stylesheet" href="<?php echo asset_url('assets/waves.css'); ?>">
<link rel="stylesheet" href="<?php echo asset_url('assets/minigame.css'); ?>">
</head>
<body>
<div class="bg-waves" aria-hidden="true"><i></i><i></i><b class="t r s1"><span class="bob"><span class="fish c1"></span></span></b><b class="t r s2"><span class="bob"><span class="fish c3"></span></span></b><b class="t l s3"><span class="bob"><span class="fish fl c2"></span></span></b><b class="t l s4"><span class="bob"><span class="fish fl c1"></span></span></b><b class="t r s5"><span class="bob"><span class="fish c2"></span></span></b><b class="t jmp j1"><span class="jy"><span class="fish c1"></span></span></b><b class="t jmp j2"><span class="jy"><span class="fish fl c2"></span></span></b><b class="t jmp j3"><span class="jy"><span class="fish c3"></span></span></b><b class="dol"><span class="fl2"><span class="sw"></span></span></b><i></i></div>
<div id="app">

  <div class="top-contact-bar">
    <span>🔐 Panel Admin</span>
    <span class="app-name-inline">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2z"/><path d="M19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14z"/></svg>
      My Blue Haven
    </span>
    <span class="tcb-divider">|</span>
    <span>🕒 08.00–16.00</span>
  </div>

  <div class="brand-hero-card admin-hero">
    <svg class="header-ocean-deco" viewBox="0 0 900 220" preserveAspectRatio="none" aria-hidden="true">
      <circle cx="820" cy="28" r="5" fill="var(--sage)" opacity="0.25"/>
      <circle cx="860" cy="55" r="7" fill="var(--sage)" opacity="0.18"/>
    </svg>

    <div class="brand-hero-top">
      <div class="brand-hero-left">
        <img class="brand-logo-lg" src="assets/logo.png" alt="Blue Haven Baby & Kids Spa">
      </div>
      <div class="admin-header-right">
        <span class="admin-badge">Mode Admin</span>
        <?php if ($isAdmin): ?><a class="adminlink-pill" href="#" onclick="logout();return false;">Keluar</a><?php endif; ?>
        <a class="adminlink-pill" href="index.php">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
          Kembali ke Website
        </a>
      </div>
    </div>

    <svg class="wave-bottom" viewBox="0 0 900 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,30 C150,55 300,10 450,30 C600,50 750,15 900,30 L900,60 L0,60 Z" fill="var(--sage)" opacity="0.16"/>
      <path d="M0,40 C150,20 300,55 450,38 C600,22 750,50 900,38 L900,60 L0,60 Z" fill="var(--sage-deep)" opacity="0.12"/>
    </svg>
  </div>

  <div id="adminGate" class="pin-box"<?php echo $isAdmin ? ' style="display:none;"' : ''; ?>>
    <h2 class="section-title" style="text-align:center;">Masuk Panel Admin</h2>
    <p class="hint">Masukkan password admin. Login berlaku 12 jam.</p>
    <div class="pw-wrap">
      <input type="password" id="adminPassword" placeholder="Password admin" autocomplete="current-password">
      <button type="button" class="pw-toggle" id="pwToggle" aria-label="Tampilkan password" title="Tampilkan password">
        <svg id="pwEyeOn" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>
        <svg id="pwEyeOff" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:none;"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-7 0-11-7-11-7a19.77 19.77 0 0 1 5.06-5.94"/><path d="M9.9 4.24A10.9 10.9 0 0 1 12 5c7 0 11 7 11 7a19.86 19.86 0 0 1-3.17 4.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/><path d="M1 1l22 22"/></svg>
      </button>
    </div>
    <button class="btn-primary" onclick="doLogin()">Masuk</button>
    <div id="pinMsg"></div>
  </div>
  <style>
    .pw-wrap{ position:relative; }
    .pw-wrap input{ padding-left:44px; padding-right:44px; }  /* simetris supaya teks tetap di tengah */
    .pw-toggle{
      position:absolute; right:6px; top:50%; transform:translateY(-50%);
      width:34px; height:34px; display:flex; align-items:center; justify-content:center;
      background:none; border:0; border-radius:8px; padding:0; color:#5D7291; cursor:pointer;
    }
    .pw-toggle:hover{ color:var(--pine); background:var(--mist); }
    .pw-toggle:focus-visible{ outline:2px solid var(--sage); outline-offset:1px; }
  </style>
  <script>
    (function(){
      var inp = document.getElementById('adminPassword');
      var btn = document.getElementById('pwToggle');
      if(!inp || !btn) return;
      btn.addEventListener('click', function(){
        var show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        document.getElementById('pwEyeOn').style.display  = show ? 'none' : '';
        document.getElementById('pwEyeOff').style.display = show ? '' : 'none';
        var label = show ? 'Sembunyikan password' : 'Tampilkan password';
        btn.setAttribute('aria-label', label);
        btn.title = label;
        inp.focus();
      });
    })();
  </script>

  <div id="adminContent" style="display:<?php echo $isAdmin ? 'block' : 'none'; ?>;">

    <div class="pill-nav-row">
      <div class="subtabs">
        <button data-sub="bookings" class="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
          Reservasi Masuk
        </button>
        <button data-sub="services">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h10"/></svg>
          Kelola Layanan
        </button>
        <button data-sub="loyalty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12v9H4v-9"/><rect x="2" y="7" width="20" height="5" rx="1"/><path d="M12 21V7M12 7S9 3 7 5s2 2 5 2 7 0 5-2-5 2-5 2z"/></svg>
          Program Loyalitas
        </button>
        <button data-sub="growth">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19h16"/><path d="M6 15l4-5 3 3 5-7"/></svg>
          Riwayat Tumbuh Kembang
        </button>
        <button data-sub="revenue">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>
          Pendapatan
        </button>
      </div>
    </div>

    <div id="sub-bookings">
      <button type="button" class="walkin-cta" onclick="openWalkinModal()">
        <span class="walkin-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="8" r="3.5"/><path d="M3 21c0-3.6 3.1-6 7-6"/><path d="M19 14v6M16 17h6"/></svg>
        </span>
        <span class="walkin-text">
          <strong>Daftar Pijat Langsung</strong>
          <small>Untuk pelanggan tanpa reservasi · langsung berstatus Dikonfirmasi</small>
        </span>
        <span class="walkin-go" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        </span>
      </button>
      <div class="row2 filter-bar">
        <div>
          <label>Filter Status</label>
          <select id="filterStatus">
            <option value="all">Semua</option>
            <option value="pending">Menunggu</option>
            <option value="confirmed">Dikonfirmasi</option>
            <option value="done">Selesai</option>
            <option value="cancelled">Dibatalkan</option>
          </select>
        </div>
        <div>
          <label>Filter Tanggal</label>
          <input type="date" id="filterDate">
        </div>
      </div>
      <div id="bookingList" style="margin-top:16px;"></div>
    </div>

    <div id="sub-services" style="display:none;">
      <div class="card">
        <h2 class="section-title">Tambah / Ubah Layanan</h2>
        <input type="hidden" id="svc_id">
        <label>Kategori</label>
        <select id="svc_category">
          <option value="newborn">Newborn Care (0-30 Hari)</option>
          <option value="newborn_pkg">Paket Newborn Care</option>
          <option value="baby">Baby Treatment (0-24 Bulan)</option>
          <option value="therapy">Baby &amp; Kids Therapy</option>
          <option value="kids">Kids Treatment (2 Tahun ke Atas)</option>
          <option value="mom">Mom Care (Home Care)</option>
          <option value="traditional">Traditional Care</option>
        </select>
        <label>Nama Layanan</label>
        <input type="text" id="svc_name">
        <div class="row2">
          <div><label>Durasi (menit)</label><input type="text" id="svc_duration" placeholder="Contoh: 20-30"></div>
          <div><label>Harga (Rp)</label><input type="number" id="svc_price"></div>
        </div>
        <label>Deskripsi Singkat</label>
        <textarea id="svc_desc"></textarea>
        <button class="btn-primary" onclick="saveService()">Simpan Layanan</button>
        <div id="svcMsg"></div>
      </div>
      <div class="row2" style="margin-bottom:6px;">
        <div>
          <label>Filter Kategori</label>
          <select id="svcFilterCategory">
            <option value="all">Semua Kategori</option>
            <option value="newborn">Newborn Care (0-30 Hari)</option>
            <option value="newborn_pkg">Paket Newborn Care</option>
            <option value="baby">Baby Treatment (0-24 Bulan)</option>
            <option value="therapy">Baby &amp; Kids Therapy</option>
          <option value="kids">Kids Treatment (2 Tahun ke Atas)</option>
            <option value="mom">Mom Care (Home Care)</option>
            <option value="traditional">Traditional Care</option>
          </select>
        </div>
      </div>
      <div id="serviceAdminList"></div>
    </div>

    <div id="sub-loyalty" style="display:none;">
      <div class="notice info">Setiap reservasi yang ditandai <strong>Selesai</strong> otomatis dihitung sebagai 1 kali sesi pijat/spa. Setelah 10 sesi, pelanggan berhak dapat 1 sesi gratis.</div>
      <div id="loyaltyList" style="margin-top:14px;"></div>
    </div>

    <div id="sub-growth" style="display:none;">
      <div class="notice info">Catatan tumbuh kembang tiap anak, dari halaman "Cek Tumbuh Kembang" maupun dari pendaftaran langsung di tempat. Klik <strong>Detail &amp; Grafik</strong> untuk melihat grafik dan membetulkan atau menghapus catatan yang salah input.</div>
      <label style="margin-top:14px;">Cari (nama anak / no. WhatsApp)</label>
      <input type="text" id="growthSearch" placeholder="Contoh: Rafael atau 0812...">
      <div id="growthAdminList" style="margin-top:14px;"></div>
    </div>

    <div id="sub-revenue" style="display:none;">
      <div id="revGate" class="card" style="max-width:420px; margin:10px auto; text-align:center;">
        <div style="font-size:2rem;">🔒</div>
        <h2 class="section-title" id="revGateTitle">Khusus Owner</h2>
        <p id="revGateDesc" style="font-size:0.88rem; color:#3F5670; margin:0 0 12px;"></p>
        <input type="password" id="revGatePw1" autocomplete="off" style="margin-bottom:8px;">
        <input type="password" id="revGatePw2" autocomplete="off" style="margin-bottom:8px; display:none;">
        <input type="password" id="revGatePw3" autocomplete="off" style="margin-bottom:8px; display:none;">
        <button class="btn-primary" id="revGateBtn" onclick="revGateSubmit()">Buka</button>
        <button class="btn-ghost" id="revGateCancel" onclick="revCheckGate()" style="display:none; margin-top:8px;">Batal</button>
        <div id="revGateMsg" style="margin-top:8px;"></div>
      </div>

      <div id="revContent" style="display:none;">
      <div style="display:flex; justify-content:flex-end; gap:8px; margin-bottom:10px; flex-wrap:wrap;">
        <button class="btn-ghost" style="padding:6px 12px; font-size:0.8rem;" onclick="revGateMode_set('change')">🔑 Ubah Password Owner</button>
        <button class="btn-ghost" style="padding:6px 12px; font-size:0.8rem;" onclick="revLock()">🔒 Kunci</button>
      </div>
      <div class="notice info">Pendapatan dihitung dari reservasi berstatus <strong>Selesai</strong>, sesuai total setelah diskon yang tercatat di kasir.</div>

      <div class="rev-cards" id="revCards"></div>

      <div class="card" style="margin-top:14px;">
        <div class="rev-toolbar">
          <div class="rev-tabs" id="revPeriodTabs">
            <button data-period="daily" class="active">Harian</button>
            <button data-period="monthly">Bulanan</button>
            <button data-period="yearly">Tahunan</button>
          </div>
          <div class="rev-filter">
            <input type="month" id="revMonth">
            <select id="revYear" style="display:none;"></select>
          </div>
        </div>

        <div class="rev-summary" id="revSummary"></div>

        <div class="chart-wrap" style="margin-top:12px;">
          <div style="position:relative; height:300px;"><canvas id="revChart"></canvas></div>
        </div>
        <div id="revChartMsg"></div>
      </div>

      <div class="row2" style="margin-top:14px;">
        <div class="card">
          <h3 class="rev-h">Metode Pembayaran</h3>
          <div id="revMethod"></div>
        </div>
        <div class="card">
          <h3 class="rev-h">Layanan Terlaris</h3>
          <div id="revTop"></div>
        </div>
      </div>

      <div class="card" style="margin-top:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
          <h3 class="rev-h" style="margin:0;">Rincian</h3>
          <button class="btn-ghost" style="padding:6px 12px; font-size:0.8rem;" onclick="downloadRevenueCSV()">⬇ Unduh CSV</button>
        </div>
        <div style="overflow-x:auto; margin-top:10px;"><table class="rev-table" id="revTable"></table></div>
      </div>
      </div><!-- /revContent -->
    </div>
  </div>

  <footer class="tiny">Blue Haven Baby & Kids Spa — Panel Admin</footer>
</div>


<!-- POP UP DAFTAR PIJAT LANGSUNG (WALK-IN) -->
<div id="walkinModal" class="modal-overlay" style="display:none;" onclick="if(event.target===this) closeWalkinModal()">
  <div class="modal-box card" role="dialog" aria-modal="true" aria-labelledby="walkinTitle">
    <h2 class="section-title" id="walkinTitle">Daftar Pijat Langsung</h2>
    <p class="hint" style="margin-bottom:4px;">Untuk pelanggan yang datang tanpa reservasi. Bisa mendaftarkan <strong>lebih dari satu anak sekaligus</strong>: mereka dibayar bersamaan dan struknya otomatis menjadi satu. Berat &amp; tinggi badan (opsional) langsung masuk ke <strong>Riwayat Tumbuh Kembang</strong>. Setelah disimpan, statusnya langsung <strong>Dikonfirmasi</strong>. Maksimal 2 bayi per jam.</p>
    <div class="row2">
      <div><label>Nama Orang Tua</label><input type="text" id="w_parent"></div>
      <div><label>No. WhatsApp</label><input type="tel" id="w_phone" placeholder="08xxxxxxxxxx"></div>
    </div>
    <div id="w_kids"></div>
    <button type="button" class="btn-ghost" style="width:100%;margin-top:10px;" onclick="addWalkinKid()">+ Tambah anak</button>
    <label>Tanggal</label>
    <input type="date" id="w_date">
    <label>Catatan (opsional)</label>
    <textarea id="w_notes" placeholder="Alergi, kondisi kulit, atau permintaan khusus"></textarea>
    <button class="btn-primary" id="w_saveBtn" onclick="saveWalkin()">Simpan & Konfirmasi</button>
    <button class="btn-ghost" style="width:100%;margin-top:8px;" onclick="closeWalkinModal()">Batal</button>
    <div id="w_msg"></div>
  </div>
</div>

<!-- POP UP UBAH LAYANAN -->
<div id="svcModal" class="modal-overlay" style="display:none;" onclick="if(event.target===this) closeEditModal()">
  <div class="modal-box card" role="dialog" aria-modal="true" aria-labelledby="svcModalTitle">
    <h2 class="section-title" id="svcModalTitle">Ubah Layanan</h2>
    <input type="hidden" id="m_svc_id">
    <label>Kategori</label>
    <select id="m_svc_category">
      <option value="newborn">Newborn Care (0-30 Hari)</option>
      <option value="newborn_pkg">Paket Newborn Care</option>
      <option value="baby">Baby Treatment (0-24 Bulan)</option>
      <option value="therapy">Baby &amp; Kids Therapy</option>
          <option value="kids">Kids Treatment (2 Tahun ke Atas)</option>
      <option value="mom">Mom Care (Home Care)</option>
      <option value="traditional">Traditional Care</option>
    </select>
    <label>Nama Layanan</label>
    <input type="text" id="m_svc_name">
    <div class="row2">
      <div><label>Durasi (menit)</label><input type="text" id="m_svc_duration" placeholder="Contoh: 20-30"></div>
      <div><label>Harga (Rp)</label><input type="number" id="m_svc_price"></div>
    </div>
    <label>Deskripsi Singkat</label>
    <textarea id="m_svc_desc"></textarea>
    <button class="btn-primary" id="m_svcSaveBtn" onclick="saveServiceEdit()">Simpan Perubahan</button>
    <button class="btn-ghost" style="width:100%;margin-top:8px;" onclick="closeEditModal()">Batal</button>
    <div id="m_svcMsg"></div>
  </div>
</div>

<!-- POP UP EDIT LOYALITAS -->
<div id="loyaltyModal" class="modal-overlay" style="display:none;" onclick="if(event.target===this) closeLoyaltyEdit()">
  <div class="modal-box card" role="dialog" aria-modal="true" aria-labelledby="loyaltyModalTitle">
    <h2 class="section-title" id="loyaltyModalTitle">Edit Riwayat Selesai</h2>
    <p class="hint" id="l_who" style="margin-bottom:8px;"></p>
    <input type="hidden" id="l_idx">
    <label>Nama Orang Tua</label>
    <input type="text" id="l_name">
    <div class="row2">
      <div><label>Jumlah sesi selesai</label><input type="number" id="l_count" min="0" step="1"></div>
      <div><label>Reward sudah terpakai</label><input type="number" id="l_redeemed" min="0" step="1"></div>
    </div>
    <p class="hint" id="l_hint"></p>
    <button class="btn-primary" id="l_saveBtn" onclick="saveLoyaltyEdit()">Simpan Perubahan</button>
    <button class="btn-ghost" style="width:100%;margin-top:8px;" onclick="closeLoyaltyEdit()">Batal</button>
    <div id="l_msg"></div>
  </div>
</div>

<script>
  const ADMIN_LOGGED_IN = <?php echo $isAdmin ? 'true' : 'false'; ?>;
</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="<?php echo asset_url('assets/growth-data.js'); ?>"></script>
<script src="<?php echo asset_url('assets/growth-who-lms.js'); ?>"></script>
<script src="<?php echo asset_url('assets/growth-assess.js'); ?>"></script>
<script src="<?php echo asset_url('assets/growth-chart.js'); ?>"></script>
<script src="<?php echo asset_url('assets/growth-report.js'); ?>"></script>
<script src="<?php echo asset_url('assets/admin.js'); ?>"></script>
<script src="<?php echo asset_url('assets/notif.js'); ?>"></script>
<script src="<?php echo asset_url('assets/minigame.js'); ?>"></script>
</body>
</html>
