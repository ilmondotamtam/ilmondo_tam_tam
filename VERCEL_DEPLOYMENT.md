# Guida al Deploy su Vercel del PHP Bridge ("Il Mondo Tam Tam")

Questa guida spiega come ospitare e distribuire l'applicazione **Il Mondo Tam Tam** insieme al suo **PHP Bridge** (`aruba-bridge/bridge.php`) e alla pagina di recupero password (`reset-password.php`) sulla piattaforma **Vercel**.

## 1. Architettura di Hosting su Vercel
Vercel supporterà:
- **Frontend SPA**: React/Vite (compilato nella cartella `dist`).
- **PHP Serverless Functions**: Grazie al runtime `@vercel/php`, gli script `aruba-bridge/bridge.php` e `reset-password.php` verranno eseguiti nativamente come funzioni serverless PHP su Vercel.
- **Connessione MySQL Esterna**: Il bridge PHP si connetterà direttamente al database MySQL remoto (es. Aruba Business o qualsiasi altro server MySQL remoto) tramite PDO.

---

## 2. Variabili d'Ambiente da Configurare su Vercel
Nel pannello di controllo del tuo progetto su Vercel (`Settings > Environment Variables`), inserisci le seguenti variabili d'ambiente (per gli ambienti *Production*, *Preview* e *Development*):

| Nome Variabile | Descrizione | Esempio |
|---|---|---|
| `MYSQL_HOST` | Host del database MySQL remoto | `sql.tuodominio.it` o IP server |
| `MYSQL_PORT` | Porta MySQL (solitamente 3306) | `3306` |
| `MYSQL_DATABASE` | Nome del database MySQL | `Sql123456_1` |
| `MYSQL_USER` | Nome utente MySQL | `Sql123456` |
| `MYSQL_PASSWORD` | Password dell'utente MySQL | `TuaPasswordSicura123!` |
| `ARUBA_BRIDGE_KEY` | Chiave segreta di autenticazione API Bridge | `LA_TUA_CHIAVE_SEGRETA_COMPLESSA` |
| `VITE_BRIDGE_URL` | URL del bridge API (se separato, altrimenti `/aruba-bridge/bridge.php` o `/api/bridge`) | `/aruba-bridge/bridge.php` |
| `VITE_BRIDGE_KEY` | Stessa chiave segreta per il client frontend | `LA_TUA_CHIAVE_SEGRETA_COMPLESSA` |

---

## 3. Configurazione `vercel.json`
Il file `vercel.json` presente nella radice del progetto è già configurato come segue:

```json
{
  "version": 2,
  "builds": [
    { "src": "aruba-bridge/bridge.php", "use": "@vercel/php" },
    { "src": "reset-password.php", "use": "@vercel/php" },
    { "src": "package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } }
  ],
  "routes": [
    { "src": "/api/bridge", "destination": "/aruba-bridge/bridge.php" },
    { "src": "/api/bridge.php", "destination": "/aruba-bridge/bridge.php" },
    { "src": "/aruba-bridge/bridge.php", "destination": "/aruba-bridge/bridge.php" },
    { "src": "/reset-password.php", "destination": "/reset-password.php" },
    { "src": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 4. Passaggi per il Deploy
1. **Collega la repository Git** (GitHub, GitLab o Bitbucket) al tuo account Vercel.
2. **Importa il progetto** selezionando la repository di *Il Mondo Tam Tam*.
3. **Configura le variabili d'ambiente** (punto 2) prima di avviare il deploy.
4. **Avvia il deploy** (*Deploy*). Vercel installerà le dipendenze, compilerà il frontend React/Vite e configurerà i runtime PHP per `bridge.php` e `reset-password.php`.
5. Una volta completato, l'applicazione sarà attiva e il PHP Bridge risponderà correttamente alle chiamate API del portale giornalistico!
