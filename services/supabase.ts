
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// Utilizziamo process.env direttamente come configurato in vite.config.ts
const supabaseUrl = process.env.SUPABASE_URL || 'https://yingiqhhcaimacguvruc.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpbmdpcWhoY2FpbWFjZ3V2cnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMTUzODEsImV4cCI6MjA4NTY5MTM4MX0.r7zT6pgXDVtatLwXCbxZLbB1GbBs2EGQmUmlTtrV2F8';

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
