import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { arubaDb } from './arubaDbService';

export const arubaRouter = Router();

// Middleware di validazione Zod per Request Body
function validateBody<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = (result.error as any).issues || (result.error as any).errors || [];
      return res.status(400).json({
        error: 'Dati della richiesta non validi (Validazione Zod fallita).',
        details: issues.map((e: any) => `${e.path?.join('.') || 'field'}: ${e.message}`)
      });
    }
    req.body = result.data;
    next();
  };
}

// Middleware di validazione Zod per Request Query
function validateQuery<T extends z.ZodTypeAny>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const issues = (result.error as any).issues || (result.error as any).errors || [];
      return res.status(400).json({
        error: 'Parametri query non validi.',
        details: issues.map((e: any) => `${e.path?.join('.') || 'field'}: ${e.message}`)
      });
    }
    if (result.data && typeof result.data === 'object') {
      Object.assign(req.query, result.data);
    }
    next();
  };
}

// -----------------------------------------------------------------------------
// SCHEMI ZOD DI VALIDAZIONE (OWASP Top 10)
// -----------------------------------------------------------------------------

const RegisterSchema = z.object({
  email: z.string().email('Email non valida'),
  password: z.string().min(6, 'La password deve avere almeno 6 caratteri'),
  first_name: z.string().optional().default(''),
  last_name: z.string().optional().default(''),
  birth_date: z.string().optional().nullable(),
  username: z.string().optional(),
  role: z.enum(['ADMIN', 'AUTHOR', 'READER', 'GESTOR']).optional().default('AUTHOR'),
  city: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  job: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  privacy_accepted: z.boolean().optional().default(true),
  contract_accepted: z.boolean().optional().default(true)
});

const LoginSchema = z.object({
  email: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(1, 'La password è obbligatoria')
}).refine(data => data.email || data.username, {
  message: 'Email o username obbligatorio per il login'
});

const UpdatePasswordSchema = z.object({
  user_id: z.string().min(1, 'ID utente richiesto'),
  current_password: z.string().optional(),
  new_password: z.string().min(6, 'La nuova password deve contenere almeno 6 caratteri')
});

const ForgotPasswordSchema = z.object({
  email: z.string().email('Email non valida'),
  redirectTo: z.string().optional()
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token richiesto'),
  new_password: z.string().min(6, 'La nuova password deve contenere almeno 6 caratteri')
});

const ProfileUpdateSchema = z.object({
  id: z.string().min(1, 'ID utente richiesto'),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  birth_date: z.string().optional().nullable(),
  username: z.string().min(2, 'Username troppo corto').optional(),
  avatar: z.string().optional(),
  city: z.string().optional().nullable(),
  mobile: z.string().optional().nullable(),
  job: z.string().optional().nullable(),
  bio: z.string().optional().nullable()
});

const CreateArticleSchema = z.object({
  title: z.string().min(3, 'Il titolo deve avere almeno 3 caratteri'),
  content: z.string().min(10, 'Il contenuto deve avere almeno 10 caratteri'),
  summary: z.string().optional(),
  category: z.string().min(1, 'Categoria obbligatoria'),
  author_id: z.string().optional().nullable(),
  author_name: z.string().min(1, 'Nome autore obbligatorio'),
  image_url: z.string().optional().nullable()
});

const AddCommentSchema = z.object({
  article_id: z.string().min(1, 'ID articolo richiesto'),
  user_id: z.string().optional().nullable(),
  username: z.string().min(1, 'Username richiesto'),
  content: z.string().min(1, 'Testo del commento obbligatorio')
});

const ToggleLikeSchema = z.object({
  article_id: z.string().min(1, 'ID articolo richiesto'),
  user_id: z.string().min(1, 'ID utente richiesto')
});

const ContactRequestSchema = z.object({
  sender_id: z.string().min(1, 'ID mittente richiesto'),
  receiver_id: z.string().min(1, 'ID destinatario richiesto')
});

const ContactStatusSchema = z.object({
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED'])
});

const SendMessageSchema = z.object({
  sender_id: z.string().min(1, 'ID mittente richiesto'),
  receiver_id: z.string().min(1, 'ID destinatario richiesto'),
  content: z.string().min(1, 'Il messaggio non può essere vuoto')
});

const MarkMessagesReadSchema = z.object({
  receiver_id: z.string().min(1, 'ID destinatario richiesto'),
  sender_id: z.string().min(1, 'ID mittente richiesto')
});

// Simple in-memory rate limiter per endpoint sensibili (login/register/pwd)
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();
function rateLimit(limit: number = 10, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'anonymous';
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimitMap.get(key);
    if (!record || record.expiresAt < now) {
      rateLimitMap.set(key, { count: 1, expiresAt: now + windowMs });
      return next();
    }

    record.count++;
    if (record.count > limit) {
      return res.status(429).json({
        error: 'Troppe richieste. Riprova tra un minuto (Rate Limit di sicurezza attivo).'
      });
    }

    next();
  };
}

