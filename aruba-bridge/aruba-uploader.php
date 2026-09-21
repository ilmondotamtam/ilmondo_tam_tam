<?php
/**
 * Script Bridge Upload per Hosting Aruba Business
 * 
 * ISTRUZIONI:
 * 1. Carica questo file nella root o in una cartella del tuo hosting Aruba Business.
 * 2. Assicurati che i permessi della cartella "mediamag" siano in scrittura (755 o 775).
 * 3. Le cartelle create automaticamente saranno:
 *    - mediamag/immamag/ (per tutte le immagini)
 *    - mediamag/vidmag/ (per tutti i video)
 *    - mediamag/avatar/ (per le foto profilo / avatar)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Metodo non consentito. Richiesto POST.']);
    exit;
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(['error' => 'Nessun file ricevuto o errore durante il caricamento.']);
    exit;
}

$file = $_FILES['file'];
$mediaCategory = isset($_POST['mediaCategory']) ? strtolower(trim($_POST['mediaCategory'])) : '';
$subfolderParam = isset($_POST['subfolder']) ? strtolower(trim($_POST['subfolder'])) : '';
$isImage = strpos($file['type'], 'image/') === 0;
$isVideo = strpos($file['type'], 'video/') === 0 || $mediaCategory === 'video';

if (!$isImage && !$isVideo) {
    http_response_code(400);
    echo json_encode(['error' => 'Formato non supportato. Sono ammesse solo immagini e video.']);
    exit;
}

if ($subfolderParam === 'avatar' || $subfolderParam === 'header' || $mediaCategory === 'avatar' || $mediaCategory === 'header') {
    $subfolder = 'avatar';
} elseif ($isVideo || $subfolderParam === 'vidmag') {
    $subfolder = 'vidmag';
} else {
    $subfolder = 'immamag';
}
$baseDir = __DIR__ . '/mediamag/' . $subfolder;

if (!is_dir($baseDir)) {
    mkdir($baseDir, 0755, true);
}

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!$ext || $ext === 'blob' || !in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'mp4', 'mov', 'webm', 'ogg', 'mkv'])) {
    if (strpos($file['type'], 'webp') !== false) $ext = 'webp';
    elseif (strpos($file['type'], 'png') !== false) $ext = 'png';
    elseif (strpos($file['type'], 'jpeg') !== false || strpos($file['type'], 'jpg') !== false) $ext = 'jpg';
    elseif (strpos($file['type'], 'gif') !== false) $ext = 'gif';
    elseif (strpos($file['type'], 'mp4') !== false) $ext = 'mp4';
    elseif (strpos($file['type'], 'quicktime') !== false) $ext = 'mov';
    elseif (strpos($file['type'], 'webm') !== false) $ext = 'webm';
    else $ext = $isVideo ? 'webm' : 'webp';
}

// Se è un video ed è già compresso o viene convertito, impostiamo estensione .webm
if ($isVideo && $ext !== 'webm') {
    $webmFilename = time() . '-' . substr(md5(uniqid((string)rand(), true)), 0, 16) . '.webm';
    $finalFilename = time() . '-' . substr(md5(uniqid((string)rand(), true)), 0, 16) . '.' . $ext;
} else {
    $finalFilename = time() . '-' . substr(md5(uniqid((string)rand(), true)), 0, 16) . '.' . $ext;
}
$targetPath = $baseDir . '/' . $finalFilename;

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
    // Se è un video, tentiamo se disponibile la compressione nativa in WebM VP9 tramite libvpx-vp9 a 2 Megabit/s
    if ($isVideo) {
        $ffmpegBin = trim(shell_exec('which ffmpeg 2>/dev/null') ?? '');
        if (!empty($ffmpegBin) && file_exists($ffmpegBin) && is_executable($ffmpegBin)) {
            $webmPath = $baseDir . '/' . (isset($webmFilename) ? $webmFilename : (time() . '-' . substr(md5(uniqid((string)rand(), true)), 0, 16) . '.webm'));
            $cmd = escapeshellcmd($ffmpegBin) . ' -y -i ' . escapeshellarg($targetPath) . ' -c:v libvpx-vp9 -b:v 2M -deadline realtime -cpu-used 8 -row-mt 1 -c:a libopus -b:a 128k -f webm ' . escapeshellarg($webmPath) . ' 2>&1';
            @exec($cmd, $output, $returnCode);
            if ($returnCode === 0 && file_exists($webmPath) && filesize($webmPath) > 0) {
                if ($targetPath !== $webmPath && file_exists($targetPath)) {
                    @unlink($targetPath);
                }
                $finalFilename = basename($webmPath);
                $targetPath = $webmPath;
            }
        }
    }

    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://";
    $host = $_SERVER['HTTP_HOST'];
    $publicUrl = $protocol . $host . '/mediamag/' . $subfolder . '/' . $finalFilename;

    echo json_encode([
        'success' => true,
        'url' => $publicUrl,
        'path' => 'mediamag/' . $subfolder . '/' . $finalFilename,
        'filename' => $finalFilename,
        'size' => filesize($targetPath)
    ]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Impossibile salvare il file nella cartella mediamag/' . $subfolder]);
}
?>
