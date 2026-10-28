<?php
/**
 * Pengaturan notifikasi WhatsApp ke admin (via Fonnte — https://fonnte.com).
 * 1. Daftar di fonnte.com, tambahkan perangkat, scan QR dengan WA bisnis kamu.
 * 2. Salin "Token" perangkat ke FONNTE_TOKEN di bawah.
 * 3. Isi WA_ADMIN_NUMBER dengan nomor WA admin yang menerima notifikasi (format 62...).
 */
const WA_ENABLED      = false;
const WA_ADMIN_NUMBER = '62XXXXXXXXXX';   // <-- GANTI: nomor WA admin
const FONNTE_TOKEN    = 'ISI_TOKEN_FONNTE';   // <-- FILL IN: device token from Fonnte

/** Kirim pesan ke WA admin. Return [true, ''] kalau sukses, [false, alasan] kalau gagal. */
function wa_notify_admin(string $message): array
{
    if (!WA_ENABLED) return [false, 'WA_ENABLED = false'];
    if (FONNTE_TOKEN === 'ISI_TOKEN_FONNTE') return [false, 'Token Fonnte belum diisi di wa_config.php'];
    if (!function_exists('curl_init')) return [false, 'cURL tidak aktif di hosting'];

    $ch = curl_init('https://api.fonnte.com/send');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_HTTPHEADER     => ['Authorization: ' . FONNTE_TOKEN],
        CURLOPT_POSTFIELDS     => ['target' => WA_ADMIN_NUMBER, 'message' => $message, 'countryCode' => '62'],
    ]);
    $out = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);

    if ($out === false) return [false, 'Koneksi gagal: ' . $err];
    $json = json_decode($out, true);
    if (is_array($json) && !empty($json['status'])) return [true, ''];
    return [false, 'Fonnte menolak: ' . substr((string)$out, 0, 200)];
}
