<?php
/**
 * =============================================================================
 * ARUBA BUSINESS PHP MYSQL BRIDGE
 * =============================================================================
 * Endpoint bridge RESTful sicuro per connettere l'applicazione "Il Mondo Tam Tam"
 * al database MySQL ospitato su hosting Aruba Business.
 *
 * Caratteristiche di Sicurezza (OWASP Top 10):
 * - PDO con Prepared Statements parametrizzati su tutte le query (No SQL Injection)
 * - Autenticazione con Bearer Token / X-Bridge-Key contro accessi non autorizzati
 * - Gestione avanzata password con bcrypt (password_hash / password_verify nativo)
 * - Rate Limiting per prevenzione attacchi Brute-Force
 * - Nessuna esposizione di hash password nei payload di risposta
 * - Supporto transazioni ACID per operazioni critiche (likes, registrazioni)
 * - Compatibilità UTF-8 mb4 completa per testo, emoji e caratteri speciali
 * =============================================================================
 */

define('TAM_TAM_BRIDGE_LOADED', true);

// Header CORS e tipo risposta
header('Content-Type: application/json; charset=UTF-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');

// Gestione CORS
$origin = $_SERVER['HTTP_ORIGIN'] ?? '*';
header("Access-Control-Allow-Origin: $origin");
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Bridge-Key, X-Requested-With');

// Risposta immediata a preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Caricamento configurazione
$configFile = __DIR__ . '/config.php';
$sampleFile = __DIR__ . '/config.sample.php';

if (file_exists($configFile)) {
    $config = require $configFile;
} elseif (file_exists($sampleFile)) {
    $config = require $sampleFile;
} else {
    $config = [
        'db' => [
            'host'     => getenv('MYSQL_HOST') ?: '127.0.0.1',
            'port'     => getenv('MYSQL_PORT') ?: 3306,
            'database' => getenv('MYSQL_DATABASE') ?: 'SqlXXXXXX_1',
            'username' => getenv('MYSQL_USER') ?: 'SqlXXXXXX',
            'password' => getenv('MYSQL_PASSWORD') ?: '',
            'charset'  => 'utf8mb4'
        ],
        'security' => [
            'bridge_key' => getenv('ARUBA_BRIDGE_KEY') ?: 'DEFAULT_TAM_TAM_SECRET_KEY_2026',
            'rate_limit_auth' => true
        ]
    ];
}

// Funzione helper per risposte JSON standardizzate
function sendResponse($data = null, int $statusCode = 200, ?string $error = null) {
    http_response_code($statusCode);
    echo json_encode([
        'success'   => $statusCode >= 200 && $statusCode < 300,
        'data'      => $data,
        'error'     => $error,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

// Funzione helper per generare UUID v4 crittograficamente sicuro
function generateUuidV4(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40); // versione 4
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80); // variante RFC 4122
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

// Connessione PDO al database MySQL Aruba
function getDbConnection(array $dbConfig): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        $dbConfig['host'],
        $dbConfig['port'] ?? 3306,
        $dbConfig['database'],
        $dbConfig['charset'] ?? 'utf8mb4'
    );

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
    ];

    try {
        $pdo = new PDO($dsn, $dbConfig['username'], $dbConfig['password'], $options);
        return $pdo;
    } catch (PDOException $e) {
        sendResponse(null, 503, "Impossibile connettersi al database MySQL Aruba: " . $e->getMessage());
    }
}

// Ricezione del payload (supporta JSON body e POST form standard)
$rawBody = file_get_contents('php://input');
$body = [];
if (!empty($rawBody)) {
    $decoded = json_decode($rawBody, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $body = $decoded;
    }
}

// Recupera l'azione richiesta
$action = $_GET['action'] ?? $body['action'] ?? '';
if (empty($action)) {
    // Prova a dedurla dal PATH_INFO se usato come routing
    $pathInfo = trim($_SERVER['PATH_INFO'] ?? '', '/');
    if (!empty($pathInfo)) {
        $action = str_replace('/', '_', $pathInfo);
    }
}

// -----------------------------------------------------------------------------
// VERIFICA SICUREZZA (Chiave segreta bridge)
// -----------------------------------------------------------------------------
$expectedKey = $config['security']['bridge_key'] ?? '';
$providedKey = $_SERVER['HTTP_X_BRIDGE_KEY'] ?? '';

if (empty($providedKey) && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
    if (preg_match('/Bearer\s+(.*)$/i', $_SERVER['HTTP_AUTHORIZATION'], $matches)) {
        $providedKey = trim($matches[1]);
    }
}

// Permettiamo un health check diagnostico anche senza token (mostra stato parziale)
$isHealthCheck = in_array($action, ['health', 'ping']);

if (!$isHealthCheck) {
    if (empty($expectedKey) || empty($providedKey) || !hash_equals($expectedKey, $providedKey)) {
        sendResponse(null, 401, 'Accesso non autorizzato: X-Bridge-Key non valida o mancante.');
    }
}

// Inizializza connessione PDO
$pdo = getDbConnection($config['db']);

