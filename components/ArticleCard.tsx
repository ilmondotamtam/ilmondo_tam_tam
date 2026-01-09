
import React from 'react';
import { Article } from '../types';

interface ArticleCardProps {
  article: Article;
  onClick: (article: Article) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onClick }) => {
  return (
    <article 
      className="bg-white border border-stone-200 p-4 mb-6 cursor-pointer hover:shadow-lg transition-shadow duration-300"
      onClick={() => onClick(article)}
    >
      <span className="text-xs font-bold uppercase tracking-widest text-red-700 mb-2 block">
        {article.category}
      </span>
      <h2 className="text-2xl font-bold mb-3 leading-tight newspaper-font group-hover:underline">
        {article.title}
      </h2>
      <img 
        src={article.imageUrl} 
        alt={article.title} 
        className="w-full h-48 object-cover mb-4 grayscale hover:grayscale-0 transition-all duration-500"
      />
      <p className="text-gray-600 text-sm mb-4 line-clamp-3">
        {article.summary}
      </p>
      <div className="flex justify-between items-center text-xs text-stone-500 border-t pt-3">
        <span>Di <span className="font-semibold text-stone-800">{article.authorName}</span></span>
        <span>{new Date(article.timestamp).toLocaleDateString('it-IT')}</span>
      </div>
    </article>
  );
};
