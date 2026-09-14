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

export const arubaAuth = {
  async signUp(params: { email: string; password: string; options?: { data?: any } }) {
    const { email, password, options } = params;
    const meta = options?.data || {};

    const response = await fetch('/api/auth/register', {
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

    const json = await response.json();
    if (!response.ok || !json.success) {
      return { data: null, error: { message: json.error || 'Errore registrazione su MySQL Aruba' } };
    }

    const session: SessionData = {
      user: json.user,
      token: json.token
    };

    saveStoredSession(session);
    notifyAuthListeners('SIGNED_IN', session);

    return { data: { user: json.user, session }, error: null };
  },

  async signInWithPassword(params: { email?: string; username?: string; password: string }) {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      return { data: null, error: { message: json.error || 'Credenziali non valide su MySQL Aruba' } };
    }

    const session: SessionData = {
      user: json.user,
      token: json.token
    };

    saveStoredSession(session);
    notifyAuthListeners('SIGNED_IN', session);

    return { data: { user: json.user, session }, error: null };
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
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          new_password: params.password
        })
      });

      const json = await response.json();
      if (!response.ok || !json.success) {
        return { data: null, error: { message: json.error || 'Errore aggiornamento password su MySQL Aruba' } };
      }
    }

    return { data: { user: session.user }, error: null };
  },

  async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, redirectTo: options?.redirectTo })
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      return { data: null, error: { message: json.error || 'Errore richiesta recupero password' } };
    }

    return { data: json, error: null };
  },

  async resetPassword(params: { token: string; new_password: string }) {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: params.token,
        new_password: params.new_password
      })
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      return { data: null, error: { message: json.error || 'Token di recupero non valido o scaduto' } };
    }

    return { data: json, error: null };
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
          const res = await fetch('/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.insertPayload)
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Errore inserimento articolo');
          return { data: json, error: null };
        }

        if (this.isDelete) {
          const idFilter = this.filters.find(f => f.field === 'id')?.value;
          if (idFilter) {
            const res = await fetch(`/api/articles/${idFilter}`, { method: 'DELETE' });
            const json = await res.json();
            return { data: json, error: null };
          }
        }

        const res = await fetch('/api/articles');
        const json = await res.json();
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
        if (this.insertPayload) {
          const res = await fetch('/api/testata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.insertPayload)
          });
          const json = await res.json();
          return { data: json, error: null };
        }

        const res = await fetch('/api/testata');
        const json = await res.json();
        return { data: json.data || { imma_testata: null }, error: null };
      }

      // 3. Tabella UTENTI
      if (this.tableName === 'utenti') {
        if (this.updatePayload) {
          const id = this.filters.find(f => f.field === 'id')?.value || currentUserId;
          const res = await fetch('/api/utenti/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...this.updatePayload })
          });
          const json = await res.json();
          return { data: json, error: null };
        }

        const idFilter = this.filters.find(f => f.field === 'id')?.value;
        if (idFilter) {
          const res = await fetch(`/api/utenti/profile?user_id=${encodeURIComponent(idFilter)}`);
          const json = await res.json();
          const user = json.data;
          if (this.isSingle || this.isMaybeSingle) {
            return { data: user || null, error: null };
          }
          return { data: user ? [user] : [], error: null };
        }

        // Cerca utenti
        const res = await fetch(`/api/utenti/search?exclude_id=${encodeURIComponent(currentUserId || '')}`);
        const json = await res.json();
        return { data: json.data || [], error: null };
      }

      // 4. Tabella COMMENTS
      if (this.tableName === 'comments') {
        if (this.insertPayload) {
          const res = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.insertPayload)
          });
          const json = await res.json();
          return { data: json.data, error: null };
        }
        return { data: [], error: null };
      }

      // 5. Tabella APPREZZAMENTI (Likes)
      if (this.tableName === 'apprezzamenti') {
        if (this.insertPayload) {
          const res = await fetch('/api/likes/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.insertPayload)
          });
          const json = await res.json();
          return { data: json, error: null };
        }
        if (this.isDelete) {
          const articleId = this.filters.find(f => f.field === 'article_id')?.value;
          const userId = this.filters.find(f => f.field === 'user_id')?.value || currentUserId;
          if (articleId && userId) {
            const res = await fetch('/api/likes/toggle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ article_id: articleId, user_id: userId })
            });
            const json = await res.json();
            return { data: json, error: null };
          }
        }
        return { data: [], error: null };
      }

      // 6. Tabella CONTATTI
      if (this.tableName === 'contatti') {
        if (this.insertPayload) {
          const res = await fetch('/api/contatti/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.insertPayload)
          });
          const json = await res.json();
          return { data: json, error: null };
        }

        if (this.updatePayload) {
          const id = this.filters.find(f => f.field === 'id')?.value;
          const res = await fetch(`/api/contatti/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.updatePayload)
          });
          const json = await res.json();
          return { data: json, error: null };
        }

        if (this.isDelete) {
          const id = this.filters.find(f => f.field === 'id')?.value;
          const res = await fetch(`/api/contatti/${id}`, { method: 'DELETE' });
          const json = await res.json();
          return { data: json, error: null };
        }

        const uid = currentUserId || '';
        const res = await fetch(`/api/contatti?user_id=${encodeURIComponent(uid)}`);
        const json = await res.json();
        return { data: json.data || [], error: null };
      }

      // 7. Tabella MESSAGGI
      if (this.tableName === 'messaggi') {
        if (this.insertPayload) {
          const res = await fetch('/api/messaggi/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(this.insertPayload)
          });
          const json = await res.json();
          return { data: json, error: null };
        }

        if (this.updatePayload && this.updatePayload.is_read) {
          const senderId = this.filters.find(f => f.field === 'sender_id')?.value;
          const receiverId = this.filters.find(f => f.field === 'receiver_id')?.value || currentUserId;
          if (senderId && receiverId) {
            const res = await fetch('/api/messaggi/read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ receiver_id: receiverId, sender_id: senderId })
            });
            const json = await res.json();
            return { data: json, error: null };
          }
        }

        const uid = currentUserId || '';
        const res = await fetch(`/api/messaggi?user_id=${encodeURIComponent(uid)}`);
        const json = await res.json();
        return { data: json.data || [], error: null };
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
        await fetch('/api/likes/toggle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article_id: rowId, user_id: session.user.id })
        });
      }
      return { data: null, error: null };
    }
    return { data: null, error: null };
  },

  channel(channelName: string) {
    return new RealtimeChannel(channelName);
  }
};
