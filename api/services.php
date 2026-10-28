<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {

        case 'GET':
            try {
                $stmt = $pdo->query("SELECT * FROM services WHERE is_active = 1 ORDER BY id");
            } catch (\PDOException $e) {
                // kolom is_active belum ada (migrasi belum dijalankan) -> pakai query lama
                $stmt = $pdo->query("SELECT * FROM services ORDER BY id");
            }
            echo json_encode($stmt->fetchAll());
            break;

        case 'POST':
            admin_require_json();
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['name']) || empty($data['duration']) || empty($data['price'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Nama, durasi, dan harga wajib diisi.']);
                break;
            }
            $category = in_array($data['category'] ?? '', ['newborn','newborn_pkg','baby','therapy','kids','mom','traditional']) ? $data['category'] : 'kids';
            $stmt = $pdo->prepare(
                "INSERT INTO services (category, name, duration, price, description) VALUES (?,?,?,?,?)"
            );
            $stmt->execute([
                $category,
                $data['name'],
                $data['duration'],
                (int)$data['price'],
                $data['description'] ?? '',
            ]);
            echo json_encode(['id' => $pdo->lastInsertId()]);
            break;

        case 'PUT':
            admin_require_json();
            $data = json_decode(file_get_contents('php://input'), true);
            if (empty($data['id'])) {
                http_response_code(400);
                echo json_encode(['error' => 'ID layanan tidak ada.']);
                break;
            }
            $category = in_array($data['category'] ?? '', ['newborn','newborn_pkg','baby','therapy','kids','mom','traditional']) ? $data['category'] : 'kids';
            $stmt = $pdo->prepare(
                "UPDATE services SET category=?, name=?, duration=?, price=?, description=? WHERE id=?"
            );
            $stmt->execute([
                $category,
                $data['name'],
                $data['duration'],
                (int)$data['price'],
                $data['description'] ?? '',
                (int)$data['id'],
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'DELETE':
            admin_require_json();
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID layanan tidak ada.']);
                break;
            }
            try {
                $stmt = $pdo->prepare("DELETE FROM services WHERE id=?");
                $stmt->execute([(int)$id]);
            } catch (\PDOException $e) {
                // Layanan sudah punya riwayat reservasi -> jangan dihapus, cukup disembunyikan
                if ($e->getCode() === '23000') {
                    $stmt = $pdo->prepare("UPDATE services SET is_active = 0 WHERE id=?");
                    $stmt->execute([(int)$id]);
                } else {
                    throw $e;
                }
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
