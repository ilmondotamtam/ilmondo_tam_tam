
import React, { useState } from 'react';
import { Article } from '../types';
import { getEmbedUrl } from '../services/mediaUtils';
import { Translations } from '../translations';

interface ArticleCardProps {
  article: Article;
  onClick: (article: Article) => void;
  onLike?: () => void;
  currentUserId?: string;
  t: Translations;
  language?: string;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick, onLike, currentUserId, t, language = 'it' }) => {
  const liked = currentUserId ? article.likedBy?.includes(currentUserId) : false;

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLike) onLike();
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareData = {
      title: article.title,
      text: article.summary,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        // We don't have access to showToast here easily without props, 
        // but we can use a basic fallback or just assume it worked if no error.
        // For maximum compatibility with the iframe, we avoid alert.
      } catch (err) {
        console.error('Clipboard failed:', err);
      }
    }
  };

  return (
    <article 
      className="bg-white border border-stone-200 rounded-xl overflow-hidden mb-8 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
      onClick={() => onClick(article)}
    >
      {/* Post Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-200 overflow-hidden">
            <img 
              src={`https://api.dicebear.com/7.x/miniavs/svg?seed=${article.authorName}`} 
              alt={article.authorName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 leading-tight">
              {article.authorName}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-stone-500 uppercase font-bold tracking-tight">
              <span className="text-red-600">{t.categories[article.category] || article.category}</span>
              <span>•</span>
              <span>{new Date(article.timestamp).toLocaleDateString(language === 'it' ? 'it-IT' : language === 'en' ? 'en-GB' : language === 'fr' ? 'fr-FR' : 'es-ES')}</span>
            </div>
          </div>
        </div>
        <button className="text-stone-400 hover:text-stone-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
        </button>
      </div>

      {/* Post Content */}
      <div className="px-4 pb-3">
        <h2 className="text-xl font-bold mb-2 leading-tight newspaper-font">
          {article.title}
        </h2>
        <p className="text-stone-600 text-sm leading-relaxed line-clamp-2">
          {article.summary}
        </p>
      </div>

      {/* Media Container */}
      <div className="relative bg-stone-100 overflow-hidden">
        {(() => {
          const embedUrl = getEmbedUrl(article.imageUrl);
          if (embedUrl) {
            const isTikTok = article.imageUrl.includes('tiktok.com');
            const isInstagram = article.imageUrl.includes('instagram.com');
            const isFacebook = article.imageUrl.includes('facebook.com');
            
            let containerClass = "aspect-video";
            if (isTikTok) containerClass = "aspect-[9/16] max-h-[600px] mx-auto";
            else if (isInstagram) containerClass = "aspect-square max-h-[600px] mx-auto";
            else if (isFacebook) containerClass = "aspect-[4/3] max-h-[500px] mx-auto";

            return (
              <div className={containerClass}>
                <iframe 
                  src={embedUrl} 
                  className="w-full h-full border-0" 
                  allowFullScreen 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  onClick={(e) => e.stopPropagation()}
                  loading="lazy"
                />
              </div>
            );
          }
          if (article.imageUrl.match(/\.(mp4|webm|ogg|mov|avi|mkv)(?:\?.*)?$/i)) {
            return (
              <video 
                src={article.imageUrl} 
                className="w-full h-auto max-h-[70vh] block mx-auto"
                controls
                onClick={(e) => e.stopPropagation()}
              />
            );
          }
          return (
            <img 
              src={article.imageUrl} 
              alt={article.title} 
              className="w-full h-auto block transition-transform duration-500 hover:scale-[1.02]"
              referrerPolicy="no-referrer"
              loading="lazy"
            />
          );
        })()}
      </div>

      {/* Social Actions */}
      <div className="p-2 border-t border-stone-50">
        <div className="flex items-center justify-between px-2 mb-1">
          <div className="flex items-center gap-1 text-[11px] text-stone-500">
            <div className="flex -space-x-1">
               <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center border border-white">
                 <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="white" stroke="white"><circle cx="12" cy="12" r="10"/></svg>
               </div>
            </div>
            <span className="ml-1">{article.likes || 0} {t.article.peopleAppreciated}</span>
          </div>
          <span className="text-[11px] text-stone-500">{article.comments.length} {t.article.commentCount}</span>
        </div>
        
        <div className="flex items-center border-t border-stone-50 pt-2">
          <button 
            onClick={handleLike}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${liked ? 'text-green-600 bg-green-50' : 'text-stone-600 hover:bg-stone-50'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
            </svg>
            <span className="text-xs font-bold uppercase tracking-tight">{t.article.like}</span>
          </button>
          <button 
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span className="text-xs font-bold uppercase tracking-tight">{t.article.comment}</span>
          </button>
          <button 
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            <span className="text-xs font-bold uppercase tracking-tight">{t.article.share}</span>
          </button>
        </div>
      </div>
    </article>
  );
};
