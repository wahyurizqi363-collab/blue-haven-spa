<?php
/**
 * API Pendapatan (khusus admin).
 *
 * GET /api/revenue.php?period=daily&month=2026-10    -> per hari dalam 1 bulan
 * GET /api/revenue.php?period=monthly&year=2026      -> per bulan dalam 1 tahun
 * GET /api/revenue.php?period=yearly                 -> per tahun (semua tahun yang ada data)
 *
 * Aturan hitung:
 *  - Hanya reservasi berstatus "done" (Selesai) yang dihitung sebagai pendapatan.
 *  - Nominal = final_total (total setelah diskon dari kasir). Untuk data lama yang
 *    final_total-nya kosong, dipakai harga layanan saat ini sebagai cadangan.
 *  - Tanggal yang dipakai = booking_date (tanggal layanan).
 */
header('Content-Type: application/json; charset=utf-8');
require __DIR__ . '/../config.php';
require_once __DIR__ . '/../auth.php';
require_once __DIR__ . '/../owner_auth.php';
owner_require_json(); // admin login + password owner

date_default_timezone_set('Asia/Jakarta');

const AMT = "COALESCE(b.final_total, s.price, 0)";
const FROM_SQL = "FROM bookings b LEFT JOIN services s ON s.id = b.service_id WHERE b.status = 'done'";

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['error' => 'Method tidak didukung.']);
    exit;
}

