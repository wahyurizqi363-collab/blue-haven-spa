<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/../auth.php';
admin_require_json();

try {
    // Migrasi otomatis kolom yang dibutuhkan
    if (!$pdo->query("SHOW COLUMNS FROM bookings LIKE 'admin_seen'")->fetch()) {
        $pdo->exec("ALTER TABLE bookings ADD COLUMN admin_seen TINYINT(1) NOT NULL DEFAULT 0");
        $pdo->exec("UPDATE bookings SET admin_seen = 1");
    }
    if (!$pdo->query("SHOW COLUMNS FROM bookings LIKE 'admin_hidden'")->fetch()) {
        $pdo->exec("ALTER TABLE bookings ADD COLUMN admin_hidden TINYINT(1) NOT NULL DEFAULT 0");
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $action = $data['action'] ?? 'read';           // read | hide
        $ids = array_values(array_filter(array_map('intval', (array)($data['ids'] ?? []))));
        if (!empty($data['id'])) $ids[] = (int)$data['id'];

        if (!empty($data['all'])) {
            $pdo->exec("UPDATE bookings SET admin_seen = 1 WHERE admin_seen = 0 AND admin_hidden = 0");
        } elseif ($ids) {
            $in = implode(',', array_fill(0, count($ids), '?'));
            // "hide" hanya menyembunyikan notifikasi; data reservasi TIDAK dihapus
            $sql = $action === 'hide'
                ? "UPDATE bookings SET admin_hidden = 1, admin_seen = 1 WHERE id IN ($in)"
                : "UPDATE bookings SET admin_seen = 1 WHERE id IN ($in)";
            $pdo->prepare($sql)->execute($ids);
        }
        echo json_encode(['success' => true]);
        exit;
    }

    $unread = (int)$pdo->query("SELECT COUNT(*) FROM bookings WHERE admin_seen = 0 AND admin_hidden = 0")->fetchColumn();
    $items = $pdo->query(
        "SELECT b.id, b.parent_name, b.phone, b.baby_name, b.booking_date, b.booking_time,
                b.admin_seen, TIMESTAMPDIFF(SECOND, b.created_at, NOW()) AS age_seconds,
                s.name AS service_name
         FROM bookings b LEFT JOIN services s ON s.id = b.service_id
         WHERE b.admin_hidden = 0
         ORDER BY b.created_at DESC LIMIT 30"
    )->fetchAll();
    echo json_encode(['unread' => $unread, 'items' => $items]);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Gagal memuat notifikasi.']);
}
