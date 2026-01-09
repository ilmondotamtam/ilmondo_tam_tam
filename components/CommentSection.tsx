
import React, { useState } from 'react';
import { Comment, User } from '../types';

interface CommentSectionProps {
  comments: Comment[];
  currentUser: User | null;
  onAddComment: (content: string) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({ comments, currentUser, onAddComment }) => {
  const [newComment, setNewComment] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      onAddComment(newComment);
      setNewComment('');
    }
  };

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-xl font-bold mb-4 newspaper-font">Commenti ({comments.length})</h3>
      
      {currentUser ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <textarea
            className="w-full p-3 border border-stone-300 focus:ring-1 focus:ring-stone-800 outline-none resize-none h-24 text-sm"
            placeholder="Lascia un commento..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <button 
            type="submit"
            className="mt-2 bg-stone-800 text-white px-4 py-2 text-sm font-semibold hover:bg-stone-700 transition-colors"
          >
            Pubblica Commento
          </button>
        </form>
      ) : (
        <p className="text-sm text-stone-500 italic mb-8">Accedi per poter commentare questo articolo.</p>
      )}

      <div className="space-y-6">
        {comments.map((comment) => (
          <div key={comment.id} className="border-b border-stone-100 pb-4">
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-sm text-stone-800">{comment.username}</span>
              <span className="text-xs text-stone-400">
                {new Date(comment.timestamp).toLocaleString('it-IT')}
              </span>
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">
              {comment.content}
            </p>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-stone-400 text-sm text-center">Nessun commento ancora. Sii il primo!</p>
        )}
      </div>
    </div>
  );
};
