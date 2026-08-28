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
 * Comprime un file video registrando a risoluzione e bitrate ottimizzati (es. 720p / 1.5 Mbps).
 * Se il browser non supporta la compressione runtime tramite MediaRecorder o in caso di errore,
 * restituisce il file originale senza bloccare l'upload.
 */
export async function compressVideo(
  file: File,
  onProgress?: (progressPercent: number) => void
): Promise<CompressionResult> {
  // Se non è un video o è già molto piccolo (< 3MB), usalo direttamente
  if (!file.type.startsWith('video/') || file.size < 3 * 1024 * 1024) {
    if (onProgress) onProgress(100);
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0
    };
  }

  // Verifica supporto MediaRecorder nel browser
  if (typeof window === 'undefined' || !window.MediaRecorder) {
    if (onProgress) onProgress(100);
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0
    };
  }

  return new Promise((resolve) => {
    const videoUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration;
        if (!duration || duration <= 0 || !isFinite(duration)) {
          URL.revokeObjectURL(videoUrl);
          resolve({ file, originalSize: file.size, compressedSize: file.size, savingsPercent: 0 });
          return;
        }

        // Risoluzione target (massimo 1280x720)
        let targetWidth = video.videoWidth || 1280;
        let targetHeight = video.videoHeight || 720;
        const maxDim = 1280;

        if (targetWidth > maxDim || targetHeight > maxDim) {
          if (targetWidth > targetHeight) {
            targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
            targetWidth = maxDim;
          } else {
            targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
            targetHeight = maxDim;
          }
        }

        // Assicuriamo dimensioni pari per i codec video
        targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
        targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          URL.revokeObjectURL(videoUrl);
          resolve({ file, originalSize: file.size, compressedSize: file.size, savingsPercent: 0 });
          return;
        }

        const stream = canvas.captureStream(30); // 30 FPS
        
        // Seleziona il formato migliore supportato
        const mimeTypes = [
          'video/webm;codecs=vp9',
          'video/webm;codecs=vp8',
          'video/webm',
          'video/mp4'
        ];
        
        const selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
        
        // Bitrate target ottimizzato: 1.5 Mbps per qualità eccellente e peso ridotto
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: selectedMimeType,
          videoBitsPerSecond: 1500000 
        });

        const chunks: Blob[] = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        mediaRecorder.onstop = () => {
          URL.revokeObjectURL(videoUrl);
          const compressedBlob = new Blob(chunks, { type: selectedMimeType });

          if (compressedBlob.size >= file.size || compressedBlob.size === 0) {
            resolve({ file, originalSize: file.size, compressedSize: file.size, savingsPercent: 0 });
            return;
          }

          const ext = selectedMimeType.includes('mp4') ? 'mp4' : 'webm';
          const compressedFile = new File([compressedBlob], `video-${Date.now()}.${ext}`, {
            type: selectedMimeType,
            lastModified: Date.now()
          });

          const savings = Math.round(((file.size - compressedBlob.size) / file.size) * 100);
          if (onProgress) onProgress(100);

          resolve({
            file: compressedFile,
            originalSize: file.size,
            compressedSize: compressedBlob.size,
            savingsPercent: Math.max(0, savings)
          });
        };

        mediaRecorder.onerror = () => {
          URL.revokeObjectURL(videoUrl);
          resolve({ file, originalSize: file.size, compressedSize: file.size, savingsPercent: 0 });
        };

        // Avvia registrazione
        mediaRecorder.start(250);

        // Rendering loop
        let animationFrameId: number;
        const render = () => {
          if (video.paused || video.ended) return;
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          
          if (onProgress && duration > 0) {
            const currentProg = Math.min(95, Math.round((video.currentTime / duration) * 100));
            onProgress(currentProg);
          }
          
          animationFrameId = requestAnimationFrame(render);
        };

        video.onended = () => {
          cancelAnimationFrame(animationFrameId);
          setTimeout(() => {
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }, 300);
        };

        // Timeout di sicurezza per evitare blocchi infiniti
        setTimeout(() => {
          if (mediaRecorder.state !== 'inactive') {
            try {
              mediaRecorder.stop();
            } catch (e) {
              // ignore
            }
          }
        }, (duration + 5) * 1000);

        await video.play();
        render();
      } catch (err) {
        console.warn('Video compression fallback to original:', err);
        URL.revokeObjectURL(videoUrl);
        resolve({ file, originalSize: file.size, compressedSize: file.size, savingsPercent: 0 });
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(videoUrl);
      resolve({ file, originalSize: file.size, compressedSize: file.size, savingsPercent: 0 });
    };
  });
}

/**
 * Esegue l'upload di un file multimediale su Aruba Business:
 * - Immagini -> cartella `mediamag/immamag`
 * - Video -> cartella `mediamag/vidmag`
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

  // Fase 2: Upload HTTP / FormData verso l'endpoint `/api/upload`
  if (onProgress) onProgress(55, 'Caricamento su server Aruba Business...');

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    // Inviamo il file processato e i metadati di destinazione Aruba
    formData.append('file', processedFile);
    formData.append('mediaCategory', isVideo ? 'video' : 'image');
    formData.append('subfolder', isVideo ? 'vidmag' : 'immamag');

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const uploadPercent = Math.round((event.loaded / event.total) * 100);
        // Mappiamo dal 55% al 100%
        const totalProgress = Math.round(55 + (uploadPercent * 0.45));
        onProgress(
          totalProgress,
          `Invio a mediamag/${isVideo ? 'vidmag' : 'immamag'}: ${uploadPercent}%`
        );
      }
    });

    xhr.addEventListener('load', () => {
      let isJson = false;
      let data: any = null;
      try {
        data = JSON.parse(xhr.responseText);
        isJson = true;
      } catch (_) {
        isJson = false;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (isJson && data && data.url) {
          resolve({
            url: data.url,
            originalSize,
            finalSize,
            savingsPercent
          });
        } else if (!isJson && xhr.responseText && (xhr.responseText.startsWith('http://') || xhr.responseText.startsWith('https://') || xhr.responseText.startsWith('/mediamag/'))) {
          resolve({
            url: xhr.responseText.trim(),
            originalSize,
            finalSize,
            savingsPercent
          });
        } else {
          const msg = (isJson && data && (data.error || data.message))
            ? (data.error || data.message)
            : "Risposta del server non valida.";
          reject(new Error(msg));
        }
      } else {
        let errorMsg = `Errore caricamento (${xhr.status})`;
        if (isJson && data) {
          if (data.error) errorMsg = data.error;
          if (data.details) errorMsg += ` - ${data.details}`;
        } else if (xhr.responseText) {
          const stripped = xhr.responseText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
          if (stripped) errorMsg += `: ${stripped}`;
        }
        reject(new Error(errorMsg));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error("Errore di connessione durante l'invio al server."));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error("Caricamento interrotto."));
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  });
}
