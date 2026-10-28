<?php
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../wa_config.php';
require_once __DIR__ . '/../auth.php';

$method = $_SERVER['REQUEST_METHOD'];

// Jumlah terapis = jumlah bayi yang bisa dilayani di jam yang sama
const MAX_PER_HOUR = 2;

// Biaya jarak Home Care: Rp3.500 per 1 km (jarak diinput admin di kasir / edit reservasi)
const HOMECARE_RATE_PER_KM = 3500;
// Kategori layanan yang termasuk Home Care (Mom Care & Paket Newborn Care)
const HOMECARE_CATEGORIES = ['mom', 'newborn_pkg'];

/** Jarak (km) dari input admin -> angka 0..500, 1 desimal. Koma desimal ikut diterima. */
function parseHomecareKm($raw): float
{
    $v = (float)str_replace(',', '.', trim((string)$raw));
    if ($v < 0) $v = 0;
    if ($v > 500) $v = 500;
    return round($v, 1);
}

/** Biaya jarak (Rp) = km x tarif per km, dibulatkan ke rupiah. */
function homecareFee(float $km): int
{
    return (int)round($km * HOMECARE_RATE_PER_KM);
}

/**
 * Sinkronkan penanda di catatan dengan jarak Home Care:
 *  - jarak > 0  -> "[Datang langsung]" berubah jadi "[Homecare]"
 *  - jarak = 0  -> "[Homecare]" kembali jadi "[Datang langsung]"
 * Catatan lain yang ditulis admin/pelanggan tidak disentuh.
 */
function syncHomecareNote(PDO $pdo, int $id, float $km): void
{
    try {
        if ($km > 0) {
            $pdo->prepare("UPDATE bookings SET notes = REPLACE(notes, '[Datang langsung]', '[Homecare]') WHERE id = ?")->execute([$id]);
        } else {
            $pdo->prepare("UPDATE bookings SET notes = REPLACE(notes, '[Homecare]', '[Datang langsung]') WHERE id = ?")->execute([$id]);
        }
    } catch (\PDOException $e) { /* catatan gagal disinkronkan: jangan batalkan pembayaran */ }
}

