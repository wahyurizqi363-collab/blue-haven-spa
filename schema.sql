-- ============================================================
-- Blue Haven Baby & Kids Spa — Skema Database
--
-- Cara pakai DI XAMPP (lokal):
--   1. Buat database baru bernama: blue_haven_spa (lewat phpMyAdmin,
--      klik "New"/"Baru", ketik nama, klik Create)
--   2. Pilih database itu, buka tab "Import", pilih file ini, klik "Go"
--
-- Cara pakai DI HOSTING GRATIS (InfinityFree/shared hosting lain):
--   1. Buat database lewat vPanel/cPanel (BUKAN lewat SQL) — hosting
--      gratis biasanya tidak mengizinkan CREATE DATABASE via SQL,
--      makanya cara ini beda dari XAMPP
--   2. Pilih database itu di phpMyAdmin, baru buka tab "Import",
--      pilih file ini, klik "Go" — skrip ini tidak lagi mencoba
--      membuat database sendiri, jadi aman dipakai di kedua tempat
-- ============================================================

-- ------------------------------------------------------------
-- Tabel layanan (services)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category VARCHAR(30) NOT NULL DEFAULT 'kids' COMMENT 'baby | therapy | kids',
  name VARCHAR(150) NOT NULL,
  duration VARCHAR(20) NOT NULL COMMENT 'contoh: 20-30 (menit), bisa rentang',
  price INT NOT NULL COMMENT 'harga dalam rupiah',
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabel reservasi (bookings)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  parent_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  baby_name VARCHAR(150) NOT NULL,
  baby_dob DATE NOT NULL,
  service_id INT NOT NULL,
  booking_date DATE NOT NULL,
  booking_time VARCHAR(10) NOT NULL,
  notes TEXT,
  status ENUM('pending','confirmed','done','cancelled') NOT NULL DEFAULT 'pending',
  discount_percent INT NOT NULL DEFAULT 0,
  final_total INT NULL COMMENT 'total setelah diskon (diisi saat transaksi selesai)',
  cash_received INT NULL COMMENT 'uang yang diterima dari pelanggan',
  change_given INT NULL COMMENT 'kembalian',
  payment_method ENUM('cash','qris','transfer') NOT NULL DEFAULT 'cash',
  payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  loyalty_counted TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES services(id),
  INDEX idx_date_time (booking_date, booking_time),
  INDEX idx_phone (phone)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabel pengaturan (settings) — info rekening bank untuk metode Transfer
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(255)
) ENGINE=InnoDB;

INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
('bank_name', 'BCA'),
('bank_account_number', '1234567890'),
('bank_account_holder', 'Nama Pemilik Usaha');

-- ------------------------------------------------------------
-- Tabel loyalitas (loyalty) — 1 baris per ANAK (bukan per orang tua)
-- Dikenali lewat kombinasi phone + baby_name + baby_dob
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty (
  phone VARCHAR(30) NOT NULL,
  baby_name VARCHAR(150) NOT NULL,
  baby_dob DATE NOT NULL,
  name VARCHAR(150),
  completed_count INT NOT NULL DEFAULT 0,
  rewards_redeemed INT NOT NULL DEFAULT 0,
  PRIMARY KEY (phone, baby_name, baby_dob)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Tabel riwayat tumbuh kembang (growth_records)
-- 1 baris per pengukuran; dikelompokkan per anak lewat phone + baby_name
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS growth_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  phone VARCHAR(30) NOT NULL,
  baby_name VARCHAR(150) NOT NULL,
  baby_dob DATE NOT NULL,
  sex ENUM('boy','girl') NOT NULL,
  measurement_date DATE NOT NULL,
  weight DECIMAL(5,2) NOT NULL,
  height DECIMAL(5,2) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone_baby (phone, baby_name)
) ENGINE=InnoDB;

-- ------------------------------------------------------------
-- Data awal layanan (boleh diubah lewat panel admin nanti)
-- ------------------------------------------------------------
INSERT INTO services (category, name, duration, price, description) VALUES
-- ===== FOR BABY UNDER 2 YEARS =====
('baby','Baby Massage (0-3 bulan)','20-30',35000,''),
('baby','Baby Massage (3-12 bulan)','20-30',40000,''),
('baby','Baby Massage (12-24 bulan)','20-30',50000,''),
('baby','Baby Gym Ball Exercise (3-24 bulan)','10-20',25000,''),
('baby','Baby Smart Brain Exercise','10-20',25000,''),
('baby','Mix Baby Brain Gym & Gym Ball Exercise','20-30',40000,''),
('baby','Mix Baby Massage & Gym (3-24 bulan)','30-40',55000,''),
('baby','Baby Swim (termasuk Gym) (3-24 bulan)','20-30',75000,''),
('baby','Baby SPA (Massage + Gym + Swim) (3-24 bulan)','50-60',100000,''),
('baby','Cukur Gundul Baby','20-30',40000,'Gratis balur minyak kemiri'),
('baby','Baby Care','20-30',25000,'Potong kuku, membersihkan telinga, hidung, dan mulut'),

-- ===== BABY & KIDS FOR THERAPY =====
('therapy','Massage for Colic Abdomen','30-45',60000,'Membantu meredakan kolik'),
('therapy','Massage for Constipation','30-45',60000,'Membantu melancarkan BAB'),
('therapy','Massage for Wind Abdomen','30-45',60000,'Membantu meredakan kembung'),
('therapy','Massage for Common Cold','30-45',60000,'Membantu meredakan batuk pilek'),
('therapy','Massage for Increased Appetite','30-45',60000,'Membantu menambah nafsu makan'),
('therapy','Massage Special for Premature','30-45',60000,'Sentuhan & stimulasi untuk bayi prematur'),

-- ===== FOR KIDS 2 YEARS AND UP =====
('kids','Kids Massage Aromatherapy','30-45',60000,''),
('kids','Kids Scrub + Washlap Air Hangat','20-30',40000,''),
('kids','Bubble Bath','20-30',50000,'Mandi busa berbagai pilihan aroma, gratis gym exercise'),
('kids','Mix Kids Massage + Scrub + Washlap Air Hangat','40-50',85000,''),
('kids','Kids SPA (Massage + Scrub + Bathtub Swim)','50-60',125000,''),
('kids','Face Massage Aromatherapy','10-20',25000,''),
('kids','Face Mask','10-20',25000,''),
('kids','Mix Face Massage & Face Mask','20-30',40000,''),
('kids','Special Package Full Body Treatment','60-90',150000,'Massage, scrub, mask, bubble bath'),
('kids','Kids Gym Ball Exercise','10-20',30000,''),
('kids','Kids Smart Brain Exercise','10-20',30000,''),
('kids','Mix Kids Brain Gym Ball Exercise','20-30',30000,'');
