=============================================================================
GUIDA ALL'INSTALLAZIONE DEL PHP MYSQL BRIDGE SU ARUBA BUSINESS
=============================================================================

1. CARICAMENTO FILE SULL'HOSTING ARUBA:
   Carica tramite FTP o SSH/SFTP la cartella `aruba-bridge` (o i file `bridge.php` e `config.php`)
   nella root pubblica del tuo sito web su Aruba Business (es. in `/public_html/api/` o `/www/aruba-bridge/`).

2. CONFIGURAZIONE DEL DATABASE MYSQL:
   - Rinomina `config.sample.php` in `config.php`.
   - Inserisci le credenziali del database MySQL Aruba:
     * host (es. 89.96.xxx.xxx o sqlXXX.arubabusiness.it o 127.0.0.1)
     * database (es. SqlXXXXXX_1)
     * username (es. SqlXXXXXX)
     * password (la tua password del DB Aruba)
   - Imposta la chiave `bridge_key` (una stringa complessa e segreta).

3. CREAZIONE DELLE TABELLE MYSQL:
   - Apri phpMyAdmin nel pannello Aruba ed esegui il file `mysql_schema.sql` allegato.
   - In alternativa, puoi richiamare una volta sola l'endpoint:
     POST https://tuodominio.it/aruba-bridge/bridge.php?action=init_schema
     con l'header `X-Bridge-Key: TuaChiaveSegreta`.

4. CONFIGURAZIONE VARIABILI D'AMBIENTE NELL'APP:
   Nel file `.env` dell'applicazione:
   ARUBA_BRIDGE_URL="https://www.tuodominioaruba.it/aruba-bridge/bridge.php"
   ARUBA_BRIDGE_KEY="TuaChiaveSegreta"

5. NUOVA GESTIONE PASSWORD:
   Tutte le password utente sono ora cifrate con l'algoritmo bcrypt nativo (cost 12),
   compatibile al 100% con gli standard moderni di sicurezza PHP e MySQL.
=============================================================================
