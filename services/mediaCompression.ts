/**
 * Modulo di compressione e gestione multimediale per immagini e video.
 * Ottimizzato per ridurre drasticamente lo spazio occupato e inviare i file
 * verso il dominio Aruba Business nella struttura:
 * - Immagini: mediamag/immamag/
 * - Video: mediamag/vidmag/
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savingsPercent: number;
  previewUrl?: string;
}

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 a 1.0 (default 0.82)
  outputFormat?: 'image/webp' | 'image/jpeg';
}

/**
 * Comprime un'immagine ridimensionandola proporzionalmente e convertendola in WebP/JPEG ottimizzato
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1080,
    quality = 0.82,
    outputFormat = 'image/webp'
  } = options;

  // Se non è un'immagine o è SVG o GIF (che potrebbero essere animate), non alterarla
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0,
      previewUrl: URL.createObjectURL(file)
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let { width, height } = img;

        // Calcola dimensioni proporzionali rispettando i limiti massimi
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({
            file,
            originalSize: file.size,
            compressedSize: file.size,
            savingsPercent: 0,
            previewUrl: URL.createObjectURL(file)
          });
          return;
        }

        // Massima qualità di rendering sul canvas
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Disegna l'immagine scalata
        ctx.drawImage(img, 0, 0, width, height);

        // Estensione del file finale
        const ext = outputFormat === 'image/webp' ? 'webp' : 'jpg';
        const newFileName = `image-${Date.now()}.${ext}`;

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // Se il blob compresso è per assurdo più grande dell'originale, manteniamo l'originale
              resolve({
                file,
                originalSize: file.size,
                compressedSize: file.size,
                savingsPercent: 0,
                previewUrl: URL.createObjectURL(file)
              });
              return;
            }

            const compressedFile = new File([blob], newFileName, {
              type: outputFormat,
              lastModified: Date.now()
            });

            const savings = Math.round(((file.size - blob.size) / file.size) * 100);

            resolve({
              file: compressedFile,
              originalSize: file.size,
              compressedSize: blob.size,
              savingsPercent: Math.max(0, savings),
              previewUrl: URL.createObjectURL(compressedFile)
            });
          },
          outputFormat,
          quality
        );
      };

      img.onerror = () => {
        resolve({
          file,
          originalSize: file.size,
          compressedSize: file.size,
          savingsPercent: 0,
          previewUrl: URL.createObjectURL(file)
        });
      };
    };

    reader.onerror = () => {
      resolve({
        file,
        originalSize: file.size,
        compressedSize: file.size,
        savingsPercent: 0,
        previewUrl: URL.createObjectURL(file)
      });
    };
  });
}

/**
 * Comprime un file video nel formato WebM VP9 usando esclusivamente la libreria libvpx-vp9
 * con un bitrate di 2 Megabit/s (2M), e impostazioni orientate alla massima velocità/prestazione
 * (-deadline realtime, -cpu-used 8, -row-mt 1).
 */
