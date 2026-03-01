
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Article, UserRole, Category, Comment } from './types';
import { CATEGORIES } from './constants';
import { ArticleCard } from './components/ArticleCard';
import { CommentSection } from './components/CommentSection';
import { supabase } from './services/supabase';
import { upload } from '@vercel/blob/client';
import { getEmbedUrl } from './services/mediaUtils';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'VERIFY'>('LOGIN');
  const [isNewArticleModalOpen, setIsNewArticleModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [isLoading, setIsLoading] = useState(true);

  // Form State Auth
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [authError, setAuthError] = useState('');

  // Form State New Article
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newArticleCategory, setNewArticleCategory] = useState<Category>('Fatti');
  const [articleError, setArticleError] = useState('');

  const [headerImage, setHeaderImage] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingHeader, setIsUploadingHeader] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const init = async () => {
      // Timeout di sicurezza: se dopo 10 secondi non ha finito, forziamo l'avvio
      const timeout = setTimeout(() => {
        setIsLoading(false);
      }, 10000);

      try {
        // Eseguiamo checkSession e fetchData in parallelo per velocizzare l'avvio
        await Promise.all([
          checkSession(),
          fetchData()
        ]);
      } catch (err) {
        console.error("Initialization Error:", err);
      } finally {
        clearTimeout(timeout);
        setIsLoading(false);
      }
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) {
        // Sincronizziamo il profilo in background senza bloccare la UI
        syncUserProfile(session.user);
        setIsAuthModalOpen(false);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session?.user) {
        await syncUserProfile(session.user);
      }
    } catch (err) {
      console.error("Session Check Error:", err);
    }
  };

  const syncUserProfile = async (authUser: any) => {
    if (!authUser) return;
    try {
      const { data: profile, error } = await supabase
        .from('utenti')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) throw error;

      if (profile) {
        setUser({
          id: profile.id,
          username: profile.username,
          email: profile.email,
          role: profile.role as UserRole,
          avatar: profile.avatar,
          firstName: profile.first_name,
          lastName: profile.last_name,
          birthDate: profile.birth_date
        });
      } else {
        // Se il profilo non esiste ancora (es. trigger in ritardo), impostiamo un profilo temporaneo
        setUser({
          id: authUser.id,
          username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || 'utente',
          email: authUser.email || '',
          role: UserRole.READER,
          avatar: `https://api.dicebear.com/7.x/miniavs/svg?seed=${authUser.id}`,
          firstName: authUser.user_metadata?.first_name || '',
          lastName: authUser.user_metadata?.last_name || '',
          birthDate: authUser.user_metadata?.birth_date || ''
        });
      }
    } catch (err) {
      console.error("Profile Sync Error:", err);
    }
  };

  const fetchData = async () => {
    try {
      // Carichiamo articoli e immagine di testata in parallelo
      const [articlesRes, testataRes] = await Promise.all([
        supabase
          .from('articles')
          .select('*, comments(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('testata')
          .select('imma_testata')
          .eq('id', 'header_image')
          .maybeSingle() // Usiamo maybeSingle per evitare errori se la riga non esiste
      ]);

      if (articlesRes.error) throw articlesRes.error;

      const formattedArticles: Article[] = (articlesRes.data || []).map((a: any) => ({
        id: a.id,
        title: a.title,
        summary: a.summary,
        content: a.content,
        authorId: a.author_id,
        authorName: a.author_name,
        category: a.category as Category,
        imageUrl: a.image_url,
        likes: a.likes || 0,
        timestamp: new Date(a.created_at).getTime(),
        comments: (a.comments || []).map((c: any) => ({
          id: c.id,
          articleId: c.article_id,
          userId: c.user_id,
          username: c.username,
          content: c.content,
          timestamp: new Date(c.created_at).getTime()
        })).sort((a: any, b: any) => b.timestamp - a.timestamp)
      }));
      setArticles(formattedArticles);

      if (testataRes.data) {
        setHeaderImage(testataRes.data.imma_testata);
      }
    } catch (error: any) {
      console.error("Fetch Error:", error);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    
    if (authMode === 'REGISTER') {
      if (!privacyAccepted || !contractAccepted) {
        setAuthError('Devi accettare sia la Privacy Policy che il Contratto per continuare.');
        return;
      }
    }

    setIsGeneratingAI(true);

    try {
      if (authMode === 'REGISTER') {
        const username = `${firstName}_${lastName}`.toLowerCase().replace(/\s/g, '');
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
              birth_date: birthDate,
              username: username,
              privacy_accepted: privacyAccepted,
              contract_accepted: contractAccepted
            }
          }
        });

        if (error) throw error;
        setAuthMode('VERIFY');
      } else if (authMode === 'LOGIN') {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });

        if (error) {
          if (error.message.includes("Email not confirmed")) {
            setAuthMode('VERIFY');
            throw new Error("L'email non è stata confermata. Clicca sul link ricevuto via mail.");
          }
          throw error;
        }
        
        // Chiudiamo la modale e resettiamo lo stato di caricamento
        setIsAuthModalOpen(false);
        setIsGeneratingAI(false);
      }
    } catch (err: any) {
      console.error("Auth Error:", err);
      setAuthError(err.message === 'Failed to fetch' 
        ? "Impossibile contattare il server. Controlla la configurazione di Supabase." 
        : err.message || 'Errore durante l\'operazione');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const closeNewArticleModal = () => {
    setNewTitle('');
    setNewContent('');
    setNewImageUrl('');
    setSelectedFile(null);
    setArticleError('');
    setIsNewArticleModalOpen(false);
  };

  const handleCreateArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (user.role !== UserRole.AUTHOR && user.role !== UserRole.ADMIN)) return;
    
    setArticleError('');
    setIsGeneratingAI(true);

    try {
      let finalImageUrl = newImageUrl;

      // Se c'è un file selezionato, caricalo ora
      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(0);
        
        // Genera un nome univoco: timestamp + stringa random + estensione originale
        const fileExt = selectedFile.name.split('.').pop();
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        
        try {
          console.log("Starting upload for:", uniqueName);
          const newBlob = await upload(uniqueName, selectedFile, {
            access: 'public',
            handleUploadUrl: '/api/upload',
            clientPayload: JSON.stringify({ userId: user?.id }),
            multipart: true,
            onUploadProgress: (progressEvent) => {
              setUploadProgress(progressEvent.percentage);
            }
          });
          console.log("Upload successful:", newBlob.url);
          finalImageUrl = newBlob.url;
        } catch (uploadErr: any) {
          console.error("Upload error details:", uploadErr);
          throw new Error(`Errore durante l'upload del file: ${uploadErr.message || 'Errore sconosciuto'}`);
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      }

      // Inserimento nel DB (il sommario viene creato prendendo l'inizio del contenuto)
      const summary = newContent.length > 200 ? newContent.substring(0, 197) + '...' : newContent;
      
      const { error } = await supabase.from('articles').insert({
        title: newTitle,
        content: newContent,
        summary: summary,
        category: newArticleCategory,
        image_url: finalImageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1000',
        author_id: user.id,
        author_name: `${user.firstName} ${user.lastName}`
      });

      if (error) throw error;

      // Reset e chiusura
      closeNewArticleModal();
      await fetchData();
    } catch (err: any) {
      console.error("Article Creation Error:", err);
      setArticleError(err.message || "Errore durante il salvataggio dell'articolo.");
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleResendLink = async () => {
    setAuthError('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: authEmail,
      });
      if (error) throw error;
      alert("Link di verifica inviato nuovamente!");
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    // Creiamo un URL temporaneo per l'anteprima locale
    const previewUrl = URL.createObjectURL(file);
    setNewImageUrl(previewUrl);
    setArticleError('');
  };

  const handleHeaderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || user.role !== UserRole.ADMIN) return;

    setIsUploadingHeader(true);
    setUploadProgress(0);
    try {
      const fileExt = file.name.split('.').pop();
      const uniqueName = `header-${Date.now()}.${fileExt}`;
      
      const newBlob = await upload(uniqueName, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
        clientPayload: JSON.stringify({ userId: user?.id }),
        multipart: true,
        onUploadProgress: (progressEvent) => {
          setUploadProgress(progressEvent.percentage);
        }
      });
      
      const { error } = await supabase
        .from('testata')
        .update({ imma_testata: newBlob.url })
        .eq('id', 'header_image');

      if (error) throw error;
      setHeaderImage(newBlob.url);
      alert("Logo testata aggiornato con successo!");
    } catch (error: any) {
      console.error('Header upload error:', error);
      const errorMsg = error.message || "Errore durante l'aggiornamento del logo.";
      alert(errorMsg);
    } finally {
      setIsUploadingHeader(false);
      setUploadProgress(0);
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
      <main className="flex-1 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 md:p-10">
        {isLoading ? (
          <div className="lg:col-span-12 py-32 text-center flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-stone-200 border-t-stone-800 rounded-full animate-spin"></div>
            <p className="mt-6 text-stone-400 newspaper-font italic text-xl">Caricamento in corso...</p>
          </div>
        ) : (
          <>
            <aside className="lg:col-span-3 space-y-6 lg:border-r border-stone-200 lg:pr-6 order-1 lg:order-1">
              <div className="w-full relative group">
                {headerImage && (
                  <img src={headerImage} alt="Testata" className="w-full h-auto border-b-4 border-double border-stone-800 pb-4 shadow-sm" />
                )}
                {user?.role === UserRole.ADMIN && (
                  <div className="mt-2">
                    <button 
                      onClick={() => headerFileInputRef.current?.click()}
                      disabled={isUploadingHeader}
                      className="w-full bg-stone-100 text-stone-600 text-[9px] font-bold py-1 uppercase rounded hover:bg-stone-200 transition-colors border border-stone-200"
                    >
                      {isUploadingHeader ? `Caricamento ${uploadProgress}%` : 'Cambia Logo'}
                    </button>
                    <input 
                      type="file" 
                      ref={headerFileInputRef} 
                      onChange={handleHeaderUpload} 
                      className="hidden" 
                      accept="image/*" 
                    />
                  </div>
                )}
              </div>
              <div className="text-[11px] uppercase font-bold tracking-widest text-stone-500 border-y border-stone-200 py-3 text-center mb-8">
                {new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
              <nav className="flex flex-col space-y-1">
                <button onClick={() => setSelectedCategory('All')} style={navStyles} className={`text-left py-3 px-2 text-sm uppercase tracking-tighter border-b border-stone-100 transition-all ${selectedCategory === 'All' ? 'text-red-600 border-l-4 border-l-red-600 pl-4 bg-white' : 'text-stone-800'}`}>Home Page</button>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} style={navStyles} className={`text-left py-3 px-2 text-sm uppercase tracking-tighter border-b border-stone-100 transition-all ${selectedCategory === cat ? 'text-red-600 border-l-4 border-l-red-600 pl-4 bg-white' : 'text-stone-800'}`}>{cat}</button>
                ))}
              </nav>
            </aside>

            <div className="lg:col-span-6 space-y-6 order-3 lg:order-2">
              <div className="space-y-4">
                {filteredArticles.length > 0 ? (
                  filteredArticles.map(article => (
                    <ArticleCard key={article.id} article={article} onClick={setSelectedArticle} />
                  ))
                ) : (
                  <div className="py-20 text-center text-stone-400 newspaper-font italic text-xl">
                    Nessuna opinione trovata.
                  </div>
                )}
              </div>
            </div>

            <aside className="lg:col-span-3 space-y-8 lg:border-l border-stone-200 lg:pl-6 text-center order-2 lg:order-3">
              <section className="bg-white border-4 border-stone-800 p-6 shadow-sm rounded-lg">
                <h3 className="text-xl font-bold uppercase border-b-2 border-stone-800 mb-6 newspaper-font">Il Tuo Profilo</h3>
                {user ? (
                  <>
                    <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-stone-800 mb-4 mx-auto grayscale" alt="Profile" />
                    <h4 className="text-lg font-bold newspaper-font mb-1">{user.firstName} {user.lastName}</h4>
                    <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-stone-800 text-white rounded mb-6">{user.role}</span>
                    
                    {/* Pulsante Inserimento Articolo per AUTHOR e ADMIN */}
                    {(user.role === UserRole.AUTHOR || user.role === UserRole.ADMIN) && (
                      <button 
                        onClick={() => setIsNewArticleModalOpen(true)}
                        className="w-full mb-3 bg-red-600 text-white text-[10px] font-black py-3 uppercase rounded shadow hover:bg-red-700 transition-colors"
                      >
                        Nuovo
                      </button>
                    )}

                    <button onClick={() => supabase.auth.signOut()} className="w-full bg-stone-100 text-stone-900 text-[10px] font-black py-2 uppercase rounded hover:bg-stone-200">Esci</button>
                  </>
                ) : (
                  <button onClick={() => { setAuthMode('LOGIN'); setIsAuthModalOpen(true); }} className="w-full bg-stone-900 text-white py-4 text-xs font-black uppercase tracking-widest rounded hover:bg-stone-700 transition-colors">Accedi / Iscriviti</button>
                )}
              </section>

              <section className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm text-left">
                <h3 className="text-sm font-bold uppercase border-b border-stone-800 mb-4 newspaper-font">Più Apprezzati</h3>
                <div className="space-y-3">
                  {topOpinions.map((op, idx) => (
                    <div key={op.id} className="cursor-pointer group" onClick={() => setSelectedArticle(op)}>
                      <h4 className="text-xs font-bold leading-tight group-hover:text-red-600 line-clamp-2">{idx+1}. {op.title}</h4>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </>
        )}
      </main>

      {/* Modal Auth */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex justify-center items-center p-6 backdrop-blur-md">
          <div className="bg-white p-8 md:p-12 max-w-md w-full border-t-[12px] border-stone-800 shadow-2xl rounded-xl">
            {authMode !== 'VERIFY' ? (
              <>
                <h2 className="text-3xl font-bold newspaper-font mb-2 text-center uppercase tracking-tighter">
                  {authMode === 'LOGIN' ? 'Bentornato' : 'Unisciti a Noi'}
                </h2>
                <p className="text-center text-[9px] text-stone-400 uppercase font-black mb-6 tracking-widest">La Voce del Tam Tam</p>
                
                <form onSubmit={handleAuth} className="space-y-4">
                  {authMode === 'REGISTER' && (
                    <div className="grid grid-cols-2 gap-3">
                      <input required placeholder="Nome" className="w-full p-3 border-2 border-stone-100 rounded-lg text-sm" value={firstName} onChange={e => setFirstName(e.target.value)} />
                      <input required placeholder="Cognome" className="w-full p-3 border-2 border-stone-100 rounded-lg text-sm" value={lastName} onChange={e => setLastName(e.target.value)} />
                      <input required type="date" className="col-span-2 w-full p-3 border-2 border-stone-100 rounded-lg text-sm" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                      <input required type="email" placeholder="Email" className="col-span-2 w-full p-3 border-2 border-stone-100 rounded-lg text-sm" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
                      <input required type="password" placeholder="Password" className="col-span-2 w-full p-3 border-2 border-stone-100 rounded-lg text-sm" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
                      
                      <div className="col-span-2 space-y-3 mt-4 px-1">
                        <div className="flex items-start gap-3">
                          <input type="checkbox" id="privacy" className="mt-1 w-4 h-4 accent-stone-800 cursor-pointer" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
                          <label htmlFor="privacy" className="text-[11px] text-stone-600 leading-tight cursor-pointer">
                            Accetto la <a href="/privacy.pdf" target="_blank" className="font-bold text-stone-900 border-b border-stone-300 hover:border-stone-800">Privacy Policy</a> del sito.
                          </label>
                        </div>
                        <div className="flex items-start gap-3">
                          <input type="checkbox" id="contract" className="mt-1 w-4 h-4 accent-stone-800 cursor-pointer" checked={contractAccepted} onChange={(e) => setContractAccepted(e.target.checked)} />
                          <label htmlFor="contract" className="text-[11px] text-stone-600 leading-tight cursor-pointer">
                            Accetto i termini del <a href="/contratto.pdf" target="_blank" className="font-bold text-stone-900 border-b border-stone-300 hover:border-stone-800">Contratto di Servizio</a>.
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                  {authMode === 'LOGIN' && (
                    <>
                      <input required type="email" placeholder="Email" className="w-full p-3 border-2 border-stone-100 rounded-lg text-sm" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
                      <input required type="password" placeholder="Password" className="w-full p-3 border-2 border-stone-100 rounded-lg text-sm" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
                    </>
                  )}
                  {authError && <div className="bg-red-50 border-l-4 border-red-500 p-3"><p className="text-red-700 text-[10px] font-bold leading-tight uppercase">{authError}</p></div>}
                  <button disabled={isGeneratingAI} type="submit" className="w-full bg-stone-900 text-white py-4 font-black uppercase tracking-widest text-xs rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-all">
                    {isGeneratingAI ? 'CARICAMENTO...' : (authMode === 'LOGIN' ? 'ACCEDI' : 'REGISTRATI')}
                  </button>
                </form>
                <div className="mt-8 pt-6 border-t border-stone-100 text-center">
                  <button onClick={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')} className="text-[10px] font-bold uppercase text-stone-500 hover:text-stone-900 tracking-widest">
                    {authMode === 'LOGIN' ? 'Nuovo utente? Registrati' : 'Hai un account? Accedi'}
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-stone-800"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </div>
                <h2 className="text-2xl font-bold newspaper-font mb-4 uppercase">Controlla la tua Posta</h2>
                <p className="text-sm text-stone-600 font-serif leading-relaxed mb-6">Ti abbiamo inviato un'email con un link di verifica. Clicca sul link per attivare il tuo account.</p>
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg mb-8">
                  <p className="text-[11px] text-amber-800 font-bold uppercase tracking-tight">⚠️ Importante: Ricorda di controllare la cartella SPAM.</p>
                </div>
                <div className="space-y-3">
                  <button onClick={handleResendLink} className="w-full text-[10px] font-black uppercase text-stone-500 hover:text-stone-900 tracking-widest py-2">Invia di nuovo il link</button>
                  <button onClick={() => setAuthMode('LOGIN')} className="w-full bg-stone-900 text-white py-3 text-[10px] font-black uppercase tracking-widest rounded-lg">Torna al Login</button>
                </div>
              </div>
            )}
            <button onClick={() => setIsAuthModalOpen(false)} className="mt-4 w-full text-stone-300 text-[9px] font-bold uppercase hover:text-red-600">Chiudi</button>
          </div>
        </div>
      )}

      {/* Modal Nuovo Articolo */}
      {isNewArticleModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex justify-center items-center p-6 backdrop-blur-md">
          <div className="bg-white p-8 md:p-12 max-w-2xl w-full border-t-[12px] border-red-600 shadow-2xl rounded-xl overflow-y-auto max-h-[90vh]">
            <p className="text-center text-[13.5px] text-stone-400 uppercase font-black mb-10 tracking-widest">Condividi la tua opinione con il mondo</p>
            
            <form onSubmit={handleCreateArticle} className="space-y-4">
              <input 
                required 
                placeholder="Titolo" 
                className="w-full p-4 border-2 border-stone-100 rounded-lg text-lg font-bold newspaper-font" 
                value={newTitle} 
                onChange={e => setNewTitle(e.target.value)} 
              />
              
              <div className="grid grid-cols-2 gap-4">
                <select 
                  required
                  className="w-full p-3 border-2 border-stone-100 rounded-lg text-sm bg-white"
                  value={newArticleCategory}
                  onChange={e => setNewArticleCategory(e.target.value as Category)}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="space-y-2">
                  <input 
                    placeholder="URL Immagine, Video o Social (YouTube, IG, FB, TikTok)" 
                    className="w-full p-3 border-2 border-stone-100 rounded-lg text-sm" 
                    value={newImageUrl} 
                    onChange={e => setNewImageUrl(e.target.value)} 
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className={`flex-1 py-2 px-4 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${selectedFile ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
                    >
                      {selectedFile ? `Selezionato: ${selectedFile.name.substring(0, 15)}${selectedFile.name.length > 15 ? '...' : ''}` : 'Carica File'}
                    </button>
                    {selectedFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          setNewImageUrl('');
                        }}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                        title="Rimuovi file"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    )}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                      accept="image/*,video/*"
                    />
                  </div>
                  <p className="text-[9px] text-stone-400 italic">Puoi incollare un link social o caricare un file.</p>
                </div>
              </div>

              {newImageUrl && (
                <div className="w-full h-48 rounded-lg overflow-hidden border-2 border-stone-100 bg-stone-50">
                  {(() => {
                    const embedUrl = getEmbedUrl(newImageUrl);
                    if (embedUrl) {
                      return <iframe src={embedUrl} className="w-full h-full border-0" allowFullScreen />;
                    }
                    if (newImageUrl.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i) || (selectedFile && selectedFile.type.startsWith('video/'))) {
                      return <video src={newImageUrl} className="w-full h-full object-contain" controls />;
                    }
                    return <img src={newImageUrl} alt="Preview" className="w-full h-full object-cover" />;
                  })()}
                </div>
              )}

              <textarea 
                required 
                placeholder="Scrivi qui..." 
                className="w-full p-4 border-2 border-stone-100 rounded-lg text-sm font-serif min-h-[300px] resize-none" 
                value={newContent} 
                onChange={e => setNewContent(e.target.value)} 
              />

              {articleError && <div className="bg-red-50 border-l-4 border-red-500 p-3"><p className="text-red-700 text-[10px] font-bold leading-tight uppercase">{articleError}</p></div>}

              <div className="flex gap-4">
                <button 
                  type="button"
                  onClick={closeNewArticleModal}
                  className="flex-1 border-2 border-stone-100 text-stone-400 py-4 font-black uppercase tracking-widest text-xs rounded-lg hover:bg-stone-50 transition-all"
                >
                  Annulla
                </button>
                <button 
                  disabled={isGeneratingAI || isUploading} 
                  type="submit" 
                  className="flex-[2] bg-stone-900 text-white py-4 font-black uppercase tracking-widest text-xs rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-all shadow-lg"
                >
                  {isUploading ? `CARICAMENTO MEDIA ${uploadProgress}%` : (isGeneratingAI ? 'SALVATAGGIO IN CORSO...' : 'PUBBLICA')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Articolo Selezionato */}
      {selectedArticle && (
        <div className="fixed inset-0 z-50 bg-black/90 flex justify-center items-start overflow-y-auto p-4 md:p-10 backdrop-blur-sm">
          <div className="bg-white max-w-4xl w-full p-8 md:p-16 relative shadow-2xl border-x-[12px] border-stone-800">
            <button onClick={() => setSelectedArticle(null)} className="absolute top-6 right-6 text-3xl font-light hover:text-red-600 transition-colors">✕</button>
            <div className="text-center mb-12">
              <span className="text-xs font-black text-red-600 uppercase tracking-[0.3em]">{selectedArticle.category}</span>
              <h2 className="text-4xl md:text-6xl font-bold newspaper-font my-6 leading-[1.1]">{selectedArticle.title}</h2>
              <div className="flex justify-center gap-8 text-stone-400 text-sm italic font-serif border-y border-stone-100 py-3">
                <span>Di {selectedArticle.authorName}</span>
                <span>{new Date(selectedArticle.timestamp).toLocaleDateString('it-IT')}</span>
              </div>
            </div>
            {(() => {
              const embedUrl = getEmbedUrl(selectedArticle.imageUrl);
              if (embedUrl) {
                return <iframe src={embedUrl} className="w-full aspect-video mb-12 rounded shadow-lg border-0" allowFullScreen />;
              }
              if (selectedArticle.imageUrl.match(/\.(mp4|webm|ogg)$/i)) {
                return <video src={selectedArticle.imageUrl} className="w-full h-auto max-h-[600px] mb-12 rounded shadow-lg" controls />;
              }
              return <img src={selectedArticle.imageUrl} className="w-full h-auto max-h-[600px] object-cover mb-12 grayscale rounded shadow-lg" alt="Cover" />;
            })()}
            <div className="prose prose-stone max-w-none text-stone-800 text-lg font-serif leading-relaxed">
              {selectedArticle.content.split('\n').map((p, i) => (
                <p key={i} className="mb-6">{p}</p>
              ))}
            </div>
            <CommentSection comments={selectedArticle.comments} currentUser={user} onAddComment={() => fetchData()} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
