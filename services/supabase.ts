
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

// Intercettore fetch per gestire automaticamente errori di clock-skew o token futuri (PGRST303)
const customFetch: typeof fetch = async (input, init) => {
  let response = await fetch(input, init);

  if (response.status === 401) {
    try {
      const clone = response.clone();
      const text = await clone.text();
      if (text.includes('PGRST303') || text.includes('JWT issued at future') || text.includes('invalid JWT')) {
        console.warn('[Supabase] Rilevato token non valido o nel futuro (PGRST303). Reset sessione e retry con anon key...');
        
        // Pulisci le chiavi di autenticazione da localStorage
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            const keysToRemove: string[] = [];
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
                keysToRemove.push(key);
              }
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
          } catch (e) {
            console.error('[Supabase] Errore pulizia localStorage:', e);
          }
        }

        // Riprova la richiesta usando la chiave anonima
        const headers = new Headers(init?.headers);
        headers.set('apikey', supabaseAnonKey);
        headers.set('Authorization', `Bearer ${supabaseAnonKey}`);

        response = await fetch(input, {
          ...init,
          headers
        });
      }
    } catch (err) {
      console.error('[Supabase] Errore interceptor fetch:', err);
    }
  }

  return response;
};

// Configurazione client Supabase con fetch custom resilient
export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey,
  {
    global: {
      fetch: customFetch
    },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
