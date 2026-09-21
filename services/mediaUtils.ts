/**
 * Utility per il rilevamento e la generazione degli URL di incorporamento (embed)
 * per YouTube, TikTok, Instagram, Facebook e file video diretti.
 */

export const getYouTubeVideoId = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.includes('youtube.com') || trimmed.includes('youtu.be') || trimmed.includes('youtube-nocookie.com')) {
      // 1. Formato breve youtu.be/VIDEO_ID
      const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
      if (shortMatch) return shortMatch[1];

      // 2. Shorts youtube.com/shorts/VIDEO_ID
      const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
      if (shortsMatch) return shortsMatch[1];

      // 3. Embed già formato
      const embedMatch = trimmed.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
      if (embedMatch) return embedMatch[1];

      // 4. Live youtube.com/live/VIDEO_ID
      const liveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i);
      if (liveMatch) return liveMatch[1];

      // 5. Standard watch?v=VIDEO_ID
      const vMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
      if (vMatch) return vMatch[1];
    }
  } catch (_) {}

  return null;
};

export const isYouTubeUrl = (url?: string | null): boolean => {
  return !!getYouTubeVideoId(url);
};

export const getEmbedUrl = (url?: string | null): string | null => {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. YouTube (supporta watch?v=, youtu.be, shorts, embed, live, parametri aggiuntivi)
  const ytVideoId = getYouTubeVideoId(trimmed);
  if (ytVideoId) {
    // Estrazione eventuale timestamp di inizio (t= o start=)
    let startParam = '';
    const timeMatch = trimmed.match(/[?&](?:t|start)=([0-9hms]+)/i);
    if (timeMatch) {
      const rawTime = timeMatch[1];
      let seconds = 0;
      if (/^\d+$/.test(rawTime)) {
        seconds = parseInt(rawTime, 10);
      } else {
        const h = rawTime.match(/(\d+)h/i);
        const m = rawTime.match(/(\d+)m/i);
        const s = rawTime.match(/(\d+)s/i);
        if (h) seconds += parseInt(h[1], 10) * 3600;
        if (m) seconds += parseInt(m[1], 10) * 60;
        if (s) seconds += parseInt(s[1], 10);
      }
      if (seconds > 0) {
        startParam = `&start=${seconds}`;
      }
    }

    // Usiamo il dominio standard youtube.com/embed con rel=0 per massima compatibilità
    return `https://www.youtube.com/embed/${ytVideoId}?rel=0${startParam}`;
  }

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

