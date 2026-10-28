<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {

        // GET /api/growth.php?phone=08xx&baby_name=Nama&baby_dob=YYYY-MM-DD -> riwayat 1 anak (dipakai halaman pelanggan)
        // GET /api/growth.php                            -> semua catatan (dipakai admin)
        // GET /api/growth.php?search=kata_kunci          -> cari nama anak / no. WA (dipakai admin)
        case 'GET':
            // GET /api/growth.php?children=1&phone=08xx
            //     -> daftar anak milik 1 no. WA + pengukuran terakhirnya (halaman "Tumbuh Kembang Anak Saya")
            // GET /api/growth.php?children=1&phone=08xx&baby_name=X&baby_dob=Y
            //     -> seluruh riwayat 1 anak
            // Nomor WA dicocokkan lewat 9 digit terakhir, jadi 0857..., +62857..., 62857... dan
            // tanda strip/spasi yang dipakai admin saat input tetap dianggap nomor yang sama.
            if (!empty($_GET['children']) && !empty($_GET['phone'])) {
                $tail = substr(preg_replace('/\D+/', '', (string)$_GET['phone']), -9);
                if (strlen($tail) < 9) {
                    http_response_code(400);
                    echo json_encode(['error' => 'Nomor WhatsApp tidak valid. Contoh: 08123456789']);
                    break;
                }
                $norm = "REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(CONVERT(phone USING utf8mb4),' ',''),'-',''),'\xE2\x80\x93',''),'\xE2\x80\x91',''),'\xE2\x88\x92',''),'+',''),'(',''),')',''),'.','')";
                $sql = "SELECT * FROM growth_records WHERE RIGHT($norm, 9) = ?";
                $params = [$tail];
                if (!empty($_GET['baby_name']) && !empty($_GET['baby_dob'])) {
                    $sql .= " AND baby_name = ? AND baby_dob = ?";
                    $params[] = $_GET['baby_name'];
                    $params[] = $_GET['baby_dob'];
                }
                $stmt = $pdo->prepare($sql . " ORDER BY measurement_date ASC, id ASC");
                $stmt->execute($params);
                $rows = $stmt->fetchAll();

                if (!empty($_GET['baby_name']) && !empty($_GET['baby_dob'])) {
                    echo json_encode($rows);   // riwayat lengkap 1 anak
                    break;
                }
                $kids = [];   // satu entri per anak (nama + tanggal lahir); urutan ASC jadi yang terakhir = terbaru
                foreach ($rows as $r) {
                    $key = (function_exists('mb_strtolower') ? mb_strtolower(trim($r['baby_name'])) : strtolower(trim($r['baby_name']))) . '|' . $r['baby_dob'];
                    if (!isset($kids[$key])) $kids[$key] = ['count' => 0];
                    $kids[$key] = [
                        'baby_name' => $r['baby_name'], 'baby_dob' => $r['baby_dob'], 'sex' => $r['sex'],
                        'count' => $kids[$key]['count'] + 1,
                        'last_date' => $r['measurement_date'], 'last_weight' => $r['weight'], 'last_height' => $r['height'],
                    ];
                }
                echo json_encode(array_values($kids));
                break;
            }

            if (!empty($_GET['phone']) && !empty($_GET['baby_name'])) {
                // baby_dob ikut disertakan sebagai kunci identitas anak (kalau tersedia),
                // supaya 2 anak berbeda dengan nama & no. WA yang kebetulan sama tidak tercampur.
                if (!empty($_GET['baby_dob'])) {
                    $stmt = $pdo->prepare(
                        "SELECT * FROM growth_records
                         WHERE phone = ? AND baby_name = ? AND baby_dob = ?
                         ORDER BY measurement_date ASC, id ASC"
                    );
                    $stmt->execute([$_GET['phone'], $_GET['baby_name'], $_GET['baby_dob']]);
                } else {
                    $stmt = $pdo->prepare(
                        "SELECT * FROM growth_records
                         WHERE phone = ? AND baby_name = ?
                         ORDER BY measurement_date ASC, id ASC"
                    );
                    $stmt->execute([$_GET['phone'], $_GET['baby_name']]);
                }
                echo json_encode($stmt->fetchAll());
                break;
            }

            admin_require_json(); // daftar semua / pencarian = khusus admin
            if (!empty($_GET['search'])) {
                $kw = '%' . $_GET['search'] . '%';
                $stmt = $pdo->prepare(
                    "SELECT * FROM growth_records
                     WHERE baby_name LIKE ? OR phone LIKE ?
                     ORDER BY created_at DESC LIMIT 200"
                );
                $stmt->execute([$kw, $kw]);
                echo json_encode($stmt->fetchAll());
                break;
            }

            $stmt = $pdo->query("SELECT * FROM growth_records ORDER BY created_at DESC LIMIT 200");
            echo json_encode($stmt->fetchAll());
            break;

        // POST /api/growth.php -> tambah 1 catatan pengukuran baru
        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);
            $required = ['phone','baby_name','baby_dob','sex','measurement_date','weight','height'];
            foreach ($required as $field) {
                if (empty($data[$field]) && $data[$field] !== '0') {
                    http_response_code(400);
                    echo json_encode(['error' => "Field '$field' wajib diisi."]);
                    exit;
                }
            }
            $stmt = $pdo->prepare(
                "INSERT INTO growth_records
                 (phone, baby_name, baby_dob, sex, measurement_date, weight, height)
                 VALUES (?,?,?,?,?,?,?)"
            );
            $stmt->execute([
                $data['phone'],
                $data['baby_name'],
                $data['baby_dob'],
                $data['sex'],
                $data['measurement_date'],
                (float)$data['weight'],
                (float)$data['height'],
            ]);
            echo json_encode(['id' => $pdo->lastInsertId()]);
            break;

        // PUT /api/growth.php -> betulkan 1 catatan (admin): { id, measurement_date, weight, height, sex }
        case 'PUT':
            admin_require_json();
            $data = json_decode(file_get_contents('php://input'), true);
            $id = (int)($data['id'] ?? 0);
            $w = (float)str_replace(',', '.', (string)($data['weight'] ?? 0));
            $h = (float)str_replace(',', '.', (string)($data['height'] ?? 0));
            $sex = (string)($data['sex'] ?? '');
            $d = (string)($data['measurement_date'] ?? '');
            if (!$id || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $d) || !in_array($sex, ['boy', 'girl'], true)
                || $w <= 0 || $w > 120 || $h < 20 || $h > 200) {
                http_response_code(400);
                echo json_encode(['error' => 'Data tidak valid. Berat 0-120 kg, tinggi 20-200 cm, tanggal dan jenis kelamin wajib diisi.']);
                exit;
            }
            $stmt = $pdo->prepare("UPDATE growth_records SET measurement_date=?, weight=?, height=?, sex=? WHERE id=?");
            $stmt->execute([$d, $w, $h, $sex, $id]);
            echo json_encode(['success' => true]);
            break;

        // DELETE /api/growth.php?id=123 -> hapus 1 catatan (misalnya salah input)
        case 'DELETE':
            admin_require_json();
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID catatan tidak ada.']);
                exit;
            }
            $stmt = $pdo->prepare("DELETE FROM growth_records WHERE id=?");
            $stmt->execute([(int)$id]);
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
