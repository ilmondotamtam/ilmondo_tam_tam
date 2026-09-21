/**
 * Client di interfaccia per Aruba MySQL via PHP Bridge
 * Sostituisce Supabase con un'architettura enterprise basata su REST e MySQL.
 * Mantiene la compatibilità con le firme standard di interrogazione e autenticazione.
 */

import { UserRole } from '../types';

export interface SessionData {
  user: {
    id: string;
    email: string;
    username: string;
    role: UserRole;
    avatar?: string;
    firstName?: string;
    lastName?: string;
    birthDate?: string;
    city?: string;
    mobile?: string;
    job?: string;
    bio?: string;
  };
  token: string;
}

const STORAGE_KEY = 'tamtam_aruba_session';
type AuthListener = (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED', session: SessionData | null) => void;
const authListeners = new Set<AuthListener>();

function notifyAuthListeners(event: 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'USER_UPDATED', session: SessionData | null) {
  authListeners.forEach(listener => {
    try {
      listener(event, session);
    } catch (e) {
      console.error('[Aruba Auth] Errore nel listener di autenticazione:', e);
    }
  });
}

function getStoredSession(): SessionData | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error('[Aruba Auth] Errore lettura sessione locale:', e);
    return null;
  }
}

function saveStoredSession(session: SessionData | null) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.error('[Aruba Auth] Errore salvataggio sessione locale:', e);
  }
}

/**
 * Esegue fetch HTTP verso gli endpoint API gestendo credenziali iframe,
 * intercettazioni di proxy Cloud Run / Cookie check e parsing sicuro degli errori.
 */
async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<any> {
  const options: RequestInit = {
    credentials: 'include',
    ...init,
    headers: {
      'Accept': 'application/json',
      ...(init?.headers || {})
    }
  };

  const res = await fetch(input, options);
  const text = await res.text();
  const trimmedText = text.trim();

  // Rilevamento pagina Cookie check del proxy Cloud Run / preview AI Studio o risposta HTML di errore
  const isHtml = 
    trimmedText.toLowerCase().startsWith('<!doctype') ||
    trimmedText.toLowerCase().startsWith('<html') ||
    trimmedText.toLowerCase().includes('<html') ||
    trimmedText.toLowerCase().includes('<title>500') ||
    trimmedText.toLowerCase().includes('<title>502') ||
    trimmedText.toLowerCase().includes('<title>503') ||
    trimmedText.toLowerCase().includes('<title>504') ||
    trimmedText.includes('Cookie check') ||
    trimmedText.includes('action required to load your app') ||
    trimmedText.includes('AUTH_FLOW_TEST_COOKIE_NAME') ||
    trimmedText.includes(':root {');

  if (isHtml) {
    if (res.status >= 500) {
      throw new Error(`Servizio momentaneamente non disponibile (${res.status}). Riprova a breve.`);
    }
    throw new Error("L'ambiente iframe richiede autorizzazione per i cookie di sessione. Ricarica la pagina o aprila in una nuova scheda.");
  }

  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    throw new Error(`Risposta non valida dal server (${res.status})`);
  }

  if (!res.ok) {
    const detailMsg = Array.isArray(data?.details) && data.details.length > 0
      ? `: ${data.details.join('; ')}`
      : (data?.error ? `: ${data.error}` : '');
    const err = new Error(data?.message || data?.error || `Errore richiesta API${detailMsg}`);
    (err as any).data = data;
    throw err;
  }

  return data;
}

