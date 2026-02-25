import express from 'express';
import { createServer as createViteServer } from 'vite';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Endpoint per gestire l'upload di Vercel Blob
  app.post('/api/upload', async (req, res) => {
    const body = req.body as HandleUploadBody;

    try {
      const jsonResponse = await handleUpload({
        body,
        request: req,
        onBeforeGenerateToken: async (pathname) => {
          // Qui potresti aggiungere logica di autenticazione
          // Per ora permettiamo l'upload
          return {
            allowedContentTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'],
            tokenPayload: JSON.stringify({
              // payload opzionale
            }),
          };
        },
        onUploadCompleted: async ({ blob, tokenPayload }) => {
          console.log('Upload completed:', blob);
        },
      });

      res.status(200).json(jsonResponse);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
