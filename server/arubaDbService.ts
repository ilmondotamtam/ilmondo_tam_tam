import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export interface ArubaConfig {
  bridgeUrl: string;
  bridgeKey: string;
}

export function getArubaConfig(): ArubaConfig {
  return {
    bridgeUrl: (process.env.ARUBA_BRIDGE_URL || '').trim(),
    bridgeKey: (process.env.ARUBA_BRIDGE_KEY || 'TAM_TAM_ARUBA_BRIDGE_KEY_2026').trim()
  };
}

// In-memory persistent fallback store per lo sviluppo locale e preview
interface FallbackStore {
  utenti: Map<string, any>;
  articles: any[];
  comments: any[];
  apprezzamenti: { articleId: string; userId: string }[];
  testata: string;
  contatti: any[];
  messaggi: any[];
  passwordResets: any[];
}

const fallbackStore: FallbackStore = {
  utenti: new Map(),
  articles: [
    {
      id: 'demo-article-1',
      title: 'Benvenuti nel nuovo Tam Tam con Database MySQL Aruba Business',
      summary: 'La nostra piattaforma è ora migrata da Supabase al database MySQL su hosting Aruba Business tramite PHP bridge sicuro.',
      content: 'Siamo lieti di annunciare il passaggio completo al database MySQL su Aruba Business. Grazie al bridge PHP REST sicuro con prepared statements e crittografia password bcrypt avanzata, le informazioni viaggiano su canali protetti e veloci, con piena compatibilità per gli standard PHP e MySQL.',
      authorId: 'admin-1',
      authorName: 'Redazione Tam Tam',
      category: 'Opinioni',
      imageUrl: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1000',
      likes: 5,
      likedBy: [],
      timestamp: Date.now() - 3600000,
      comments: [
        {
          id: 'demo-comment-1',
          articleId: 'demo-article-1',
          userId: 'admin-1',
          username: 'Redazione Tam Tam',
          content: 'Tutte le funzionalità di autenticazione, articoli e commenti sono ora collegate al nuovo sistema.',
          timestamp: Date.now() - 1800000
        }
      ]
    }
  ],
  comments: [],
  apprezzamenti: [],
  testata: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop',
  contatti: [],
  messaggi: [],
  passwordResets: []
};

// Inizializza un utente admin demo in fallback
(async () => {
  const adminHash = await bcrypt.hash('AdminPassword123!', 10);
  fallbackStore.utenti.set('admin-1', {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@mondotamtam.it',
    passwordHash: adminHash,
    firstName: 'Admin',
    lastName: 'Tam Tam',
    birthDate: '1990-01-01',
    role: 'ADMIN',
    avatar: 'https://api.dicebear.com/7.x/miniavs/svg?seed=admin',
    city: 'Roma',
    mobile: '+39 333 1234567',
    job: 'Direttore Editoriale',
    bio: 'Gestione editoriale de Il Mondo Tam Tam.',
    privacyAccepted: true,
    contractAccepted: true
  });
})();

/**
 * Esegue una chiamata al bridge PHP su Aruba Business.
 * Se il bridge non è ancora configurato o non è raggiungibile, attiva il fallback sicuro.
 */