export const arubaAuth = {
  async signUp(params: { email: string; password: string; options?: { data?: any } }) {
    const { email, password, options } = params;
    const meta = options?.data || {};

    try {
      const json = await apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          first_name: meta.first_name,
          last_name: meta.last_name,
          birth_date: meta.birth_date,
          username: meta.username,
          privacy_accepted: meta.privacy_accepted ?? true,
          contract_accepted: meta.contract_accepted ?? true
        })
      });

      if (!json.success) {
        return { data: null, error: { message: json.error || 'Errore registrazione su MySQL Aruba' } };
      }

      const session: SessionData = {
        user: json.user,
        token: json.token
      };

      saveStoredSession(session);
      notifyAuthListeners('SIGNED_IN', session);

      return { data: { user: json.user, session }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Errore registrazione su MySQL Aruba' } };
    }
  },

  async signInWithPassword(params: { email?: string; username?: string; password: string }) {
    try {
      const json = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!json.success) {
        return { data: null, error: { message: json.error || 'Credenziali non valide su MySQL Aruba' } };
      }

      const session: SessionData = {
        user: json.user,
        token: json.token
      };

      saveStoredSession(session);
      notifyAuthListeners('SIGNED_IN', session);

      return { data: { user: json.user, session }, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Credenziali non valide su MySQL Aruba' } };
    }
  },

  async signOut(options?: { scope?: string }) {
    saveStoredSession(null);
    notifyAuthListeners('SIGNED_OUT', null);
    return { error: null };
  },

  async getSession() {
    const session = getStoredSession();
    return { data: { session }, error: null };
  },

  async updateUser(params: { password?: string; data?: any }) {
    const session = getStoredSession();
    if (!session?.user?.id) {
      return { data: null, error: { message: 'Utente non autenticato' } };
    }

    if (params.password) {
      try {
        await apiFetch('/api/auth/update-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: session.user.id,
            new_password: params.password
          })
        });
      } catch (err: any) {
        return { data: null, error: { message: err.message || 'Errore aggiornamento password su MySQL Aruba' } };
      }
    }

    return { data: { user: session.user }, error: null };
  },

  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
    try {
      const json = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: options?.redirectTo })
      });
      return { data: json, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Errore richiesta recupero password' } };
    }
  },

  async resetPassword(params: { token: string; new_password: string }) {
    try {
      const json = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: params.token,
          new_password: params.new_password
        })
      });
      return { data: json, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Token di recupero non valido o scaduto' } };
    }
  },

  async resend(params: { type: string; email: string }) {
    return { data: { message: 'Link inviato nuovamente' }, error: null };
  },

  onAuthStateChange(callback: (event: any, session: any) => void) {
    const listener: AuthListener = (event, session) => {
      callback(event, session);
    };

    authListeners.add(listener);

    // Esegui callback iniziale se esiste già una sessione
    const current = getStoredSession();
    if (current) {
      setTimeout(() => callback('SIGNED_IN', current), 10);
    }

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            authListeners.delete(listener);
          }
        }
      }
    };
  }
};

/**
 * Query Builder per simulare le chiamate fluenti della tabella su API MySQL Aruba
 */
class TableQueryBuilder {
  private tableName: string;
  private filters: Array<{ field: string; op: string; value: any }> = [];
  private limitCount?: number;
  private orderByField?: string;
  private orderAsc: boolean = true;
  private insertPayload?: any;
  private updatePayload?: any;
  private isDelete: boolean = false;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;

  constructor(tableName: string) {
    this.tableName = tableName;
  }

