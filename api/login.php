<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/../auth.php';

try {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode(['logged_in' => admin_is_logged_in()]);
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method tidak didukung.']);
        exit;
    }

    $data = json_decode(file_get_contents('php://input'), true) ?: [];

    if (($data['action'] ?? '') === 'logout') {
        admin_clear_cookie();
        echo json_encode(['success' => true]);
        exit;
    }

    $hash = admin_hash();
    if ($hash === null) {
        http_response_code(409);
        echo json_encode(['error' => 'Password admin belum dibuat. Buka setup_password.php dulu.']);
        exit;
    }
    if (login_is_locked()) {
        http_response_code(429);
        echo json_encode(['error' => 'Terlalu banyak percobaan salah. Coba lagi dalam 15 menit.']);
        exit;
    }

    $pw = (string)($data['password'] ?? '');
    if ($pw !== '' && password_verify($pw, $hash)) {
        login_clear();
        admin_issue_cookie();
        echo json_encode(['success' => true]);
    } else {
        login_record_fail();
        http_response_code(401);
        echo json_encode(['error' => 'Password salah.']);
    }
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Terjadi kesalahan server.']);
}
