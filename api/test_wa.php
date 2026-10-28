<?php
// Tes kirim WA: buka https://DOMAINMU/api/test_wa.php  (hapus file ini setelah selesai tes)
header('Content-Type: text/plain; charset=utf-8');
require __DIR__ . '/../auth.php';
require __DIR__ . '/../wa_config.php';
if (!admin_is_logged_in()) { http_response_code(401); die('Login dulu di admin.php, lalu buka halaman ini lagi.'); }
[$ok, $why] = wa_notify_admin("✅ Tes notifikasi Blue Haven berhasil.");
echo $ok ? "BERHASIL terkirim ke " . WA_ADMIN_NUMBER : "GAGAL: $why";
