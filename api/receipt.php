<?php
/**
 * Simpan gambar struk (PNG) ke folder /receipts supaya bisa dikirim ke WhatsApp
 * orang tua sebagai tautan. Dipanggil dari tombol "Kirim ke WA Orang Tua" di Panel Admin.
 *
 * - Wajib kirim header X-Admin-Pin (sama dengan ADMIN_PIN di config.php).
 * - Nama file memakai kode acak yang tidak bisa ditebak, jadi tautannya
 *   hanya bisa dibuka oleh orang yang menerimanya.
 */
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

function fail(int $code, string $msg): void {
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

// Cek cepat lewat browser: buka .../api/receipt.php?cek=1
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['cek'])) {
    $d = __DIR__ . '/../receipts';
    if (!is_dir($d)) @mkdir($d, 0755, true);
    echo json_encode([
        'file_receipt_php' => 'ada',
        'folder_receipts_ada' => is_dir($d),
        'folder_receipts_bisa_ditulis' => is_dir($d) && is_writable($d),
        'php' => PHP_VERSION,
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Method tidak didukung.');

admin_require_json(); // wajib login admin

$data = json_decode(file_get_contents('php://input'), true);
$id   = (int)($data['booking_id'] ?? 0);
$img  = (string)($data['image'] ?? '');
$prefix = 'data:image/png;base64,';

if ($id <= 0 || strpos($img, $prefix) !== 0) fail(400, 'Data struk tidak lengkap.');

$bin = base64_decode(substr($img, strlen($prefix)), true);
if ($bin === false || strlen($bin) > 3 * 1024 * 1024 || substr($bin, 0, 8) !== "\x89PNG\r\n\x1a\n") {
    fail(400, 'File struk tidak valid.');
}

try {
    $st = $pdo->prepare('SELECT id FROM bookings WHERE id = ?');
    $st->execute([$id]);
    if (!$st->fetch()) fail(404, 'Reservasi tidak ditemukan.');
} catch (\PDOException $e) {
    fail(500, $e->getMessage());
}

$dir = __DIR__ . '/../receipts';
if (!is_dir($dir)) @mkdir($dir, 0755, true);
if (!is_dir($dir) || !is_writable($dir)) fail(500, 'Folder receipts tidak bisa ditulis di hosting.');
if (!file_exists($dir . '/index.html')) @file_put_contents($dir . '/index.html', ''); // cegah daftar isi folder tampil

$token = substr(hash_hmac('sha256', 'struk-' . $id, ADMIN_PIN . $DB_PASS), 0, 24);
$name  = 'struk-' . $id . '-' . $token . '.png';

if (file_put_contents($dir . '/' . $name, $bin) === false) fail(500, 'Gagal menyimpan file struk.');

echo json_encode(['path' => 'receipts/' . $name]);
