<?php
/**
 * =============================================================================
 * IL MONDO TAM TAM - Pagina Ufficiale di Recupero e Reimpostazione Password
 * =============================================================================
 * Questo script gestisce la validazione del token di ripristino e il cambio
 * sicuro della password su database MySQL Aruba Business tramite Bcrypt.
 */

define('TAM_TAM_BRIDGE_LOADED', true);

// Caricamento configurazione DB da aruba-bridge/config.php o variabili d'ambiente (Vercel)
$configFile = __DIR__ . '/aruba-bridge/config.php';
if (file_exists($configFile)) {
    $config = require $configFile;
    $dbConfig = $config['db'];
} else {
    $dbConfig = [
        'host'     => getenv('MYSQL_HOST') ?: '127.0.0.1',
        'port'     => getenv('MYSQL_PORT') ?: 3306,
        'database' => getenv('MYSQL_DATABASE') ?: '',
        'username' => getenv('MYSQL_USER') ?: '',
        'password' => getenv('MYSQL_PASSWORD') ?: '',
        'charset'  => 'utf8mb4'
    ];
}
try {
    $dsn = "mysql:host={$dbConfig['host']};port={$dbConfig['port']};dbname={$dbConfig['database']};charset={$dbConfig['charset']}";
    $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
} catch (PDOException $e) {
    die("Impossibile connettersi al database di autenticazione.");
}

$token = trim($_GET['token'] ?? $_POST['token'] ?? '');
$emailParam = trim($_GET['email'] ?? $_POST['email'] ?? '');

$errorMsg = '';
$successMsg = '';
$tokenValid = false;
$foundUser = null;
$resetRecord = null;

if (!empty($token)) {
    $tokenHash = hash('sha256', $token);
    $stmt = $pdo->prepare("
        SELECT `id`, `email`, `expires_at`, `used` 
        FROM `password_resets` 
        WHERE `token_hash` = ? 
        LIMIT 1
    ");
    $stmt->execute([$tokenHash]);
    $resetRecord = $stmt->fetch();

    if ($resetRecord) {
        if ((int)$resetRecord['used'] === 1) {
            $errorMsg = "Questo link di ripristino è già stato utilizzato.";
        } elseif (strtotime($resetRecord['expires_at']) < time()) {
            $errorMsg = "Questo link di recupero è scaduto (validità massima 2 ore). Richiedi un nuovo link.";
        } else {
            $tokenValid = true;
            // Carica dati utente
            $uStmt = $pdo->prepare("SELECT `id`, `username`, `email`, `first_name`, `last_name` FROM `utenti` WHERE LOWER(TRIM(`email`)) = ?");
            $uStmt->execute([strtolower(trim($resetRecord['email']))]);
            $foundUser = $uStmt->fetch();
        }
    } else {
        $errorMsg = "Token di ripristino non valido o inesistente. Assicurati di aver copiato il link completo.";
    }
} else {
    $errorMsg = "Nessun token di ripristino specificato.";
}

// Gestione invio nuova password (POST)
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $tokenValid) {
    $newPassword = $_POST['new_password'] ?? '';
    $confirmPassword = $_POST['confirm_password'] ?? '';

    if (empty($newPassword) || strlen($newPassword) < 6) {
        $errorMsg = "La nuova password deve contenere almeno 6 caratteri.";
    } elseif ($newPassword !== $confirmPassword) {
        $errorMsg = "Le due password inserite non coincidono. Riprova.";
    } else {
        try {
            $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
            $targetEmail = strtolower(trim($resetRecord['email']));

            // Aggiorna password utente
            $updateUser = $pdo->prepare("
                UPDATE `utenti` 
                SET `password_hash` = ?, `updated_at` = NOW() 
                WHERE LOWER(TRIM(`email`)) = ?
            ");
            $updateUser->execute([$newHash, $targetEmail]);

            // Invalida il token utilizzato e tutti gli altri per questa email
            $invalidate = $pdo->prepare("UPDATE `password_resets` SET `used` = 1 WHERE `email` = ?");
            $invalidate->execute([$targetEmail]);

            $successMsg = "Password aggiornata con successo! Ora puoi effettuare l'accesso con la tua nuova password.";
            $tokenValid = false; // Non mostrare più il form
        } catch (Exception $e) {
            $errorMsg = "Si è verificato un errore durante l'aggiornamento. Riprova più tardi.";
        }
    }
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reimposta Password - Il Mondo Tam Tam</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: #f8fafc;
            color: #0f172a;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
        }
        .newspaper-font {
            font-family: 'Playfair Display', Georgia, serif;
        }
        .card {
            background: #ffffff;
            max-width: 480px;
            width: 100%;
            border-radius: 16px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04);
            border: 1px solid #e2e8f0;
            border-top: 10px solid #dc2626;
            overflow: hidden;
            padding: 36px 28px;
        }
        .header {
            text-align: center;
            margin-bottom: 28px;
        }
        .brand {
            font-size: 26px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: -0.5px;
            color: #1c1917;
            margin-bottom: 4px;
        }
        .badge {
            display: inline-block;
            background: #1c1917;
            color: #ffffff;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 2px;
            padding: 3px 8px;
            border-radius: 4px;
            margin-bottom: 12px;
        }
        .subtitle {
            font-size: 13px;
            color: #64748b;
        }
        .alert {
            padding: 14px 16px;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.5;
            margin-bottom: 22px;
        }
        .alert-error {
            background-color: #fef2f2;
            color: #991b1b;
            border: 1px solid #fecaca;
        }
        .alert-success {
            background-color: #f0fdf4;
            color: #166534;
            border: 1px solid #bbf7d0;
        }
        .user-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 14px;
            margin-bottom: 20px;
            font-size: 13px;
            color: #334155;
        }
        .form-group {
            margin-bottom: 18px;
        }
        label {
            display: block;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #475569;
            margin-bottom: 6px;
        }
        .input-wrapper {
            position: relative;
        }
        input[type="password"], input[type="text"] {
            width: 100%;
            padding: 12px 14px;
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            font-size: 14px;
            color: #0f172a;
            outline: none;
            transition: border-color 0.2s;
        }
        input[type="password"]:focus, input[type="text"]:focus {
            border-color: #1c1917;
        }
        .toggle-btn {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #64748b;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            padding: 4px 6px;
        }
        .btn-submit {
            display: block;
            width: 100%;
            background-color: #dc2626;
            color: #ffffff;
            border: none;
            padding: 14px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 1px;
            cursor: pointer;
            transition: background-color 0.2s, transform 0.1s;
            margin-top: 24px;
        }
        .btn-submit:hover {
            background-color: #b91c1c;
        }
        .btn-submit:active {
            transform: scale(0.99);
        }
        .btn-home {
            display: inline-block;
            text-align: center;
            width: 100%;
            background-color: #1c1917;
            color: #ffffff;
            text-decoration: none;
            padding: 13px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 14px;
        }
        .btn-home:hover {
            background-color: #292524;
        }
        .footer {
            margin-top: 24px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
        }
    </style>