export async function compressVideo(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<CompressionResult> {
  // Se non è un video, usalo direttamente
  if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|webm|mov|avi|mkv|wmv|flv)$/i)) {
    if (onProgress) onProgress(100);
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0
    };
  }

  // Eseguiamo la compressione WebM VP9 con la libreria libvpx-vp9 a 2 Megabit/s tramite l'API backend
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        // I primi 50% sono dedicati al caricamento del video sorgente verso il motore di transcodifica
        const uploadPercent = Math.round((event.loaded / event.total) * 50);
        onProgress(uploadPercent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200 && xhr.response) {
        const compressedBlob = xhr.response as Blob;
        const originalSize = parseInt(xhr.getResponseHeader('X-Original-Size') || `${file.size}`, 10);
        const compressedSize = compressedBlob.size;
        const savingsHeader = parseInt(xhr.getResponseHeader('X-Savings-Percent') || '0', 10);
        const savingsPercent = savingsHeader || (originalSize > compressedSize ? Math.round(((originalSize - compressedSize) / originalSize) * 100) : 0);

        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'video';
        const compressedFile = new File([compressedBlob], `${baseName}-${Date.now()}.webm`, {
          type: 'video/webm',
          lastModified: Date.now()
        });

        if (onProgress) onProgress(100);
        resolve({
          file: compressedFile,
          originalSize,
          compressedSize,
          savingsPercent,
          previewUrl: URL.createObjectURL(compressedBlob)
        });
      } else {
        // Fallback: se il server restituisce errore o non supporta temporaneamente la transcodifica,
        // ritorniamo il file originale senza interrompere il flusso dell'utente
        console.warn('Compressione remota libvpx-vp9 non disponibile, utilizzo file originale:', xhr.statusText);
        if (onProgress) onProgress(100);
        resolve({
          file,
          originalSize: file.size,
          compressedSize: file.size,
          savingsPercent: 0
        });
      }
    });

    xhr.addEventListener('error', () => {
      console.warn('Errore di rete durante compressione video, procedo con file originale');
      if (onProgress) onProgress(100);
      resolve({
        file,
        originalSize: file.size,
        compressedSize: file.size,
        savingsPercent: 0
      });
    });

    xhr.addEventListener('abort', () => {
      if (onProgress) onProgress(100);
      resolve({
        file,
        originalSize: file.size,
        compressedSize: file.size,
        savingsPercent: 0
      });
    });

    // Simula avanzamento transcodifica lato server dopo l'invio del file
    xhr.upload.addEventListener('loadend', () => {
      if (onProgress) {
        let fakeProgress = 55;
        const timer = setInterval(() => {
          fakeProgress = Math.min(95, fakeProgress + 10);
          onProgress(fakeProgress);
          if (fakeProgress >= 95) clearInterval(timer);
        }, 500);
      }
    });

    xhr.open('POST', '/api/compress-video');
    xhr.responseType = 'blob';
    xhr.send(formData);
  });
}

/**
 * Esegue l'upload di un file multimediale su Aruba Business:
 * - Immagini -> cartella `mediamag/immamag`
 * - Video -> cartella `mediamag/vidmag`
 * - Foto profilo / Avatar & Immagine Testata -> cartella `mediamag/avatar`
 * Applica preventivamente la compressione per massimizzare la velocità e ridurre lo spazio.
 */
