<?php
/**
 * =============================================================================
 * VERCEL SERVERLESS PHP BRIDGE ENDPOINT
 * =============================================================================
 * Questo script rappresenta il punto di ingresso serverless PHP su Vercel
 * per la connessione sicura al database MySQL (Aruba Business / Cloud MySQL)
 * tramite l'architettura PHP Bridge di "Il Mondo Tam Tam".
 * 
 * Sfrutta il runtime @vercel/php per eseguire codice PHP nativo in ambiente
 * serverless con pieno supporto per PDO, Prepared Statements e bcrypt.
 * =============================================================================
 */

// Inserisce il flag di sicurezza del bridge
define('TAM_TAM_BRIDGE_LOADED', true);

// Includi il file principale del bridge PHP condiviso
require_once __DIR__ . '/../aruba-bridge/bridge.php';