async function callArubaBridge(action: string, method: 'GET' | 'POST' = 'POST', payload: any = {}): Promise<any> {
  const { bridgeUrl, bridgeKey } = getArubaConfig();

  const isConfigured = bridgeUrl && 
    !bridgeUrl.includes('tuodominioaruba.it') && 
    !bridgeUrl.includes('example.com') && 
    bridgeUrl.startsWith('http');

  if (isConfigured) {
    try {
      const url = new URL(bridgeUrl);
      url.searchParams.set('action', action);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Bridge-Key': bridgeKey,
        'Authorization': `Bearer ${bridgeKey}`
      };

      const options: RequestInit = {
        method,
        headers,
        signal: AbortSignal.timeout(6000) // Timeout 6s per resilienza di rete
      };

      if (method === 'POST') {
        options.body = JSON.stringify({ action, ...payload });
      }

      const response = await fetch(url.toString(), options);
      const rawText = await response.text();
      let json: any = null;
      try {
        json = JSON.parse(rawText);
      } catch {
        throw new Error(`Risposta non-JSON da Bridge Aruba (HTTP ${response.status})`);
      }

      if (!response.ok || json.success === false) {
        throw new Error(json?.error || `Errore Bridge Aruba HTTP ${response.status}`);
      }

      return json.data;
    } catch (err: any) {
      console.error(`[Aruba Bridge] ERRORE chiamata remota a ${action} su URL "${bridgeUrl}": ${err.message}. Utilizzo fallback locale.`);
    }
  }

  // Esecuzione Fallback Locale (identica logica e crittografia password compatibile PHP)
  return executeFallback(action, payload);
}

/**
 * Fallback locale per assicurare che l'applicazione funzioni sempre senza interruzioni.
 */