try {
    $period = $_GET['period'] ?? 'daily';
    if (!in_array($period, ['daily', 'monthly', 'yearly'], true)) $period = 'daily';

    $today = date('Y-m-d');
    $rows  = [];   // [label_key => ['trx'=>, 'total'=>]]
    $series = [];

    // ---------- rentang & deret data ----------
    if ($period === 'daily') {
        $month = $_GET['month'] ?? date('Y-m');
        if (!preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $month)) $month = date('Y-m');
        $start = $month . '-01';
        $end   = date('Y-m-t', strtotime($start));

        $st = $pdo->prepare("SELECT b.booking_date AS k, COUNT(*) AS trx, SUM(" . AMT . ") AS total " . FROM_SQL .
            " AND b.booking_date BETWEEN ? AND ? GROUP BY b.booking_date");
        $st->execute([$start, $end]);
        foreach ($st->fetchAll() as $r) $rows[$r['k']] = $r;

        $days = (int)date('t', strtotime($start));
        for ($d = 1; $d <= $days; $d++) {
            $k = sprintf('%s-%02d', $month, $d);
            $series[] = [
                'key' => $k, 'label' => (string)$d,
                'trx' => (int)($rows[$k]['trx'] ?? 0), 'total' => (int)($rows[$k]['total'] ?? 0),
            ];
        }
        $rangeFrom = $start; $rangeTo = $end;

    } elseif ($period === 'monthly') {
        $year = $_GET['year'] ?? date('Y');
        if (!preg_match('/^\d{4}$/', $year)) $year = date('Y');
        $rangeFrom = "$year-01-01"; $rangeTo = "$year-12-31";

        $st = $pdo->prepare("SELECT DATE_FORMAT(b.booking_date,'%Y-%m') AS k, COUNT(*) AS trx, SUM(" . AMT . ") AS total " . FROM_SQL .
            " AND b.booking_date BETWEEN ? AND ? GROUP BY k");
        $st->execute([$rangeFrom, $rangeTo]);
        foreach ($st->fetchAll() as $r) $rows[$r['k']] = $r;

        $names = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
        for ($m = 1; $m <= 12; $m++) {
            $k = sprintf('%s-%02d', $year, $m);
            $series[] = [
                'key' => $k, 'label' => $names[$m - 1],
                'trx' => (int)($rows[$k]['trx'] ?? 0), 'total' => (int)($rows[$k]['total'] ?? 0),
            ];
        }

    } else { // yearly
        $st = $pdo->query("SELECT YEAR(b.booking_date) AS k, COUNT(*) AS trx, SUM(" . AMT . ") AS total " . FROM_SQL . " GROUP BY k");
        foreach ($st->fetchAll() as $r) $rows[(string)$r['k']] = $r;

        $minYear = $rows ? (int)min(array_keys($rows)) : (int)date('Y');
        $maxYear = max((int)date('Y'), $rows ? (int)max(array_keys($rows)) : 0);
        for ($y = $minYear; $y <= $maxYear; $y++) {
            $k = (string)$y;
            $series[] = [
                'key' => $k, 'label' => $k,
                'trx' => (int)($rows[$k]['trx'] ?? 0), 'total' => (int)($rows[$k]['total'] ?? 0),
            ];
        }
        $rangeFrom = "$minYear-01-01"; $rangeTo = "$maxYear-12-31";
    }

    // ---------- ringkasan untuk rentang yang dipilih ----------
    $sumTotal = array_sum(array_column($series, 'total'));
    $sumTrx   = array_sum(array_column($series, 'trx'));
    $best = null;
    foreach ($series as $p) if ($p['total'] > 0 && ($best === null || $p['total'] > $best['total'])) $best = $p;

    // ---------- per metode pembayaran ----------
    $st = $pdo->prepare("SELECT b.payment_method AS method, COUNT(*) AS trx, SUM(" . AMT . ") AS total " . FROM_SQL .
        " AND b.booking_date BETWEEN ? AND ? GROUP BY b.payment_method ORDER BY total DESC");
    $st->execute([$rangeFrom, $rangeTo]);
    $byMethod = array_map(fn($r) => ['method' => $r['method'], 'trx' => (int)$r['trx'], 'total' => (int)$r['total']], $st->fetchAll());

    // ---------- layanan terlaris (berdasar pendapatan) ----------
    $st = $pdo->prepare("SELECT COALESCE(s.name, '(layanan dihapus)') AS name, COUNT(*) AS trx, SUM(" . AMT . ") AS total " . FROM_SQL .
        " AND b.booking_date BETWEEN ? AND ? GROUP BY b.service_id, s.name ORDER BY total DESC LIMIT 5");
    $st->execute([$rangeFrom, $rangeTo]);
    $topServices = array_map(fn($r) => ['name' => $r['name'], 'trx' => (int)$r['trx'], 'total' => (int)$r['total']], $st->fetchAll());

    // ---------- kartu ringkas (selalu tampil, tidak terpengaruh filter) ----------
    $monthStart = date('Y-m-01'); $yearStart = date('Y-01-01');
    $st = $pdo->prepare("SELECT
            COALESCE(SUM(CASE WHEN b.booking_date = :t  THEN " . AMT . " END),0) AS today_total,
            COALESCE(SUM(CASE WHEN b.booking_date = :t2 THEN 1 END),0)           AS today_trx,
            COALESCE(SUM(CASE WHEN b.booking_date >= :m THEN " . AMT . " END),0) AS month_total,
            COALESCE(SUM(CASE WHEN b.booking_date >= :y THEN " . AMT . " END),0) AS year_total,
            COALESCE(SUM(" . AMT . "),0) AS all_total
        " . FROM_SQL . " AND b.booking_date <= :t3");
    $st->execute([':t' => $today, ':t2' => $today, ':m' => $monthStart, ':y' => $yearStart, ':t3' => $today]);
    $c = $st->fetch();

    echo json_encode([
        'period'       => $period,
        'range'        => ['from' => $rangeFrom, 'to' => $rangeTo],
        'series'       => $series,
        'summary'      => [
            'total'    => (int)$sumTotal,
            'trx'      => (int)$sumTrx,
            'average'  => $sumTrx > 0 ? (int)round($sumTotal / $sumTrx) : 0,
            'best'     => $best,
        ],
        'by_method'    => $byMethod,
        'top_services' => $topServices,
        'cards'        => [
            'today'     => (int)$c['today_total'],
            'today_trx' => (int)$c['today_trx'],
            'month'     => (int)$c['month_total'],
            'year'      => (int)$c['year_total'],
            'all'       => (int)$c['all_total'],
        ],
        'today'        => $today,
    ]);

} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