</head>
<body>

    <div class="card">
        <div class="header">
            <span class="badge">Sicurezza Account</span>
            <h1 class="brand newspaper-font">Il Mondo Tam Tam</h1>
            <p class="subtitle">Reimpostazione della password di accesso</p>
        </div>

        <?php if (!empty($errorMsg)): ?>
            <div class="alert alert-error">
                <strong>Attenzione:</strong> <?= htmlspecialchars($errorMsg, ENT_QUOTES, 'UTF-8') ?>
            </div>
        <?php endif; ?>

        <?php if (!empty($successMsg)): ?>
            <div class="alert alert-success">
                <strong>Operazione completata!</strong><br>
                <?= htmlspecialchars($successMsg, ENT_QUOTES, 'UTF-8') ?>
            </div>
            <a href="https://www.mondotamtam.it" class="btn-home">Vai al portale e accedi</a>
        <?php elseif ($tokenValid): ?>
            <?php if ($foundUser): ?>
                <div class="user-box">
                    Reimpostazione per: <strong><?= htmlspecialchars($foundUser['email'], ENT_QUOTES, 'UTF-8') ?></strong>
                    <?php if (!empty($foundUser['first_name'])): ?>
                        (<?= htmlspecialchars(trim($foundUser['first_name'] . ' ' . ($foundUser['last_name'] ?? '')), ENT_QUOTES, 'UTF-8') ?>)
                    <?php endif; ?>
                </div>
            <?php endif; ?>

            <form method="POST" action="">
                <input type="hidden" name="token" value="<?= htmlspecialchars($token, ENT_QUOTES, 'UTF-8') ?>">
                <input type="hidden" name="email" value="<?= htmlspecialchars($emailParam, ENT_QUOTES, 'UTF-8') ?>">

                <div class="form-group">
                    <label for="new_password">Nuova Password (min. 6 caratteri)</label>
                    <div class="input-wrapper">
                        <input type="password" id="new_password" name="new_password" required minlength="6" autocomplete="new-password" placeholder="Inserisci nuova password">
                        <button type="button" class="toggle-btn" onclick="togglePass('new_password', this)">Mostra</button>
                    </div>
                </div>

                <div class="form-group">
                    <label for="confirm_password">Conferma Nuova Password</label>
                    <div class="input-wrapper">
                        <input type="password" id="confirm_password" name="confirm_password" required minlength="6" autocomplete="new-password" placeholder="Ripeti la nuova password">
                        <button type="button" class="toggle-btn" onclick="togglePass('confirm_password', this)">Mostra</button>
                    </div>
                </div>

                <button type="submit" class="btn-submit">Salva Nuova Password</button>
            </form>
        <?php else: ?>
            <p style="text-align: center; color: #64748b; font-size: 13px; margin-bottom: 16px;">
                Puoi richiedere un nuovo link di recupero password aprendo l'applicazione e cliccando su <em>"Password dimenticata?"</em>.
            </p>
            <a href="https://www.mondotamtam.it" class="btn-home">Torna alla Pagina Iniziale</a>
        <?php endif; ?>
    </div>

    <div class="footer">
        &copy; <?= date('Y') ?> Il Mondo Tam Tam &bull; Sistema Protetto con Crittografia Bcrypt su MySQL Aruba Business
    </div>

    <script>
        function togglePass(id, btn) {
            const input = document.getElementById(id);
            if (input.type === 'password') {
                input.type = 'text';
                btn.textContent = 'Nascondi';
            } else {
                input.type = 'password';
                btn.textContent = 'Mostra';
            }
        }
    </script>
</body>
</html>