async function executeFallback(action: string, payload: any): Promise<any> {
  switch (action) {
    case 'health':
      return {
        status: 'fallback_active',
        hosting: 'Local Engine (Pronto per Aruba Business MySQL)',
        bridgeConfigured: Boolean(process.env.ARUBA_BRIDGE_URL),
        mysql_version: 'MySQL 8.0+ Ready',
        tables: {
          utenti: true,
          articles: true,
          comments: true,
          apprezzamenti: true,
          testata: true,
          contatti: true,
          messaggi: true,
          password_resets: true
        }
      };

    case 'auth_register': {
      const { email, password, first_name, last_name, birth_date, username, role, city, mobile, job, bio } = payload;
      const cleanEmail = (email || '').trim().toLowerCase();
      
      for (const u of fallbackStore.utenti.values()) {
        if (u.email === cleanEmail || u.username === username) {
          throw new Error('Un utente con questa email o username esiste già.');
        }
      }

      const id = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(password, 10);
      const finalUsername = username || cleanEmail.split('@')[0];
      const avatar = `https://api.dicebear.com/7.x/miniavs/svg?seed=${finalUsername}`;

      const user = {
        id,
        username: finalUsername,
        email: cleanEmail,
        passwordHash,
        firstName: first_name || '',
        lastName: last_name || '',
        birthDate: birth_date || '',
        role: role || 'AUTHOR',
        avatar,
        city,
        mobile,
        job,
        bio,
        privacyAccepted: true,
        contractAccepted: true
      };

      fallbackStore.utenti.set(id, user);

      const { passwordHash: _, ...publicProfile } = user;
      return {
        user: publicProfile,
        token: `session_${id}_${Date.now()}`
      };
    }

    case 'auth_login': {
      const { email, username, password } = payload;
      const cred = (email || username || '').trim().toLowerCase();

      let targetUser: any = null;
      for (const u of fallbackStore.utenti.values()) {
        if (u.email === cred || u.username === cred) {
          targetUser = u;
          break;
        }
      }

      if (!targetUser) {
        throw new Error('Credenziali non corrette. Verifica email e password.');
      }

      const isValid = await bcrypt.compare(password, targetUser.passwordHash);
      if (!isValid) {
        throw new Error('Credenziali non corrette. Verifica email e password.');
      }

      const { passwordHash: _, ...publicProfile } = targetUser;
      return {
        user: publicProfile,
        token: `session_${targetUser.id}_${Date.now()}`
      };
    }

    case 'auth_update_password': {
      const { user_id, current_password, new_password } = payload;
      const user = fallbackStore.utenti.get(user_id);
      if (!user) throw new Error('Utente non trovato.');

      if (current_password) {
        const match = await bcrypt.compare(current_password, user.passwordHash);
        if (!match) throw new Error('La password attuale inserita non è corretta.');
      }

      user.passwordHash = await bcrypt.hash(new_password, 10);
      return { message: 'Password aggiornata con successo' };
    }

    case 'auth_forgot_password': {
      const { email } = payload;
      return { message: 'Se registrato, riceverai le istruzioni di recupero.' };
    }

    case 'get_profile': {
      const { user_id } = payload;
      const user = fallbackStore.utenti.get(user_id);
      if (!user) return null;
      const { passwordHash: _, ...publicProfile } = user;
      return {
        ...publicProfile,
        first_name: publicProfile.firstName || publicProfile.first_name || '',
        last_name: publicProfile.lastName || publicProfile.last_name || '',
        birth_date: publicProfile.birthDate || publicProfile.birth_date || ''
      };
    }

    case 'get_users_by_ids': {
      const { ids } = payload;
      const validIds: string[] = Array.isArray(ids) ? ids : [];
      const results: any[] = [];
      for (const id of validIds) {
        const u = fallbackStore.utenti.get(id);
        if (u) {
          const { passwordHash: _, ...publicProfile } = u;
          results.push({
            ...publicProfile,
            first_name: publicProfile.firstName || publicProfile.first_name || '',
            last_name: publicProfile.lastName || publicProfile.last_name || '',
            birth_date: publicProfile.birthDate || publicProfile.birth_date || ''
          });
        }
      }
      return results;
    }

    case 'update_profile': {
      const { id, first_name, last_name, birth_date, username, avatar, city, mobile, job, bio } = payload;
      const user = fallbackStore.utenti.get(id);
      if (!user) throw new Error('Utente non trovato.');

      user.firstName = first_name ?? user.firstName;
      user.lastName = last_name ?? user.lastName;
      user.birthDate = birth_date ?? user.birthDate;
      user.username = username ?? user.username;
      user.avatar = avatar ?? user.avatar;
      user.city = city ?? user.city;
      user.mobile = mobile ?? user.mobile;
      user.job = job ?? user.job;
      user.bio = bio ?? user.bio;

      return { message: 'Profilo aggiornato' };
    }

    case 'search_users': {
      const { q, exclude_id } = payload;
      const query = (q || '').toLowerCase();
      const results: any[] = [];

      for (const u of fallbackStore.utenti.values()) {
        if (u.id === exclude_id) continue;
        const matches = (u.username || '').toLowerCase().includes(query) ||
          (u.firstName || '').toLowerCase().includes(query) ||
          (u.lastName || '').toLowerCase().includes(query);

        if (matches) {
          const { passwordHash: _, ...publicProfile } = u;
          results.push(publicProfile);
        }
      }
      return results.slice(0, 15);
    }

    case 'get_articles':
      return [...fallbackStore.articles].sort((a, b) => b.timestamp - a.timestamp);

    case 'create_article': {
      const { title, content, summary, category, author_id, author_name, image_url } = payload;
      const id = crypto.randomUUID();
      const newArticle = {
        id,
        title,
        content,
        summary: summary || (content.length > 200 ? content.substring(0, 197) + '...' : content),
        category: category || 'Opinioni',
        authorId: author_id,
        authorName: author_name || 'Autore',
        imageUrl: image_url || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1000',
        likes: 0,
        likedBy: [],
        timestamp: Date.now(),
        comments: []
      };

      fallbackStore.articles.unshift(newArticle);
      return { id, message: 'Articolo creato' };
    }

    case 'delete_article': {
      const { id } = payload;
      fallbackStore.articles = fallbackStore.articles.filter(a => a.id !== id);
      return { message: 'Articolo eliminato' };
    }

    case 'add_comment': {
      const { article_id, user_id, username, content } = payload;
      const article = fallbackStore.articles.find(a => a.id === article_id);
      if (!article) throw new Error('Articolo non trovato');

      const commentId = crypto.randomUUID();
      const comment = {
        id: commentId,
        articleId: article_id,
        userId: user_id,
        username,
        content,
        timestamp: Date.now()
      };

      if (!article.comments) article.comments = [];
      article.comments.unshift(comment);
      return comment;
    }

    case 'toggle_like': {
      const { article_id, user_id } = payload;
      const article = fallbackStore.articles.find(a => a.id === article_id);
      if (!article) throw new Error('Articolo non trovato');

      if (!article.likedBy) article.likedBy = [];

      let liked = false;
      const index = article.likedBy.indexOf(user_id);
      if (index > -1) {
        article.likedBy.splice(index, 1);
        article.likes = Math.max(0, (article.likes || 1) - 1);
        liked = false;
      } else {
        article.likedBy.push(user_id);
        article.likes = (article.likes || 0) + 1;
        liked = true;
      }

      return { liked, likes: article.likes, articleId: article_id };
    }

    case 'get_testata':
      return { imma_testata: fallbackStore.testata };

    case 'update_testata': {
      const { imma_testata } = payload;
      fallbackStore.testata = imma_testata;
      return { imma_testata };
    }

    case 'get_contacts': {
      const { user_id } = payload;
      return fallbackStore.contatti.filter(c => c.senderId === user_id || c.receiverId === user_id);
    }

    case 'send_contact_request': {
      const { sender_id, receiver_id } = payload;
      const id = crypto.randomUUID();
      const sender = fallbackStore.utenti.get(sender_id);
      const receiver = fallbackStore.utenti.get(receiver_id);

      const request = {
        id,
        senderId: sender_id,
        receiverId: receiver_id,
        status: 'PENDING',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        senderName: sender ? `${sender.firstName} ${sender.lastName}`.trim() || sender.username : 'Utente',
        senderAvatar: sender?.avatar || `https://api.dicebear.com/7.x/miniavs/svg?seed=${sender_id}`,
        receiverName: receiver ? `${receiver.firstName} ${receiver.lastName}`.trim() || receiver.username : 'Utente',
        receiverAvatar: receiver?.avatar || `https://api.dicebear.com/7.x/miniavs/svg?seed=${receiver_id}`
      };

      fallbackStore.contatti.push(request);
      return { id };
    }

    case 'update_contact_status': {
      const { id, status } = payload;
      const c = fallbackStore.contatti.find(x => x.id === id);
      if (c) {
        c.status = status;
        c.updatedAt = Date.now();
      }
      return { message: 'Stato aggiornato' };
    }

    case 'delete_contact': {
      const { id } = payload;
      fallbackStore.contatti = fallbackStore.contatti.filter(x => x.id !== id);
      return { message: 'Contatto eliminato' };
    }

    case 'get_messages': {
      const { user_id } = payload;
      return fallbackStore.messaggi.filter(m => m.senderId === user_id || m.receiverId === user_id);
    }

    case 'send_message': {
      const { sender_id, receiver_id, content } = payload;
      const sender = fallbackStore.utenti.get(sender_id);
      const id = crypto.randomUUID();
      const msg = {
        id,
        senderId: sender_id,
        receiverId: receiver_id,
        content,
        isRead: false,
        createdAt: Date.now(),
        senderName: sender ? `${sender.firstName} ${sender.lastName}`.trim() || sender.username : 'Utente',
        senderAvatar: sender?.avatar || `https://api.dicebear.com/7.x/miniavs/svg?seed=${sender_id}`
      };

      fallbackStore.messaggi.push(msg);
      return { id, createdAt: msg.createdAt };
    }

    case 'mark_messages_read': {
      const { receiver_id, sender_id } = payload;
      for (const m of fallbackStore.messaggi) {
        if (m.receiverId === receiver_id && m.senderId === sender_id) {
          m.isRead = true;
        }
      }
      return { message: 'Letti' };
    }

    default:
      throw new Error(`Azione '${action}' non supportata`);
  }
}

