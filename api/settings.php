<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    switch ($method) {

        // GET /api/settings.php -> semua pengaturan sebagai object {key: value}
        case 'GET':
            $stmt = $pdo->query("SELECT setting_key, setting_value FROM settings");
            $rows = $stmt->fetchAll();
            $result = [];
            foreach ($rows as $row) {
                $result[$row['setting_key']] = $row['setting_value'];
            }
            echo json_encode($result);
            break;

        // PUT /api/settings.php -> update satu atau lebih pengaturan
        // body: { bank_name: "...", bank_account_number: "...", bank_account_holder: "..." }
        case 'PUT':
            admin_require_json();
            $data = json_decode(file_get_contents('php://input'), true);
            $allowedKeys = ['bank_name', 'bank_account_number', 'bank_account_holder'];
            $stmt = $pdo->prepare(
                "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)"
            );
            foreach ($allowedKeys as $key) {
                if (isset($data[$key])) {
                    $stmt->execute([$key, $data[$key]]);
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
