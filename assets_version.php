<?php
/**
 * Cache-busting otomatis untuk file CSS/JS.
 * Menambahkan "?v=waktu-terakhir-file-diubah" ke URL asset, supaya
 * begitu file CSS/JS diubah, browser OTOMATIS tahu harus ambil versi
 * baru — tidak perlu hard refresh atau clear cache manual lagi.
 */
function asset_url($relativePath) {
    $fullPath = __DIR__ . '/' . $relativePath;
    $version = file_exists($fullPath) ? filemtime($fullPath) : time();
    return $relativePath . '?v=' . $version;
}
