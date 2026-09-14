<?php
/**
 * Configurazione Database MySQL Aruba Business e Chiave di Protezione Bridge
 *
 * ISTRUZIONI:
 * 1. Rinomina questo file in 'config.php' sul tuo hosting Aruba Business.
 * 2. Inserisci i dati di connessione al database MySQL assegnato da Aruba
 *    (visibili nel pannello di controllo Aruba -> Gestione Database MySQL).
 * 3. Imposta una 'BRIDGE_SECRET_KEY' robusta e inserisci la stessa chiave
 *    nella variabile d'ambiente ARUBA_BRIDGE_KEY dell'applicazione Node.js.
 */

// Evita l'accesso diretto al file di configurazione
if (!defined('TAM_TAM_BRIDGE_LOADED')) {
    http_response_code(403);
    exit(json_encode(['error' => 'Accesso diretto vietato']));
}

return [
    // Parametri Database Aruba Business
    'db' => [
        // Su Aruba Business l'host è tipicamente un IP (es. 89.96.xxx.xxx) o 'sqlXXX.arubabusiness.it' o '127.0.0.1'
        'host'     => getenv('MYSQL_HOST') ?: '127.0.0.1',
        'port'     => getenv('MYSQL_PORT') ?: 3306,
        'database' => getenv('MYSQL_DATABASE') ?: 'SqlXXXXXX_1',
        'username' => getenv('MYSQL_USER') ?: 'SqlXXXXXX',
        'password' => getenv('MYSQL_PASSWORD') ?: 'TuaPasswordDatabaseAruba',
        'charset'  => 'utf8mb4'
    ],

    // Chiave segreta di autenticazione per autorizzare le chiamate tra l'app e il bridge PHP.
    // DEVE corrispondere a ARUBA_BRIDGE_KEY nel file .env dell'app.
    'security' => [
        'bridge_key' => getenv('ARUBA_BRIDGE_KEY') ?: 'CAMBIA_CON_UNA_CHIAVE_SEGRETA_COMPLESSA_12345!',
        
        // Origini CORS consentite (* per tutte o domini specifici)
        'allowed_origins' => ['*'],

        // Attiva rate limiting su tentativi di login (max 10 tentativi al minuto per IP)
        'rate_limit_auth' => true
    ]
];
