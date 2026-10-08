# Architettura PHP Bridge su Vercel con Funzioni Serverless

Questo documento descrive l'implementazione dell'architettura **PHP Bridge** progettata per eseguire l'endpoint RESTful in **PHP nativo** come **Funzione Serverless su Vercel** per l'applicazione **"Il Mondo Tam Tam"**.

---

## 🏗️ Come Funziona l'Architettura su Vercel

1. **Runtime Serverless `@vercel/php`**:
   Vercel supporta l'esecuzione di script PHP nativi tramite il runtime `@vercel/php` configurato nel file `vercel.json`. Qualsiasi richiesta HTTP indirizzata a `/api/bridge` viene intercettata ed eseguita dalla funzione serverless PHP basata sul file `api/bridge.php`.

2. **Ponte di Connessione al Database MySQL**:
   Il file `api/bridge.php` include il modulo centrale `aruba-bridge/bridge.php`, il quale stabilisce una connessione sicura **PDO (PHP Data Objects)** verso il database MySQL (ospitato su Aruba Business o qualsiasi istanza MySQL remota/cloud).

3. **Sicurezza OWASP Top 10**:
   - **Prepared Statements**: Tutte le query eseguite dal bridge PHP utilizzano parametri vincolati (PDO Prepared Statements) per prevenire attacchi SQL Injection.
   - **Autenticazione Bearer / X-Bridge-Key**: Le richieste provenienti dal backend o dall'applicazione client devono presentare l'intestazione `X-Bridge-Key` o `Authorization: Bearer <chiave>` corrispondente alla chiave segreta configurata.
   - **Password Hashing con Bcrypt**: La gestione delle password (`auth_register`, `auth_login`, `auth_update_password`) utilizza le funzioni native di PHP `password_hash` e `password_verify` (cost 12), garantendo la massima compatibilità e sicurezza crittografica.

---

## ⚙️ Configurazione delle Variabili d'Ambiente su Vercel

Per fare in modo che la funzione serverless PHP si connetta correttamente al database MySQL, è necessario configurare le seguenti **Environment Variables** nel pannello di controllo Vercel (Project Settings -> Environment Variables):

| Variabile d'Ambiente | Descrizione | Esempio |
| :--- | :--- | :--- |
| `MYSQL_HOST` | Host o IP del server MySQL (es. Aruba Business) | `89.96.xxx.xxx` o `sqlXXX.arubabusiness.it` |
| `MYSQL_PORT` | Porta MySQL (default: 3306) | `3306` |
| `MYSQL_DATABASE` | Nome del database MySQL assegnato | `SqlXXXXXX_1` |
| `MYSQL_USER` | Username di accesso al database MySQL | `SqlXXXXXX` |
| `MYSQL_PASSWORD` | Password di accesso al database MySQL | `TuaPasswordSicura123` |
| `ARUBA_BRIDGE_KEY` | Chiave segreta condivisa per autorizzare le chiamate al bridge | `CHIAVE_SEGRETA_COMPLESSA_12345` |
| `ARUBA_BRIDGE_URL` | URL pubblico del bridge (es. `https://tuodominio.vercel.app/api/bridge`) | `https://tuodominio.vercel.app/api/bridge` |

---

## 🚀 Guida al Deployment su Vercel

1. **Clona o collega il repository a Vercel**:
   Importa il progetto in un nuovo progetto Vercel.

2. **Configura le Variabili d'Ambiente**:
   Inserisci le variabili elencate nella tabella precedente nelle impostazioni del progetto su Vercel.

3. **Deploy**:
   Esegui il deploy con `vercel --prod` o tramite la dashboard Vercel. Vercel installerà automaticamente il runtime `@vercel/php` ed eseguirà `api/bridge.php` come funzione serverless.

4. **Verifica dello Stato (Health Check)**:
   Puoi testare il corretto funzionamento del bridge PHP invocando l'endpoint di diagnostica:
   `https://tuodominio.vercel.app/api/bridge?action=health`
