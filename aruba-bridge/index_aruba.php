<?php
// Se la richiesta include parametri di reset password, carica l'interfaccia dedicata
if (
    (isset($_GET['action']) && in_array(strtolower($_GET['action']), ['reset_password', 'reset-password'])) ||
    (!empty($_GET['token']) && (empty($_GET['action']) || in_array(strtolower($_GET['action']), ['reset_password', 'reset-password'])))
) {
    require_once __DIR__ . '/reset-password.php';
    exit;
}

// Pagina "Lavori in corso"
// Tam Tam Mondo 2026
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tam Tam Mondo 2026 - Lavori in corso</title>
    <style>
        * {
            box-sizing: border-box;
        }
        html,
        body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
        }
        body {
            background: #050b18;
            overflow: hidden;
        }
        .page {
            width: 100%;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .construction-image {
            width: 60vw;
            max-width: 60vw;
            height: auto;
            display: block;
            object-fit: contain;
            border-radius: 4px;
            box-shadow:
                0 0 30px rgba(0, 120, 255, 0.15),
                0 0 80px rgba(0, 120, 255, 0.08);
        }
        /* -----------------------------
           TABLET
           ----------------------------- */
        @media (max-width: 900px) {
            .construction-image {
                width: 75vw;
                max-width: 75vw;
            }
        }
        /* -----------------------------
           SMARTPHONE
           ----------------------------- */
        @media (max-width: 600px) {
            body {
                overflow: auto;
            }
            .page {
                min-height: 100vh;
                height: auto;
                padding: 15px;
            }
            .construction-image {
                width: 95vw;
                max-width: 95vw;
            }
        }
    </style>
</head>
<body>
    <main class="page">
        <img
            src="images/lavori-in-corso.webp"
            alt="Tam Tam Mondo 2026 - Lavori in corso"
            class="construction-image"
        >
    </main>
</body>
</html>