try {
    switch ($method) {

        // -------------------------------------------------
        // GET /api/bookings.php            -> semua reservasi
        // GET /api/bookings.php?phone=08xx -> reservasi milik 1 nomor (cek status pelanggan)
        // GET /api/bookings.php?status=pending&date=2026-08-29 -> filter admin
        // -------------------------------------------------
        case 'GET':
            // GET /api/bookings.php?availability=1&date=2026-10-05 -> jumlah terisi per jam (untuk pilihan jam)
            if (!empty($_GET['availability']) && !empty($_GET['date'])) {
                $av = $pdo->prepare(
                    "SELECT LEFT(booking_time,2) AS h, COUNT(*) AS c FROM bookings
                     WHERE booking_date = ? AND status != 'cancelled'
                     GROUP BY LEFT(booking_time,2)"
                );
                $av->execute([$_GET['date']]);
                $counts = [];
                foreach ($av->fetchAll() as $r) {
                    $counts[$r['h'] . ':00'] = (int)$r['c'];
                }
                $nowJkt = new DateTime('now', new DateTimeZone('Asia/Jakarta'));
                echo json_encode([
                    'max' => MAX_PER_HOUR, 'counts' => (object)$counts,
                    'today' => $nowJkt->format('Y-m-d'), 'now' => $nowJkt->format('H:i'),
                ]);
                break;
            }

            if (empty($_GET['phone'])) { admin_require_json(); } // daftar lengkap = khusus admin
            $sql = "SELECT b.*, s.name AS service_name, s.price AS service_price, s.duration AS service_duration, s.category AS service_category,
                    (SELECT COUNT(*) FROM bookings b2
                     WHERE DATE(b2.created_at) = DATE(b.created_at) AND b2.id <= b.id) AS daily_number
                    /*GSEL*/
                    FROM bookings b
                    LEFT JOIN services s ON s.id = b.service_id
                    /*GJOIN*/
                    WHERE 1=1";
            $params = [];

            if (!empty($_GET['phone'])) {
                $sql .= " AND b.phone = ?";
                $params[] = $_GET['phone'];
            }
            if (!empty($_GET['status']) && $_GET['status'] !== 'all') {
                $sql .= " AND b.status = ?";
                $params[] = $_GET['status'];
            }
            if (!empty($_GET['date'])) {
                $sql .= " AND b.booking_date = ?";
                $params[] = $_GET['date'];
            }
            if (!empty($_GET['search'])) {
                $sql .= " AND (b.baby_name LIKE ? OR b.phone LIKE ? OR b.parent_name LIKE ?)";
                $kw = '%' . $_GET['search'] . '%';
                $params[] = $kw; $params[] = $kw; $params[] = $kw;
            }
            $sql .= " ORDER BY b.created_at DESC";

            // Info pembayaran gabungan (butuh migrasi_bayar_gabungan.sql). Kalau tabelnya belum ada,
            // daftar tetap tampil seperti biasa tanpa info tersebut.
            $groupSel  = ', g.cash_received AS group_cash_received, g.change_given AS group_change_given, g.grand_total AS group_grand_total';
            $groupJoin = 'LEFT JOIN payment_groups g ON g.id = b.payment_group_id';
            try {
                $stmt = $pdo->prepare(str_replace(['/*GSEL*/', '/*GJOIN*/'], [$groupSel, $groupJoin], $sql));
                $stmt->execute($params);
            } catch (\PDOException $e) {
                $stmt = $pdo->prepare(str_replace(['/*GSEL*/', '/*GJOIN*/'], '', $sql));
                $stmt->execute($params);
            }
            $rows = $stmt->fetchAll();
            applyServiceLines($pdo, $rows);
            echo json_encode($rows);
            break;

        // -------------------------------------------------
        // POST /api/bookings.php -> buat reservasi baru
        // -------------------------------------------------
        case 'POST':
            $data = json_decode(file_get_contents('php://input'), true);
            createBookings($pdo, is_array($data) ? $data : []);
            break;

        // -------------------------------------------------
        // PUT /api/bookings.php -> ubah status reservasi dan/atau status pembayaran (admin)
        // body: { id, status } dan/atau { id, payment_status }
        // -------------------------------------------------
        case 'PUT':
            admin_require_json();
            $data = json_decode(file_get_contents('php://input'), true);

            // Pembayaran gabungan (1 orang tua, beberapa anak, 1 kali bayar)
            if (in_array($data['action'] ?? '', ['group_payment', 'link_group'], true)) {
                handleGroupAction($pdo, $data);
                break;
            }

            // Edit data reservasi (untuk membetulkan salah ketik / salah input)
            if (($data['action'] ?? '') === 'edit') {
                handleEditBooking($pdo, $data);
                break;
            }

            if (empty($data['id']) || (empty($data['status']) && empty($data['payment_status']))) {
                http_response_code(400);
                echo json_encode(['error' => 'ID dan (status atau payment_status) wajib diisi.']);
                exit;
            }

            $stmt = $pdo->prepare("SELECT * FROM bookings WHERE id = ?");
            $stmt->execute([(int)$data['id']]);
            $booking = $stmt->fetch();
            if (!$booking) {
                http_response_code(404);
                echo json_encode(['error' => 'Reservasi tidak ditemukan.']);
                exit;
            }

            // Pengaman: reservasi yang sudah SELESAI tidak boleh "mundur" ke menunggu/dikonfirmasi
            // (mis. akibat klik tidak sengaja). Kalau memang perlu dibatalkan, pakai status 'cancelled'.
            if (!empty($data['status']) && $booking['status'] === 'done'
                && in_array($data['status'], ['pending', 'confirmed'], true)) {
                http_response_code(409);
                echo json_encode(['error' => 'Reservasi ini sudah selesai dan tidak bisa dikembalikan ke status sebelumnya. Gunakan Batalkan bila memang perlu.']);
                exit;
            }

            // --- Update status pembayaran (kalau diminta) ---
            if (!empty($data['payment_status']) && in_array($data['payment_status'], ['paid','unpaid'])) {
                $updPay = $pdo->prepare("UPDATE bookings SET payment_status=? WHERE id=?");
                $updPay->execute([$data['payment_status'], (int)$data['id']]);
            }

            // --- Simpan jarak Home Care (kalau dikirim) -> biaya = km x Rp3.500 ---
            if (array_key_exists('homecare_km', $data)) {
                $hcKm = parseHomecareKm($data['homecare_km']);
                try {
                    $pdo->prepare("UPDATE bookings SET homecare_km=?, homecare_fee=? WHERE id=?")
                        ->execute([$hcKm, homecareFee($hcKm), (int)$data['id']]);
                    syncHomecareNote($pdo, (int)$data['id'], $hcKm);
                } catch (\PDOException $e) {
                    http_response_code(500);
                    echo json_encode(['error' => friendlyDbError($e)]);
                    exit;
                }
            }

            // --- Simpan rincian transaksi kasir (kalau dikirim) ---
            if (isset($data['final_total'])) {
                $updTrx = $pdo->prepare(
                    "UPDATE bookings SET discount_percent=?, final_total=?, cash_received=?, change_given=? WHERE id=?"
                );
                $updTrx->execute([
                    (int)($data['discount_percent'] ?? 0),
                    (int)$data['final_total'],
                    isset($data['cash_received']) ? (int)$data['cash_received'] : null,
                    isset($data['change_given']) ? (int)$data['change_given'] : null,
                    (int)$data['id'],
                ]);
            }

            // --- Update status reservasi (kalau diminta) ---
            if (!empty($data['status'])) {
                $newStatus = $data['status'];
                $wasCountedBefore = (int)$booking['loyalty_counted'];
                $loyaltyCounted = $wasCountedBefore;

                // Hitung loyalitas: +1 saat pertama kali jadi "done", -1 kalau dibatalkan setelah sempat "done"
                if ($newStatus === 'done' && !$wasCountedBefore) {
                    updateLoyalty($pdo, $booking['phone'], $booking['baby_name'], $booking['baby_dob'], $booking['parent_name'], 1);
                    $loyaltyCounted = 1;
                } elseif ($booking['status'] === 'done' && $newStatus !== 'done' && $wasCountedBefore) {
                    updateLoyalty($pdo, $booking['phone'], $booking['baby_name'], $booking['baby_dob'], $booking['parent_name'], -1);
                    $loyaltyCounted = 0;
                }

                $update = $pdo->prepare(
                    "UPDATE bookings SET status=?, loyalty_counted=? WHERE id=?"
                );
                $update->execute([$newStatus, $loyaltyCounted, (int)$data['id']]);
            }

            echo json_encode(['success' => true]);
            break;

        // -------------------------------------------------
        // DELETE /api/bookings.php?id=123 -> hapus reservasi
        // -------------------------------------------------
        case 'DELETE':
            admin_require_json();
            $id = $_GET['id'] ?? null;
            if (!$id) {
                http_response_code(400);
                echo json_encode(['error' => 'ID reservasi tidak ada.']);
                exit;
            }
            $stmt = $pdo->prepare("DELETE FROM bookings WHERE id=?");
            $stmt->execute([(int)$id]);
            try { $pdo->prepare("DELETE FROM booking_services WHERE booking_id=?")->execute([(int)$id]); } catch (\PDOException $e) {}
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

/**
 * Tambah/kurangi hitungan sesi selesai pada tabel loyalty untuk 1 ANAK
 * (dikenali lewat kombinasi phone + baby_name + baby_dob).
 */
function updateLoyalty(PDO $pdo, string $phone, string $babyName, string $babyDob, string $parentName, int $delta): void
{
    $stmt = $pdo->prepare("SELECT * FROM loyalty WHERE phone = ? AND baby_name = ? AND baby_dob = ?");
    $stmt->execute([$phone, $babyName, $babyDob]);
    $row = $stmt->fetch();

    if ($row) {
        $newCount = max(0, $row['completed_count'] + $delta);
        if ($delta < 0 && $newCount === 0 && (int)$row['rewards_redeemed'] === 0) {
            // Sesi terakhir dipindah/dibatalkan & tidak ada reward terpakai: hapus baris supaya tidak tersisa nama "kosong" (0 sesi)
            $del = $pdo->prepare("DELETE FROM loyalty WHERE phone=? AND baby_name=? AND baby_dob=?");
            $del->execute([$phone, $babyName, $babyDob]);
            return;
        }
        $upd = $pdo->prepare("UPDATE loyalty SET completed_count=?, name=? WHERE phone=? AND baby_name=? AND baby_dob=?");
        $upd->execute([$newCount, $parentName, $phone, $babyName, $babyDob]);
    } else {
        // Baris loyalitas sudah dihapus admin: pengurangan tidak perlu membuat baris kosong baru
        if ($delta <= 0) return;
        $newCount = max(0, $delta);
        $ins = $pdo->prepare(
            "INSERT INTO loyalty (phone, baby_name, baby_dob, name, completed_count, rewards_redeemed) VALUES (?,?,?,?,?,0)"
        );
        $ins->execute([$phone, $babyName, $babyDob, $parentName, $newCount]);
    }
}

function groupFail(int $code, string $msg): void
{
    http_response_code($code);
    echo json_encode(['error' => $msg]);
    exit;
}

/**
 * Pembayaran gabungan.
 *  - action 'group_payment': beberapa reservasi (belum selesai) diselesaikan sekaligus.
 *       body: { action, cash_received, items: [{id, discount_percent, final_total}, ...] }
 *       Diskon/total tiap anak berbeda-beda; uang diterima dicatat satu kali.
 *  - action 'link_group': beberapa reservasi yang SUDAH selesai dicatat sebagai satu pembayaran.
 *       body: { action, cash_received, ids: [..] }
 */
function handleGroupAction(PDO $pdo, array $data): void
{
    $action = $data['action'];
    $cash = (int)($data['cash_received'] ?? 0);

    $ids = [];
    if ($action === 'group_payment') {
        foreach ((array)($data['items'] ?? []) as $it) { $ids[] = (int)(((array)$it)['id'] ?? 0); }
    } else {
        foreach ((array)($data['ids'] ?? []) as $v) { $ids[] = (int)$v; }
    }
    $ids = array_values(array_unique(array_filter($ids, function ($v) { return $v > 0; })));
    if (count($ids) < 2) groupFail(400, 'Pilih minimal 2 reservasi untuk pembayaran gabungan.');

    $in = implode(',', array_fill(0, count($ids), '?'));
    $st = $pdo->prepare(
        "SELECT b.*, s.price AS service_price
         FROM bookings b LEFT JOIN services s ON s.id = b.service_id
         WHERE b.id IN ($in)"
    );
    $st->execute($ids);
    $rows = [];
    foreach ($st->fetchAll() as $r) { $rows[(int)$r['id']] = $r; }
    if (count($rows) !== count($ids)) groupFail(404, 'Ada reservasi yang tidak ditemukan.');
    foreach (fetchExtraLines($pdo, array_keys($rows)) as $bid => $lines) {
        foreach ($lines as $l) { $rows[$bid]['service_price'] = (int)$rows[$bid]['service_price'] + $l['price']; }
    }

    $phone = null;
    foreach ($rows as $r) {
        if ($phone === null) { $phone = $r['phone']; }
        elseif ($phone !== $r['phone']) { groupFail(400, 'Semua reservasi harus milik nomor WA yang sama.'); }
        if ($r['status'] === 'cancelled') groupFail(409, 'Ada reservasi yang sudah dibatalkan.');
        if (!empty($r['payment_group_id'])) groupFail(409, 'Ada reservasi yang sudah tercatat dalam pembayaran gabungan.');
        if ($action === 'group_payment' && $r['status'] === 'done') groupFail(409, 'Ada reservasi yang sudah selesai.');
        if ($action === 'link_group' && $r['status'] !== 'done') groupFail(409, 'Pembayaran gabungan hanya untuk reservasi yang sudah selesai.');
    }

    // diskon & total tiap anak
    $final = []; $pct = []; $hcKm = [];
    if ($action === 'group_payment') {
        foreach ((array)$data['items'] as $it) {
            $it = (array)$it;
            $id = (int)$it['id'];
            $price = (int)$rows[$id]['service_price'];
            // biaya jarak Home Care (kalau admin mengisi km) ikut dalam total anak ini; diskon hanya untuk harga layanan
            $fee = 0;
            if (array_key_exists('homecare_km', $it)) {
                $hcKm[$id] = parseHomecareKm($it['homecare_km']);
                $fee = homecareFee($hcKm[$id]);
            }
            $final[$id] = min(max((int)($it['final_total'] ?? ($price + $fee)), 0), $price + $fee);
            $pct[$id] = min(max((int)($it['discount_percent'] ?? 0), 0), 100);
        }
    } else {
        foreach ($rows as $id => $r) {
            $price = (int)$r['service_price'];
            $final[$id] = $r['final_total'] !== null ? (int)$r['final_total'] : $price;
            $pct[$id] = (int)$r['discount_percent'];
        }
    }
    $total = array_sum($final);
    if ($cash < $total) groupFail(400, 'Uang yang diterima belum mencukupi total tagihan.');

    try {
        $pdo->beginTransaction();

        $ins = $pdo->prepare("INSERT INTO payment_groups (phone, grand_total, cash_received, change_given) VALUES (?,?,?,?)");
        $ins->execute([$phone, $total, $cash, $cash - $total]);
        $gid = (int)$pdo->lastInsertId();

        // Tiap reservasi dicatat lunas pas sebesar totalnya sendiri; uang diterima & kembalian
        // sebenarnya ada di payment_groups.
        $upd = $pdo->prepare(
            "UPDATE bookings SET status='done', discount_percent=?, final_total=?, cash_received=?, change_given=0,
                    loyalty_counted=?, payment_group_id=? WHERE id=?"
        );
        $updHc = $pdo->prepare("UPDATE bookings SET homecare_km=?, homecare_fee=? WHERE id=?");
        foreach ($rows as $id => $r) {
            if (isset($hcKm[$id])) { $updHc->execute([$hcKm[$id], homecareFee($hcKm[$id]), $id]); syncHomecareNote($pdo, (int)$id, (float)$hcKm[$id]); }
            $counted = (int)$r['loyalty_counted'];
            if ($action === 'group_payment' && !$counted) {
                updateLoyalty($pdo, $r['phone'], $r['baby_name'], $r['baby_dob'], $r['parent_name'], 1);
                $counted = 1;
            }
            $upd->execute([$pct[$id], $final[$id], $final[$id], $counted, $gid, $id]);
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if (stripos($e->getMessage(), 'payment_group') !== false) {
            groupFail(500, 'Database belum diperbarui. Jalankan dulu migrasi_bayar_gabungan.sql di phpMyAdmin.');
        }
        groupFail(500, friendlyDbError($e));
    }

    echo json_encode(['success' => true, 'group_id' => $gid, 'total' => $total]);
}

/**
 * Edit data reservasi: nama orang tua, nomor WA, nama anak, tanggal lahir, layanan, jadwal, catatan.
 * Untuk reservasi yang sudah SELESAI (dan belum masuk pembayaran gabungan) total & uang diterima
 * juga bisa dibetulkan. Hitungan loyalitas ikut dipindahkan kalau identitas anak berubah.
 */
function handleEditBooking(PDO $pdo, array $data): void
{
    $id = (int)($data['id'] ?? 0);
    $st = $pdo->prepare("SELECT * FROM bookings WHERE id = ?");
    $st->execute([$id]);
    $old = $st->fetch();
    if (!$old) groupFail(404, 'Reservasi tidak ditemukan.');

    $parent = trim((string)($data['parent_name'] ?? ''));
    $phone  = preg_replace('/\s+/', '', trim((string)($data['phone'] ?? '')));
    $baby   = trim((string)($data['baby_name'] ?? ''));
    $dob    = trim((string)($data['baby_dob'] ?? ''));
    $svcIds = parseServiceIds($data['service_ids'] ?? [$data['service_id'] ?? 0]);
    $svcId  = $svcIds ? $svcIds[0] : 0;
    $date   = trim((string)($data['booking_date'] ?? ''));
    $time   = trim((string)($data['booking_time'] ?? ''));
    $notes  = (string)($data['notes'] ?? '');

    if ($parent === '' || $phone === '' || $baby === '' || $dob === '' || !$svcId || $date === '' || $time === '') {
        groupFail(400, 'Semua kolom (selain catatan) wajib diisi.');
    }
    foreach ([$dob, $date] as $d) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) groupFail(400, 'Format tanggal tidak valid.');
    }

    $svcMap = fetchServicesById($pdo, $svcIds);
    if (!$svcIds || count($svcMap) !== count($svcIds)) groupFail(400, 'Layanan tidak ditemukan.');
    $svc = ['price' => array_sum(array_map(function ($x) { return (int)$x['price']; }, $svcMap))];

    // Tinggi & berat badan (opsional) -> catatan Riwayat Tumbuh Kembang untuk reservasi ini
    $g  = (isset($data['growth']) && is_array($data['growth'])) ? $data['growth'] : [];
    $gw = isset($g['weight']) && $g['weight'] !== '' ? (float)str_replace(',', '.', (string)$g['weight']) : null;
    $gh = isset($g['height']) && $g['height'] !== '' ? (float)str_replace(',', '.', (string)$g['height']) : null;
    $gsex = (string)($g['sex'] ?? '');
    if ($gw !== null || $gh !== null) {
        if ($gw === null || $gh === null) groupFail(400, 'Isi berat DAN tinggi badan (atau kosongkan keduanya).');
        if ($gw <= 0 || $gw > 120) groupFail(400, 'Berat badan tidak wajar (isi dalam kg, maksimal 120).');
        if ($gh < 20 || $gh > 200) groupFail(400, 'Tinggi badan tidak wajar (isi dalam cm, 20-200).');
        if (!in_array($gsex, ['boy', 'girl'], true)) groupFail(400, 'Pilih jenis kelamin untuk mencatat tumbuh kembang.');
    }

    $grouped = !empty($old['payment_group_id']);
    if ($grouped && $phone !== $old['phone']) {
        groupFail(409, 'Nomor WA tidak bisa diubah karena reservasi ini sudah tercatat dalam pembayaran gabungan.');
    }

    // Cek kapasitas hanya kalau jam/tanggal berubah (reservasi dibatalkan tidak dihitung)
    $hourNew = substr($time, 0, 2);
    $hourOld = substr((string)$old['booking_time'], 0, 2);
    if ($old['status'] !== 'cancelled' && ($date !== $old['booking_date'] || $hourNew !== $hourOld)) {
        $ck = $pdo->prepare(
            "SELECT COUNT(*) FROM bookings
             WHERE booking_date = ? AND LEFT(booking_time,2) = ? AND status != 'cancelled' AND id != ?"
        );
        $ck->execute([$date, $hourNew, $id]);
        if ((int)$ck->fetchColumn() >= MAX_PER_HOUR) {
            groupFail(409, 'Jam tersebut sudah penuh (maksimal ' . MAX_PER_HOUR . ' bayi per jam). Pilih jam lain.');
        }
    }

    // Jarak Home Care (km) -> biaya jarak. Hanya diubah kalau kolomnya memang dikirim.
    $hcSql = ''; $hcParams = [];
    $hcFee = (int)($old['homecare_fee'] ?? 0);
    if (array_key_exists('homecare_km', $data)) {
        $hcKmNew = parseHomecareKm($data['homecare_km']);
        $hcFee = homecareFee($hcKmNew);
        $hcSql = ', homecare_km=?, homecare_fee=?';
        $hcParams = [$hcKmNew, $hcFee];
    }

    // Total & uang diterima (hanya reservasi selesai yang belum digabung)
    $trxSql = ''; $trxParams = [];
    if ($old['status'] === 'done' && !$grouped && isset($data['final_total']) && $data['final_total'] !== '') {
        $price = (int)$svc['price'];
        $total = max((int)$data['final_total'], 0);
        // persen diskon dihitung dari harga layanan saja (biaya jarak Home Care tidak didiskon)
        $svcNet = $total - $hcFee;
        $disc  = $price > 0 && $svcNet < $price ? (int)round((1 - max($svcNet, 0) / $price) * 100) : 0;
        $cash = null; $chg = null;
        if (isset($data['cash_received']) && $data['cash_received'] !== '' && $data['cash_received'] !== null) {
            $cash = (int)$data['cash_received'];
            if ($cash < $total) groupFail(400, 'Uang diterima kurang dari total tagihan.');
            $chg = $cash - $total;
        }
        $trxSql = ', discount_percent=?, final_total=?, cash_received=?, change_given=?';
        $trxParams = [$disc, $total, $cash, $chg];
    }

    try {
        $pdo->beginTransaction();

        // Loyalitas dihitung per anak (phone + nama + tgl lahir): pindahkan kalau identitasnya berubah
        $identityChanged = $old['phone'] !== $phone || $old['baby_name'] !== $baby || $old['baby_dob'] !== $dob;
        if ($identityChanged && (int)$old['loyalty_counted'] === 1) {
            updateLoyalty($pdo, $old['phone'], $old['baby_name'], $old['baby_dob'], $old['parent_name'], -1);
            updateLoyalty($pdo, $phone, $baby, $dob, $parent, 1);
        } elseif (!$identityChanged && (int)$old['loyalty_counted'] === 1 && $old['parent_name'] !== $parent) {
            // Identitas anak sama, hanya nama orang tua dibetulkan: ikutkan di program loyalitas
            $pdo->prepare("UPDATE loyalty SET name=? WHERE phone=? AND baby_name=? AND baby_dob=?")
                ->execute([$parent, $phone, $baby, $dob]);
        }

        $sql = "UPDATE bookings SET parent_name=?, phone=?, baby_name=?, baby_dob=?, service_id=?,
                       booking_date=?, booking_time=?, notes=?" . $hcSql . $trxSql . " WHERE id=?";
        $pdo->prepare($sql)->execute(array_merge(
            [$parent, $phone, $baby, $dob, $svcId, $date, $time, $notes],
            $hcParams,
            $trxParams,
            [$id]
        ));
        saveExtraServices($pdo, $id, array_slice($svcIds, 1));
        if (array_key_exists('homecare_km', $data)) { syncHomecareNote($pdo, (int)$id, (float)$hcKmNew); }

        // Catatan tumbuh kembang milik reservasi ini = anak yang sama + tanggal reservasi (nilai LAMA sebelum diedit)
        $fs = $pdo->prepare(
            "SELECT id FROM growth_records WHERE phone=? AND baby_name=? AND baby_dob=? AND measurement_date=? ORDER BY id LIMIT 1"
        );
        $fs->execute([$old['phone'], $old['baby_name'], $old['baby_dob'], $old['booking_date']]);
        $growthId = (int)$fs->fetchColumn();
        if ($growthId) {
            if ($gw !== null) {
                $pdo->prepare("UPDATE growth_records SET phone=?, baby_name=?, baby_dob=?, measurement_date=?, sex=?, weight=?, height=? WHERE id=?")
                    ->execute([$phone, $baby, $dob, $date, $gsex, $gw, $gh, $growthId]);
            } else {
                // tidak ada nilai baru: catatan lama tetap, tapi ikut identitas/tanggal yang sudah dibetulkan
                $pdo->prepare("UPDATE growth_records SET phone=?, baby_name=?, baby_dob=?, measurement_date=? WHERE id=?")
                    ->execute([$phone, $baby, $dob, $date, $growthId]);
            }
        } elseif ($gw !== null) {
            $pdo->prepare("INSERT INTO growth_records (phone, baby_name, baby_dob, sex, measurement_date, weight, height) VALUES (?,?,?,?,?,?,?)")
                ->execute([$phone, $baby, $dob, $gsex, $date, $gw, $gh]);
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        groupFail(500, friendlyDbError($e));
    }

    echo json_encode(['success' => true]);
}

function friendlyDbError(\Throwable $e): string
{
    $m = $e->getMessage();
    if (stripos($m, 'booking_services') !== false) {
        return 'Database belum diperbarui. Jalankan dulu migrasi_layanan_tambahan.sql di phpMyAdmin.';
    }
    if (stripos($m, 'homecare_') !== false) {
        return 'Database belum diperbarui. Jalankan dulu migrasi_homecare.sql di phpMyAdmin.';
    }
    if (stripos($m, 'visit_id') !== false || stripos($m, 'payment_group') !== false) {
        return 'Database belum diperbarui. Jalankan dulu migrasi_bayar_gabungan.sql di phpMyAdmin.';
    }
    return $m;
}

/** Daftar id layanan -> array int unik (urutan dipertahankan, yang pertama = layanan utama). */
function parseServiceIds($raw): array
{
    if (!is_array($raw)) $raw = [$raw];
    $out = [];
    foreach ($raw as $v) { $i = (int)$v; if ($i > 0 && !in_array($i, $out, true)) $out[] = $i; }
    return $out;
}

/** [id => ['id','name','price']] untuk id layanan yang ada. */
function fetchServicesById(PDO $pdo, array $ids): array
{
    if (!$ids) return [];
    $in = implode(',', array_fill(0, count($ids), '?'));
    $st = $pdo->prepare("SELECT id, name, price FROM services WHERE id IN ($in)");
    $st->execute(array_values($ids));
    $out = [];
    foreach ($st->fetchAll() as $r) { $out[(int)$r['id']] = $r; }
    return $out;
}

/** Layanan tambahan per reservasi: [booking_id => [ ['id','name','price'], ... ]]. Kosong bila tabel belum ada. */
function fetchExtraLines(PDO $pdo, array $bookingIds): array
{
    if (!$bookingIds) return [];
    $in = implode(',', array_fill(0, count($bookingIds), '?'));
    try {
        $st = $pdo->prepare(
            "SELECT bs.booking_id, s.id, s.name, s.price, s.category
             FROM booking_services bs JOIN services s ON s.id = bs.service_id
             WHERE bs.booking_id IN ($in) ORDER BY bs.id"
        );
        $st->execute(array_values($bookingIds));
    } catch (\PDOException $e) {
        return [];
    }
    $out = [];
    foreach ($st->fetchAll() as $r) {
        $out[(int)$r['booking_id']][] = ['id' => (int)$r['id'], 'name' => $r['name'], 'price' => (int)$r['price'], 'category' => $r['category']];
    }
    return $out;
}

/** Gabungkan layanan utama + tambahan: service_name jadi "A + B", service_price jadi jumlahnya. */
function applyServiceLines(PDO $pdo, array &$rows): void
{
    $ids = [];
    foreach ($rows as $r) { $ids[] = (int)$r['id']; }
    $extras = fetchExtraLines($pdo, $ids);
    foreach ($rows as &$r) {
        $lines = [];
        if (!empty($r['service_name'])) {
            $lines[] = ['id' => (int)$r['service_id'], 'name' => $r['service_name'], 'price' => (int)$r['service_price'],
                        'category' => $r['service_category'] ?? null];
        }
        foreach ($extras[(int)$r['id']] ?? [] as $l) { $lines[] = $l; }
        $r['service_lines'] = $lines;
        // Penanda layanan Home Care (kasir menampilkan kolom jarak km hanya untuk ini)
        $r['is_homecare'] = (bool)array_filter($lines, function ($l) { return in_array($l['category'] ?? '', HOMECARE_CATEGORIES, true); });
        $r['homecare_km'] = (float)($r['homecare_km'] ?? 0);
        $r['homecare_fee'] = (int)($r['homecare_fee'] ?? 0);
        $r['service_ids'] = array_map(function ($l) { return $l['id']; }, $lines);
        if ($lines) {
            $r['service_name'] = implode(' + ', array_map(function ($l) { return $l['name']; }, $lines));
            $r['service_price'] = array_sum(array_map(function ($l) { return $l['price']; }, $lines));
        }
    }
    unset($r);
}

/** Ganti layanan tambahan sebuah reservasi (dipanggil di dalam transaksi). */
function saveExtraServices(PDO $pdo, int $bookingId, array $extraIds): void
{
    try {
        $pdo->prepare("DELETE FROM booking_services WHERE booking_id = ?")->execute([$bookingId]);
    } catch (\PDOException $e) {
        if ($extraIds) throw $e;   // tabel belum ada tapi ada layanan tambahan -> beri tahu
        return;
    }
    if (!$extraIds) return;
    $ins = $pdo->prepare("INSERT INTO booking_services (booking_id, service_id) VALUES (?, ?)");
    foreach ($extraIds as $sid) { $ins->execute([$bookingId, (int)$sid]); }
}

/**
 * Buat 1 atau beberapa reservasi SEKALIGUS (semua atau tidak sama sekali).
 *  - Format baru : { parent_name, phone, booking_date, notes, visit_id?, status?, kids:[{baby_name, baby_dob, booking_time, service_ids:[..]}] }
 *  - Format lama : { parent_name, phone, baby_name, baby_dob, service_id, booking_date, booking_time, notes }  (form pelanggan)
 * Semua pengecekan (termasuk kapasitas jam) dilakukan LEBIH DULU; tidak ada data yang tersimpan kalau salah satu gagal.
 */
function createBookings(PDO $pdo, array $data): void
{
    $isAdmin = admin_is_logged_in();

    foreach (['parent_name', 'phone', 'booking_date'] as $f) {
        if (empty($data[$f])) groupFail(400, "Field '$f' wajib diisi.");
    }

    $rawKids = (isset($data['kids']) && is_array($data['kids'])) ? $data['kids'] : [[
        'baby_name'    => $data['baby_name'] ?? '',
        'baby_dob'     => $data['baby_dob'] ?? '',
        'booking_time' => $data['booking_time'] ?? '',
        'service_ids'  => $data['service_ids'] ?? [$data['service_id'] ?? 0],
    ]];
    if (!$rawKids) groupFail(400, 'Minimal 1 anak harus didaftarkan.');
    if (!$isAdmin && count($rawKids) > 4) groupFail(400, 'Maksimal 4 anak dalam satu pendaftaran. Silakan buat pendaftaran terpisah.');

    $kids = []; $allSvc = [];
    foreach ($rawKids as $i => $k) {
        $k = (array)$k;
        $label = count($rawKids) > 1 ? 'Anak ' . ($i + 1) . ': ' : '';
        foreach (['baby_name', 'baby_dob', 'booking_time'] as $f) {
            if (trim((string)($k[$f] ?? '')) === '') groupFail(400, $label . "Field '$f' wajib diisi.");
        }
        $ids = parseServiceIds($k['service_ids'] ?? [$k['service_id'] ?? 0]);
        if (!$ids) groupFail(400, $label . "Field 'service_id' wajib diisi.");
        $allSvc = array_merge($allSvc, $ids);
        // Tinggi & berat badan (opsional, admin maupun pelanggan) -> otomatis jadi catatan Riwayat Tumbuh Kembang
        $growth = null;
        $gw = isset($k['weight']) && $k['weight'] !== '' ? (float)str_replace(',', '.', (string)$k['weight']) : null;
        $gh = isset($k['height']) && $k['height'] !== '' ? (float)str_replace(',', '.', (string)$k['height']) : null;
        if ($gw !== null || $gh !== null) {
            if ($gw === null || $gh === null) groupFail(400, $label . 'Isi berat DAN tinggi badan (atau kosongkan keduanya).');
            if ($gw <= 0 || $gw > 120) groupFail(400, $label . 'Berat badan tidak wajar (isi dalam kg, maksimal 120).');
            if ($gh < 20 || $gh > 200) groupFail(400, $label . 'Tinggi badan tidak wajar (isi dalam cm, 20-200).');
            $gsex = (string)($k['sex'] ?? '');
            if (!in_array($gsex, ['boy', 'girl'], true)) groupFail(400, $label . 'Pilih jenis kelamin untuk mencatat tumbuh kembang.');
            $growth = ['sex' => $gsex, 'w' => $gw, 'h' => $gh];
        }
        $kids[] = [
            'baby_name' => trim((string)$k['baby_name']), 'baby_dob' => trim((string)$k['baby_dob']),
            'time' => trim((string)$k['booking_time']), 'svc' => $ids, 'growth' => $growth,
        ];
    }
    $svcMap = fetchServicesById($pdo, array_values(array_unique($allSvc)));
    foreach ($kids as $k) {
        foreach ($k['svc'] as $sid) { if (!isset($svcMap[$sid])) groupFail(400, 'Layanan tidak ditemukan.'); }
    }

    $paymentMethod = in_array($data['payment_method'] ?? '', ['cash', 'qris', 'transfer'], true) ? $data['payment_method'] : 'cash';
    $status  = ($isAdmin && ($data['status'] ?? '') === 'confirmed') ? 'confirmed' : 'pending';
    $visitId = (!empty($data['visit_id']) && preg_match('/^[A-Za-z0-9]{4,20}$/', (string)$data['visit_id'])) ? $data['visit_id'] : null;
    // Lebih dari 1 anak = 1 kunjungan (dibayar bersama, struk satu): buat visit_id sendiri kalau belum dikirim
    if (!$visitId && count($kids) > 1) {
        $visitId = strtoupper(substr('V' . base_convert((string)(int)(microtime(true) * 1000), 10, 36) . bin2hex(random_bytes(2)), 0, 20));
    }
    // Tanggal catatan tumbuh kembang: admin = tanggal kunjungan; pelanggan yang memesan untuk hari lain = hari ini (saat berat/tinggi diukur)
    $nowJkt = new DateTime('now', new DateTimeZone('Asia/Jakarta'));
    $today  = $nowJkt->format('Y-m-d');
    // PENTING: $date harus diisi SEBELUM dipakai untuk validasi di bawah
    // (dulu baru diisi sesudahnya, sehingga bernilai kosong dan pelanggan selalu ditolak
    //  dengan "Tanggal reservasi sudah lewat"; admin lolos karena pengecekan ini dilewati).
    $date = trim((string)$data['booking_date']);
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !checkdate((int)substr($date, 5, 2), (int)substr($date, 8, 2), (int)substr($date, 0, 4))) {
        groupFail(400, 'Format tanggal reservasi tidak valid. Silakan pilih ulang tanggalnya.');
    }

    // Pelanggan tidak boleh memesan jam yang sudah terlewat (slot hangus begitu jamnya tiba). Admin tetap bebas (walk-in/koreksi).
    if (!$isAdmin) {
        if ($date < $today) groupFail(400, 'Tanggal reservasi sudah lewat. Silakan pilih tanggal hari ini atau setelahnya.');
        if ($date === $today) {
            $nowHm = $nowJkt->format('H:i');
            foreach ($kids as $k) {
                $slot = substr($k['time'], 0, 2) . ':00';
                if ($slot <= $nowHm) groupFail(409, "Jam {$slot} sudah terlewat. Silakan pilih jam yang masih tersedia.");
            }
        }
    }
    $notes   = (string)($data['notes'] ?? '');

    $lockOk = (int)$pdo->query("SELECT GET_LOCK('bh_booking_slot', 5)")->fetchColumn() === 1;
    $newIds = [];
    try {
        $pdo->beginTransaction();

        // ---- cek kapasitas SEMUA jam dulu, sebelum menyimpan apa pun ----
        $need = [];
        foreach ($kids as $k) { $h = substr($k['time'], 0, 2); $need[$h] = ($need[$h] ?? 0) + 1; }
        $ck = $pdo->prepare(
            "SELECT COUNT(*) FROM bookings WHERE booking_date = ? AND LEFT(booking_time,2) = ? AND status != 'cancelled'"
        );
        foreach ($need as $h => $n) {
            $ck->execute([$date, $h]);
            $free = max(0, MAX_PER_HOUR - (int)$ck->fetchColumn());
            if ($n > $free) {
                $pdo->rollBack();
                if (count($kids) === 1) {
                    groupFail(409, 'Jam tersebut sudah penuh (maksimal ' . MAX_PER_HOUR . ' bayi per jam). Silakan pilih jam lain.');
                }
                groupFail(409, "Jam {$h}:00 hanya tersisa $free slot (maksimal " . MAX_PER_HOUR . " bayi per jam), tetapi $n anak dipilih di jam itu. "
                    . 'Belum ada data yang disimpan. Ubah jamnya lalu simpan lagi.');
            }
        }

        // ---- semua lolos -> simpan ----
        $cols = "parent_name, phone, baby_name, baby_dob, service_id, booking_date, booking_time, notes, status, payment_method, payment_status"
              . ($visitId ? ', visit_id' : '');
        $marks = "?,?,?,?,?,?,?,?,?,?,'unpaid'" . ($visitId ? ',?' : '');
        $ins = $pdo->prepare("INSERT INTO bookings ($cols) VALUES ($marks)");
        foreach ($kids as $k) {
            $params = [$data['parent_name'], $data['phone'], $k['baby_name'], $k['baby_dob'], $k['svc'][0],
                       $date, $k['time'], $notes, $status, $paymentMethod];
            if ($visitId) $params[] = $visitId;
            $ins->execute($params);
            $bid = (int)$pdo->lastInsertId();
            $newIds[] = $bid;
            if (count($k['svc']) > 1) saveExtraServices($pdo, $bid, array_slice($k['svc'], 1));
            if ($k['growth']) {
                $pdo->prepare(
                    "INSERT INTO growth_records (phone, baby_name, baby_dob, sex, measurement_date, weight, height)
                     VALUES (?,?,?,?,?,?,?)"
                )->execute([$data['phone'], $k['baby_name'], $k['baby_dob'], $k['growth']['sex'],
                            ($isAdmin ? $date : min($date, $today)),
                            $k['growth']['w'], $k['growth']['h']]);
            }
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($lockOk) { $pdo->query("SELECT RELEASE_LOCK('bh_booking_slot')"); }
        groupFail(500, friendlyDbError($e));
    }
    if ($lockOk) { $pdo->query("SELECT RELEASE_LOCK('bh_booking_slot')"); }

    // Notifikasi WhatsApp ke admin (kegagalan WA tidak boleh menggagalkan reservasi)
    foreach ($kids as $i => $k) {
        $newId = $newIds[$i];
        try {
            $names = []; $sum = 0;
            foreach ($k['svc'] as $sid) { $names[] = $svcMap[$sid]['name']; $sum += (int)$svcMap[$sid]['price']; }
            $pay = ['cash' => 'Tunai', 'qris' => 'QRIS', 'transfer' => 'Transfer'][$paymentMethod];
            $msg = "🔔 *RESERVASI BARU #{$newId}*\n\n"
                 . "👤 Orang tua: {$data['parent_name']}\n"
                 . "📱 WA: {$data['phone']}\n"
                 . "👶 Anak: {$k['baby_name']} (lahir {$k['baby_dob']})\n"
                 . "💆 Layanan: " . implode(' + ', $names) . " (Rp " . number_format($sum, 0, ',', '.') . ")\n"
                 . ($k['growth'] ? "⚖️ BB/TB: {$k['growth']['w']} kg / {$k['growth']['h']} cm\n" : "")
                 . "📅 Jadwal: {$date} pukul {$k['time']}\n"
                 . "💳 Bayar: {$pay}\n"
                 . ($notes !== '' ? "📝 Catatan: {$notes}\n" : "")
                 . "\nBuka panel admin untuk konfirmasi.";
            [$ok, $why] = wa_notify_admin($msg);
            if (!$ok) @file_put_contents(__DIR__ . '/wa_error.log', date('c') . " #{$newId} $why\n", FILE_APPEND);
        } catch (\Throwable $e) {
            @file_put_contents(__DIR__ . '/wa_error.log', date('c') . " #{$newId} " . $e->getMessage() . "\n", FILE_APPEND);
        }
    }

    echo json_encode(['id' => $newIds[0], 'ids' => $newIds]);
}
