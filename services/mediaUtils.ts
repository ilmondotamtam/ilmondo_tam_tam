/**
 * Utility per il rilevamento e la generazione degli URL di incorporamento (embed)
 * per YouTube, TikTok, Instagram, Facebook e file video diretti.
 */

export const getEmbedUrl = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. YouTube (supporta watch?v=, youtu.be, shorts, embed, live, parametri aggiuntivi)
  try {
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be')) {
      // Controllo formato breve youtu.be/VIDEO_ID
      const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
      if (shortMatch) {
        return `https://www.youtube.com/embed/${shortMatch[1]}`;
      }

      // Controllo shorts youtube.com/shorts/VIDEO_ID
      const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
      if (shortsMatch) {
        return `https://www.youtube.com/embed/${shortsMatch[1]}`;
      }

      // Controllo embed già formato
      const embedMatch = trimmed.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
      if (embedMatch) {
        return `https://www.youtube.com/embed/${embedMatch[1]}`;
      }

      // Controllo live
      const liveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i);
      if (liveMatch) {
        return `https://www.youtube.com/embed/${liveMatch[1]}`;
      }

      // Controllo standard watch?v=VIDEO_ID (gestisce qualsiasi posizione del parametro v)
      const vMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
      if (vMatch) {
        return `https://www.youtube.com/embed/${vMatch[1]}`;
      }
    }
  } catch (_) {}

  // 2. Instagram (post, reel, tv)
  try {
    if (trimmed.includes('instagram.com')) {
      const igMatch = trimmed.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i);
      if (igMatch) {
        return `https://www.instagram.com/p/${igMatch[1]}/embed/?captioned=false`;
      }
    }
  } catch (_) {}

  // 3. TikTok (video, v, embed)
  try {
    if (trimmed.includes('tiktok.com')) {
      const ttMatch = trimmed.match(/tiktok\.com\/(?:@[\w.-]+\/video\/|v\/|embed\/v2\/|embed\/)(\d+)/i);
      if (ttMatch) {
        return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`;
      }
    }
  } catch (_) {}

  // 4. Facebook
  try {
    if (trimmed.includes('facebook.com')) {
      return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(trimmed)}&show_text=true&width=500`;
    }
  } catch (_) {}

  return null;
};

export const isSocialLink = (url?: string | null): boolean => {
  return !!getEmbedUrl(url);
};

export const isVideoUrl = (url?: string | null): boolean => {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  return (
    /\.(mp4|webm|ogg|mov|avi|mkv)(?:\?.*)?$/i.test(clean) ||
    clean.includes('/vidmag/') ||
    clean.includes('video/mp4') ||
    clean.includes('video/webm')
  );
};

