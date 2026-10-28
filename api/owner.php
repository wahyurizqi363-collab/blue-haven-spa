<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../owner_auth.php';
admin_require_json();

try {
    $hash = owner_hash();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        echo json_encode(['configured' => $hash !== null, 'unlocked' => owner_is_unlocked()]);
        exit;
    }
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method tidak didukung.']);
        exit;
    }

    $data   = json_decode(file_get_contents('php://input'), true) ?: [];
    $action = $data['action'] ?? '';
    $pw     = (string)($data['password'] ?? '');

    if ($action === 'lock') {
        owner_clear_cookie();
        echo json_encode(['success' => true]);
        exit;
    }

    // Password baru: minimal 6 karakter & tidak boleh sama dengan password admin
    $checkNew = function (string $new) {
        if (strlen($new) < 6) {
            http_response_code(400);
            echo json_encode(['error' => 'Password owner minimal 6 karakter.']);
            exit;
        }
        $adminHash = admin_hash();
        if ($adminHash !== null && password_verify($new, $adminHash)) {
            http_response_code(400);
            echo json_encode(['error' => 'Password owner tidak boleh sama dengan password admin.']);
            exit;
        }
    };

    if ($action === 'setup') {
        if ($hash !== null) {
            http_response_code(409);
            echo json_encode(['error' => 'Password owner sudah dibuat.']);
            exit;
        }
        $checkNew($pw);
        owner_save_hash(password_hash($pw, PASSWORD_DEFAULT));
        owner_issue_cookie();
        echo json_encode(['success' => true]);
        exit;
    }

    if ($hash === null) {
        http_response_code(409);
        echo json_encode(['error' => 'Password owner belum dibuat.']);
        exit;
    }
    if (owner_is_locked()) {
        http_response_code(429);
        echo json_encode(['error' => 'Terlalu banyak percobaan salah. Coba lagi dalam 15 menit.']);
        exit;
    }

    if ($action === 'unlock') {
        if ($pw !== '' && password_verify($pw, $hash)) {
            owner_clear_fails();
            owner_issue_cookie();
            echo json_encode(['success' => true]);
        } else {
            owner_record_fail();
            http_response_code(403); // 403 (bukan 401) supaya halaman tidak ter-reload
            echo json_encode(['error' => 'Password owner salah.']);
        }
        exit;
    }

    if ($action === 'change') {
        $new = (string)($data['new_password'] ?? '');
        if ($pw === '' || !password_verify($pw, $hash)) {
            owner_record_fail();
            http_response_code(403);
            echo json_encode(['error' => 'Password owner lama salah.']);
            exit;
        }
        $checkNew($new);
        owner_clear_fails();
        owner_save_hash(password_hash($new, PASSWORD_DEFAULT));
        owner_issue_cookie();
        echo json_encode(['success' => true]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Aksi tidak dikenal.']);
} catch (\Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Terjadi kesalahan server.']);
}