export async function uploadMediaToAruba(
  file: File,
  type: 'image' | 'video' | 'header' | 'avatar',
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<{ url: string; originalSize: number; finalSize: number; savingsPercent: number }> {
  const isVideo = file.type.startsWith('video/') || type === 'video';
  let processedFile = file;
  let originalSize = file.size;
  let finalSize = file.size;
  let savingsPercent = 0;

  // Fase 1: Compressione Ottimale
  if (isVideo) {
    if (onProgress) onProgress(5, 'Compressione video in corso...');
    try {
      const comp = await compressVideo(file, (p) => {
        if (onProgress) onProgress(Math.round(5 + (p * 0.45)), `Compressione video in corso (${p}%)...`);
      });
      processedFile = comp.file;
      finalSize = comp.compressedSize;
      savingsPercent = comp.savingsPercent;
    } catch (e) {
      console.warn('Compressione video non riuscita, invio originale:', e);
    }
  } else {
    if (onProgress) onProgress(15, 'Ottimizzazione e compressione immagine...');
    try {
      let maxDim = 1920;
      let quality = 0.82;
      
      if (type === 'avatar') {
        maxDim = 500;
        quality = 0.85;
      } else if (type === 'header') {
        maxDim = 1920;
        quality = 0.88;
      }

      const comp = await compressImage(file, {
        maxWidth: maxDim,
        maxHeight: maxDim,
        quality
      });
      processedFile = comp.file;
      finalSize = comp.compressedSize;
      savingsPercent = comp.savingsPercent;
    } catch (e) {
      console.warn('Compressione immagine non riuscita, invio originale:', e);
    }
  }

  // Fase 2: Upload HTTP / FormData verso /api/upload con fallback automatico e trasparente su Aruba Business
  if (onProgress) onProgress(55, 'Caricamento del file in corso...');

  const isAvatarOrHeader = type === 'avatar' || type === 'header';
  const mediaCategory = isAvatarOrHeader ? (type === 'header' ? 'header' : 'avatar') : (isVideo ? 'video' : 'image');
  const targetSubfolder = isAvatarOrHeader ? 'avatar' : (isVideo ? 'vidmag' : 'immamag');

  const executeXhrUpload = (endpoint: string, isDirectAruba: boolean): Promise<string> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();

      formData.append('file', processedFile);
      formData.append('mediaCategory', mediaCategory);
      formData.append('subfolder', targetSubfolder);

      // Se endpoint locale, impostiamo le credenziali per supportare i cookie dell'ambiente iframe
      if (!isDirectAruba) {
        xhr.withCredentials = true;
      }

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const uploadPercent = Math.round((event.loaded / event.total) * 100);
          const totalProgress = Math.round(55 + (uploadPercent * 0.45));
          onProgress(
            totalProgress,
            `Caricamento in corso (${isDirectAruba ? 'Aruba Business' : 'Server'}): ${uploadPercent}%`
          );
        }
      });

      xhr.addEventListener('load', () => {
        const text = (xhr.responseText || '').trim();

        // Rilevamento intercettazione proxy / Cloud Run "Cookie check" in iframe
        const isHtmlOrCookieCheck =
          text.includes('Cookie check') ||
          text.includes('action required to load your app') ||
          text.includes('AUTH_FLOW_TEST_COOKIE_NAME') ||
          text.startsWith('<!doctype') ||
          text.startsWith('<html') ||
          text.includes(':root {');

        if (isHtmlOrCookieCheck) {
          return reject(new Error('PROXY_COOKIE_CHECK_INTERCEPTED'));
        }

        let data: any = null;
        try {
          data = JSON.parse(text);
        } catch (_) {
          data = null;
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          const returnedUrl = data?.url || data?.publicUrl || data?.path;
          if (data && returnedUrl) {
            return resolve(returnedUrl);
          }
          if (!data && text && (text.startsWith('http://') || text.startsWith('https://') || text.startsWith('/mediamag/'))) {
            return resolve(text);
          }
          const msg = (data && (data.error || data.message || data.details))
            ? (data.error || data.message || data.details)
            : `Risposta inattesa dal server (${xhr.status}): ${text.replace(/<[^>]+>/g, ' ').slice(0, 100)}`;
          return reject(new Error(msg));
        } else {
          let errorMsg = `Errore caricamento (${xhr.status})`;
          if (data) {
            if (data.error) errorMsg = data.error;
            if (data.details) errorMsg += ` - ${data.details}`;
          } else if (text) {
            const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
            if (stripped) errorMsg += `: ${stripped}`;
          }
          return reject(new Error(errorMsg));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error("Errore di rete durante il caricamento del file."));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error("Caricamento interrotto."));
      });

      xhr.open('POST', endpoint);
      xhr.send(formData);
    });
  };

  const ARUBA_DIRECT_UPLOADER = 'https://www.mondotamtam.it/aruba-uploader.php';

  try {
    // 1. Tentativo primario: server Node proxy /api/upload
    const uploadUrl = await executeXhrUpload('/api/upload', false);
    return {
      url: uploadUrl,
      originalSize,
      finalSize,
      savingsPercent
    };
  } catch (primaryErr: any) {
    console.warn('[Upload] Endpoint /api/upload non disponibile o intercettato da cookie check proxy:', primaryErr?.message);
    if (onProgress) onProgress(65, 'Reindirizzamento verso lo storage diretto Aruba Business...');

    try {
      // 2. Fallback trasparente: upload diretto su hosting Aruba Business
      const directUrl = await executeXhrUpload(ARUBA_DIRECT_UPLOADER, true);
      return {
        url: directUrl,
        originalSize,
        finalSize,
        savingsPercent
      };
    } catch (directErr: any) {
      console.error('[Upload] Errore anche durante il fallback diretto Aruba:', directErr);
      throw new Error(`Errore durante il salvataggio del file su Aruba: ${directErr.message || primaryErr.message}`);
    }
  }
}
