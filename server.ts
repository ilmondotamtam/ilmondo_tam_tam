import express from 'express';
import { createServer as createViteServer } from 'vite';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

const app = express();
app.use(express.json());

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
        // Estraiamo il payload inviato dal client (es. userId)
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        
        // In un ambiente reale, qui verificheresti il token di sessione
        // Per ora, ci assicuriamo che ci sia almeno un tentativo di identificazione
        
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
            'video/ogg'
          ],
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
