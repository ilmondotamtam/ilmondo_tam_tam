import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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

    return res.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Blob upload error:', error);
    return res.status(400).json({ error: (error as Error).message });
  }
}
