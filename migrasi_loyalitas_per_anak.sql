-- ============================================================
-- MIGRASI: Loyalitas per-ORANG TUA -> per-ANAK
-- Jalankan skrip ini SEKALI SAJA lewat phpMyAdmin (tab SQL),
-- setelah update kode ke versi yang mendukung loyalitas per anak.
--
-- Efeknya:
--  - Tabel loyalty lama (dikunci per nomor WA) dihapus & dibuat ulang
--    dengan kunci baru: nomor WA + nama anak + tanggal lahir.
--  - Jumlah sesi selesai dihitung ULANG dari tabel bookings yang
--    sudah berstatus "done", supaya datanya akurat per anak.
--  - Catatan reward yang SUDAH ditandai "Terpakai" sebelumnya TIDAK
--    ikut terbawa (rewards_redeemed di-reset ke 0). Kalau ada
--    pelanggan yang sebelumnya sudah pernah pakai reward, catat
--    manual dan tandai ulang lewat Panel Admin setelah migrasi ini.
-- ============================================================


DROP TABLE IF EXISTS loyalty;

CREATE TABLE loyalty (
  phone VARCHAR(30) NOT NULL,
  baby_name VARCHAR(150) NOT NULL,
  baby_dob DATE NOT NULL,
  name VARCHAR(150),
  completed_count INT NOT NULL DEFAULT 0,
  rewards_redeemed INT NOT NULL DEFAULT 0,
  PRIMARY KEY (phone, baby_name, baby_dob)
) ENGINE=InnoDB;

INSERT INTO loyalty (phone, baby_name, baby_dob, name, completed_count, rewards_redeemed)
SELECT phone, baby_name, baby_dob, MAX(parent_name), COUNT(*), 0
FROM bookings
WHERE status = 'done'
GROUP BY phone, baby_name, baby_dob;