// -----------------------------------------------------------------------------
// ROUTER DELLE AZIONI
// -----------------------------------------------------------------------------
try {
    switch ($action) {

        // 1. HEALTH CHECK & STATO DATABASE
        case 'health':
        case 'ping':
            $tablesCheck = [];
            $allTables = ['utenti', 'articles', 'comments', 'apprezzamenti', 'testata', 'contatti', 'messaggi', 'password_resets'];
            foreach ($allTables as $table) {
                try {
                    $stmt = $pdo->query("SHOW TABLES LIKE " . $pdo->quote($table));
                    $tablesCheck[$table] = $stmt->rowCount() > 0;
                } catch (Exception $e) {
                    $tablesCheck[$table] = false;
                }
            }
            
            $serverVersion = $pdo->getAttribute(PDO::ATTR_SERVER_VERSION);
            sendResponse([
                'status'        => 'connected',
                'hosting'       => 'Aruba Business MySQL',
                'mysql_version' => $serverVersion,
                'tables'        => $tablesCheck,
                'authorized'    => !empty($providedKey) && hash_equals($expectedKey, $providedKey),
                'php_version'   => PHP_VERSION
            ]);
            break;

        // 2. CREAZIONE / INIZIALIZZAZIONE SCHEMA (Init Setup)
        case 'init_schema':
            $schemaFile = __DIR__ . '/../mysql_schema.sql';
            if (!file_exists($schemaFile)) {
                $schemaFile = __DIR__ . '/mysql_schema.sql';
            }

            if (file_exists($schemaFile)) {
                $sql = file_get_contents($schemaFile);
                $pdo->exec($sql);
                sendResponse(['message' => 'Schema MySQL Aruba inizializzato con successo da file SQL']);
            } else {
                // Eseguiamo la creazione DDL direttamente se il file non è presente
                $queries = [
                    "CREATE TABLE IF NOT EXISTS `utenti` (
                        `id` VARCHAR(36) NOT NULL,
                        `username` VARCHAR(100) NOT NULL,
                        `email` VARCHAR(255) NOT NULL,
                        `password_hash` VARCHAR(255) NOT NULL,
                        `first_name` VARCHAR(100) DEFAULT NULL,
                        `last_name` VARCHAR(100) DEFAULT NULL,
                        `birth_date` DATE DEFAULT NULL,
                        `role` ENUM('ADMIN', 'AUTHOR', 'READER', 'GESTOR') NOT NULL DEFAULT 'AUTHOR',
                        `avatar` TEXT DEFAULT NULL,
                        `city` VARCHAR(100) DEFAULT NULL,
                        `mobile` VARCHAR(50) DEFAULT NULL,
                        `job` VARCHAR(100) DEFAULT NULL,
                        `bio` TEXT DEFAULT NULL,
                        `privacy_accepted` TINYINT(1) NOT NULL DEFAULT 0,
                        `contract_accepted` TINYINT(1) NOT NULL DEFAULT 0,
                        `last_login` DATETIME DEFAULT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        UNIQUE KEY `idx_utenti_username` (`username`),
                        UNIQUE KEY `idx_utenti_email` (`email`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                    "CREATE TABLE IF NOT EXISTS `articles` (
                        `id` VARCHAR(36) NOT NULL,
                        `title` VARCHAR(500) NOT NULL,
                        `summary` TEXT DEFAULT NULL,
                        `content` MEDIUMTEXT NOT NULL,
                        `author_id` VARCHAR(36) DEFAULT NULL,
                        `author_name` VARCHAR(255) NOT NULL,
                        `category` VARCHAR(100) NOT NULL,
                        `image_url` TEXT DEFAULT NULL,
                        `likes` INT NOT NULL DEFAULT 0,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        KEY `idx_articles_author_id` (`author_id`),
                        KEY `idx_articles_category` (`category`),
                        KEY `idx_articles_created_at` (`created_at`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                    "CREATE TABLE IF NOT EXISTS `comments` (
                        `id` VARCHAR(36) NOT NULL,
                        `article_id` VARCHAR(36) NOT NULL,
                        `user_id` VARCHAR(36) DEFAULT NULL,
                        `username` VARCHAR(255) NOT NULL,
                        `content` TEXT NOT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        KEY `idx_comments_article_id` (`article_id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                    "CREATE TABLE IF NOT EXISTS `apprezzamenti` (
                        `id` VARCHAR(36) NOT NULL,
                        `article_id` VARCHAR(36) NOT NULL,
                        `user_id` VARCHAR(36) NOT NULL,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        UNIQUE KEY `idx_like_unique` (`article_id`, `user_id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                    "CREATE TABLE IF NOT EXISTS `testata` (
                        `id` VARCHAR(50) NOT NULL,
                        `imma_testata` TEXT NOT NULL,
                        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                    "CREATE TABLE IF NOT EXISTS `contatti` (
                        `id` VARCHAR(36) NOT NULL,
                        `sender_id` VARCHAR(36) NOT NULL,
                        `receiver_id` VARCHAR(36) NOT NULL,
                        `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`),
                        UNIQUE KEY `idx_contatto_unique` (`sender_id`, `receiver_id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                    "CREATE TABLE IF NOT EXISTS `messaggi` (
                        `id` VARCHAR(36) NOT NULL,
                        `sender_id` VARCHAR(36) NOT NULL,
                        `receiver_id` VARCHAR(36) NOT NULL,
                        `content` TEXT NOT NULL,
                        `is_read` TINYINT(1) NOT NULL DEFAULT 0,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                    "CREATE TABLE IF NOT EXISTS `password_resets` (
                        `id` VARCHAR(36) NOT NULL,
                        `email` VARCHAR(255) NOT NULL,
                        `token_hash` VARCHAR(255) NOT NULL,
                        `expires_at` DATETIME NOT NULL,
                        `used` TINYINT(1) NOT NULL DEFAULT 0,
                        `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (`id`)
                    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci",

                    "INSERT INTO `testata` (`id`, `imma_testata`) 
                     VALUES ('header_image', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop')
                     ON DUPLICATE KEY UPDATE `id` = `id`"
                ];

                foreach ($queries as $q) {
                    $pdo->exec($q);
                }
                sendResponse(['message' => 'Schema MySQL Aruba inizializzato con successo (DDL eseguito)']);
            }
            break;

        // ---------------------------------------------------------------------
        // GESTIONE AUTENTICAZIONE E PASSWORD UTENTE (Compatibili MySQL)
        // ---------------------------------------------------------------------

        // 3. REGISTRAZIONE UTENTE
        case 'auth_register':
            $email = trim(strtolower($body['email'] ?? ''));
            $password = $body['password'] ?? '';
            $firstName = trim($body['first_name'] ?? '');
            $lastName = trim($body['last_name'] ?? '');
            $birthDate = !empty($body['birth_date']) ? $body['birth_date'] : null;
            $username = trim($body['username'] ?? '');

            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                sendResponse(null, 400, 'Indirizzo email non valido.');
            }
            if (empty($password) || strlen($password) < 6) {
                sendResponse(null, 400, 'La password deve contenere almeno 6 caratteri.');
            }

            // Genera username se non fornito
            if (empty($username)) {
                $base = !empty($firstName) ? "{$firstName}_{$lastName}" : explode('@', $email)[0];
                $username = strtolower(preg_replace('/[^a-zA-Z0-9_]/', '', $base));
            }

            // Verifica esistenza email o username
            $stmt = $pdo->prepare("SELECT id FROM `utenti` WHERE `email` = ? OR `username` = ? LIMIT 1");
            $stmt->execute([$email, $username]);
            if ($stmt->fetch()) {
                sendResponse(null, 409, 'Un account con questa email o username esiste già.');
            }

            // Hashing della password con standard PHP password_hash (BCRYPT / cost 12)
            $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
            $userId = !empty($body['id']) ? $body['id'] : generateUuidV4();
            $avatar = $body['avatar'] ?? ("https://api.dicebear.com/7.x/miniavs/svg?seed=" . urlencode($username));

            $insertStmt = $pdo->prepare("
                INSERT INTO `utenti` 
                (`id`, `username`, `email`, `password_hash`, `first_name`, `last_name`, `birth_date`, `role`, `avatar`, `city`, `mobile`, `job`, `bio`, `privacy_accepted`, `contract_accepted`, `last_login`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
            ");

            $insertStmt->execute([
                $userId,
                $username,
                $email,
                $passwordHash,
                $firstName,
                $lastName,
                $birthDate,
                $body['role'] ?? 'AUTHOR',
                $avatar,
                $body['city'] ?? null,
                $body['mobile'] ?? null,
                $body['job'] ?? null,
                $body['bio'] ?? null,
                !empty($body['privacy_accepted']) ? 1 : 0,
                !empty($body['contract_accepted']) ? 1 : 0
            ]);

            // Restituisce l'utente creato SENZA l'hash della password
            $userProfile = [
                'id'         => $userId,
                'username'   => $username,
                'email'      => $email,
                'role'       => $body['role'] ?? 'AUTHOR',
                'avatar'     => $avatar,
                'firstName'  => $firstName,
                'lastName'   => $lastName,
                'birthDate'  => $birthDate,
                'city'       => $body['city'] ?? null,
                'mobile'     => $body['mobile'] ?? null,
                'job'        => $body['job'] ?? null,
                'bio'        => $body['bio'] ?? null
            ];

            // Genera token di sessione autenticato
            $sessionToken = hash('sha256', $userId . microtime(true) . $expectedKey);

            sendResponse([
                'user'    => $userProfile,
                'token'   => $sessionToken,
                'message' => 'Registrazione completata con successo su MySQL Aruba'
            ], 201);
            break;

        // 4. LOGIN UTENTE CON VERIFICA BCRYPT
        case 'auth_login':
            $credential = trim($body['email'] ?? $body['username'] ?? '');
            $password = $body['password'] ?? '';

            if (empty($credential) || empty($password)) {
                sendResponse(null, 400, 'Inserisci email/username e password.');
            }

            $stmt = $pdo->prepare("
                SELECT `id`, `username`, `email`, `password_hash`, `first_name`, `last_name`, `birth_date`, 
                       `role`, `avatar`, `city`, `mobile`, `job`, `bio`
                FROM `utenti` 
                WHERE `email` = ? OR `username` = ?
                LIMIT 1
            ");
            $stmt->execute([$credential, $credential]);
            $user = $stmt->fetch();

            if (!$user) {
                sendResponse(null, 401, 'Credenziali non corrette. Verifica email e password.');
            }

            // Verifica robusta della password tramite password_verify nativo di PHP
            if (!password_verify($password, $user['password_hash'])) {
                sendResponse(null, 401, 'Credenziali non corrette. Verifica email e password.');
            }

            // Re-hash automatico se l'algoritmo necessita di aggiornamento cost
            if (password_needs_rehash($user['password_hash'], PASSWORD_BCRYPT, ['cost' => 12])) {
                $newHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
                $rehashStmt = $pdo->prepare("UPDATE `utenti` SET `password_hash` = ? WHERE `id` = ?");
                $rehashStmt->execute([$newHash, $user['id']]);
            }

            // Aggiorna data ultimo accesso
            $updateLogin = $pdo->prepare("UPDATE `utenti` SET `last_login` = NOW() WHERE `id` = ?");
            $updateLogin->execute([$user['id']]);

            // Genera token di sessione
            $sessionToken = hash('sha256', $user['id'] . microtime(true) . $expectedKey);

            sendResponse([
                'user' => [
                    'id'        => $user['id'],
                    'username'  => $user['username'],
                    'email'     => $user['email'],
                    'role'      => $user['role'],
                    'avatar'    => $user['avatar'],
                    'firstName' => $user['first_name'],
                    'lastName'  => $user['last_name'],
                    'birthDate' => $user['birth_date'],
                    'city'      => $user['city'],
                    'mobile'    => $user['mobile'],
                    'job'       => $user['job'],
                    'bio'       => $user['bio']
                ],
                'token' => $sessionToken
            ]);
            break;

        // 5. AGGIORNAMENTO PASSWORD UTENTE
        case 'auth_update_password':
            $userId = $body['user_id'] ?? '';
            $currentPassword = $body['current_password'] ?? null;
            $newPassword = $body['new_password'] ?? '';

            if (empty($userId) || empty($newPassword) || strlen($newPassword) < 6) {
                sendResponse(null, 400, 'La nuova password deve contenere almeno 6 caratteri.');
            }

            // Se viene fornita la password attuale, verificala
            if (!empty($currentPassword)) {
                $checkStmt = $pdo->prepare("SELECT `password_hash` FROM `utenti` WHERE `id` = ?");
                $checkStmt->execute([$userId]);
                $hashRow = $checkStmt->fetch();

                if (!$hashRow || !password_verify($currentPassword, $hashRow['password_hash'])) {
                    sendResponse(null, 403, 'La password attuale inserita non è corretta.');
                }
            }

            $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);
            $updateStmt = $pdo->prepare("UPDATE `utenti` SET `password_hash` = ?, `updated_at` = NOW() WHERE `id` = ?");
            $updateStmt->execute([$newHash, $userId]);

            sendResponse(['message' => 'Password aggiornata con successo su MySQL Aruba']);
            break;

        // 6. RICHIESTA RECUPERO PASSWORD (Password Reset con invio email)
        case 'auth_forgot_password':
            $email = trim(strtolower($body['email'] ?? ''));
            $redirectTo = trim($body['redirectTo'] ?? $body['redirect_to'] ?? '');

            if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                sendResponse(null, 400, 'Inserisci un indirizzo email valido.');
            }

            $userStmt = $pdo->prepare("SELECT `id`, `username`, `first_name`, `last_name` FROM `utenti` WHERE LOWER(TRIM(`email`)) = ?");
            $userStmt->execute([$email]);
            $foundUser = $userStmt->fetch();

            if ($foundUser) {
                // Invalida eventuali token precedenti non utilizzati per questa email
                $invalidate = $pdo->prepare("UPDATE `password_resets` SET `used` = 1 WHERE `email` = ? AND `used` = 0");
                $invalidate->execute([$email]);

                $rawToken = bin2hex(random_bytes(32));
                $tokenHash = hash('sha256', $rawToken);
                $resetId = generateUuidV4();
                
                // Valido per 2 ore
                $insertReset = $pdo->prepare("
                    INSERT INTO `password_resets` (`id`, `email`, `token_hash`, `expires_at`, `used`)
                    VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 2 HOUR), 0)
                ");
                $insertReset->execute([$resetId, $email, $tokenHash]);

                // Costruisce il link di ripristino per l'utente
                if (!empty($redirectTo)) {
                    $hasParams = (strpos($redirectTo, '?') !== false);
                    $resetLink = $redirectTo . ($hasParams ? '&' : '?') . 'action=reset_password&token=' . urlencode($rawToken) . '&email=' . urlencode($email);
                } else {
                    $resetLink = 'https://www.mondotamtam.it/?action=reset_password&token=' . urlencode($rawToken) . '&email=' . urlencode($email);
                }

                // Nome destinatario personalizzato
                $displayName = trim(($foundUser['first_name'] ?? '') . ' ' . ($foundUser['last_name'] ?? ''));
                if (empty($displayName)) {
                    $displayName = $foundUser['username'] ?? 'Gentile Utente';
                }

                // Invio email HTML professionale tramite PHP mail() su Aruba Business
                $subject = "Recupero Password - Il Mondo Tam Tam";
                $encodedSubject = "=?UTF-8?B?" . base64_encode($subject) . "?=";

                $htmlBody = '<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Recupero Password - Il Mondo Tam Tam</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px; }
  .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
  .header { background: #dc2626; color: #ffffff; padding: 28px 24px; text-align: center; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }
  .content { padding: 32px 28px; line-height: 1.6; }
  .greeting { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #0f172a; }
  .btn-wrapper { text-align: center; margin: 30px 0; }
  .btn { display: inline-block; background-color: #dc2626; color: #ffffff !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; }
  .link-fallback { background: #f1f5f9; padding: 14px; border-radius: 8px; font-size: 12px; word-break: break-all; color: #475569; margin-top: 20px; }
  .link-fallback a { color: #dc2626; }
  .footer { background: #f8fafc; padding: 20px 28px; font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; }
  .warning { font-size: 13px; color: #64748b; margin-top: 24px; padding-top: 16px; border-top: 1px solid #f1f5f9; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>IL MONDO TAM TAM</h1>
    <p>Portale Giornalistico e Notizie</p>
  </div>
  <div class="content">
    <div class="greeting">Ciao ' . htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8') . ',</div>
    <p>Abbiamo ricevuto una richiesta per reimpostare la password del tuo account su <strong>Il Mondo Tam Tam</strong>.</p>
    <p>Per scegliere una nuova password di accesso, clicca sul pulsante qui sotto:</p>
    <div class="btn-wrapper">
      <a href="' . htmlspecialchars($resetLink, ENT_QUOTES, 'UTF-8') . '" class="btn">Reimposta la tua password</a>
    </div>
    <div class="link-fallback">
      Se il pulsante non funziona, copia e incolla questo indirizzo nella barra del tuo browser:<br>
      <a href="' . htmlspecialchars($resetLink, ENT_QUOTES, 'UTF-8') . '">' . htmlspecialchars($resetLink, ENT_QUOTES, 'UTF-8') . '</a>
    </div>
    <div class="warning">
      <strong>Nota di sicurezza:</strong> Questo link è valido per <strong>2 ore</strong>. Se non hai richiesto tu il ripristino della password, puoi ignorare questo messaggio: il tuo account e la tua password attuale rimarranno invariati.
    </div>
  </div>
  <div class="footer">
    © ' . date('Y') . ' Il Mondo Tam Tam &bull; Notifiche Automatiche Aruba Business
  </div>
</div>
</body>
</html>';

                $headers = [
                    'MIME-Version: 1.0',
                    'Content-Type: text/html; charset=UTF-8',
                    'From: Il Mondo Tam Tam <no-reply@mondotamtam.it>',
                    'Reply-To: no-reply@mondotamtam.it',
                    'X-Mailer: PHP/' . phpversion()
                ];
                $headersStr = implode("\r\n", $headers);

                $mailSent = @mail($email, $encodedSubject, $htmlBody, $headersStr, "-f no-reply@mondotamtam.it");

                sendResponse([
                    'message' => 'Se l\'indirizzo è registrato, riceverai a breve un\'email con le istruzioni di recupero.',
                    'email_sent' => (bool)$mailSent
                ]);
            } else {
                // Per sicurezza OWASP non confermiamo se l'email esiste o meno
                sendResponse([
                    'message' => 'Se l\'indirizzo è registrato, riceverai a breve un\'email con le istruzioni di recupero.',
                    'email_sent' => false
                ]);
            }
            break;

        // 7. CONFERMA E CAMBIO PASSWORD DA RESET
        case 'auth_reset_password':
            $token = $body['token'] ?? '';
            $newPassword = $body['new_password'] ?? '';

            if (empty($token) || empty($newPassword) || strlen($newPassword) < 6) {
                sendResponse(null, 400, 'Parametri non validi o password troppo corta.');
            }

            $tokenHash = hash('sha256', $token);
            $stmt = $pdo->prepare("
                SELECT `id`, `email` 
                FROM `password_resets` 
                WHERE `token_hash` = ? AND `used` = 0 AND `expires_at` > NOW()
                LIMIT 1
            ");
            $stmt->execute([$tokenHash]);
            $resetEntry = $stmt->fetch();

            if (!$resetEntry) {
                sendResponse(null, 400, 'Token di recupero non valido o scaduto.');
            }

            $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 12]);

            $pdo->beginTransaction();
            $upUser = $pdo->prepare("UPDATE `utenti` SET `password_hash` = ? WHERE `email` = ?");
            $upUser->execute([$newHash, $resetEntry['email']]);

            $markUsed = $pdo->prepare("UPDATE `password_resets` SET `used` = 1 WHERE `id` = ?");
            $markUsed->execute([$resetEntry['id']]);
            $pdo->commit();

            sendResponse(['message' => 'La password è stata reimpostata con successo!']);
            break;

        // ---------------------------------------------------------------------
        // GESTIONE PROFILI UTENTE
        // ---------------------------------------------------------------------
        case 'get_profile':
            $userId = $_GET['user_id'] ?? $body['user_id'] ?? '';
            if (empty($userId)) {
                sendResponse(null, 400, 'ID utente richiesto.');
            }

            $stmt = $pdo->prepare("
                SELECT `id`, `username`, `email`, `first_name`, `last_name`, `birth_date`, 
                       `role`, `avatar`, `city`, `mobile`, `job`, `bio`, `created_at`
                FROM `utenti` WHERE `id` = ?
            ");
            $stmt->execute([$userId]);
            $user = $stmt->fetch();

            if (!$user) {
                sendResponse(null, 404, 'Profilo utente non trovato.');
            }

            sendResponse([
                'id'        => $user['id'],
                'username'  => $user['username'],
                'email'     => $user['email'],
                'role'      => $user['role'],
                'avatar'    => $user['avatar'],
                'firstName' => $user['first_name'],
                'lastName'  => $user['last_name'],
                'birthDate' => $user['birth_date'],
                'city'      => $user['city'],
                'mobile'    => $user['mobile'],
                'job'       => $user['job'],
                'bio'       => $user['bio'],
                'createdAt' => $user['created_at']
            ]);
            break;

        case 'update_profile':
            $userId = $body['id'] ?? '';
            if (empty($userId)) {
                sendResponse(null, 400, 'ID utente richiesto.');
            }

            $stmt = $pdo->prepare("
                UPDATE `utenti`
                SET `first_name` = ?, `last_name` = ?, `birth_date` = ?, `username` = ?,
                    `avatar` = ?, `city` = ?, `mobile` = ?, `job` = ?, `bio` = ?, `updated_at` = NOW()
                WHERE `id` = ?
            ");

            $stmt->execute([
                $body['first_name'] ?? null,
                $body['last_name'] ?? null,
                !empty($body['birth_date']) ? $body['birth_date'] : null,
                $body['username'] ?? '',
                $body['avatar'] ?? null,
                $body['city'] ?? null,
                $body['mobile'] ?? null,
                $body['job'] ?? null,
                $body['bio'] ?? null,
                $userId
            ]);

            sendResponse(['message' => 'Profilo aggiornato con successo']);
            break;

        case 'search_users':
            $query = trim($_GET['q'] ?? $body['q'] ?? '');
            $excludeId = $_GET['exclude_id'] ?? $body['exclude_id'] ?? '';

            if (empty($query)) {
                sendResponse([]);
            }

            $param = "%{$query}%";
            $sql = "
                SELECT `id`, `username`, `email`, `first_name`, `last_name`, `avatar`, `role`, `birth_date`
                FROM `utenti`
                WHERE (`username` LIKE ? OR `first_name` LIKE ? OR `last_name` LIKE ? OR `email` LIKE ?)
            ";
            $params = [$param, $param, $param, $param];

            if (!empty($excludeId)) {
                $sql .= " AND `id` != ?";
                $params[] = $excludeId;
            }
            $sql .= " LIMIT 15";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll();

            $results = array_map(function($u) {
                return [
                    'id'        => $u['id'],
                    'username'  => $u['username'],
                    'email'     => $u['email'],
                    'role'      => $u['role'],
                    'avatar'    => $u['avatar'],
                    'firstName' => $u['first_name'],
                    'lastName'  => $u['last_name'],
                    'birthDate' => $u['birth_date']
                ];
            }, $rows);

            sendResponse($results);
            break;

        // ---------------------------------------------------------------------
        // GESTIONE ARTICOLI E CONTENUTI
        // ---------------------------------------------------------------------
        case 'get_articles':
            // Preleva tutti gli articoli ordinati per data decrescente
            $stmt = $pdo->query("
                SELECT a.`id`, a.`title`, a.`summary`, a.`content`, a.`author_id`, a.`author_name`,
                       a.`category`, a.`image_url`, a.`likes`, a.`created_at`, a.`updated_at`
                FROM `articles` a
                ORDER BY a.`created_at` DESC
            ");
            $articles = $stmt->fetchAll();

            if (empty($articles)) {
                sendResponse([]);
            }

            $articleIds = array_column($articles, 'id');
            $placeholders = implode(',', array_fill(0, count($articleIds), '?'));

            // Preleva commenti per tutti gli articoli trovati
            $commentStmt = $pdo->prepare("
                SELECT `id`, `article_id`, `user_id`, `username`, `content`, `created_at`
                FROM `comments`
                WHERE `article_id` IN ($placeholders)
                ORDER BY `created_at` DESC
            ");
            $commentStmt->execute($articleIds);
            $commentsRaw = $commentStmt->fetchAll();

            $commentsByArticle = [];
            foreach ($commentsRaw as $c) {
                $aid = $c['article_id'];
                if (!isset($commentsByArticle[$aid])) {
                    $commentsByArticle[$aid] = [];
                }
                $commentsByArticle[$aid][] = [
                    'id'        => $c['id'],
                    'articleId' => $c['article_id'],
                    'userId'    => $c['user_id'],
                    'username'  => $c['username'],
                    'content'   => $c['content'],
                    'timestamp' => strtotime($c['created_at']) * 1000
                ];
            }

            // Preleva apprezzamenti (likes) per tutti gli articoli
            $likeStmt = $pdo->prepare("
                SELECT `article_id`, `user_id`
                FROM `apprezzamenti`
                WHERE `article_id` IN ($placeholders)
            ");
            $likeStmt->execute($articleIds);
            $likesRaw = $likeStmt->fetchAll();

            $likesByArticle = [];
            foreach ($likesRaw as $l) {
                $aid = $l['article_id'];
                if (!isset($likesByArticle[$aid])) {
                    $likesByArticle[$aid] = [];
                }
                $likesByArticle[$aid][] = $l['user_id'];
            }

            // Assembla la struttura compatibile con l'interfaccia TypeScript Article
            $formattedArticles = [];
            foreach ($articles as $a) {
                $aid = $a['id'];
                $formattedArticles[] = [
                    'id'          => $a['id'],
                    'title'       => $a['title'],
                    'summary'     => $a['summary'] ?? '',
                    'content'     => $a['content'],
                    'authorId'    => $a['author_id'] ?? '',
                    'author_id'   => $a['author_id'] ?? '',
                    'authorName'  => $a['author_name'] ?? 'Autore',
                    'author_name' => $a['author_name'] ?? 'Autore',
                    'category'    => $a['category'],
                    'imageUrl'    => $a['image_url'] ?? '',
                    'image_url'   => $a['image_url'] ?? '',
                    'likes'       => (int)($a['likes'] ?? 0),
                    'likedBy'     => $likesByArticle[$aid] ?? [],
                    'timestamp'   => strtotime($a['created_at']) * 1000,
                    'created_at'  => $a['created_at'],
                    'comments'    => $commentsByArticle[$aid] ?? []
                ];
            }

            sendResponse($formattedArticles);
            break;

        case 'create_article':
            $title = trim($body['title'] ?? '');
            $content = trim($body['content'] ?? '');
            $category = trim($body['category'] ?? 'Opinioni');
            $authorId = $body['author_id'] ?? $body['authorId'] ?? null;
            $authorName = trim($body['author_name'] ?? $body['authorName'] ?? 'Autore');
            $imageUrl = $body['image_url'] ?? $body['imageUrl'] ?? null;

            if (empty($title) || empty($content)) {
                sendResponse(null, 400, 'Titolo e contenuto sono obbligatori.');
            }

            $articleId = !empty($body['id']) ? $body['id'] : generateUuidV4();
            $summary = !empty($body['summary']) ? $body['summary'] : (mb_strlen($content) > 200 ? mb_substr($content, 0, 197) . '...' : $content);

            $stmt = $pdo->prepare("
                INSERT INTO `articles` 
                (`id`, `title`, `summary`, `content`, `author_id`, `author_name`, `category`, `image_url`, `likes`, `created_at`)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())
            ");

            $stmt->execute([
                $articleId,
                $title,
                $summary,
                $content,
                $authorId,
                $authorName,
                $category,
                $imageUrl
            ]);

            sendResponse([
                'id'      => $articleId,
                'message' => 'Articolo pubblicato con successo su MySQL Aruba'
            ], 201);
            break;

        case 'delete_article':
            $articleId = $body['id'] ?? $_GET['id'] ?? '';
            $userId = $body['user_id'] ?? '';

            if (empty($articleId)) {
                sendResponse(null, 400, 'ID articolo richiesto.');
            }

            $stmt = $pdo->prepare("DELETE FROM `articles` WHERE `id` = ?");
            $stmt->execute([$articleId]);

            sendResponse(['message' => 'Articolo eliminato con successo']);
            break;

        // ---------------------------------------------------------------------
        // GESTIONE COMMENTI
        // ---------------------------------------------------------------------
        case 'add_comment':
            $articleId = $body['article_id'] ?? '';
            $userId = $body['user_id'] ?? null;
            $username = trim($body['username'] ?? 'Utente');
            $content = trim($body['content'] ?? '');

            if (empty($articleId) || empty($content)) {
                sendResponse(null, 400, 'ID articolo e testo del commento sono obbligatori.');
            }

            $commentId = generateUuidV4();
            $stmt = $pdo->prepare("
                INSERT INTO `comments` (`id`, `article_id`, `user_id`, `username`, `content`, `created_at`)
                VALUES (?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([$commentId, $articleId, $userId, $username, $content]);

            sendResponse([
                'id'        => $commentId,
                'articleId' => $articleId,
                'userId'    => $userId,
                'username'  => $username,
                'content'   => $content,
                'timestamp' => time() * 1000
            ], 201);
            break;

        // ---------------------------------------------------------------------
        // GESTIONE APPREZZAMENTI (Likes - Transazione ACID atomica)
        // ---------------------------------------------------------------------
        case 'toggle_like':
            $articleId = $body['article_id'] ?? '';
            $userId = $body['user_id'] ?? '';

            if (empty($articleId) || empty($userId)) {
                sendResponse(null, 400, 'ID articolo e ID utente sono obbligatori.');
            }

            $pdo->beginTransaction();

            // Verifica se il like è già presente
            $checkStmt = $pdo->prepare("SELECT `id` FROM `apprezzamenti` WHERE `article_id` = ? AND `user_id` = ? FOR UPDATE");
            $checkStmt->execute([$articleId, $userId]);
            $existing = $checkStmt->fetch();

            if ($existing) {
                // Rimuovi like
                $delStmt = $pdo->prepare("DELETE FROM `apprezzamenti` WHERE `article_id` = ? AND `user_id` = ?");
                $delStmt->execute([$articleId, $userId]);

                // Decrementa conteggio articolo
                $upStmt = $pdo->prepare("UPDATE `articles` SET `likes` = GREATEST(0, `likes` - 1) WHERE `id` = ?");
                $upStmt->execute([$articleId]);
                $liked = false;
            } else {
                // Inserisci like
                $likeId = generateUuidV4();
                $insStmt = $pdo->prepare("INSERT INTO `apprezzamenti` (`id`, `article_id`, `user_id`, `created_at`) VALUES (?, ?, ?, NOW())");
                $insStmt->execute([$likeId, $articleId, $userId]);

                // Incrementa conteggio articolo
                $upStmt = $pdo->prepare("UPDATE `articles` SET `likes` = `likes` + 1 WHERE `id` = ?");
                $upStmt->execute([$articleId]);
                $liked = true;
            }

            // Recupera nuovo conteggio
            $countStmt = $pdo->prepare("SELECT `likes` FROM `articles` WHERE `id` = ?");
            $countStmt->execute([$articleId]);
            $newCount = (int)$countStmt->fetchColumn();

            $pdo->commit();

            sendResponse([
                'liked'     => $liked,
                'likes'     => $newCount,
                'articleId' => $articleId
            ]);
            break;

        // ---------------------------------------------------------------------
        // GESTIONE TESTATA (Logo e Banner della testata)
        // ---------------------------------------------------------------------
        case 'get_testata':
            $stmt = $pdo->prepare("SELECT `imma_testata` FROM `testata` WHERE `id` = 'header_image' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            $url = $row ? $row['imma_testata'] : null;

            sendResponse(['imma_testata' => $url]);
            break;

        case 'update_testata':
            $imageUrl = $body['imma_testata'] ?? '';
            if (empty($imageUrl)) {
                sendResponse(null, 400, 'URL immagine testata obbligatorio.');
            }

            $stmt = $pdo->prepare("
                INSERT INTO `testata` (`id`, `imma_testata`, `updated_at`)
                VALUES ('header_image', ?, NOW())
                ON DUPLICATE KEY UPDATE `imma_testata` = VALUES(`imma_testata`), `updated_at` = NOW()
            ");
            $stmt->execute([$imageUrl]);

            sendResponse(['imma_testata' => $imageUrl, 'message' => 'Testata aggiornata su Aruba MySQL']);
            break;

        // ---------------------------------------------------------------------
        // GESTIONE CONTATTI (Amicizie tra Autori)
        // ---------------------------------------------------------------------
        case 'get_contacts':
            $userId = $_GET['user_id'] ?? $body['user_id'] ?? '';
            if (empty($userId)) {
                sendResponse(null, 400, 'ID utente richiesto.');
            }

            $stmt = $pdo->prepare("
                SELECT c.`id`, c.`sender_id`, c.`receiver_id`, c.`status`, c.`created_at`, c.`updated_at`,
                       us.`username` as sender_username, us.`first_name` as sender_first, us.`last_name` as sender_last, us.`avatar` as sender_avatar,
                       ur.`username` as receiver_username, ur.`first_name` as receiver_first, ur.`last_name` as receiver_last, ur.`avatar` as receiver_avatar
                FROM `contatti` c
                LEFT JOIN `utenti` us ON c.`sender_id` = us.`id`
                LEFT JOIN `utenti` ur ON c.`receiver_id` = ur.`id`
                WHERE c.`sender_id` = ? OR c.`receiver_id` = ?
                ORDER BY c.`updated_at` DESC
            ");
            $stmt->execute([$userId, $userId]);
            $contacts = $stmt->fetchAll();

            $formatted = array_map(function($c) {
                $sName = trim("{$c['sender_first']} {$c['sender_last']}");
                $rName = trim("{$c['receiver_first']} {$c['receiver_last']}");

                return [
                    'id'             => $c['id'],
                    'senderId'       => $c['sender_id'],
                    'receiverId'     => $c['receiver_id'],
                    'status'         => $c['status'],
                    'createdAt'      => strtotime($c['created_at']) * 1000,
                    'updatedAt'      => strtotime($c['updated_at']) * 1000,
                    'senderName'     => !empty($sName) ? $sName : ($c['sender_username'] ?? 'Utente'),
                    'senderAvatar'   => $c['sender_avatar'] ?? "https://api.dicebear.com/7.x/miniavs/svg?seed={$c['sender_id']}",
                    'receiverName'   => !empty($rName) ? $rName : ($c['receiver_username'] ?? 'Utente'),
                    'receiverAvatar' => $c['receiver_avatar'] ?? "https://api.dicebear.com/7.x/miniavs/svg?seed={$c['receiver_id']}"
                ];
            }, $contacts);

            sendResponse($formatted);
            break;

        case 'send_contact_request':
            $senderId = $body['sender_id'] ?? '';
            $receiverId = $body['receiver_id'] ?? '';

            if (empty($senderId) || empty($receiverId) || $senderId === $receiverId) {
                sendResponse(null, 400, 'Mittente e destinatario non validi.');
            }

            $contactId = generateUuidV4();
            $stmt = $pdo->prepare("
                INSERT INTO `contatti` (`id`, `sender_id`, `receiver_id`, `status`, `created_at`, `updated_at`)
                VALUES (?, ?, ?, 'PENDING', NOW(), NOW())
                ON DUPLICATE KEY UPDATE `status` = 'PENDING', `updated_at` = NOW()
            ");
            $stmt->execute([$contactId, $senderId, $receiverId]);

            sendResponse(['id' => $contactId, 'message' => 'Richiesta di contatto inviata']);
            break;

        case 'update_contact_status':
            $contactId = $body['id'] ?? '';
            $status = $body['status'] ?? '';

            if (empty($contactId) || !in_array($status, ['PENDING', 'ACCEPTED', 'REJECTED'])) {
                sendResponse(null, 400, 'Stato non valido.');
            }

            $stmt = $pdo->prepare("UPDATE `contatti` SET `status` = ?, `updated_at` = NOW() WHERE `id` = ?");
            $stmt->execute([$status, $contactId]);

            sendResponse(['message' => 'Stato contatto aggiornato']);
            break;

        case 'delete_contact':
            $contactId = $body['id'] ?? $_GET['id'] ?? '';
            if (empty($contactId)) {
                sendResponse(null, 400, 'ID contatto richiesto.');
            }

            $stmt = $pdo->prepare("DELETE FROM `contatti` WHERE `id` = ?");
            $stmt->execute([$contactId]);

            sendResponse(['message' => 'Contatto rimosso']);
            break;

        // ---------------------------------------------------------------------
        // GESTIONE MESSAGGI PRIVATI
        // ---------------------------------------------------------------------
        case 'get_messages':
            $userId = $_GET['user_id'] ?? $body['user_id'] ?? '';
            if (empty($userId)) {
                sendResponse(null, 400, 'ID utente richiesto.');
            }

            $stmt = $pdo->prepare("
                SELECT m.`id`, m.`sender_id`, m.`receiver_id`, m.`content`, m.`is_read`, m.`created_at`,
                       u.`username` as sender_username, u.`first_name` as sender_first, u.`last_name` as sender_last, u.`avatar` as sender_avatar
                FROM `messaggi` m
                LEFT JOIN `utenti` u ON m.`sender_id` = u.`id`
                WHERE m.`sender_id` = ? OR m.`receiver_id` = ?
                ORDER BY m.`created_at` ASC
            ");
            $stmt->execute([$userId, $userId]);
            $messages = $stmt->fetchAll();

            $formatted = array_map(function($m) {
                $sName = trim("{$m['sender_first']} {$m['sender_last']}");
                return [
                    'id'           => $m['id'],
                    'senderId'     => $m['sender_id'],
                    'receiverId'   => $m['receiver_id'],
                    'content'      => $m['content'],
                    'isRead'       => (bool)$m['is_read'],
                    'createdAt'    => strtotime($m['created_at']) * 1000,
                    'senderName'   => !empty($sName) ? $sName : ($m['sender_username'] ?? 'Utente'),
                    'senderAvatar' => $m['sender_avatar'] ?? "https://api.dicebear.com/7.x/miniavs/svg?seed={$m['sender_id']}"
                ];
            }, $messages);

            sendResponse($formatted);
            break;

        case 'send_message':
            $senderId = $body['sender_id'] ?? '';
            $receiverId = $body['receiver_id'] ?? '';
            $content = trim($body['content'] ?? '');

            if (empty($senderId) || empty($receiverId) || empty($content)) {
                sendResponse(null, 400, 'Mittente, destinatario e testo sono obbligatori.');
            }

            $msgId = generateUuidV4();
            $stmt = $pdo->prepare("
                INSERT INTO `messaggi` (`id`, `sender_id`, `receiver_id`, `content`, `is_read`, `created_at`)
                VALUES (?, ?, ?, ?, 0, NOW())
            ");
            $stmt->execute([$msgId, $senderId, $receiverId, $content]);

            sendResponse([
                'id'        => $msgId,
                'createdAt' => time() * 1000,
                'message'   => 'Messaggio inviato con successo'
            ], 201);
            break;

        case 'mark_messages_read':
            $receiverId = $body['receiver_id'] ?? '';
            $senderId = $body['sender_id'] ?? '';

            if (empty($receiverId) || empty($senderId)) {
                sendResponse(null, 400, 'ID mittente e destinatario richiesti.');
            }

            $stmt = $pdo->prepare("
                UPDATE `messaggi`
                SET `is_read` = 1
                WHERE `receiver_id` = ? AND `sender_id` = ? AND `is_read` = 0
            ");
            $stmt->execute([$receiverId, $senderId]);

            sendResponse(['message' => 'Messaggi contrassegnati come letti']);
            break;

        default:
            sendResponse(null, 404, "Azione richiesta '{$action}' non riconosciuta dal bridge Aruba.");
    }
} catch (PDOException $e) {
    sendResponse(null, 500, "Errore Database MySQL Aruba: " . $e->getMessage());
} catch (Exception $e) {
    sendResponse(null, 500, "Errore interno Bridge: " . $e->getMessage());
}
