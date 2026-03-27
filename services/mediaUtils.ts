
export const getEmbedUrl = (url: string) => {
  if (!url) return null;

  // YouTube
  const ytMatch = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Instagram
  const igMatch = url.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/);
  if (igMatch) return `https://www.instagram.com/p/${igMatch[1]}/embed/?captioned=false`;

  // TikTok
  const ttMatch = url.match(/tiktok\.com\/(?:@[\w.-]+\/video\/|v\/|embed\/v2\/|embed\/)(\d+)/);
  if (ttMatch) return `https://www.tiktok.com/embed/v2/${ttMatch[1]}`;

  // Facebook
  if (url.includes('facebook.com')) {
      // Facebook embeds usually need the full URL encoded
      return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500`;
  }

  return null;
};

export const isSocialLink = (url: string) => {
    return !!getEmbedUrl(url);
};
