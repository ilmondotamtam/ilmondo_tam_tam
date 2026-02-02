
import React, { useState, useEffect, useCallback } from 'react';
import { User, Article, UserRole, Category, Comment } from './types';
import { INITIAL_ARTICLES, CATEGORIES } from './constants';
import { ArticleCard } from './components/ArticleCard';
import { CommentSection } from './components/CommentSection';
import { summarizeArticle, suggestHeadline } from './services/geminiService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [articles, setArticles] = useState<Article[]>(INITIAL_ARTICLES);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNewArticleModalOpen, setIsNewArticleModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');

  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCat, setNewCat] = useState<Category>('Fatti');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  const handleLogin = (role: UserRole) => {
    const mockUser: User = {
      id: Math.random().toString(36).substr(2, 9),
      username: role === UserRole.READER ? 'LettoreCurioso' : 'RedattoreCapo',
      email: 'user@example.com',
      role,
      avatar: `https://picsum.photos/seed/${role}/40/40`
    };
    setUser(mockUser);
    setIsAuthModalOpen(false);
  };

  const handleAddComment = (content: string) => {
    if (!selectedArticle || !user) return;
    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      articleId: selectedArticle.id,
      userId: user.id,
      username: user.username,
      content,
      timestamp: Date.now(),
    };
    const updatedArticles = articles.map(a => 
      a.id === selectedArticle.id ? { ...a, comments: [newComment, ...a.comments] } : a
    );
    setArticles(updatedArticles);
    setSelectedArticle({ ...selectedArticle, comments: [newComment, ...selectedArticle.comments] });
  };

  const generateAIHelp = async () => {
    if (!newContent) return alert("Scrivi prima il contenuto dell'articolo");
    setIsGeneratingAI(true);
    try {
      const [title, summary] = await Promise.all([
        suggestHeadline(newContent),
        summarizeArticle(newContent)
      ]);
      setNewTitle(title);
      alert(`AI ha suggerito:\nTitolo: ${title}\nRiassunto: ${summary}`);
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handlePublish = async () => {
    if (!user || !newTitle || !newContent) return;
    const summary = await summarizeArticle(newContent);
    const newArticle: Article = {
      id: Math.random().toString(36).substr(2, 9),
      title: newTitle,
      summary,
      content: newContent,
      authorId: user.id,
      authorName: user.username,
      category: newCat,
      imageUrl: `https://picsum.photos/800/450?random=${Math.random()}`,
      timestamp: Date.now(),
      comments: []
    };
    setArticles([newArticle, ...articles]);
    setIsNewArticleModalOpen(false);
    setNewTitle('');
    setNewContent('');
  };

  const filteredArticles = selectedCategory === 'All' 
    ? articles 
    : articles.filter(a => a.category === selectedCategory);

  const showHeader = user && (user.role === UserRole.ADMIN || user.role === UserRole.AUTHOR);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b-4 border-stone-800 w-full py-8 md:py-12 relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 relative">
          {/* Testo di fallback visibile se l'immagine non carica o per dare profondità */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-10">
            <h1 className="text-5xl md:text-8xl font-bold newspaper-font tracking-tighter text-stone-900 uppercase text-center">
              Il Mondo Tam Tam
            </h1>
          </div>
          
          {/* Contenitore Testata aggiornato con il percorso richiesto */}
          <div 
            className="relative z-10 w-full aspect-[4/1] bg-contain bg-center bg-no-repeat mx-auto"
            style={{ 
              backgroundImage: "url('/immagini/testata.jpg')",
              minHeight: '140px'
            }}
            role="img"
            aria-label="Il Mondo Tam Tam - Logo"
          ></div>
          
          <div className="text-center mt-4">
             <p className="text-xs md:text-sm font-bold uppercase tracking-[0.5em] text-stone-600">
              Edizione Globale 2026
            </p>
          </div>
        </div>
      </header>

      <nav className="bg-white sticky top-0 z-30 border-b shadow-sm overflow-x-auto whitespace-nowrap">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex space-x-6 text-sm font-bold uppercase tracking-widest">
            <button 
              onClick={() => setSelectedCategory('All')}
              className={`hover:text-red-700 ${selectedCategory === 'All' ? 'text-red-700' : ''}`}
            >
              Home
            </button>
            {CATEGORIES.map(cat => (
              <button 
                key={cat} 
                onClick={() => setSelectedCategory(cat)}
                className={`hover:text-red-700 ${selectedCategory === cat ? 'text-red-700' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <span className="text-xs font-semibold">{user.username}</span>
                <img src={user.avatar} className="w-8 h-8 rounded-full border border-stone-200" alt="avatar" />
                <button onClick={() => setUser(null)} className="text-xs underline hover:text-red-700">Logout</button>
              </div>
            ) : (
              <button 
                onClick={() => setIsAuthModalOpen(true)}
                className="bg-stone-800 text-white px-4 py-1 text-xs font-bold uppercase hover:bg-stone-700"
              >
                Accedi
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 md:p-8">
        <aside className="lg:col-span-3 order-2 lg:order-1">
          <div className="sticky top-20 space-y-8">
            <section className="border-t-2 border-stone-800 pt-4">
              <h3 className="text-lg font-bold uppercase mb-4 newspaper-font">In Evidenza</h3>
              <ul className="space-y-4">
                {articles.slice(0, 3).map(a => (
                  <li key={a.id} className="group cursor-pointer" onClick={() => setSelectedArticle(a)}>
                    <span className="text-xs text-red-700 font-bold uppercase">{a.category}</span>
                    <h4 className="font-bold text-stone-800 group-hover:underline">{a.title}</h4>
                  </li>
                ))}
              </ul>
            </section>
            <section className="border-t-2 border-stone-800 pt-4">
              <h3 className="text-lg font-bold uppercase mb-4 newspaper-font">Meteo & Mercati</h3>
              <div className="bg-stone-100 p-4 text-sm text-stone-600 space-y-2">
                <p>Mondo: Variabile</p>
                <p>Economia: +0.42% Global Index</p>
              </div>
            </section>
          </div>
        </aside>

        <div className="lg:col-span-6 order-1 lg:order-2">
          {showHeader && (
            <div className="flex justify-end items-center mb-6 border-b pb-2">
              <button 
                onClick={() => setIsNewArticleModalOpen(true)}
                className="bg-red-700 text-white px-3 py-1 text-sm font-bold uppercase flex items-center gap-2 hover:bg-red-800"
              >
                + Scrivi Articolo
              </button>
            </div>
          )}
          <div className="space-y-8">
            {filteredArticles.length > 0 ? (
              filteredArticles.map(article => (
                <ArticleCard key={article.id} article={article} onClick={setSelectedArticle} />
              ))
            ) : (
              <p className="text-center text-stone-500 py-20 italic">Nessun articolo trovato in questa sezione.</p>
            )}
          </div>
        </div>

        <aside className="lg:col-span-3 order-3">
          <div className="sticky top-20 space-y-8">
            <section className="border-t-2 border-stone-800 pt-4">
              <h3 className="text-lg font-bold uppercase mb-4 newspaper-font">Commenti Recenti</h3>
              <div className="space-y-4">
                {articles.flatMap(a => a.comments).slice(0, 4).map(c => (
                  <div key={c.id} className="text-xs border-b border-stone-100 pb-2">
                    <p className="font-bold text-stone-800">{c.username}</p>
                    <p className="text-stone-500 italic">"{c.content.substring(0, 60)}..."</p>
                  </div>
                ))}
              </div>
            </section>
            <div className="bg-stone-800 text-stone-100 p-6 text-center">
              <h4 className="font-bold uppercase tracking-widest text-xs mb-2">Sostienici</h4>
              <p className="text-sm mb-4 font-serif">Fai risuonare la verità.</p>
              <button className="border border-stone-100 px-4 py-2 text-xs font-bold uppercase hover:bg-stone-100 hover:text-stone-800 transition-colors">Abbonati</button>
            </div>
          </div>
        </aside>
      </main>

      <footer className="bg-white border-t-2 border-stone-800 py-12 px-4 mt-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 text-center md:text-left">
          <div>
            <h4 className="text-xs font-bold uppercase mb-4 tracking-widest text-stone-400">Info</h4>
            <ul className="text-sm space-y-2">
              <li className="hover:underline cursor-pointer">Chi siamo</li>
              <li className="hover:underline cursor-pointer">Privacy Policy</li>
              <li className="hover:underline cursor-pointer">Contatti</li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase mb-4 tracking-widest text-stone-400">Social</h4>
            <div className="flex justify-center md:justify-start space-x-4 text-xs font-bold uppercase">
              <span className="cursor-pointer hover:text-blue-800">FB</span>
              <span className="cursor-pointer hover:text-blue-800">X</span>
              <span className="cursor-pointer hover:text-blue-800">IG</span>
            </div>
          </div>
        </div>
      </footer>

      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-75 flex justify-center items-start overflow-y-auto p-4 py-8">
          <div className="bg-white max-w-4xl w-full p-6 md:p-12 relative shadow-2xl animate-in fade-in zoom-in duration-300">
            <button onClick={() => setSelectedArticle(null)} className="absolute top-4 right-4 text-2xl hover:text-red-700">✕</button>
            <div className="border-b-2 border-stone-800 mb-8 pb-4">
              <span className="text-sm font-bold uppercase text-red-700">{selectedArticle.category}</span>
              <h2 className="text-4xl md:text-5xl font-bold newspaper-font my-4 leading-tight">{selectedArticle.title}</h2>
              <div className="flex justify-between items-center text-stone-500 text-sm italic font-serif">
                <span>Di {selectedArticle.authorName}</span>
                <span>Pubblicato il {new Date(selectedArticle.timestamp).toLocaleDateString('it-IT')}</span>
              </div>
            </div>
            <img src={selectedArticle.imageUrl} className="w-full h-auto max-h-[500px] object-cover mb-8 grayscale hover:grayscale-0 transition-all duration-700" alt="Cover" />
            <div className="prose prose-stone max-w-none text-stone-800 leading-relaxed mb-12">
              {selectedArticle.content.split('\n').map((para, i) => (
                <p key={i} className="mb-6 first-letter:text-5xl first-letter:font-bold first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:newspaper-font">{para}</p>
              ))}
            </div>
            <CommentSection comments={selectedArticle.comments} currentUser={user} onAddComment={handleAddComment} />
          </div>
        </div>
      )}

      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-60 flex justify-center items-center p-4">
          <div className="bg-white p-8 max-w-sm w-full border-t-8 border-blue-800 shadow-2xl">
            <h2 className="text-2xl font-bold newspaper-font mb-6 text-center">Entra nella Community</h2>
            <div className="space-y-4">
              <button onClick={() => handleLogin(UserRole.READER)} className="w-full border-2 border-stone-800 py-3 text-sm font-bold uppercase hover:bg-stone-50">Accedi come Lettore</button>
              <button onClick={() => handleLogin(UserRole.AUTHOR)} className="w-full bg-stone-800 text-white py-3 text-sm font-bold uppercase hover:bg-stone-700">Accedi come Autore</button>
              <button onClick={() => handleLogin(UserRole.ADMIN)} className="w-full bg-blue-800 text-white py-3 text-sm font-bold uppercase hover:bg-blue-900">Accedi come Admin</button>
              <button onClick={() => setIsAuthModalOpen(false)} className="w-full text-xs text-stone-400 mt-4 underline text-center block">Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {isNewArticleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-70 flex justify-center items-start overflow-y-auto p-4 py-8">
          <div className="bg-white max-w-3xl w-full p-8 relative shadow-2xl">
            <button onClick={() => setIsNewArticleModalOpen(false)} className="absolute top-4 right-4 text-2xl">✕</button>
            <h2 className="text-3xl font-bold newspaper-font mb-6 border-b pb-2 uppercase">Pubblica sul Tam Tam</h2>
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">Sezione</label>
                <select className="w-full p-2 border border-stone-300 text-sm focus:outline-none focus:ring-1 focus:ring-stone-800" value={newCat} onChange={(e) => setNewCat(e.target.value as Category)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold uppercase tracking-widest text-stone-500">Titolo</label>
                  <button onClick={generateAIHelp} disabled={isGeneratingAI} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 uppercase font-bold hover:bg-blue-200 disabled:opacity-50">
                    {isGeneratingAI ? 'Generazione...' : 'Aiuto AI (Gemini)'}
                  </button>
                </div>
                <input type="text" placeholder="Titolo dell'articolo..." className="w-full p-3 border border-stone-300 text-xl font-bold focus:outline-none focus:ring-1 focus:ring-blue-800" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">Testo Articolo</label>
                <textarea placeholder="Cosa sta succedendo nel mondo?" className="w-full p-3 border border-stone-300 h-64 text-sm focus:outline-none focus:ring-1 focus:ring-blue-800" value={newContent} onChange={(e) => setNewContent(e.target.value)} />
              </div>
              <div className="flex gap-4">
                <button onClick={handlePublish} className="flex-1 bg-blue-800 text-white py-3 font-bold uppercase text-sm hover:bg-blue-900">Pubblica Ora</button>
                <button onClick={() => setIsNewArticleModalOpen(false)} className="flex-1 border-2 border-stone-300 py-3 font-bold uppercase text-sm hover:bg-stone-50">Annulla</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
