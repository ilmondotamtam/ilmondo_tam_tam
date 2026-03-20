import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const app = express();
app.use(cors());
app.use(express.json());

// Configurazione S3 per Supabase
const DEFAULT_S3_ENDPOINT = 'https://rsedmdahrhxmrlrkizmp.supabase.co/storage/v1/s3';

let s3Client: S3Client | null = null;

function getS3Client() {
  if (!s3Client) {
    const S3_ENDPOINT = process.env.SUPABASE_S3_ENDPOINT || DEFAULT_S3_ENDPOINT;
    s3Client = new S3Client({
      forcePathStyle: true,
      region: process.env.SUPABASE_S3_REGION || 'us-east-1',
      endpoint: S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return s3Client;
}

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

// Endpoint per generare un URL pre-firmato S3 per l'upload
app.post('/api/upload/presign', async (req, res) => {
  const { fileName, contentType } = req.body;

  if (!fileName || !contentType) {
    return res.status(400).json({ error: 'fileName and contentType are required' });
  }

  if (!process.env.SUPABASE_S3_ACCESS_KEY_ID || !process.env.SUPABASE_S3_SECRET_ACCESS_KEY) {
    console.error('S3 credentials are missing on the server');
    return res.status(500).json({ error: 'S3 credentials are not configured on the server. Please add SUPABASE_S3_ACCESS_KEY_ID and SUPABASE_S3_SECRET_ACCESS_KEY to your secrets.' });
  }

  try {
    const bucketName = process.env.SUPABASE_S3_BUCKET || 'media';
    const S3_ENDPOINT = process.env.SUPABASE_S3_ENDPOINT || DEFAULT_S3_ENDPOINT;
    const client = getS3Client();
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      ContentType: contentType,
    });

    // Genera l'URL pre-firmato valido per 60 secondi
    const signedUrl = await getSignedUrl(client, command, { expiresIn: 60 });
    
    // Costruiamo l'URL pubblico finale in modo robusto
    const baseUrl = S3_ENDPOINT.replace(/\/s3\/?$/, '');
    const publicUrl = `${baseUrl}/object/public/${bucketName}/${fileName}`;

    res.json({ signedUrl, publicUrl });
  } catch (error: any) {
    console.error('S3 presign error:', error);
    res.status(500).json({ 
      error: 'Failed to generate signed URL', 
      details: error?.message || String(error) 
    });
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
