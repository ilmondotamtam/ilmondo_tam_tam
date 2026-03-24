
import { createClient } from '@supabase/supabase-js';

// Utilizziamo process.env direttamente come configurato in vite.config.ts
//const supabaseUrl = process.env.SUPABASE_URL;
//const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

export const supabaseUrl = process.env.SUPABASE_URL || 'https://rsedmdahrhxmrlrkizmp.supabase.co';
export const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzZWRtZGFocmh4bXJscmtpem1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNTI3OTAsImV4cCI6MjA4NjgyODc5MH0.JDZs9Ry5encKZ0vKR0Uqk_5vD0fbhyWmctap4vcZnPk';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Configurazione Supabase non trovata. " +
    "Assicurati di aver impostato SUPABASE_URL e SUPABASE_ANON_KEY nelle variabili d'ambiente."
  );
}

// Forniamo valori di fallback per evitare l'errore fatale 'supabaseUrl is required' durante l'importazione del modulo.
// Le chiamate effettive falliranno con 401/404 invece di far crashare l'intera app al caricamento.
export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey
);
