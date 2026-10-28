<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {

        // GET /api/loyalty.php                                          -> semua anak (untuk admin)
        // GET /api/loyalty.php?phone=08xx&baby_name=X&baby_dob=Y        -> 1 anak spesifik (halaman cek status)
        // GET /api/loyalty.php?phone=08xx                               -> semua anak dari 1 no. WA (dipakai halaman cek status untuk daftar anak)
        case 'GET':
            if (!empty($_GET['phone']) && !empty($_GET['baby_name']) && !empty($_GET['baby_dob'])) {
                $stmt = $pdo->prepare("SELECT * FROM loyalty WHERE phone = ? AND baby_name = ? AND baby_dob = ?");
                $stmt->execute([$_GET['phone'], $_GET['baby_name'], $_GET['baby_dob']]);
                $row = $stmt->fetch();
                echo json_encode($row ?: null);
            } elseif (!empty($_GET['phone'])) {
                $stmt = $pdo->prepare("SELECT * FROM loyalty WHERE phone = ? ORDER BY completed_count DESC");
                $stmt->execute([$_GET['phone']]);
                echo json_encode($stmt->fetchAll());
            } else {
                admin_require_json();
                $stmt = $pdo->query("SELECT * FROM loyalty ORDER BY completed_count DESC");
                echo json_encode($stmt->fetchAll());
            }
            break;

        // POST /api/loyalty.php -> tandai 1 reward sudah dipakai (untuk 1 anak spesifik)
        // body: { phone, baby_name, baby_dob }
        case 'POST':
            admin_require_json();
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['phone']) || empty($data['baby_name']) || empty($data['baby_dob'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Nomor telepon, nama anak, dan tanggal lahir wajib diisi.']);
                exit;
            }
            $stmt = $pdo->prepare("SELECT * FROM loyalty WHERE phone = ? AND baby_name = ? AND baby_dob = ?");
            $stmt->execute([$data['phone'], $data['baby_name'], $data['baby_dob']]);
            $row = $stmt->fetch();
            if (!$row) {
                http_response_code(404);
                echo json_encode(['error' => 'Data loyalitas tidak ditemukan.']);
                exit;
            }
            $available = intdiv($row['completed_count'], SESSIONS_PER_REWARD) - $row['rewards_redeemed'];
            if ($available <= 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Belum ada reward yang tersedia untuk ditukar.']);
                exit;
            }
            $upd = $pdo->prepare("UPDATE loyalty SET rewards_redeemed = rewards_redeemed + 1 WHERE phone = ? AND baby_name = ? AND baby_dob = ?");
            $upd->execute([$data['phone'], $data['baby_name'], $data['baby_dob']]);
            echo json_encode(['success' => true]);
            break;

        // PUT /api/loyalty.php -> koreksi data loyalitas 1 anak (khusus admin)
        // body: { phone, baby_name, baby_dob, completed_count, rewards_redeemed, name? }
        case 'PUT':
            admin_require_json();
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            if (empty($data['phone']) || empty($data['baby_name']) || empty($data['baby_dob'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Nomor telepon, nama anak, dan tanggal lahir wajib diisi.']);
                exit;
            }
            if (!isset($data['completed_count']) || !is_numeric($data['completed_count'])
                || !isset($data['rewards_redeemed']) || !is_numeric($data['rewards_redeemed'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Jumlah sesi selesai dan reward terpakai harus berupa angka.']);
                exit;
            }
            $count    = (int)$data['completed_count'];
            $redeemed = (int)$data['rewards_redeemed'];
            if ($count < 0 || $redeemed < 0) {
                http_response_code(400);
                echo json_encode(['error' => 'Angka tidak boleh negatif.']);
                exit;
            }
            if ($count > 1000) {
                http_response_code(400);
                echo json_encode(['error' => 'Jumlah sesi terlalu besar, periksa kembali.']);
                exit;
            }
            $earned = intdiv($count, SESSIONS_PER_REWARD);
            if ($redeemed > $earned) {
                http_response_code(400);
                echo json_encode(['error' => "Reward terpakai ($redeemed) tidak boleh melebihi reward yang diperoleh ($earned) dari $count sesi."]);
                exit;
            }
            $stmt = $pdo->prepare("SELECT 1 FROM loyalty WHERE phone = ? AND baby_name = ? AND baby_dob = ?");
            $stmt->execute([$data['phone'], $data['baby_name'], $data['baby_dob']]);
            if (!$stmt->fetchColumn()) {
                http_response_code(404);
                echo json_encode(['error' => 'Data loyalitas tidak ditemukan.']);
                exit;
            }
            $parent = isset($data['name']) ? trim((string)$data['name']) : null;
            $upd = $pdo->prepare(
                "UPDATE loyalty SET completed_count = ?, rewards_redeemed = ?, name = COALESCE(?, name)
                 WHERE phone = ? AND baby_name = ? AND baby_dob = ?"
            );
            $upd->execute([$count, $redeemed, ($parent === '' ? null : $parent), $data['phone'], $data['baby_name'], $data['baby_dob']]);
            echo json_encode(['success' => true]);
            break;

        // DELETE /api/loyalty.php?phone=..&baby_name=..&baby_dob=.. -> hapus data loyalitas 1 anak (khusus admin)
        // Catatan: hanya menghapus baris loyalitas; riwayat reservasi tetap ada.
        case 'DELETE':
            admin_require_json();
            $phone = $_GET['phone'] ?? '';
            $baby  = $_GET['baby_name'] ?? '';
            $dob   = $_GET['baby_dob'] ?? '';
            if ($phone === '' || $baby === '' || $dob === '') {
                http_response_code(400);
                echo json_encode(['error' => 'Nomor telepon, nama anak, dan tanggal lahir wajib diisi.']);
                exit;
            }
            $del = $pdo->prepare("DELETE FROM loyalty WHERE phone = ? AND baby_name = ? AND baby_dob = ?");
            $del->execute([$phone, $baby, $dob]);
            if ($del->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'Data loyalitas tidak ditemukan.']);
                exit;
            }
            echo json_encode(['success' => true]);
            break;

        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method tidak didukung.']);
    }
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