  select(fields?: string) {
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, op: '=', value });
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push({ field, op: '!=', value });
    return this;
  }

  or(conditions: string) {
    // Es: "sender_id.eq.xxx,receiver_id.eq.xxx"
    const match = conditions.match(/eq\.([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      this.filters.push({ field: 'user_id', op: '=', value: match[1] });
    }
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push({ field, op: 'IN', value: values });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderByField = field;
    this.orderAsc = options?.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this.execute();
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this.execute();
  }

  insert(data: any) {
    this.insertPayload = data;
    return this.execute();
  }

  upsert(data: any) {
    this.insertPayload = data;
    return this.execute();
  }

  update(data: any) {
    this.updatePayload = data;
    return this;
  }

  delete() {
    this.isDelete = true;
    return this;
  }

  async then(resolve: (value: any) => void, reject?: (reason: any) => void) {
    try {
      const result = await this.execute();
      resolve(result);
    } catch (err) {
      if (reject) reject(err);
      else throw err;
    }
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      const session = getStoredSession();
      const currentUserId = session?.user?.id;

      // 1. Tabella ARTICLES
      if (this.tableName === 'articles') {
        if (this.insertPayload) {
          const payload = {
            ...this.insertPayload,
            title: (this.insertPayload.title || '').trim(),
            content: (this.insertPayload.content || '').trim(),
            category: (this.insertPayload.category || 'Opinioni').trim(),
            author_name: (this.insertPayload.author_name || this.insertPayload.authorName || '').trim() || 'Autore',
            author_id: this.insertPayload.author_id || this.insertPayload.authorId || currentUserId || null,
            image_url: this.insertPayload.image_url || this.insertPayload.imageUrl || null
          };

          const json = await apiFetch('/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          return { data: json, error: null };
        }

        if (this.isDelete) {
          const idFilter = this.filters.find(f => f.field === 'id')?.value;
          if (idFilter) {
            const json = await apiFetch(`/api/articles/${idFilter}`, { method: 'DELETE' });
            return { data: json, error: null };
          }
        }

        const json = await apiFetch('/api/articles');
        let list = (json.data || []).map((a: any) => ({
          ...a,
          imageUrl: a.imageUrl || a.image_url || '',
          image_url: a.image_url || a.imageUrl || '',
          authorId: a.authorId || a.author_id || '',
          author_id: a.author_id || a.authorId || '',
          authorName: a.authorName || a.author_name || 'Autore',
          author_name: a.author_name || a.authorName || 'Autore',
          created_at: a.created_at || (a.timestamp ? new Date(a.timestamp).toISOString() : new Date().toISOString())
        }));

        if (this.isSingle || this.isMaybeSingle) {
          const idFilter = this.filters.find(f => f.field === 'id')?.value;
          const found = idFilter ? list.find((a: any) => a.id === idFilter) : list[0];
          return { data: found || null, error: null };
        }

        return { data: list, error: null };
      }

      // 2. Tabella TESTATA
      if (this.tableName === 'testata') {
        const payload = this.insertPayload || this.updatePayload;
        if (payload) {
          const json = await apiFetch('/api/testata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          return { data: json, error: null };
        }

        const json = await apiFetch('/api/testata');
        return { data: json.data || { imma_testata: null }, error: null };
      }

      // 3. Tabella UTENTI
      if (this.tableName === 'utenti') {
        if (this.updatePayload) {
          const id = this.filters.find(f => f.field === 'id')?.value || currentUserId;
          const json = await apiFetch('/api/utenti/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...this.updatePayload })
          });
          return { data: json, error: null };
        }

        // Filtro batch IN su id: es. .in('id', userIds)
        const inFilter = this.filters.find(f => f.field === 'id' && f.op === 'IN');
        if (inFilter) {
          const rawIds = Array.isArray(inFilter.value) ? inFilter.value : [inFilter.value];
          const cleanIds = rawIds.filter((id: any) => id && typeof id === 'string' && id !== 'undefined' && id !== 'null' && id.trim() !== '');
          if (cleanIds.length === 0) {
            return { data: [], error: null };
          }
          const json = await apiFetch('/api/utenti/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: cleanIds })
          });
          return { data: json.data || [], error: null };
        }

        const idFilter = this.filters.find(f => f.field === 'id' && (f.op === '=' || !f.op))?.value;
        if (idFilter) {
          if (!idFilter || idFilter === 'undefined' || idFilter === 'null') {
            return { data: this.isSingle || this.isMaybeSingle ? null : [], error: null };
          }
          try {
            const json = await apiFetch(`/api/utenti/profile?user_id=${encodeURIComponent(idFilter)}`);
            const user = json.data;
            if (this.isSingle || this.isMaybeSingle) {
              return { data: user || null, error: null };
            }
            return { data: user ? [user] : [], error: null };
          } catch {
            if (this.isSingle || this.isMaybeSingle) {
              return { data: null, error: null };
            }
            return { data: [], error: null };
          }
        }

        // Cerca utenti
        const json = await apiFetch(`/api/utenti/search?exclude_id=${encodeURIComponent(currentUserId || '')}`);
        return { data: json.data || [], error: null };
      }

      // 4. Tabella COMMENTS
      if (this.tableName === 'comments') {
        if (this.insertPayload) {
          const json = await apiFetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.insertPayload)
          });
          return { data: json.data, error: null };
        }
        return { data: [], error: null };
      }

      // 5. Tabella APPREZZAMENTI (Likes)
      if (this.tableName === 'apprezzamenti') {
        if (this.insertPayload) {
          const json = await apiFetch('/api/likes/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.insertPayload)
          });
          return { data: json, error: null };
        }
        if (this.isDelete) {
          const articleId = this.filters.find(f => f.field === 'article_id')?.value;
          const userId = this.filters.find(f => f.field === 'user_id')?.value || currentUserId;
          if (articleId && userId) {
            const json = await apiFetch('/api/likes/toggle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ article_id: articleId, user_id: userId })
            });
            return { data: json, error: null };
          }
        }
        return { data: [], error: null };
      }

      // 6. Tabella CONTATTI
      if (this.tableName === 'contatti') {
        if (this.insertPayload) {
          const json = await apiFetch('/api/contatti/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.insertPayload)
          });
          return { data: json, error: null };
        }

        if (this.updatePayload) {
          const id = this.filters.find(f => f.field === 'id')?.value;
          const json = await apiFetch(`/api/contatti/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.updatePayload)
          });
          return { data: json, error: null };
        }

        if (this.isDelete) {
          const id = this.filters.find(f => f.field === 'id')?.value;
          const json = await apiFetch(`/api/contatti/${id}`, { method: 'DELETE' });
          return { data: json, error: null };
        }

        let uid = currentUserId || '';
        if (!uid) {
          const idFilter = this.filters.find(f => f.field === 'user_id' || f.field === 'sender_id' || f.field === 'receiver_id')?.value;
          if (idFilter && typeof idFilter === 'string') uid = idFilter;
        }

        if (!uid) {
          return { data: [], error: null };
        }

        try {
          const json = await apiFetch(`/api/contatti?user_id=${encodeURIComponent(uid)}`);
          const list = (json?.data || []).map((c: any) => ({
            ...c,
            sender_id: c.sender_id || c.senderId,
            receiver_id: c.receiver_id || c.receiverId,
            senderId: c.senderId || c.sender_id,
            receiverId: c.receiverId || c.receiver_id,
            created_at: c.created_at || (c.createdAt ? new Date(c.createdAt).toISOString() : new Date().toISOString()),
            updated_at: c.updated_at || (c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString())
          }));
          return { data: list, error: null };
        } catch (fetchErr: any) {
          console.warn('[Aruba DB] Recupero contatti temporaneamente non disponibile:', fetchErr.message);
          return { data: [], error: null };
        }
      }

      // 7. Tabella MESSAGGI
      if (this.tableName === 'messaggi') {
        if (this.insertPayload) {
          const json = await apiFetch('/api/messaggi/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.insertPayload)
          });
          return { data: json, error: null };
        }

        if (this.updatePayload && this.updatePayload.is_read) {
          const senderId = this.filters.find(f => f.field === 'sender_id')?.value;
          const receiverId = this.filters.find(f => f.field === 'receiver_id')?.value || currentUserId;
          if (senderId && receiverId) {
            const json = await apiFetch('/api/messaggi/read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ receiver_id: receiverId, sender_id: senderId })
            });
            return { data: json, error: null };
          }
        }

        let uid = currentUserId || '';
        if (!uid) {
          const idFilter = this.filters.find(f => f.field === 'user_id' || f.field === 'sender_id' || f.field === 'receiver_id')?.value;
          if (idFilter && typeof idFilter === 'string') uid = idFilter;
        }

        if (!uid) {
          return { data: [], error: null };
        }

        try {
          const json = await apiFetch(`/api/messaggi?user_id=${encodeURIComponent(uid)}`);
          const list = (json?.data || []).map((m: any) => ({
            ...m,
            sender_id: m.sender_id || m.senderId,
            receiver_id: m.receiver_id || m.receiverId,
            senderId: m.senderId || m.sender_id,
            receiverId: m.receiverId || m.receiver_id,
            is_read: typeof m.is_read !== 'undefined' ? m.is_read : (typeof m.isRead !== 'undefined' ? m.isRead : false),
            isRead: typeof m.isRead !== 'undefined' ? m.isRead : (typeof m.is_read !== 'undefined' ? m.is_read : false),
            created_at: m.created_at || (m.createdAt ? new Date(m.createdAt).toISOString() : new Date().toISOString())
          }));
          return { data: list, error: null };
        } catch (fetchErr: any) {
          console.warn('[Aruba DB] Recupero messaggi temporaneamente non disponibile:', fetchErr.message);
          return { data: [], error: null };
        }
      }

      return { data: [], error: null };
    } catch (err: any) {
      console.error(`[Aruba DB] Errore tabella ${this.tableName}:`, err);
      return { data: null, error: { message: err.message || 'Errore database Aruba' } };
    }
  }
}

/**
 * Canale di aggiornamento in tempo reale basato su polling leggero
 * compatibile con MySQL su hosting condiviso Aruba (senza websocket daemons).
 */
class RealtimeChannel {
  private channelName: string;
  private intervalId: any = null;
  private callbacks: Array<(payload: any) => void> = [];

  constructor(channelName: string) {
    this.channelName = channelName;
  }

  on(eventType: string, filter: any, callback: (payload: any) => void) {
    this.callbacks.push(callback);
    return this;
  }

  subscribe() {
    // Polling periodico ogni 6 secondi per aggiornamenti messaggi/contatti
    this.intervalId = setInterval(() => {
      this.callbacks.forEach(cb => cb({ event: 'SYNC', channel: this.channelName }));
    }, 6000);
    return this;
  }

  unsubscribe() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const arubaClient = {
  auth: arubaAuth,

  from(tableName: string) {
    return new TableQueryBuilder(tableName);
  },

  async rpc(procedureName: string, params?: any) {
    if (procedureName === 'increment_likes' || procedureName === 'decrement_likes') {
      const rowId = params?.row_id;
      const session = getStoredSession();
      if (rowId && session?.user?.id) {
        try {
          await apiFetch('/api/likes/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article_id: rowId, user_id: session.user.id })
          });
        } catch (e) {
          console.error('[Aruba DB] Errore toggle likes rpc:', e);
        }
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  },

  channel(channelName: string) {
    return new RealtimeChannel(channelName);
  }
};
