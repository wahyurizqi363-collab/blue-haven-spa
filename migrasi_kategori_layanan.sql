-- ============================================================
-- MIGRASI: Kategori Layanan (Bayi < 2 Tahun / Terapi / Anak 2 Tahun+)
-- + tambah daftar layanan lengkap
--
-- Skrip ini TIDAK menghapus layanan lama (supaya tidak kena masalah
-- foreign key dengan reservasi yang sudah ada) — cuma MENAMBAHKAN
-- 29 layanan baru di bawah ini. Layanan contoh lama (Pijat Bayi Klasik,
-- dst) akan tetap ada dan otomatis masuk kategori "Anak 2 Tahun ke Atas".
-- Kamu bisa hapus manual lewat Panel Admin kalau tidak diperlukan lagi
-- (kalau ternyata gagal dihapus karena masih dipakai reservasi lama,
-- biarkan saja, tidak masalah — cukup jangan dipakai lagi untuk booking baru).
--
-- Kalau ini instalasi baru (baru pertama kali import schema.sql),
-- LEWATI file ini sepenuhnya — schema.sql sudah otomatis termasuk ini.
-- ============================================================


ALTER TABLE services
  ADD COLUMN IF NOT EXISTS category VARCHAR(30) NOT NULL DEFAULT 'kids' AFTER id,
  MODIFY COLUMN duration VARCHAR(20) NOT NULL;

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

