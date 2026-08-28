import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { saveMediaToAruba } from './server/arubaStorage';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Serviamo la cartella mediamag locale come asset statici
app.use('/mediamag', express.static(path.join(process.cwd(), 'public', 'mediamag')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Configurazione multer con memoria per il processing e upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // Limite 100MB
  },
  fileFilter: (req, file, cb) => {
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    if (isImage || isVideo) {
      cb(null, true);
    } else {
      cb(new Error('Formato file non supportato. Sono ammesse solo immagini e video.'));
    }
  }
});

// Endpoint di upload esclusivo per Aruba Business (mediamag/immamag e mediamag/vidmag)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nessun file inviato.' });
    }

    const rawCategory = req.body.mediaCategory;
    const mediaCategory = (rawCategory === 'video' || req.file.mimetype.startsWith('video/')) ? 'video' : 'image';

    const result = await saveMediaToAruba(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      mediaCategory,
      req.headers.host
    );

    res.json({
      success: true,
      url: result.url,
      filename: result.filename,
      path: result.path,
      size: result.size,
      storageType: result.storageType,
      warning: result.warning
    });
  } catch (error: any) {
    console.error('Errore durante l\'upload multimediale su Aruba:', error);
    res.status(500).json({
      error: 'Errore durante il salvataggio su Aruba Business.',
      details: error.message || String(error)
    });
  }
});

// Endpoint per risolvere i link brevi di TikTok (vt.tiktok.com, vm.tiktok.com)
app.get('/api/resolve-tiktok', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const response = await fetch(url, { 
      method: 'GET', 
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    res.json({ resolvedUrl: response.url });
  } catch (error) {
    console.error('TikTok resolve error:', error);
    res.status(500).json({ error: 'Failed to resolve URL' });
  }
});

// Fallback per rotte /api/* non gestite (garantisce sempre risposta JSON invece di index.html)
app.all('/api/*all', (req, res) => {
  res.status(404).json({ error: `Endpoint API '${req.method} ${req.path}' non trovato.` });
});

// Middleware di gestione errori centralizzato per rotte API
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path.startsWith('/api')) {
    console.error('Errore API Server:', err);
    return res.status(err.status || err.statusCode || 500).json({
      error: err.message || 'Errore interno del server durante la richiesta API.',
      details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  }
  next(err);
});

async function startServer() {
  // Vite middleware per lo sviluppo
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

export default app;
