# Ottimizzazione PHP Bridge e Diagnostica MySQL per Vercel

Questo piano descrive gli interventi per risolvere il problema di visualizzazione dei post ("Nessuna opinione trovata") quando l'applicazione è ospitata su Vercel e si interfaccia con il PHP Bridge su Aruba Business.

## 1. Panoramica & Obiettivi
- **Problema**: L'istanza pubblicata su Vercel non carica i post restituiti da Aruba Business a causa di potenziali problemi di CORS, gestione errori JSON o timeout di connessione al database MySQL.
- **Soluzione**: 
  1. Rafforzare la gestione CORS e l'intestazione della risposta nel PHP Bridge (`bridge.php`).
  2. Aggiungere un endpoint di diagnostica (`health` / `ping`) per verificare in tempo reale lo stato della connessione MySQL da Vercel.
  3. Migliorare la cattura degli errori PDO ed eccezioni PHP restituendo messaggi JSON strutturati e log diagnostici chiari.

## 2. Architettura & Flusso Diagnostico

```
┌──────────────┐         HTTPS / REST         ┌─────────────────┐        PDO         ┌──────────────────────┐
│  Vercel App  │ ───────────────────────────> │  Aruba Bridge   │ ─────────────────> │  Aruba MySQL DB      │
│  (Frontend)  │ <─────────────────────────── │  (bridge.php)   │ <───────────────── │  (mxn6524v_MdTamTam) │
└──────────────┘          JSON / CORS         └─────────────────┘                    └──────────────────────┘
```

## 3. Passi di Intervento

### A. Potenziamento Intestazioni CORS & Gestione Errori in `bridge.php`
- Assicurare che gli header CORS rispondano correttamente a qualsiasi origine (`Access-Control-Allow-Origin: *` o origin dinamico con fallback tollerante).
- Registrare un gestore di eccezioni globali in PHP (`set_exception_handler` e `set_error_handler`) che converta qualsiasi errore PHP imprevisto (es. connessione MySQL fallita) in una risposta JSON valida con codice HTTP appropriato anziché generare HTML o pagine di errore 500 vuote.

### B. Endpoint di Test/Ping nel Bridge
- Aggiungere un'azione `ping` o `health` nel router di `bridge.php` per testare la connessione al database MySQL e lo stato dei driver PDO.

### C. Gestione Robusta nel Client Node.js (`arubaDbClient.ts` / `arubaDbService.ts`)
- Migliorare la gestione degli errori di rete e la visualizzazione di toast o avvisi descrittivi nel frontend nel caso in cui la risposta non sia un JSON valido o il server Aruba non sia raggiungibile.

## 4. Decisioni & Trade-Off
- **CORS permissivo**: Consentire richieste cross-origin da qualsiasi dominio (`*` o origin dinamico) per permettere a Vercel di comunicare senza blocchi di sicurezza del browser.
- **JSON Error Output**: Garantire che nessun errore PHP venga stampato in formato HTML grezzo (che interromperebbe il parsing `res.json()` nel frontend).
