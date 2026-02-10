
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Article, UserRole, Category, Comment } from './types';
import { CATEGORIES } from './constants';
import { ArticleCard } from './components/ArticleCard';
import { CommentSection } from './components/CommentSection';
import { summarizeArticle, suggestHeadline } from './services/geminiService';
import { supabase } from './services/supabase';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNewArticleModalOpen, setIsNewArticleModalOpen] = useState(false);
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [isLoading, setIsLoading] = useState(true);

  const [headerImage, setHeaderImage] = useState<string>('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCat, setNewCat] = useState<Category>('Fatti');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Carica Articoli con commenti
      const { data: articlesData, error: articlesError } = await supabase
        .from('articles')
        .select('*, comments(*)')
        .order('created_at', { ascending: false });

      if (articlesError) throw articlesError;
      
      const formattedArticles: Article[] = (articlesData || []).map(a => ({
        id: a.id,
        title: a.title,
        summary: a.summary,
        content: a.content,
        authorId: a.author_id || 'guest',
        authorName: a.author_name,
        category: a.category as Category,
        imageUrl: a.image_url,
        likes: a.likes || 0,
        timestamp: new Date(a.created_at).getTime(),
        comments: (a.comments || []).map((c: any) => ({
          id: c.id,
          articleId: c.article_id,
          userId: c.user_id || 'anonymous',
          username: c.username,
          content: c.content,
          timestamp: new Date(c.created_at).getTime()
        })).sort((a: any, b: any) => b.timestamp - a.timestamp)
      }));
      setArticles(formattedArticles);

      // 2. Carica Immagine Testata dalla tabella 'testata'
      const { data: testataData } = await supabase
        .from('testata')
        .select('imma_testata')
        .eq('id', 'header_image')
        .single();

      if (testataData) {
        setHeaderImage(testataData.imma_testata);
      }
    } catch (error) {
      console.error("Database Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (role: UserRole) => {
    const mockId = `user_${role.toLowerCase()}_${Math.random().toString(36).substr(2, 5)}`;
    const mockUser: User = {
      id: mockId,
      username: role === UserRole.READER ? 'Lettore_Eco' : role === UserRole.AUTHOR ? 'Redattore_Capo' : 'Admin_TamTam',
      email: `${role.toLowerCase()}@tamtam.it`,
      role,
      avatar: `https://api.dicebear.com/7.x/miniavs/svg?seed=${role}`
    };

    try {
      await supabase.from('users').upsert({
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        role: mockUser.role,
        avatar: mockUser.avatar,
        last_login: new Date().toISOString()
      });
      setUser(mockUser);
      setIsAuthModalOpen(false);
    } catch (e) {
      console.error("Errore salvataggio utente:", e);
    }
  };

  const handleAddComment = async (content: string) => {
    if (!selectedArticle || !user) return;
    
    try {
      const { data, error } = await supabase
        .from('comments')
        .insert([{
          article_id: selectedArticle.id,
          username: user.username,
          user_id: user.id,
          content: content
        }])
        .select()
        .single();

      if (error) throw error;

      const newComment: Comment = {
        id: data.id,
        articleId: data.article_id,
        userId: user.id,
        username: data.username,
        content: data.content,
        timestamp: new Date(data.created_at).getTime()
      };

      setArticles(articles.map(a => a.id === selectedArticle.id ? { ...a, comments: [newComment, ...a.comments] } : a));
      setSelectedArticle({ ...selectedArticle, comments: [newComment, ...selectedArticle.comments] });
    } catch (error) {
      alert("Errore salvataggio commento");
    }
  };

  const handleUpdateLike = async (articleId: string, newLikes: number) => {
    try {
      const { error } = await supabase
        .from('articles')
        .update({ likes: newLikes })
        .eq('id', articleId);
      
      if (error) throw error;
      
      setArticles(prev => prev.map(a => a.id === articleId ? { ...a, likes: newLikes } : a));
    } catch (error) {
      console.error("Errore aggiornamento like:", error);
    }
  };

  const handlePublish = async () => {
    if (!user || !newTitle || !newContent) return;
    setIsGeneratingAI(true);
    try {
      const summary = await summarizeArticle(newContent);
      const { error } = await supabase
        .from('articles')
        .insert([{
          title: newTitle,
          summary,
          content: newContent,
          author_name: user.username,
          author_id: user.id,
          category: newCat,
          likes: 0,
          image_url: `https://picsum.photos/seed/${Math.random()}/800/450`
        }]);

      if (error) throw error;
      await fetchData();
      setIsNewArticleModalOpen(false);
      setNewTitle('');
      setNewContent('');
    } catch (error) {
      alert("Errore pubblicazione");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleHeaderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        try {
          const { error } = await supabase
            .from('testata')
            .upsert({ id: 'header_image', imma_testata: base64String });

          if (error) throw error;
          setHeaderImage(base64String);
        } catch (error) {
          alert("Errore salvataggio testata");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredArticles = selectedCategory === 'All' 
    ? articles 
    : articles.filter(a => a.category === selectedCategory);

  const topOpinions = useMemo(() => {
    return articles
      .filter(a => a.category === 'Opinioni')
      .sort((a, b) => (b.likes || 0) - (a.likes || 0))
      .slice(0, 5);
  }, [articles]);

  const navStyles = { fontFamily: '"Arial Black", Arial, sans-serif', fontWeight: 900 };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 font-sans">
      {/* Header Newspaper Style - Rimosso bordo doppio */}
      <header className="bg-white py-2 px-4">
        <div className="max-w-7xl mx-auto flex flex-col items-center">
          {/* Spazio vuoto sopra per estetica minimal o eventuale brand secondario */}
        </div>
      </header>

      {/* Main Content - 3 COLUMNS */}
      <main className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 md:p-10">
        {isLoading ? (
          <div className="lg:col-span-12 py-32 text-center flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
            <p className="mt-6 text-stone-400 newspaper-font italic text-xl">Consultando gli archivi digitali...</p>
          </div>
        ) : (
          <>
            {/* COLUMN 1: Testata & Vertical Nav */}
            <aside className="lg:col-span-3 space-y-6 order-2 lg:order-1 border-r border-stone-200 pr-6">
              
              {/* Testata Image - Ingrandita del 10% */}
              <div className="w-full">
                {headerImage ? (
                  <div className="group relative">
                    <img 
                      src={headerImage} 
                      alt="Testata" 
                      className="w-full h-auto border-b-4 border-double border-stone-800 pb-4 shadow-sm transform scale-110 origin-top transition-transform duration-300" 
                    />
                    {user?.role === UserRole.ADMIN && (
                      <button 
                        onClick={() => setIsHeaderModalOpen(true)} 
                        className="absolute bottom-6 right-0 bg-white/90 text-[8px] font-black border border-stone-800 px-2 py-1 rounded hover:bg-stone-900 hover:text-white transition-all shadow-sm z-10"
                      >
                        MODIFICA
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-32 flex flex-col items-center justify-center bg-stone-100 border-2 border-dashed border-stone-300 rounded-lg">
                    <p className="text-stone-400 text-[10px] italic text-center px-4 mb-2">Immagine Testata Assente</p>
                    {user?.role === UserRole.ADMIN && (
                      <button onClick={() => setIsHeaderModalOpen(true)} className="text-[9px] font-bold bg-stone-800 text-white px-2 py-1 rounded">CARICA</button>
                    )}
                  </div>
                )}
              </div>

              {/* Nuova Posizione Data */}
              <div className="text-[11px] uppercase font-bold tracking-widest text-stone-500 border-y border-stone-200 py-3 text-center mb-8">
                {new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>

              {/* VERTICAL MENU */}
              <nav className="flex flex-col space-y-1">
                <h3 className="text-[10px] font-black uppercase text-stone-400 mb-4 tracking-widest border-b border-stone-200 pb-1">Sezioni Navigazione</h3>
                
                <button 
                  onClick={() => setSelectedCategory('All')} 
                  style={navStyles}
                  className={`text-left py-3 px-2 text-sm uppercase tracking-tighter border-b border-stone-100 transition-all hover:bg-stone-100 hover:pl-4 ${selectedCategory === 'All' ? 'text-red-600 border-l-4 border-l-red-600 pl-4 bg-white shadow-sm' : 'text-stone-800'}`}
                >
                  Home Page
                </button>
                
                {CATEGORIES.map(cat => (
                  <button 
                    key={cat} 
                    onClick={() => setSelectedCategory(cat)}
                    style={navStyles}
                    className={`text-left py-3 px-2 text-sm uppercase tracking-tighter border-b border-stone-100 transition-all hover:bg-stone-100 hover:pl-4 ${selectedCategory === cat ? 'text-red-600 border-l-4 border-l-red-600 pl-4 bg-white shadow-sm' : 'text-stone-800'}`}
                  >
                    {cat}
                  </button>
                ))}
              </nav>

            </aside>

            {/* COLUMN 2: Social Feed */}
            <div className="lg:col-span-6 space-y-6 order-1 lg:order-2">
              {/* Social Posting Box */}
              {(user?.role === UserRole.ADMIN || user?.role === UserRole.AUTHOR) && (
                <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm mb-8">
                  <div className="flex gap-4 items-center">
                    <img src={user?.avatar} className="w-10 h-10 rounded-full grayscale border border-stone-100" alt="me" />
                    <button 
                      onClick={() => setIsNewArticleModalOpen(true)}
                      className="flex-1 text-left bg-stone-50 hover:bg-stone-100 text-stone-400 p-3 rounded-full text-sm transition-colors border border-stone-100"
                    >
                      Cosa bolle in pentola, {user?.username.split('_')[0]}?
                    </button>
                  </div>
                  <div className="flex items-center justify-around mt-4 pt-3 border-t border-stone-50">
                    <button onClick={() => setIsNewArticleModalOpen(true)} className="flex items-center gap-2 text-stone-600 hover:bg-stone-50 p-2 rounded-lg transition-colors text-xs font-bold uppercase tracking-tighter">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                      Foto
                    </button>
                    <button onClick={() => setIsNewArticleModalOpen(true)} className="flex items-center gap-2 text-stone-600 hover:bg-stone-50 p-2 rounded-lg transition-colors text-xs font-bold uppercase tracking-tighter">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 4.5z"/></svg>
                      Opinione
                    </button>
                    <button onClick={() => setIsNewArticleModalOpen(true)} className="flex items-center gap-2 text-stone-600 hover:bg-stone-50 p-2 rounded-lg transition-colors text-xs font-bold uppercase tracking-tighter">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                      Cronaca
                    </button>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                {filteredArticles.length > 0 ? (
                  filteredArticles.map(article => (
                    <ArticleCard 
                      key={article.id} 
                      article={article} 
                      onClick={setSelectedArticle}
                      onLike={(newLikes) => handleUpdateLike(article.id, newLikes)}
                    />
                  ))
                ) : (
                  <div className="text-center py-20 bg-white rounded-xl border-2 border-dashed border-stone-200">
                    <p className="text-stone-400 italic">Ancora nessuna cronaca in questa sezione.</p>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 3: Top Opinioni & Profile */}
            <aside className="lg:col-span-3 space-y-8 order-3 border-l border-stone-200 pl-6">
              {/* TOP OPINIONI SECTION */}
              <section className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
                <h3 className="text-lg font-bold uppercase border-b border-stone-800 mb-6 newspaper-font">Top Opinioni</h3>
                <div className="space-y-4">
                  {topOpinions.map((op, idx) => (
                    <div 
                      key={op.id} 
                      className="group cursor-pointer border-b border-stone-50 pb-3 last:border-0"
                      onClick={() => setSelectedArticle(op)}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl font-black text-stone-200 group-hover:text-stone-800 transition-colors">0{idx + 1}</span>
                        <div className="flex-1">
                          <h4 className="text-sm font-bold leading-tight group-hover:text-red-600 transition-colors line-clamp-2">{op.title}</h4>
                          <div className="flex items-center justify-between mt-2">
                             <span className="text-[10px] text-stone-400 font-bold uppercase">Di {op.authorName}</span>
                             <div className="flex items-center gap-1">
                               <div className="w-3 h-3 rounded-full bg-green-500"></div>
                               <span className="text-[10px] font-bold text-stone-600">{op.likes}</span>
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {topOpinions.length === 0 && (
                    <p className="text-[10px] text-stone-400 text-center italic">Nessuna opinione pubblicata.</p>
                  )}
                </div>
              </section>

              {/* Profile Section */}
              <section className="bg-white border-4 border-stone-800 p-6 shadow-sm rounded-lg">
                <h3 className="text-xl font-bold uppercase border-b-2 border-stone-800 mb-6 newspaper-font text-center">Profilo</h3>
                
                {user ? (
                  <div className="flex flex-col items-center text-center">
                    <div className="relative mb-4">
                      <img 
                        src={user.avatar} 
                        className="w-24 h-24 rounded-full border-4 border-stone-800 shadow-md grayscale" 
                        alt="Avatar"
                      />
                      <span className="absolute -bottom-1 -right-1 bg-stone-900 text-white text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-tighter">
                        {user.role}
                      </span>
                    </div>
                    <h4 className="text-lg font-bold newspaper-font mb-1">{user.username}</h4>
                    <p className="text-[10px] uppercase font-black text-stone-400 mb-6 tracking-widest">{user.email}</p>
                    
                    <div className="w-full space-y-2 border-t border-stone-100 pt-6">
                      <button 
                        onClick={() => setUser(null)}
                        className="w-full bg-stone-100 hover:bg-stone-200 text-stone-900 text-[10px] font-black py-2 uppercase tracking-widest transition-colors rounded"
                      >
                        Disconnetti
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs italic font-serif text-stone-500 mb-6 text-center">
                      Accedi per partecipare alla vita della redazione e lasciare i tuoi commenti.
                    </p>
                    <button 
                      onClick={() => setIsAuthModalOpen(true)}
                      className="w-full bg-stone-900 text-white py-4 text-xs font-black uppercase hover:bg-stone-700 shadow-md tracking-widest transition-all rounded"
                    >
                      Accedi
                    </button>
                  </div>
                )}
              </section>

              <div className="p-6 bg-stone-900 text-white text-center rounded-xl shadow-inner">
                <div className="mb-4 flex justify-center">
                   <div className="w-10 h-10 rounded-full bg-stone-800 flex items-center justify-center">
                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                   </div>
                </div>
                <h4 className="text-lg newspaper-font mb-2">Cloud Seguro</h4>
                <p className="text-[10px] uppercase tracking-widest text-stone-400">Dati protetti da Supabase Enterprise</p>
              </div>
            </aside>
          </>
        )}
      </main>

      {/* MODAL ARTICOLO */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/90 flex justify-center items-start overflow-y-auto p-4 md:p-10 backdrop-blur-sm">
          <div className="bg-white max-w-4xl w-full p-8 md:p-16 relative shadow-2xl animate-in slide-in-from-bottom-10 duration-500 border-x-[12px] border-stone-800">
            <button onClick={() => setSelectedArticle(null)} className="absolute top-6 right-6 text-3xl font-light hover:text-red-600 transition-colors">✕</button>
            <div className="text-center mb-12">
              <span className="text-xs font-black text-red-600 uppercase tracking-[0.3em]">{selectedArticle.category}</span>
              <h2 className="text-4xl md:text-6xl font-bold newspaper-font my-6 leading-[1.1]">{selectedArticle.title}</h2>
              <div className="flex justify-center gap-8 text-stone-400 text-sm italic font-serif border-y border-stone-100 py-3">
                <span className="flex items-center gap-2">
                  <img src={`https://api.dicebear.com/7.x/miniavs/svg?seed=${selectedArticle.authorName}`} className="w-6 h-6 rounded-full border border-stone-200" alt="auth" />
                  Di {selectedArticle.authorName}
                </span>
                <span className="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {new Date(selectedArticle.timestamp).toLocaleDateString()}
                </span>
              </div>
            </div>
            <img src={selectedArticle.imageUrl} className="w-full h-auto max-h-[600px] object-cover mb-12 grayscale shadow-xl rounded-lg" />
            <div className="prose prose-stone max-w-none text-stone-800 leading-[1.8] text-lg font-serif">
              {selectedArticle.content.split('\n').map((p, i) => (
                <p key={i} className="mb-8 first-letter:text-6xl first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:mt-2 first-letter:newspaper-font">{p}</p>
              ))}
            </div>
            <CommentSection comments={selectedArticle.comments} currentUser={user} onAddComment={handleAddComment} />
          </div>
        </div>
      )}

      {/* MODAL CAMBIO TESTATA */}
      {isHeaderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex justify-center items-center p-6 backdrop-blur-md">
          <div className="bg-white p-10 max-w-xl w-full shadow-2xl border-4 border-stone-900 rounded-xl">
            <h2 className="text-3xl font-bold newspaper-font mb-6 border-b-2 border-stone-800 pb-2 uppercase text-center">Gestione Testata</h2>
            <p className="text-sm text-stone-500 mb-8 italic text-center">Carica una nuova immagine. Questa verrà salvata nel database Supabase e sarà visibile a tutti.</p>
            <div className="space-y-6">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleHeaderUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-stone-900 text-white py-4 font-black uppercase tracking-widest text-xs hover:bg-stone-700 transition-colors rounded-lg">Carica Immagine</button>
              <button onClick={() => setIsHeaderModalOpen(false)} className="w-full border-2 border-stone-200 py-4 font-black uppercase tracking-widest text-xs hover:bg-stone-50 transition-colors rounded-lg">Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUTH */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex justify-center items-center p-6 backdrop-blur-sm">
          <div className="bg-white p-10 max-sm w-full border-t-[12px] border-stone-800 shadow-2xl rounded-xl">
            <h2 className="text-3xl font-bold newspaper-font mb-8 text-center uppercase">Login Redazione</h2>
            <div className="space-y-4">
              <button onClick={() => handleLogin(UserRole.READER)} className="w-full border-2 border-stone-900 py-4 text-xs font-black uppercase hover:bg-stone-50 transition-colors rounded-lg">Entra come Lettore</button>
              <button onClick={() => handleLogin(UserRole.AUTHOR)} className="w-full bg-stone-900 text-white py-4 text-xs font-black uppercase hover:bg-stone-700 transition-colors rounded-lg">Entra come Autore</button>
              <button onClick={() => handleLogin(UserRole.ADMIN)} className="w-full bg-red-700 text-white py-4 text-xs font-black uppercase hover:bg-red-800 transition-colors rounded-lg">Entra come Admin</button>
            </div>
            <button onClick={() => setIsAuthModalOpen(false)} className="mt-8 w-full text-stone-400 text-[10px] font-bold uppercase hover:text-stone-900 tracking-widest">Annulla</button>
          </div>
        </div>
      )}

      {/* MODAL NUOVO ARTICOLO / POST */}
      {isNewArticleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex justify-center items-start overflow-y-auto p-4 md:p-10 backdrop-blur-sm">
          <div className="bg-white max-w-3xl w-full p-10 relative shadow-2xl border-x-8 border-stone-800 rounded-xl">
            <button onClick={() => setIsNewArticleModalOpen(false)} className="absolute top-6 right-6 text-2xl hover:text-red-600 transition-colors">✕</button>
            <h2 className="text-4xl font-bold newspaper-font mb-8 border-b-4 border-stone-800 pb-2 uppercase tracking-tighter">Crea un Post</h2>
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-stone-400 mb-2">Sezione</label>
                  <select className="w-full p-3 border-2 border-stone-100 bg-stone-50 text-xs font-bold rounded-lg outline-none focus:border-stone-300" value={newCat} onChange={(e) => setNewCat(e.target.value as Category)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <button onClick={async () => {
                    if(!newContent) return;
                    setIsGeneratingAI(true);
                    setNewTitle(await suggestHeadline(newContent));
                    setIsGeneratingAI(false);
                  }} className="text-[10px] bg-stone-100 p-3 font-bold uppercase hover:bg-stone-200 rounded-lg flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    Suggerisci Titolo AI
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-stone-400 mb-2">Titolo Post</label>
                <input type="text" placeholder="Scrivi un titolo accattivante..." className="w-full p-4 border-2 border-stone-100 text-2xl font-bold newspaper-font rounded-lg outline-none focus:border-stone-300" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-stone-400 mb-2">Cosa vuoi raccontare?</label>
                <textarea placeholder="Inserisci il contenuto qui..." className="w-full p-4 border-2 border-stone-100 h-80 text-lg font-serif rounded-lg outline-none focus:border-stone-300" value={newContent} onChange={(e) => setNewContent(e.target.value)} />
              </div>
              <button 
                onClick={handlePublish}
                disabled={isGeneratingAI || !newTitle || !newContent}
                className="w-full bg-stone-900 text-white py-5 font-black uppercase tracking-[0.2em] text-sm hover:bg-stone-700 disabled:opacity-50 transition-all rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-1"
              >
                {isGeneratingAI ? 'PUBBLICAZIONE IN CORSO...' : 'PUBBLICA ORA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
