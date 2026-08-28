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
$isImage = strpos($file['type'], 'image/') === 0;
$isVideo = strpos($file['type'], 'video/') === 0 || $mediaCategory === 'video';

if (!$isImage && !$isVideo) {
    http_response_code(400);
    echo json_encode(['error' => 'Formato non supportato. Sono ammesse solo immagini e video.']);
    exit;
}

$subfolder = $isVideo ? 'vidmag' : 'immamag';
$baseDir = __DIR__ . '/mediamag/' . $subfolder;

if (!is_dir($baseDir)) {
    mkdir($baseDir, 0755, true);
}

$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!$ext) {
    $ext = $isVideo ? 'mp4' : 'webp';
}
$finalFilename = time() . '-' . substr(md5(uniqid((string)rand(), true)), 0, 16) . '.' . $ext;
$targetPath = $baseDir . '/' . $finalFilename;

if (move_uploaded_file($file['tmp_name'], $targetPath)) {
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
