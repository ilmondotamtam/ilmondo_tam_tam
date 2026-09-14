import fs from 'fs';
import path from 'path';
import SftpClient from 'ssh2-sftp-client';
import { Client as FtpClient } from 'basic-ftp';
import { z } from 'zod';

export const UploadMetadataSchema = z.object({
  mediaCategory: z.enum(['image', 'video']).default('image'),
  subfolder: z.enum(['immamag', 'vidmag']).optional()
});

export interface UploadResult {
  url: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
  storageType: 'aruba_sftp' | 'aruba_ftp' | 'local_storage';
  warning?: string;
}

/**
 * Genera una lista ordinata di possibili host candidati per Aruba:
 * Es: Se viene fornito "ssh.mondotamtam.it", genera anche "mondotamtam.it", "ftp.mondotamtam.it", "www.mondotamtam.it"
 */
function getHostCandidates(configuredHost?: string, baseUrl?: string): string[] {
  const hosts: Set<string> = new Set();

  if (configuredHost) {
    const clean = configuredHost.trim().toLowerCase();
    hosts.add(clean);

    // Se inizia con ssh., prova anche senza prefisso
    if (clean.startsWith('ssh.')) {
      const rootDomain = clean.replace(/^ssh\./, '');
      hosts.add(rootDomain);
      hosts.add(`ftp.${rootDomain}`);
      hosts.add(`www.${rootDomain}`);
    } else if (clean.startsWith('ftp.')) {
      const rootDomain = clean.replace(/^ftp\./, '');
      hosts.add(rootDomain);
      hosts.add(`ssh.${rootDomain}`);
      hosts.add(`www.${rootDomain}`);
    } else {
      hosts.add(`ssh.${clean}`);
      hosts.add(`ftp.${clean}`);
      hosts.add(`www.${clean}`);
    }
  }

  if (baseUrl) {
    try {
      const parsed = new URL(baseUrl);
      if (parsed.hostname) {
        hosts.add(parsed.hostname.toLowerCase());
        const root = parsed.hostname.replace(/^www\./, '').replace(/^ssh\./, '').replace(/^ftp\./, '');
        hosts.add(root);
        hosts.add(`ftp.${root}`);
      }
    } catch (_) {}
  }

  return Array.from(hosts).filter(h => !!h && !h.includes('tuodominioaruba.it'));
}

/**
 * Salva un file nella destinazione Aruba Business via SSH / SFTP:
 * - Immagini: cartella `mediamag/immamag/`
 * - Video: cartella `mediamag/vidmag/`
 *
 * Include auto-discovery dei candidati DNS e fallback sicuro su storage locale
 * per prevenire blocchi durante la pubblicazione.
 */