// -----------------------------------------------------------------------------
// ENDPOINTS
// -----------------------------------------------------------------------------

// Health check dello stato Bridge & MySQL Aruba
arubaRouter.get('/health', async (req, res, next) => {
  try {
    const health = await arubaDb.health();
    res.json({ success: true, ...health });
  } catch (err) {
    next(err);
  }
});

// AUTENTICAZIONE CON PASSWORD HASHING MYSQL
arubaRouter.post('/auth/register', rateLimit(10, 60000), validateBody(RegisterSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.authRegister(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Errore durante la registrazione' });
  }
});

arubaRouter.post('/auth/login', rateLimit(15, 60000), validateBody(LoginSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.authLogin(req.body);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(401).json({ success: false, error: err.message || 'Credenziali non valide' });
  }
});

arubaRouter.post('/auth/update-password', rateLimit(5, 60000), validateBody(UpdatePasswordSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.authUpdatePassword(req.body);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Errore durante l\'aggiornamento della password' });
  }
});

arubaRouter.post('/auth/forgot-password', rateLimit(5, 60000), validateBody(ForgotPasswordSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.authForgotPassword(req.body);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

arubaRouter.post('/auth/reset-password', rateLimit(5, 60000), validateBody(ResetPasswordSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.authResetPassword(req.body);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PROFILI UTENTE
arubaRouter.get('/utenti/profile', validateQuery(z.object({ user_id: z.string() })), async (req, res, next) => {
  try {
    const profile = await arubaDb.getProfile(req.query.user_id as string);
    res.json({ success: true, data: profile });
  } catch (err: any) {
    res.status(404).json({ success: false, error: err.message || 'Profilo non trovato' });
  }
});

arubaRouter.post('/utenti/profile', validateBody(ProfileUpdateSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.updateProfile(req.body);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

arubaRouter.get('/utenti/search', validateQuery(z.object({ q: z.string().optional(), exclude_id: z.string().optional() })), async (req, res, next) => {
  try {
    const excludeId = typeof req.query.exclude_id === 'string' ? req.query.exclude_id : undefined;
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await arubaDb.searchUsers(query, excludeId);
    res.json({ success: true, data: results });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ARTICOLI
arubaRouter.get('/articles', async (req, res, next) => {
  try {
    const articles = await arubaDb.getArticles();
    res.json({ success: true, data: articles });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

arubaRouter.post('/articles', validateBody(CreateArticleSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.createArticle(req.body);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

arubaRouter.delete('/articles/:id', async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await arubaDb.deleteArticle(id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// COMMENTI
arubaRouter.post('/comments', validateBody(AddCommentSchema), async (req, res, next) => {
  try {
    const comment = await arubaDb.addComment(req.body);
    res.status(201).json({ success: true, data: comment });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// LIKES (APPREZZAMENTI ATOMICI)
arubaRouter.post('/likes/toggle', validateBody(ToggleLikeSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.toggleLike(req.body.article_id, req.body.user_id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// TESTATA
arubaRouter.get('/testata', async (req, res, next) => {
  try {
    const result = await arubaDb.getTestata();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

arubaRouter.post('/testata', validateBody(z.object({ imma_testata: z.string().min(1) })), async (req, res, next) => {
  try {
    const result = await arubaDb.updateTestata(req.body.imma_testata);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// CONTATTI
arubaRouter.get('/contatti', validateQuery(z.object({ user_id: z.string() })), async (req, res, next) => {
  try {
    const contacts = await arubaDb.getContacts(req.query.user_id as string);
    res.json({ success: true, data: contacts });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

arubaRouter.post('/contatti/request', validateBody(ContactRequestSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.sendContactRequest(req.body.sender_id, req.body.receiver_id);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

arubaRouter.put('/contatti/:id', validateBody(ContactStatusSchema), async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await arubaDb.updateContactStatus(id, req.body.status);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

arubaRouter.delete('/contatti/:id', async (req, res, next) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await arubaDb.deleteContact(id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// MESSAGGI
arubaRouter.get('/messaggi', validateQuery(z.object({ user_id: z.string() })), async (req, res, next) => {
  try {
    const messages = await arubaDb.getMessages(req.query.user_id as string);
    res.json({ success: true, data: messages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

arubaRouter.post('/messaggi/send', validateBody(SendMessageSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.sendMessage(req.body.sender_id, req.body.receiver_id, req.body.content);
    res.status(201).json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

arubaRouter.post('/messaggi/read', validateBody(MarkMessagesReadSchema), async (req, res, next) => {
  try {
    const result = await arubaDb.markMessagesRead(req.body.receiver_id, req.body.sender_id);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});
