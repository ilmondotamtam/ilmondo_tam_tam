
import React, { useState, useEffect, useRef } from 'react';
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

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 font-sans">
      {/* Header Newspaper Style */}
      <header className="bg-white border-b-8 border-double border-stone-800 py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col items-center">
          <div className="w-full flex justify-end items-end border-b border-stone-200 pb-2 mb-6 text-[10px] uppercase font-bold tracking-widest text-stone-500">
            <span>{new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          
          <div className="relative w-full">
            {headerImage && (
              <div 
                className="w-full aspect-[21/5] bg-cover bg-center border-y-2 border-stone-800 shadow-inner"
                style={{ backgroundImage: `url(${headerImage})` }}
              ></div>
            )}
            {!headerImage && (
               <div className="w-full h-32 flex items-center justify-center bg-stone-100 border-2 border-dashed border-stone-300">
                 <p className="text-stone-400 italic newspaper-font">Carica la testata dal menu Admin</p>
               </div>
            )}
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white sticky top-0 z-40 border-b-2 border-stone-800 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          <div 
            className="flex space-x-8 text-[17px] uppercase tracking-tighter" 
            style={{ fontFamily: '"Arial Black", Arial, sans-serif', fontWeight: 900 }}
          >
            <button onClick={() => setSelectedCategory('All')} className={`hover:text-red-600 ${selectedCategory === 'All' ? 'text-red-600 border-b-2 border-red-600' : ''}`}>Home</button>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)} className={`hover:text-red-600 ${selectedCategory === cat ? 'text-red-600 border-b-2 border-red-600' : ''}`}>{cat}</button>
            ))}
          </div>
          <div className="flex items-center gap-6">
            {user?.role === UserRole.ADMIN && (
              <button onClick={() => setIsHeaderModalOpen(true)} className="text-[10px] font-bold border border-stone-300 px-2 py-1 rounded hover:bg-stone-50 transition-colors">CAMBIA TESTATA</button>
            )}
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase text-stone-400">{user.role}</span>
                <img src={user.avatar} className="w-8 h-8 rounded-full border-2 border-stone-800" />
                <button onClick={() => setUser(null)} className="text-xs font-bold hover:underline">ESCI</button>
              </div>
            ) : (
              <button onClick={() => setIsAuthModalOpen(true)} className="bg-stone-900 text-white px-5 py-1 text-xs font-bold uppercase hover:bg-stone-700">ACCEDI</button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content - 3 COLUMNS */}
      <main className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 md:p-10">
        {isLoading ? (
          <div className="lg:col-span-12 py-32 text-center flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
            <p className="mt-6 text-stone-400 newspaper-font italic text-xl">Consultando gli archivi digitali...</p>
          </div>
        ) : (
          <>
            <aside className="lg:col-span-3 space-y-10 order-2 lg:order-1 border-r border-stone-200 pr-4">
              <section>
                <h3 className="text-xl font-bold uppercase border-b-2 border-stone-800 mb-6 newspaper-font">Flash News</h3>
                <div className="space-y-6">
                  {articles.slice(0, 4).map(a => (
                    <div key={a.id} className="group cursor-pointer" onClick={() => setSelectedArticle(a)}>
                      <p className="text-[10px] text-red-600 font-bold uppercase mb-1">{a.category}</p>
                      <h4 className="font-bold leading-tight group-hover:underline">{a.title}</h4>
                      <p className="text-xs text-stone-500 mt-1 italic">{new Date(a.timestamp).toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
              </section>
            </aside>

            <div className="lg:col-span-6 space-y-10 order-1 lg:order-2">
              {(user?.role === UserRole.ADMIN || user?.role === UserRole.AUTHOR) && (
                <button 
                  onClick={() => setIsNewArticleModalOpen(true)}
                  className="w-full border-4 border-double border-stone-300 py-4 text-xl font-bold newspaper-font hover:bg-stone-100 transition-colors uppercase tracking-widest"
                >
                  ✎ Scrivi una nuova cronaca
                </button>
              )}
              
              <div className="space-y-12">
                {filteredArticles.map(article => (
                  <ArticleCard key={article.id} article={article} onClick={setSelectedArticle} />
                ))}
              </div>
            </div>

            <aside className="lg:col-span-3 space-y-10 order-3 border-l border-stone-200 pl-4">
              <section>
                <h3 className="text-xl font-bold uppercase border-b-2 border-stone-800 mb-6 newspaper-font">Dal Mondo</h3>
                <div className="space-y-6">
                  {articles.flatMap(a => a.comments).slice(0, 5).map(c => (
                    <div key={c.id} className="text-xs bg-white p-3 border-l-4 border-stone-800 shadow-sm">
                      <p className="font-bold text-stone-900 mb-1">{c.username}</p>
                      <p className="italic text-stone-600">"{c.content}"</p>
                    </div>
                  ))}
                </div>
              </section>
              <div className="p-6 bg-stone-900 text-white text-center">
                <h4 className="text-lg newspaper-font mb-2">Database Sincronizzato</h4>
                <p className="text-[10px] uppercase tracking-widest text-stone-400">Tutti i dati sono al sicuro su Supabase Cloud</p>
              </div>
            </aside>
          </>
        )}
      </main>

      {/* MODAL ARTICOLO */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/90 flex justify-center items-start overflow-y-auto p-4 md:p-10 backdrop-blur-sm">
          <div className="bg-white max-w-4xl w-full p-8 md:p-16 relative shadow-2xl animate-in slide-in-from-bottom-10 duration-500 border-x-[12px] border-stone-800">
            <button onClick={() => setSelectedArticle(null)} className="absolute top-6 right-6 text-3xl font-light hover:text-red-600">✕</button>
            <div className="text-center mb-12">
              <span className="text-xs font-black text-red-600 uppercase tracking-[0.3em]">{selectedArticle.category}</span>
              <h2 className="text-4xl md:text-6xl font-bold newspaper-font my-6 leading-[1.1]">{selectedArticle.title}</h2>
              <div className="flex justify-center gap-8 text-stone-400 text-sm italic font-serif border-y border-stone-100 py-3">
                <span>Di {selectedArticle.authorName}</span>
                <span>{new Date(selectedArticle.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
            <img src={selectedArticle.imageUrl} className="w-full h-auto max-h-[600px] object-cover mb-12 grayscale shadow-xl" />
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
          <div className="bg-white p-10 max-w-xl w-full shadow-2xl border-4 border-stone-900">
            <h2 className="text-3xl font-bold newspaper-font mb-6 border-b-2 border-stone-800 pb-2 uppercase">GESTIONE IMMAGINE TESTATA</h2>
            <p className="text-sm text-stone-500 mb-8 italic">Carica una nuova immagine. Questa verrà salvata direttamente nel database Supabase nella tabella 'testata' e sarà visibile a tutti i visitatori.</p>
            <div className="space-y-6">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleHeaderUpload} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full bg-stone-900 text-white py-4 font-black uppercase tracking-widest text-xs hover:bg-stone-700">Seleziona e Salva nel DB</button>
              <button onClick={() => setIsHeaderModalOpen(false)} className="w-full border-2 border-stone-200 py-4 font-black uppercase tracking-widest text-xs hover:bg-stone-50">Chiudi</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL AUTH */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex justify-center items-center p-6">
          <div className="bg-white p-10 max-w-sm w-full border-t-[12px] border-stone-800 shadow-2xl">
            <h2 className="text-3xl font-bold newspaper-font mb-8 text-center uppercase">Ingresso Redazione</h2>
            <div className="space-y-4">
              <button onClick={() => handleLogin(UserRole.READER)} className="w-full border-2 border-stone-900 py-4 text-xs font-black uppercase hover:bg-stone-50">Lettore</button>
              <button onClick={() => handleLogin(UserRole.AUTHOR)} className="w-full bg-stone-900 text-white py-4 text-xs font-black uppercase hover:bg-stone-700">Autore</button>
              <button onClick={() => handleLogin(UserRole.ADMIN)} className="w-full bg-red-700 text-white py-4 text-xs font-black uppercase hover:bg-red-800">Amministratore</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUOVO ARTICOLO */}
      {isNewArticleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex justify-center items-start overflow-y-auto p-4 md:p-10">
          <div className="bg-white max-w-3xl w-full p-10 relative shadow-2xl border-x-8 border-stone-800">
            <button onClick={() => setIsNewArticleModalOpen(false)} className="absolute top-6 right-6 text-2xl">✕</button>
            <h2 className="text-4xl font-bold newspaper-font mb-8 border-b-4 border-stone-800 pb-2 uppercase tracking-tighter">Nuova Pubblicazione</h2>
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase text-stone-400 mb-2">Categoria</label>
                  <select className="w-full p-3 border-2 border-stone-100 bg-stone-50 text-xs font-bold" value={newCat} onChange={(e) => setNewCat(e.target.value as Category)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col justify-end">
                  <button onClick={async () => {
                    if(!newContent) return;
                    setIsGeneratingAI(true);
                    setNewTitle(await suggestHeadline(newContent));
                    setIsGeneratingAI(false);
                  }} className="text-[10px] bg-stone-100 p-3 font-bold uppercase hover:bg-stone-200">🤖 Suggerisci Titolo con Gemini</button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-stone-400 mb-2">Titolo della Notizia</label>
                <input type="text" className="w-full p-4 border-2 border-stone-100 text-2xl font-bold newspaper-font" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase text-stone-400 mb-2">Corpo dell'Articolo</label>
                <textarea className="w-full p-4 border-2 border-stone-100 h-80 text-lg font-serif" value={newContent} onChange={(e) => setNewContent(e.target.value)} />
              </div>
              <button 
                onClick={handlePublish}
                disabled={isGeneratingAI}
                className="w-full bg-stone-900 text-white py-5 font-black uppercase tracking-[0.2em] text-sm hover:bg-stone-700 disabled:opacity-50"
              >
                {isGeneratingAI ? 'ELABORAZIONE...' : 'SALVA NEL DATABASE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
