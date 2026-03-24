
import { createClient } from '@supabase/supabase-js';

// Utilizziamo process.env direttamente come configurato in vite.config.ts
//const supabaseUrl = process.env.SUPABASE_URL;
//const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabaseUrl = process.env.SUPABASE_URL || 'https://rsedmdahrhxmrlrkizmp.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_RPNjYNfNdxFHEv9viO4hOw_ECZxqZmR';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Configurazione Supabase non trovata. " +
    "Assicurati di aver impostato SUPABASE_URL e SUPABASE_ANON_KEY nelle variabili d'ambiente."
  );
}

// Forniamo valori di fallback per evitare l'errore fatale 'supabaseUrl is required' durante l'importazione del modulo.
// Le chiamate effettive falliranno con 401/404 invece di far crashare l'intera app al caricamento.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder-project.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);
