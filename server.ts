import express from 'express';
import { createServer as createViteServer } from 'vite';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

const app = express();
app.use(express.json());

// Endpoint per risolvere i link brevi di TikTok (vt.tiktok.com, vm.tiktok.com)
app.get('/api/resolve-tiktok', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    // Usiamo fetch (disponibile in Node 18+) per seguire i redirect
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

// Endpoint per gestire l'upload di Vercel Blob
app.post('/api/upload', async (req, res) => {
  const body = req.body as HandleUploadBody;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is missing on the server');
    return res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN is not configured on the server' });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        
        return {
          allowedContentTypes: [
            'image/jpeg', 
            'image/png', 
            'image/gif', 
            'image/webp', 
            'image/avif',
            'video/mp4', 
            'video/quicktime', 
            'video/webm',
            'video/ogg',
            'video/x-matroska',
            'video/avi',
            'video/mpeg'
          ],
          maximumSizeInBytes: 100 * 1024 * 1024, // 100MB
          tokenPayload: JSON.stringify({
            userId: payload.userId,
            uploadDate: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Upload completed:', blob, tokenPayload);
      },
    });

    res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Blob upload error:', error);
    res.status(400).json({ error: (error as Error).message });
  }
});

async function startServer() {
  const PORT = 3000;

  // Vite middleware per lo sviluppo
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  // Avviamo il server solo se non siamo in un ambiente serverless (come Vercel Functions)
  // o se siamo in locale
  if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();

export default app;