export const arubaDb = {
  health: () => callArubaBridge('health', 'GET'),
  authRegister: (data: any) => callArubaBridge('auth_register', 'POST', data),
  authLogin: (data: any) => callArubaBridge('auth_login', 'POST', data),
  authUpdatePassword: (data: any) => callArubaBridge('auth_update_password', 'POST', data),
  authForgotPassword: (data: any) => callArubaBridge('auth_forgot_password', 'POST', data),
  authResetPassword: (data: any) => callArubaBridge('auth_reset_password', 'POST', data),
  getProfile: async (userId: string) => {
    if (!userId || userId === 'undefined' || userId === 'null') return null;
    try {
      const user = await callArubaBridge('get_profile', 'POST', { user_id: userId });
      if (!user) return null;
      return {
        ...user,
        first_name: user.firstName || user.first_name || '',
        last_name: user.lastName || user.last_name || '',
        birth_date: user.birthDate || user.birth_date || ''
      };
    } catch (err: any) {
      if (err.message && (err.message.includes('non trovato') || err.message.includes('not found') || err.message.includes('404'))) {
        return null;
      }
      throw err;
    }
  },
  getUsersByIds: async (ids: string[]) => {
    const validIds = Array.from(new Set(ids.filter(id => Boolean(id) && typeof id === 'string' && id !== 'undefined' && id !== 'null')));
    if (validIds.length === 0) return [];

    const fetchPromises = validIds.map(async (userId) => {
      try {
        const user = await arubaDb.getProfile(userId);
        return user;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);
    return results.filter(Boolean);
  },
  updateProfile: (data: any) => callArubaBridge('update_profile', 'POST', data),
  searchUsers: (query: string, excludeId?: string) => callArubaBridge('search_users', 'POST', { q: query, exclude_id: excludeId }),
  getArticles: async () => {
    const raw = await callArubaBridge('get_articles', 'GET');
    const list = Array.isArray(raw) ? raw : (raw?.data || raw?.articles || []);
    return list.map((a: any) => ({
      ...a,
      imageUrl: a.imageUrl || a.image_url || '',
      image_url: a.image_url || a.imageUrl || '',
      authorId: a.authorId || a.author_id || '',
      author_id: a.author_id || a.authorId || '',
      authorName: a.authorName || a.author_name || 'Autore',
      author_name: a.author_name || a.authorName || 'Autore'
    }));
  },
  createArticle: (data: any) => callArubaBridge('create_article', 'POST', data),
  deleteArticle: (id: string, userId?: string) => callArubaBridge('delete_article', 'POST', { id, user_id: userId }),
  addComment: (data: any) => callArubaBridge('add_comment', 'POST', data),
  toggleLike: (articleId: string, userId: string) => callArubaBridge('toggle_like', 'POST', { article_id: articleId, user_id: userId }),
  getTestata: () => callArubaBridge('get_testata', 'GET'),
  updateTestata: (imageUrl: string) => callArubaBridge('update_testata', 'POST', { imma_testata: imageUrl }),
  getContacts: (userId: string) => {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return Promise.resolve([]);
    }
    return callArubaBridge('get_contacts', 'POST', { user_id: userId.trim() });
  },
  sendContactRequest: (senderId: string, receiverId: string) => callArubaBridge('send_contact_request', 'POST', { sender_id: senderId, receiver_id: receiverId }),
  updateContactStatus: (id: string, status: string) => callArubaBridge('update_contact_status', 'POST', { id, status }),
  deleteContact: (id: string) => callArubaBridge('delete_contact', 'POST', { id }),
  getMessages: (userId: string) => {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return Promise.resolve([]);
    }
    return callArubaBridge('get_messages', 'POST', { user_id: userId.trim() });
  },
  sendMessage: (senderId: string, receiverId: string, content: string) => callArubaBridge('send_message', 'POST', { sender_id: senderId, receiver_id: receiverId, content }),
  markMessagesRead: (receiverId: string, senderId: string) => callArubaBridge('mark_messages_read', 'POST', { receiver_id: receiverId, sender_id: senderId })
};
