<?php
require_once __DIR__ . '/assets_version.php';
// Foto slide beranda: hero-baby.jpg (slide pertama) + semua gambar di folder assets/slides/
$heroSlides = [];
if (file_exists(__DIR__ . '/assets/hero-baby.jpg')) $heroSlides[] = 'assets/hero-baby.jpg';
$slideDir = __DIR__ . '/assets/slides';
if (is_dir($slideDir)) {
    $slideFiles = scandir($slideDir);
    natcasesort($slideFiles);
    foreach ($slideFiles as $sf) {
        if (preg_match('/\.(jpe?g|png|webp)$/i', $sf)) $heroSlides[] = 'assets/slides/' . $sf;
    }
}
$heroPhotoExists = count($heroSlides) > 0;
function slide_url($rel) {
    $enc = implode('/', array_map('rawurlencode', explode('/', $rel)));
    return $enc . '?v=' . @filemtime(__DIR__ . '/' . $rel);
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Blue Haven — Baby & Kids Spa</title>

<!-- PWA -->
<link rel="manifest" href="manifest.json">
<meta name="theme-color" content="#12407A">
<link rel="icon" href="assets/icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="assets/icons/icon-192.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="My Blue Haven">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?php echo asset_url('assets/style.css'); ?>">
<link rel="stylesheet" href="<?php echo asset_url('assets/waves.css'); ?>">
<link rel="stylesheet" href="<?php echo asset_url('assets/minigame.css'); ?>">
</head>
<body>
<div class="bg-waves" aria-hidden="true"><i></i><i></i><b class="t r s1"><span class="bob"><span class="fish c1"></span></span></b><b class="t r s2"><span class="bob"><span class="fish c3"></span></span></b><b class="t l s3"><span class="bob"><span class="fish fl c2"></span></span></b><b class="t l s4"><span class="bob"><span class="fish fl c1"></span></span></b><b class="t r s5"><span class="bob"><span class="fish c2"></span></span></b><b class="t jmp j1"><span class="jy"><span class="fish c1"></span></span></b><b class="t jmp j2"><span class="jy"><span class="fish fl c2"></span></span></b><b class="t jmp j3"><span class="jy"><span class="fish c3"></span></span></b><b class="dol"><span class="fl2"><span class="sw"></span></span></b><i></i></div>
<div id="app">

  <div class="top-contact-bar">
    <span>📞 0813-9245-0033</span>
    <span class="app-name-inline">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 5.6L19 9l-5.2 1.4L12 16l-1.8-5.6L5 9l5.2-1.4L12 2z"/><path d="M19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14z"/></svg>
      My Blue Haven
    </span>
    <span class="tcb-divider">|</span>
    <span>🕒 Buka setiap hari, 08.00–16.00</span>
    <div class="social-icons">
      <a href="https://www.facebook.com/profile.php?id=61593963745886&locale=id_ID" target="_blank" rel="noopener" aria-label="Facebook" title="Blue Haven Baby & Kids Spa">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V8c0-.9.25-1.5 1.55-1.5H16.7V3.7C16.4 3.66 15.4 3.6 14.2 3.6c-2.5 0-4.2 1.5-4.2 4.3v2h-2.7v3.1H10v8h3.5z"/></svg>
      </a>
      <a href="https://www.instagram.com/bluehavenbabyandkids" target="_blank" rel="noopener" aria-label="Instagram" title="@bluehavenbabyandkids">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1"/></svg>
      </a>
      <a href="https://www.tiktok.com/@blue.haven.spa" target="_blank" rel="noopener" aria-label="TikTok" title="@blue.haven.spa">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 2h-3v13.5a2.5 2.5 0 11-2.5-2.5c.2 0 .4 0 .6.05v-3.05a5.5 5.5 0 105.5 5.5V8.2a7.5 7.5 0 004.4 1.4V6.6A4.5 4.5 0 0116.5 2z"/></svg>
      </a>
      <a href="https://wa.me/6281392450033" target="_blank" rel="noopener" aria-label="WhatsApp" title="Chat WhatsApp">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.3c1.5.8 3.1 1.3 4.8 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2zm0 18c-1.5 0-3-.4-4.3-1.1l-.3-.2-3.1.8.8-3-.2-.3C4.4 15 4 13.5 4 12c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8zm4.4-6c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1-.2.2-.6.8-.7.9-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.3.1-.4l.3-.4c.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4-.1-.1-.5-1.3-.7-1.7-.2-.5-.4-.4-.5-.4h-.5c-.1 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.4c.1.1 1.6 2.5 3.9 3.5.5.2 1 .4 1.3.5.6.2 1.1.1 1.5.1.5-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1-.1-.1-.2-.1-.4-.2z"/></svg>
      </a>
    </div>
  </div>

  <div class="brand-hero-card cust-hero">
    <svg class="header-ocean-deco" viewBox="0 0 900 220" preserveAspectRatio="none" aria-hidden="true">
      <circle cx="820" cy="28" r="5" fill="var(--sage)" opacity="0.25"/>
      <circle cx="860" cy="55" r="7" fill="var(--sage)" opacity="0.18"/>
    </svg>

    <div class="brand-hero-top">
      <div class="brand-hero-left">
        <img class="brand-logo-lg" src="assets/logo.png" alt="Blue Haven Baby & Kids Spa">
        <div class="hero-copy">
          <span class="hero-eyebrow">✦ Baby & Kids Spa</span>
          <p class="hero-tagline">Pijat &amp; Spa Lembut untuk <em>Si Kecil</em></p>
          <p class="hero-sub">Tenang, aman, dan penuh kasih — dari bayi baru lahir hingga anak-anak.</p>
        </div>
      </div>

      <div class="trust-badges">
        <div class="trust-badge">
          <span class="trust-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2 L20 6 V12 C20 17 16.5 21 12 22 C7.5 21 4 17 4 12 V6 Z"/><path d="M8 12 L11 15 L16 9"/></svg></span>
          <span>Terlatih & Bersertifikat</span>
        </div>
        <div class="trust-badge">
          <span class="trust-icon pink"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.4-9.5-8.5C1 9.5 2 6 5.2 5.1 7.4 4.5 9.6 5.5 12 8c2.4-2.5 4.6-3.5 6.8-2.9C22 6 23 9.5 21.5 12.5 19 16.6 12 21 12 21z"/></svg></span>
          <span>Aman & Nyaman</span>
        </div>
        <div class="trust-badge">
          <span class="trust-icon teal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21c8-2 13-8 14-16-8 1-14 6-16 14 0 1 1 2 2 2z"/><path d="M9 15c2-3 5-5 8-6"/></svg></span>
          <span>Alat Steril & Higienis</span>
        </div>
        <div class="trust-badge">
          <span class="trust-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2c-2 4-6 6-6 11a6 6 0 0012 0c0-5-4-7-6-11z"/></svg></span>
          <span>Produk Alami & Hipoalergenik</span>
        </div>
        <div class="trust-badge">
          <span class="trust-icon yellow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></span>
          <span>Terapis Wanita Berpengalaman</span>
        </div>
      </div>
    </div>

    <svg class="wave-bottom" viewBox="0 0 900 60" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0,30 C150,55 300,10 450,30 C600,50 750,15 900,30 L900,60 L0,60 Z" fill="var(--sage)" opacity="0.16"/>
      <path d="M0,40 C150,20 300,55 450,38 C600,22 750,50 900,38 L900,60 L0,60 Z" fill="var(--sage-deep)" opacity="0.12"/>
    </svg>
  </div>

  <div class="address-card">
    <iframe
      class="address-map-thumb"
      src="https://www.google.com/maps?q=Jalan+Masjid+Nur+Rohman%2C+Selojeneng%2C+Sumberdadi%2C+Kec.+Sumbergempol%2C+Kabupaten+Tulungagung%2C+Jawa+Timur+66291&output=embed"
      loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Peta lokasi Blue Haven Baby & Kids Spa">
    </iframe>
    <div class="address-info">
      <div class="address-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg></div>
      <div class="address-text">
        <div class="address-label">Lokasi Kami</div>
        <p>Jalan Masjid Nur Rohman, Selojeneng, Sumberdadi, Kec. Sumbergempol, Kabupaten Tulungagung, Jawa Timur 66291</p>
      </div>
    </div>
    <a class="address-cta" href="https://share.google/91k4VuEjozlyCzcHN" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6-7-11a7 7 0 0114 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
      Buka di Google Maps
    </a>
  </div>

  <div class="pill-nav-row">
    <div class="tabfolder" id="tabfolder">
      <button data-tab="beranda" class="active">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></svg>
        Beranda
      </button>
      <button data-tab="reservasi">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
        Reservasi
      </button>
      <button data-tab="tumbuhkembang">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19h16"/><path d="M6 15l4-5 3 3 5-7"/></svg>
        Cek Tumbuh Kembang
      </button>
      <button data-tab="statusku">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 3h6v3H9z"/><path d="M9 12l2 2 4-4"/></svg>
        Cek Status Reservasi
      </button>
    </div>
    <a class="adminlink-pill" href="admin.php">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
      Panel Admin
    </a>
  </div>

  <!-- ===================== BERANDA ===================== -->
  <section class="panel active" id="panel-beranda">
    <div class="hero hero-v2">
      <div class="hero-text">
        <h1>Sentuhan lembut,<br><span class="accent">tumbuh kembang</span><br>yang terpantau.</h1>
        <p>Pijat & spa bayi oleh terapis terlatih, plus alat bantu pemantauan tumbuh kembang balita berbasis standar berat & tinggi badan menurut usia.</p>
        <button class="cta" onclick="switchTab('reservasi')">Buat Reservasi →</button>
      </div>

      <div class="hero-media">
        <?php if ($heroPhotoExists): ?>
          <div class="hero-slider" id="heroSlider" aria-roledescription="carousel" aria-label="Foto Blue Haven Baby & Kids Spa">
            <?php foreach ($heroSlides as $i => $src): ?>
              <img src="<?php echo htmlspecialchars(slide_url($src)); ?>"
                   alt="Foto Blue Haven Baby & Kids Spa <?php echo $i + 1; ?>"
                   class="hero-slide<?php echo $i === 0 ? ' active' : ''; ?>"
                   <?php echo $i === 0 ? '' : 'loading="lazy"'; ?>>
            <?php endforeach; ?>
            <?php if (count($heroSlides) > 1): ?>
              <div class="hero-dots">
                <?php foreach ($heroSlides as $i => $src): ?>
                  <button type="button" class="hero-dot<?php echo $i === 0 ? ' active' : ''; ?>" aria-label="Foto <?php echo $i + 1; ?>"></button>
                <?php endforeach; ?>
              </div>
            <?php endif; ?>
          </div>
        <?php else: ?>
          <div class="hero-photo-placeholder">
            <span class="ph-icon">📷</span>
            <p>Taruh foto bayi kamu di sini</p>
            <p class="hint">Simpan file sebagai <code>assets/hero-baby.jpg</code>, lalu refresh halaman ini</p>
          </div>
        <?php endif; ?>

        <div class="floating-badge fb1">
          <span class="fb-icon blue"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="3"/><path d="M6 21c0-3 3-5 6-5s6 2 6 5"/></svg></span>
          Pijat Bayi
        </div>
        <div class="floating-badge fb2">
          <span class="fb-icon pink"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.4-9.5-8.5C1 9.5 2 6 5.2 5.1 7.4 4.5 9.6 5.5 12 8c2.4-2.5 4.6-3.5 6.8-2.9C22 6 23 9.5 21.5 12.5 19 16.6 12 21 12 21z"/></svg></span>
          Spa Bayi
        </div>
        <div class="floating-badge fb3">
          <span class="fb-icon purple"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19h16"/><path d="M6 15l4-5 3 3 5-7"/></svg></span>
          Pantau Tumbuh Kembang
        </div>
      </div>
    </div>

    <h2 class="section-title">Layanan Kami</h2>
    <div class="chart-tabs" id="serviceCatTabs">
      <button data-cat="newborn" class="active">Newborn Care (0-30 Hari)</button>
      <button data-cat="newborn_pkg">Paket Newborn Care</button>
      <button data-cat="baby">Baby Treatment (0-24 Bulan)</button>
      <button data-cat="therapy">Baby &amp; Kids Therapy</button>
      <button data-cat="kids">Kids Treatment (2 Tahun ke Atas)</button>
      <button data-cat="mom">Mom Care (Home Care)</button>
      <button data-cat="traditional">Traditional Care</button>
    </div>
    <div class="grid" id="serviceGrid"></div>

    <div class="notice info" style="margin-top:20px;">
      Jam operasional: <strong>08.00–16.00</strong> setiap hari (istirahat 12.00–13.00). <strong>Pemesanan pijat di luar jam kerja tetap kami layani dengan membuat janji terlebih dahulu</strong> — hubungi kami lewat <a href="https://wa.me/6281392450033" target="_blank" rel="noopener">WhatsApp 0813-9245-0033</a>. Datang 10 menit lebih awal ya, agar si kecil tenang dulu sebelum sesi dimulai.
    </div>

    <div class="loyalty-promo">
      <i class="lp-spark lp-s1" aria-hidden="true">✦</i><i class="lp-spark lp-s2" aria-hidden="true">✦</i><i class="lp-spark lp-s3" aria-hidden="true">✦</i>
      <div class="loyalty-promo-icon">🎁</div>
      <div class="lp-body">
        <h3>Program Loyalitas: Pijat 10x, Gratis 1x!</h3>
        <p>Setiap sesi pijat/spa yang selesai otomatis dihitung. Sudah 10 sesi? Sesi ke-11 kamu <strong>gratis</strong>. Cek progres poin kamu kapan saja lewat tab "Cek Status Reservasi" pakai nomor WhatsApp yang biasa dipakai booking.</p>
      </div>
    </div>
  </section>

  <!-- ===================== RESERVASI ===================== -->
  <section class="panel" id="panel-reservasi">
    <div class="card">
      <h2 class="section-title">Formulir Reservasi</h2>
      <form id="bookingForm">
        <div class="row2">
          <div>
            <label>Nama Orang Tua/Wali</label>
            <input type="text" id="b_parent" required>
          </div>
          <div>
            <label>No. WhatsApp</label>
            <input type="tel" id="b_phone" placeholder="08xxxxxxxxxx" required>
          </div>
        </div>
        <label>Tanggal Reservasi</label>
        <input type="date" id="b_date" required>
        <div id="b_kids"></div>
        <button type="button" class="btn-ghost" id="b_addKid" style="width:100%;margin-top:10px;">+ Tambah anak</button>
        <p class="hint" style="margin-top:6px;">Tersedia <strong>2 slot</strong> di setiap jam. Butuh jadwal di luar jam kerja (08.00–16.00)? Tetap bisa — silakan buat janji terlebih dahulu lewat <a href="https://wa.me/6281392450033" target="_blank" rel="noopener">WhatsApp</a>.</p>
        <label>Catatan (opsional)</label>
        <textarea id="b_notes" placeholder="Alergi, kondisi kulit, atau permintaan khusus lainnya"></textarea>
        <div id="bookingMsg"></div>
        <button type="submit" class="btn-primary">Kirim Reservasi</button>
      </form>
    </div>
  </section>

  <!-- ===================== TUMBUH KEMBANG ===================== -->
  <section class="panel" id="panel-tumbuhkembang">
    <div class="card" id="myKidsCard">
      <h2 class="section-title">Tumbuh Kembang Anak Saya</h2>
      <p class="hint" style="margin-bottom:10px;">Berat &amp; tinggi badan si kecil yang dicatat petugas Blue Haven saat kunjungan bisa kamu lihat di sini, lengkap dengan grafik. Cukup masukkan nomor WhatsApp yang dipakai saat reservasi.</p>
      <label>No. WhatsApp</label>
      <input type="tel" id="mk_phone" inputmode="tel" placeholder="08xxxxxxxxxx" autocomplete="tel">
      <button type="button" class="btn-primary" id="mk_btn" style="margin-top:12px;width:100%;">Lihat Tumbuh Kembang</button>
      <div id="myKidsList" style="margin-top:16px;"></div>
    </div>

    <div class="card" id="growthResult"></div>

    <div class="card">
      <h2 class="section-title">Hitung Sendiri &amp; Tambah Pengukuran</h2>
      <p class="hint" style="margin-bottom:10px;">Alat bantu estimasi status gizi &amp; pertumbuhan anak usia 0–18 tahun berdasarkan standar WHO (kategori Permenkes 2/2020): BB/U, TB/U, BB/TB, dan IMT/U lengkap dengan Z-score, persentil, rentang normal, dan saran tindak lanjut. Untuk usia 0–60 bulan juga tersedia grafik pita normal seperti pada Buku KIA.</p>
      <div class="notice info" id="olderGuide" style="margin-bottom:12px;">
        <strong>Anak di atas 60 bulan (5 tahun ke atas) — yang perlu diisi:</strong>
        <ol style="margin:6px 0 0 18px;padding:0;">
          <li><strong>Nama anak</strong> &amp; <strong>No. WhatsApp</strong> orang tua</li>
          <li><strong>Jenis kelamin</strong> (standar WHO berbeda antara laki-laki &amp; perempuan)</li>
          <li><strong>Tanggal lahir</strong> yang benar (menentukan usia dalam bulan)</li>
          <li><strong>Tanggal pengukuran</strong></li>
          <li><strong>Berat badan (kg)</strong> dan <strong>tinggi badan (cm)</strong> — IMT dihitung otomatis dari keduanya</li>
        </ol>
        <div class="hint" style="margin-top:6px;">Tips ukur: berat tanpa sepatu &amp; pakaian tebal; tinggi diukur berdiri tegak tanpa alas kaki. Penilaian status gizi anak 5–18 tahun memakai IMT menurut umur (IMT/U) dan tinggi menurut umur (TB/U); BB/U dinilai sampai usia 10 tahun.</div>
      </div>
      <form id="growthForm">
        <div class="row2">
          <div>
            <label>Nama Anak</label>
            <input type="text" id="g_name" required>
          </div>
          <div>
            <label>No. WhatsApp Orang Tua</label>
            <input type="tel" id="g_phone" placeholder="08xxxxxxxxxx" required>
          </div>
        </div>
        <p class="hint" style="margin-top:-6px;margin-bottom:10px;">Data ini dipakai untuk mengelompokkan riwayat pengukuran anak yang sama dari waktu ke waktu.</p>
        <div class="row2">
          <div>
            <label>Jenis Kelamin</label>
            <select id="g_sex">
              <option value="boy">Laki-laki</option>
              <option value="girl">Perempuan</option>
            </select>
          </div>
          <div>
            <label>Tanggal Lahir</label>
            <input type="date" id="g_dob" required>
          </div>
        </div>
        <div class="row2">
          <div>
            <label>Tanggal Pengukuran</label>
            <input type="date" id="g_date" required>
          </div>
          <div>
            <label>Usia Saat Ini</label>
            <input type="text" id="g_age" disabled placeholder="otomatis">
          </div>
        </div>
        <div class="row2">
          <div>
            <label>Berat Badan (kg)</label>
            <input type="number" step="0.1" min="0" id="g_weight" required>
          </div>
          <div>
            <label>Tinggi/Panjang Badan (cm)</label>
            <input type="number" step="0.1" min="0" id="g_height" required>
          </div>
        </div>
        <div id="g_olderInfo"></div>
        <button type="submit" class="btn-primary">Hitung & Simpan Pengukuran</button>
      </form>
      <div class="notice warn" style="margin-top:16px;">
        Ini bukan alat diagnosis medis. Untuk pemantauan resmi, gunakan grafik pada Buku KIA dan konsultasikan hasilnya dengan bidan, kader posyandu, atau dokter anak — terutama bila hasil menunjukkan risiko kurang/lebih.
      </div>
    </div>
  </section>

  <!-- ===================== STATUS RESERVASI (customer) ===================== -->
  <section class="panel" id="panel-statusku">
    <div class="card">
      <h2 class="section-title">Cek Status Reservasi</h2>
      <label>Masukkan No. WhatsApp yang dipakai saat memesan</label>
      <input type="tel" id="s_phone" placeholder="08xxxxxxxxxx">
      <button class="btn-ghost" style="margin-top:12px;" onclick="checkStatus()">Cari Reservasi</button>
      <div id="statusResult" style="margin-top:16px;"></div>
    </div>
  </section>

  <footer class="tiny">Blue Haven Baby & Kids Spa — Jalan Masjid Nur Rohman, Selojeneng, Sumberdadi, Kec. Sumbergempol, Kabupaten Tulungagung, Jawa Timur 66291</footer>
</div>

<script src="<?php echo asset_url('assets/growth-data.js'); ?>"></script>
<script src="<?php echo asset_url('assets/growth-who-lms.js'); ?>"></script>
<script src="<?php echo asset_url('assets/growth-assess.js'); ?>"></script>
<script src="<?php echo asset_url('assets/growth-chart.js'); ?>"></script>
<script src="<?php echo asset_url('assets/app.js'); ?>"></script>
<script src="<?php echo asset_url('assets/minigame.js'); ?>"></script>
<script>
  // Daftarkan service worker untuk PWA (aman diabaikan browser lama, tidak akan error)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(err => {
        console.log('Service worker gagal didaftarkan:', err);
      });
    });
  }
</script>
</body>
</html>
