<?php
/**
 * Password OWNER (lapisan kedua) khusus menu Pendapatan.
 * Hash password disimpan di tabel owner_auth (dibuat otomatis).
 * Dibuka lewat cookie bertanda tangan, berlaku 15 menit.
 */
require_once __DIR__ . '/auth.php';

const OWNER_COOKIE = 'bh_owner';
const OWNER_TTL    = 900; // 15 menit

function owner_table(): void {
    global $pdo;
    $pdo->exec("CREATE TABLE IF NOT EXISTS owner_auth (
        id TINYINT NOT NULL PRIMARY KEY,
        pw_hash VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB");
}

function owner_hash(): ?string {
    global $pdo; owner_table();
    $h = $pdo->query("SELECT pw_hash FROM owner_auth WHERE id = 1")->fetchColumn();
    return is_string($h) && $h !== '' ? $h : null;
}

function owner_save_hash(string $hash): void {
    global $pdo; owner_table();
    $pdo->prepare("INSERT INTO owner_auth (id, pw_hash) VALUES (1, ?) ON DUPLICATE KEY UPDATE pw_hash = VALUES(pw_hash)")
        ->execute([$hash]);
}

function owner_secret(): string {
    return hash('sha256', admin_secret() . '|' . (string)owner_hash() . '|owner');
}

function owner_issue_cookie(): void {
    $exp = time() + OWNER_TTL;
    $val = $exp . '.' . hash_hmac('sha256', (string)$exp, owner_secret());
    setcookie(OWNER_COOKIE, $val, [
        'expires' => $exp, 'path' => '/', 'secure' => admin_is_https(),
        'httponly' => true, 'samesite' => 'Lax',
    ]);
}

function owner_clear_cookie(): void {
    setcookie(OWNER_COOKIE, '', [
        'expires' => time() - 3600, 'path' => '/', 'secure' => admin_is_https(),
        'httponly' => true, 'samesite' => 'Lax',
    ]);
}

function owner_is_unlocked(): bool {
    if (!admin_is_logged_in() || owner_hash() === null) return false;
    $c = $_COOKIE[OWNER_COOKIE] ?? '';
    if (!is_string($c) || strpos($c, '.') === false) return false;
    [$exp, $sig] = explode('.', $c, 2);
    if (!ctype_digit($exp) || (int)$exp < time()) return false;
    return hash_equals(hash_hmac('sha256', $exp, owner_secret()), $sig);
}

/** Dipakai di API pendapatan: hentikan dengan 403 kalau password owner belum dimasukkan. */
function owner_require_json(): void {
    admin_require_json();
    if (!owner_is_unlocked()) {
        http_response_code(403);
        echo json_encode(['error' => 'Menu Pendapatan khusus owner. Masukkan password owner.', 'owner_locked' => true]);
        exit;
    }
}

/* ---- Pembatas percobaan salah (terpisah dari login admin) ---- */
function owner_ip(): string { return 'o:' . substr(login_ip(), 0, 42); }

function owner_is_locked(): bool {
    global $pdo; login_table();
    $s = $pdo->prepare("SELECT COUNT(*) FROM login_attempts WHERE ip = ? AND attempted_at > (NOW() - INTERVAL " . LOGIN_WINDOW . " SECOND)");
    $s->execute([owner_ip()]);
    return (int)$s->fetchColumn() >= LOGIN_MAX_FAIL;
}

function owner_record_fail(): void {
    global $pdo; login_table();
    $pdo->prepare("INSERT INTO login_attempts (ip) VALUES (?)")->execute([owner_ip()]);
    usleep(600000);
}

function owner_clear_fails(): void {
    global $pdo;
    $pdo->prepare("DELETE FROM login_attempts WHERE ip = ?")->execute([owner_ip()]);
}
