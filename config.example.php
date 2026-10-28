<?php
/**
 * Konfigurasi koneksi database — EXAMPLE (copy to config.php and fill in).
 * Ganti $DB_PASS di bawah dengan password akun InfinityFree kamu.
 */
$DB_HOST = 'localhost';
$DB_NAME = 'blue_haven_spa';
$DB_USER = 'root';
$DB_PASS = '';
$DB_CHARSET = 'utf8mb4';

$dsn = "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=$DB_CHARSET";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $DB_USER, $DB_PASS, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    die(json_encode([
        'error' => 'Koneksi database gagal. Cek kembali $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS di config.php.',
        'detail' => $e->getMessage(),
    ]));
}

// PIN sederhana untuk kunci panel admin (WAJIB diganti sebelum online!)
define('ADMIN_PIN', 'CHANGE_ME');

// Jumlah sesi selesai yang dibutuhkan untuk 1 kali gratis
define('SESSIONS_PER_REWARD', 10);
