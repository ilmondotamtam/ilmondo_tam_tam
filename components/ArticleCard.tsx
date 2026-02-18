
import React, { useState } from 'react';
import { Opinione } from '../types';

interface ArticleCardProps {
  article: Opinione;
  onClick: (article: Opinione) => void;
  onLike?: (newLikes: number) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick, onLike }) => {
  const [liked, setLiked] = useState(false);

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isNewLike = !liked;
    setLiked(isNewLike);
    const currentLikes = article.likes || 0;
    const newLikes = isNewLike ? currentLikes + 1 : Math.max(0, currentLikes - 1);
    if (onLike) onLike(newLikes);
  };

  return (
    <article 
      className="bg-white border border-stone-200 rounded-xl overflow-hidden mb-8 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
      onClick={() => onClick(article)}
    >
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-200 overflow-hidden">
            <img 
              src={`https://api.dicebear.com/7.x/miniavs/svg?seed=${article.authorName}`} 
              alt={article.authorName}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-stone-900 leading-tight">
              {article.authorName}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-stone-500 uppercase font-bold tracking-tight">
              <span className="text-red-600">{article.category}</span>
              <span>•</span>
              <span>{new Date(article.timestamp).toLocaleDateString('it-IT')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-3">
        <h2 className="text-xl font-bold mb-2 leading-tight newspaper-font">
          {article.title}
        </h2>
        {article.summary && (
          <p className="text-stone-600 text-sm leading-relaxed line-clamp-2 italic font-serif">
            {article.summary}
          </p>
        )}
      </div>

      <div className="relative aspect-video bg-stone-100 overflow-hidden">
        <img 
          src={article.imageUrl} 
          alt={article.title} 
          className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
        />
      </div>

      <div className="p-2 border-t border-stone-50">
        <div className="flex items-center justify-between px-2 mb-1">
          <span className="text-[11px] text-stone-500">{article.likes || 0} mi piace</span>
          <span className="text-[11px] text-stone-500">{article.comments.length} commenti</span>
        </div>
        
        <div className="flex items-center border-t border-stone-50 pt-2">
          <button 
            onClick={handleLike}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-colors ${liked ? 'text-green-600 bg-green-50' : 'text-stone-600 hover:bg-stone-50'}`}
          >
            <span className="text-xs font-bold uppercase tracking-tight">Mi piace</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-stone-600 hover:bg-stone-50 transition-colors">
            <span className="text-xs font-bold uppercase tracking-tight">Commenta</span>
          </button>
        </div>
      </div>
    </article>
  );
};
