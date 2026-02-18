
import React, { useState, useEffect, useMemo } from 'react';
import { User, Opinione, UserRole, Category } from './types';
import { CATEGORIES } from './constants';
import { ArticleCard as OpinioneCard } from './components/ArticleCard';
import { CommentSection } from './components/CommentSection';
import { summarizeArticle } from './services/geminiService';
import { supabase } from './services/supabase';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [opinioni, setOpinioni] = useState<Opinione[]>([]);
  const [selectedOpinione, setSelectedOpinione] = useState<Opinione | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'VERIFY'>('LOGIN');
  const [isNewOpinioneModalOpen, setIsNewOpinioneModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  const [isLoading, setIsLoading] = useState(true);

  // Form States
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [contractAccepted, setContractAccepted] = useState(false);
  const [authError, setAuthError] = useState('');

  const [headerImage, setHeaderImage] = useState<string>('');
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newCat, setNewCat] = useState<Category>('Opinioni');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const init = async () => {
      await checkSession();
      await fetchData();
      setIsLoading(false);
    };
    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await syncUserProfile(session.user);
        setIsAuthModalOpen(false);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await syncUserProfile(session.user);
  };

  const syncUserProfile = async (authUser: any) => {
    const { data: profile } = await supabase.from('utenti').select('*').eq('id', authUser.id).maybeSingle();
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
    }
  };

  const fetchData = async () => {
    try {
      const { data: opinioniData } = await supabase
        .from('opinioni')
        .select('*, comments(*)')
        .order('created_at', { ascending: false });

      if (opinioniData) {
        const formatted: Opinione[] = opinioniData.map(o => ({
          id: o.id,
          title: o.title,
          summary: o.summary || '',
          content: o.content,
          authorId: o.author_id,
          authorName: o.author_name,
          category: o.category as Category,
          imageUrl: o.image_url,
          likes: o.likes || 0,
          timestamp: new Date(o.created_at).getTime(),
          comments: (o.comments || []).map((c: any) => ({
            id: c.id,
            opinioneId: c.opinione_id,
            userId: c.user_id,
            username: c.username,
            content: c.content,
            timestamp: new Date(c.created_at).getTime()
          }))
        }));
        setOpinioni(formatted);
      }

      const { data: testataData } = await supabase.from('testata').select('imma_testata').eq('id', 'header_image').single();
      if (testataData) setHeaderImage(testataData.imma_testata);
    } catch (err) {
      console.error("Fetch Error:", err);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsProcessing(true);

    try {
      if (authMode === 'REGISTER') {
        if (!privacyAccepted || !contractAccepted) throw new Error("Accetta i termini per continuare.");
        
        const username = `${firstName}_${lastName}`.toLowerCase().replace(/\s/g, '');
        const { error } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
          options: {
            emailRedirectTo: window.location.origin, // Cruciale per l'invio mail
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
            throw new Error("Controlla la mail per confermare l'account.");
          }
          throw error;
        }
        setIsAuthModalOpen(false);
      }
    } catch (err: any) {
      setAuthError(err.message || 'Errore durante l\'operazione');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateOpinione = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsProcessing(true);
    try {
      // Generazione automatica del sommario tramite AI
      const summary = await summarizeArticle(newContent);

      const { error } = await supabase.from('opinioni').insert({
        title: newTitle,
        content: newContent,
        summary: summary,
        category: newCat,
        image_url: newImageUrl || 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&q=80&w=1000',
        author_id: user.id,
        author_name: `${user.firstName} ${user.lastName}`
      });

      if (error) throw error;
      setNewTitle('');
      setNewContent('');
      setNewImageUrl('');
      setIsNewOpinioneModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredOpinioni = selectedCategory === 'All' ? opinioni : opinioni.filter(o => o.category === selectedCategory);
  const topOpinions = useMemo(() => [...opinioni].sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 5), [opinioni]);

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
            <aside className="lg:col-span-3 space-y-6 lg:border-r border-stone-200 lg:pr-6">
              <img src={headerImage} alt="Header" className="w-full h-auto border-b-4 border-double border-stone-800 pb-4 shadow-sm" />
              <nav className="flex flex-col space-y-1">
                <button onClick={() => setSelectedCategory('All')} style={navStyles} className={`text-left py-3 px-2 text-sm uppercase tracking-tighter border-b border-stone-100 transition-all ${selectedCategory === 'All' ? 'text-red-600 border-l-4 border-l-red-600 pl-4 bg-white' : 'text-stone-800'}`}>Home</button>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} style={navStyles} className={`text-left py-3 px-2 text-sm uppercase tracking-tighter border-b border-stone-100 transition-all ${selectedCategory === cat ? 'text-red-600 border-l-4 border-l-red-600 pl-4 bg-white' : 'text-stone-800'}`}>{cat}</button>
                ))}
              </nav>
            </aside>

            <div className="lg:col-span-6 space-y-6">
              {filteredOpinioni.map(o => <OpinioneCard key={o.id} article={o} onClick={setSelectedOpinione} />)}
              {filteredOpinioni.length === 0 && <p className="text-center py-20 text-stone-400 font-serif italic">Nessuna opinione disponibile in questa categoria.</p>}
            </div>

            <aside className="lg:col-span-3 space-y-8 lg:border-l border-stone-200 lg:pl-6 text-center">
              <section className="bg-white border-4 border-stone-800 p-6 shadow-sm rounded-lg">
                <h3 className="text-xl font-bold uppercase border-b-2 border-stone-800 mb-6 newspaper-font">Profilo</h3>
                {user ? (
                  <>
                    <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-stone-800 mb-4 mx-auto" alt="Profile" />
                    <h4 className="text-lg font-bold mb-1">{user.firstName} {user.lastName}</h4>
                    <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-stone-800 text-white rounded mb-6">{user.role}</span>
                    {(user.role === 'ADMIN' || user.role === 'AUTHOR') && (
                      <button onClick={() => setIsNewOpinioneModalOpen(true)} className="w-full bg-red-600 text-white py-3 text-xs font-bold uppercase rounded mb-3">Scrivi Opinione</button>
                    )}
                    <button onClick={() => supabase.auth.signOut()} className="w-full bg-stone-100 text-stone-900 text-[10px] font-black py-2 uppercase rounded">Esci</button>
                  </>
                ) : (
                  <button onClick={() => setIsAuthModalOpen(true)} className="w-full bg-stone-900 text-white py-4 text-xs font-black uppercase rounded">Accedi / Iscriviti</button>
                )}
              </section>
            </aside>
          </>
        )}
      </main>

      {/* MODAL AUTH */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex justify-center items-center p-6 backdrop-blur-md">
          <div className="bg-white p-8 md:p-12 max-w-md w-full border-t-[12px] border-stone-800 shadow-2xl rounded-xl">
            {authMode !== 'VERIFY' ? (
              <form onSubmit={handleAuth} className="space-y-4">
                <h2 className="text-3xl font-bold newspaper-font mb-6 text-center uppercase tracking-tighter">{authMode === 'LOGIN' ? 'Accedi' : 'Iscriviti'}</h2>
                {authMode === 'REGISTER' && (
                  <div className="grid grid-cols-2 gap-3">
                    <input required placeholder="Nome" className="p-3 border rounded text-sm" value={firstName} onChange={e => setFirstName(e.target.value)} />
                    <input required placeholder="Cognome" className="p-3 border rounded text-sm" value={lastName} onChange={e => setLastName(e.target.value)} />
                    <input required type="date" className="col-span-2 p-3 border rounded text-sm" value={birthDate} onChange={e => setBirthDate(e.target.value)} />
                  </div>
                )}
                <input required type="email" placeholder="Email" className="w-full p-3 border rounded text-sm" value={authEmail} onChange={e => setAuthEmail(e.target.value)} />
                <input required type="password" placeholder="Password" className="w-full p-3 border rounded text-sm" value={authPassword} onChange={e => setAuthPassword(e.target.value)} />
                
                {authMode === 'REGISTER' && (
                  <div className="space-y-2 mt-4">
                    <label className="flex items-center gap-2 text-[10px] font-bold text-stone-600 uppercase">
                      <input type="checkbox" required checked={privacyAccepted} onChange={e => setPrivacyAccepted(e.target.checked)} /> Accetto la Privacy Policy
                    </label>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-stone-600 uppercase">
                      <input type="checkbox" required checked={contractAccepted} onChange={e => setContractAccepted(e.target.checked)} /> Accetto il Contratto di Servizio
                    </label>
                  </div>
                )}

                {authError && <p className="text-red-600 text-[10px] font-bold uppercase">{authError}</p>}
                
                <button disabled={isProcessing} className="w-full bg-stone-900 text-white py-4 font-black uppercase text-xs rounded-lg">{isProcessing ? 'Caricamento...' : authMode}</button>
                <button type="button" onClick={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')} className="w-full text-[10px] font-bold uppercase text-stone-400 mt-4">Cambia modalità</button>
              </form>
            ) : (
              <div className="text-center py-6">
                <h2 className="text-2xl font-bold newspaper-font mb-4 uppercase">Controlla la Mail</h2>
                <p className="text-sm text-stone-600 font-serif mb-6">Ti abbiamo inviato un link di verifica. Clicca sul link per attivare l'account.</p>
                <button onClick={() => setAuthMode('LOGIN')} className="w-full bg-stone-900 text-white py-3 text-[10px] font-black uppercase rounded-lg">Torna al Login</button>
              </div>
            )}
            <button onClick={() => setIsAuthModalOpen(false)} className="mt-4 w-full text-stone-300 text-[9px] font-bold uppercase hover:text-red-600 text-center">Chiudi</button>
          </div>
        </div>
      )}

      {/* MODAL NUOVA OPINIONE (Senza Sommario) */}
      {isNewOpinioneModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex justify-center items-center p-6 backdrop-blur-md">
          <div className="bg-white p-8 md:p-12 max-w-2xl w-full border-t-[12px] border-red-600 shadow-2xl rounded-xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-3xl font-bold newspaper-font mb-6 text-center uppercase tracking-tighter">Nuova Opinione</h2>
            <form onSubmit={handleCreateOpinione} className="space-y-4">
              <input required placeholder="Titolo dell'opinione" className="w-full p-4 border-2 border-stone-100 rounded-lg text-lg font-bold" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
              <div className="grid grid-cols-2 gap-4">
                <select className="p-3 border rounded-lg text-sm bg-white" value={newCat} onChange={e => setNewCat(e.target.value as Category)}>
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <input placeholder="URL Immagine" className="p-3 border rounded-lg text-sm" value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} />
              </div>
              <textarea required placeholder="Scrivi qui la tua opinione..." className="w-full p-4 border-2 border-stone-100 rounded-lg text-sm min-h-[300px] font-serif" value={newContent} onChange={e => setNewContent(e.target.value)} />
              <button disabled={isProcessing} className="w-full bg-stone-900 text-white py-4 font-black uppercase text-xs rounded-lg">{isProcessing ? 'Pubblicazione in corso...' : 'Pubblica Opinione'}</button>
            </form>
            <button onClick={() => setIsNewOpinioneModalOpen(false)} className="mt-4 w-full text-stone-300 text-[9px] font-bold uppercase hover:text-red-600 text-center">Annulla</button>
          </div>
        </div>
      )}

      {/* VISUALIZZAZIONE OPINIONE */}
      {selectedOpinione && (
        <div className="fixed inset-0 z-50 bg-black/90 flex justify-center items-start overflow-y-auto p-4 md:p-10 backdrop-blur-sm">
          <div className="bg-white max-w-4xl w-full p-8 md:p-16 relative shadow-2xl border-x-[12px] border-stone-800">
            <button onClick={() => setSelectedOpinione(null)} className="absolute top-6 right-6 text-3xl font-light hover:text-red-600 transition-colors">✕</button>
            <div className="text-center mb-12">
              <span className="text-xs font-black text-red-600 uppercase tracking-[0.3em]">{selectedOpinione.category}</span>
              <h2 className="text-4xl md:text-6xl font-bold newspaper-font my-6 leading-[1.1]">{selectedOpinione.title}</h2>
              <div className="flex justify-center gap-8 text-stone-400 text-sm italic font-serif border-y border-stone-100 py-3">
                <span>Di {selectedOpinione.authorName}</span>
                <span>{new Date(selectedOpinione.timestamp).toLocaleDateString('it-IT')}</span>
              </div>
            </div>
            <img src={selectedOpinione.imageUrl} className="w-full h-auto max-h-[600px] object-cover mb-12 rounded shadow-lg" alt="Cover" />
            <div className="prose prose-stone max-w-none text-stone-800 text-lg font-serif leading-relaxed mb-12">
              {selectedOpinione.content.split('\n').map((p, i) => <p key={i} className="mb-6">{p}</p>)}
            </div>
            <CommentSection 
              comments={selectedOpinione.comments} 
              currentUser={user} 
              onAddComment={async (content) => {
                if (!user) return;
                const { error } = await supabase.from('comments').insert({
                  opinione_id: selectedOpinione.id,
                  user_id: user.id,
                  username: `${user.firstName} ${user.lastName}`,
                  content
                });
                if (!error) await fetchData();
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
