-- ============================================================
-- MIGRASI: Fitur Kasir (diskon, uang diterima, kembalian)
-- Jalankan sekali saja lewat phpMyAdmin (tab SQL).
--
-- Menambahkan 4 kolom ke tabel bookings untuk menyimpan
-- rincian transaksi saat admin menyelesaikan sesi.
-- ============================================================


ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS discount_percent INT NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN IF NOT EXISTS final_total INT NULL AFTER discount_percent,
  ADD COLUMN IF NOT EXISTS cash_received INT NULL AFTER final_total,
  ADD COLUMN IF NOT EXISTS change_given INT NULL AFTER cash_received;
