<?php
/**
 * Autentikasi admin (password + cookie bertanda tangan, berlaku 12 jam).
 * Dipakai oleh admin.php dan semua API khusus admin.
 * Password disimpan sebagai hash di admin_hash.php (dibuat lewat setup_password.php).
 */
require_once __DIR__ . '/config.php';

const ADMIN_COOKIE   = 'bh_admin';
const ADMIN_TTL      = 43200; // 12 jam
const LOGIN_MAX_FAIL = 5;     // percobaan salah
const LOGIN_WINDOW   = 900;   // dalam 15 menit

function admin_hash(): ?string {
    $f = __DIR__ . '/admin_hash.php';
    if (!is_file($f)) return null;
    $h = include $f;
    return is_string($h) && $h !== '' ? $h : null;
}

function admin_is_https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function admin_secret(): string {
    global $DB_PASS;
    return hash('sha256', (string)admin_hash() . '|' . $DB_PASS . '|bluehaven');
}

function admin_issue_cookie(): void {
    $exp = time() + ADMIN_TTL;
    $val = $exp . '.' . hash_hmac('sha256', (string)$exp, admin_secret());
    setcookie(ADMIN_COOKIE, $val, [
        'expires' => $exp, 'path' => '/', 'secure' => admin_is_https(),
        'httponly' => true, 'samesite' => 'Lax',
    ]);
}

function admin_clear_cookie(): void {
    setcookie(ADMIN_COOKIE, '', [
        'expires' => time() - 3600, 'path' => '/', 'secure' => admin_is_https(),
        'httponly' => true, 'samesite' => 'Lax',
    ]);
}

function admin_is_logged_in(): bool {
    if (admin_hash() === null) return false;
    $c = $_COOKIE[ADMIN_COOKIE] ?? '';
    if (!is_string($c) || strpos($c, '.') === false) return false;
    [$exp, $sig] = explode('.', $c, 2);
    if (!ctype_digit($exp) || (int)$exp < time()) return false;
    return hash_equals(hash_hmac('sha256', $exp, admin_secret()), $sig);
}

/** Dipakai di API admin: hentikan dengan 401 kalau belum login. (Cookie SameSite=Lax mencegah permintaan lintas-situs.) */
function admin_require_json(): void {
    header('Content-Type: application/json; charset=utf-8');
    if (!admin_is_logged_in()) {
        http_response_code(401);
        echo json_encode(['error' => 'Belum login. Silakan masuk ke panel admin.']);
        exit;
    }
}

/* ---- Pembatas percobaan login (per alamat IP, disimpan di database) ---- */
function login_ip(): string { return substr($_SERVER['REMOTE_ADDR'] ?? 'unknown', 0, 45); }

function login_table(): void {
    global $pdo;
    $pdo->exec("CREATE TABLE IF NOT EXISTS login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY, ip VARCHAR(45) NOT NULL,
        attempted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_ip (ip, attempted_at)
    ) ENGINE=InnoDB");
}

function login_is_locked(): bool {
    global $pdo; login_table();
    $pdo->exec("DELETE FROM login_attempts WHERE attempted_at < (NOW() - INTERVAL 1 DAY)");
    $s = $pdo->prepare("SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at > (NOW() - INTERVAL " . LOGIN_WINDOW . " SECOND)");
    $s->execute([login_ip()]);
    return (int)$s->fetchColumn() >= LOGIN_MAX_FAIL;
}

function login_record_fail(): void {
    global $pdo; login_table();
    $pdo->prepare("INSERT INTO login_attempts (ip) VALUES (?)")->execute([login_ip()]);
    usleep(600000);
}

function login_clear(): void {
    global $pdo;
    $pdo->prepare("DELETE FROM login_attempts WHERE ip = ?")->execute([login_ip()]);
}