export async function saveMediaToAruba(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string,
  mediaCategory: 'image' | 'video',
  hostHeader?: string
): Promise<UploadResult> {
  const isVideo = mediaCategory === 'video' || mimeType.startsWith('video/');
  const subfolder = isVideo ? 'vidmag' : 'immamag';
  
  // Determina l'estensione del file in modo sicuro (senza usare il nome originale per il file finale)
  let ext = path.extname(originalFilename || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!ext) {
    if (mimeType.includes('webp')) ext = 'webp';
    else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) ext = 'jpg';
    else if (mimeType.includes('png')) ext = 'png';
    else if (mimeType.includes('gif')) ext = 'gif';
    else if (mimeType.includes('mp4')) ext = 'mp4';
    else if (mimeType.includes('webm')) ext = 'webm';
    else if (mimeType.includes('quicktime') || mimeType.includes('mov')) ext = 'mov';
    else ext = isVideo ? 'webm' : 'webp';
  }
  
  // Generazione nome univoco senza includere il nome originale del file: timestamp + identificatore casuale
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
  const finalFilename = `${timestamp}-${randomSuffix}.${ext}`;
  const relativeMediaPath = `mediamag/${subfolder}/${finalFilename}`;

  // Parametri di configurazione SSH / SFTP & FTP per Aruba Business
  const sshHost = process.env.ARUBA_SSH_HOST || process.env.ARUBA_FTP_HOST;
  const sshUser = process.env.ARUBA_SSH_USER || process.env.ARUBA_FTP_USER;
  const sshPassword = process.env.ARUBA_SSH_PASSWORD || process.env.ARUBA_FTP_PASSWORD;
  const sshPrivateKey = process.env.ARUBA_SSH_PRIVATE_KEY;
  const sshPort = parseInt(process.env.ARUBA_SSH_PORT || process.env.ARUBA_FTP_PORT || '22', 10);
  const rootPath = process.env.ARUBA_SSH_ROOT_PATH || process.env.ARUBA_FTP_ROOT_PATH || '';
  const arubaBaseUrl = process.env.ARUBA_MEDIA_BASE_URL?.replace(/\/$/, '');
  const protocolMode = process.env.ARUBA_STORAGE_PROTOCOL?.toLowerCase() || (sshPort === 21 ? 'ftp' : 'sftp');

  const hostCandidates = getHostCandidates(sshHost, arubaBaseUrl);

  // 1. TENTATIVO UPLOAD TRAMITE ACCESSO SSH / SFTP
  if (hostCandidates.length > 0 && sshUser && (sshPassword || sshPrivateKey) && protocolMode !== 'ftp') {
    let lastSftpError: any = null;

    for (const candidateHost of hostCandidates) {
      const sftp = new SftpClient();
      try {
        const connectConfig: SftpClient.ConnectOptions = {
          host: candidateHost,
          port: sshPort || 22,
          username: sshUser,
          readyTimeout: 10000,
          retries: 1
        };

        if (sshPrivateKey) {
          connectConfig.privateKey = sshPrivateKey;
          if (process.env.ARUBA_SSH_PASSPHRASE) {
            connectConfig.passphrase = process.env.ARUBA_SSH_PASSPHRASE;
          }
        } else if (sshPassword) {
          connectConfig.password = sshPassword;
        }

        console.log(`[Aruba SSH] Tentativo connessione SFTP verso ${candidateHost}:${sshPort || 22}...`);
        await sftp.connect(connectConfig);

        // Percorso cartella remota su server Aruba SSH
        const remoteDir = rootPath 
          ? path.posix.join(rootPath, 'mediamag', subfolder) 
          : path.posix.join('mediamag', subfolder);

        const remoteFilePath = path.posix.join(remoteDir, finalFilename);

        // Crea ricorsivamente la cartella mediamag/immamag o mediamag/vidmag se non esiste
        await sftp.mkdir(remoteDir, true);

        // Carica il buffer del file tramite canale SSH sicuro
        await sftp.put(fileBuffer, remoteFilePath);
        await sftp.end();

        console.log(`[Aruba SSH] File caricato con successo su ${candidateHost}: ${remoteFilePath}`);

        const publicBase = arubaBaseUrl || `https://${candidateHost}`;
        const fullUrl = `${publicBase}/${relativeMediaPath}`;

        return {
          url: fullUrl,
          filename: finalFilename,
          path: relativeMediaPath,
          size: fileBuffer.length,
          mimeType,
          storageType: 'aruba_sftp'
        };
      } catch (err: any) {
        try {
          await sftp.end();
        } catch (_) {}
        lastSftpError = err;
        console.warn(`[Aruba SSH] Connessione a ${candidateHost} non riuscita (${err.code || err.message}).`);
      }
    }

    console.warn(`[Aruba SSH Fallback] Impossibile raggiungere l'host SSH Aruba (${lastSftpError?.message || 'ENOTFOUND'}). Attivazione fallback locale.`);
  }

  // 2. TENTATIVO UPLOAD TRAMITE FTP (se specificato)
  if (hostCandidates.length > 0 && sshUser && sshPassword && protocolMode === 'ftp') {
    let lastFtpError: any = null;

    for (const candidateHost of hostCandidates) {
      const client = new FtpClient();
      client.ftp.verbose = false;

      try {
        await client.access({
          host: candidateHost,
          user: sshUser,
          password: sshPassword,
          port: sshPort || 21,
          secure: process.env.ARUBA_FTP_SECURE === 'true'
        });

        const remoteDir = rootPath 
          ? path.posix.join(rootPath, 'mediamag', subfolder) 
          : path.posix.join('mediamag', subfolder);

        await client.ensureDir(remoteDir);

        const { Readable } = await import('stream');
        const stream = Readable.from(fileBuffer);

        await client.uploadFrom(stream, finalFilename);
        await client.close();

        const publicBase = arubaBaseUrl || `https://${candidateHost}`;
        const fullUrl = `${publicBase}/${relativeMediaPath}`;

        return {
          url: fullUrl,
          filename: finalFilename,
          path: relativeMediaPath,
          size: fileBuffer.length,
          mimeType,
          storageType: 'aruba_ftp'
        };
      } catch (ftpError: any) {
        client.close();
        lastFtpError = ftpError;
      }
    }

    console.warn(`[Aruba FTP Fallback] Impossibile completare l'upload FTP (${lastFtpError?.message}). Attivazione fallback locale.`);
  }

  // 3. STORAGE LOCALE & SERVING IMMEDIATO (Resilienza totale per ambiente dev, preview e fallback)
  const localTargetDir = path.join(process.cwd(), 'public', 'mediamag', subfolder);
  await fs.promises.mkdir(localTargetDir, { recursive: true });

  const localFilePath = path.join(localTargetDir, finalFilename);
  await fs.promises.writeFile(localFilePath, fileBuffer);

  const publicUrl = `/${relativeMediaPath}`;

  console.log(`[Storage Locale] Media salvato in public/${relativeMediaPath} (URL: ${publicUrl})`);

  return {
    url: publicUrl,
    filename: finalFilename,
    path: relativeMediaPath,
    size: fileBuffer.length,
    mimeType,
    storageType: 'local_storage',
    warning: 'File salvato localmente; verificare configurazione host SSH Aruba.'
  };
}
