-- ============================================================
-- MIGRASI: Tambah fitur Metode Pembayaran (Cash/QRIS/Transfer)
-- Jalankan sekali saja lewat phpMyAdmin (tab SQL), kalau website
-- kamu sudah pernah pakai versi SEBELUM fitur pembayaran ada.
--
-- Kalau ini instalasi baru (baru pertama kali import schema.sql),
-- LEWATI file ini — schema.sql sudah otomatis termasuk fitur ini.
-- ============================================================


ALTER TABLE bookings
  ADD COLUMN payment_method ENUM('cash','qris','transfer') NOT NULL DEFAULT 'cash' AFTER status,
  ADD COLUMN payment_status ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid' AFTER payment_method;

CREATE TABLE IF NOT EXISTS settings (
  setting_key VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(255)
) ENGINE=InnoDB;

INSERT IGNORE INTO settings (setting_key, setting_value) VALUES
('bank_name', 'BCA'),
('bank_account_number', '1234567890'),
('bank_account_holder', 'Nama Pemilik Usaha');
