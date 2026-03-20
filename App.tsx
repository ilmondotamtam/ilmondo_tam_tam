
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ClipboardPaste } from 'lucide-react';
import { User, Article, UserRole, Category, Comment, Contatto, ContattoStatus } from './types';
import { CATEGORIES } from './constants';
import { ArticleCard } from './components/ArticleCard';
import { CommentSection } from './components/CommentSection';
import { supabase } from './services/supabase';
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
  const [viewMode, setViewMode] = useState<'PRIORITY' | 'CHRONOLOGICAL'>('PRIORITY');

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
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Form State Profile
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState('');
  const [profileLastName, setProfileLastName] = useState('');
  const [profileBirthDate, setProfileBirthDate] = useState('');
  const [profileUsername, setProfileUsername] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Form State Contacts
  const [contacts, setContacts] = useState<Contatto[]>([]);
  const [isContactsModalOpen, setIsContactsModalOpen] = useState(false);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

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
        setContacts([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchContacts();
    }
  }, [user?.id]);

  useEffect(() => {
    // Re-sort articles when contacts or viewMode change
    if (articles.length > 0) {
      sortArticles(articles);
    }
  }, [contacts, viewMode]);

  // Risoluzione automatica link brevi TikTok
  useEffect(() => {
    if (!newImageUrl) return;
    
    const isShortTikTok = newImageUrl.includes('tiktok.com') && 
      (newImageUrl.includes('/t/') || newImageUrl.includes('vt.tiktok.com') || newImageUrl.includes('vm.tiktok.com'));
    
    if (isShortTikTok) {
      const resolveTikTok = async () => {
        try {
          const res = await fetch(`/api/resolve-tiktok?url=${encodeURIComponent(newImageUrl)}`);
          if (!res.ok) return;
          const responseText = await res.text();
          let data;
          try {
            data = JSON.parse(responseText);
          } catch (e) {
            console.error("Failed to parse TikTok resolution response as JSON:", responseText);
            return;
          }
          if (data.resolvedUrl && data.resolvedUrl !== newImageUrl) {
            setNewImageUrl(data.resolvedUrl);
          }
        } catch (err) {
          console.error("TikTok resolution failed", err);
        }
      };
      
      const timer = setTimeout(resolveTikTok, 800);
      return () => clearTimeout(timer);
    }
  }, [newImageUrl]);

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

  const uploadToS3 = async (file: File, fileName: string): Promise<string> => {
    // 1. Ottieni l'URL pre-firmato dal server
    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, contentType: file.type })
    });

    if (!presignRes.ok) {
      const errorText = await presignRes.text();
      let errorMsg = 'Errore durante la generazione del link di upload';
      try {
        const errData = JSON.parse(errorText);
        errorMsg = errData.details || errData.error || errorMsg;
      } catch (e) {
        errorMsg = `${errorMsg} (${presignRes.status}): ${errorText.substring(0, 100)}`;
      }
      throw new Error(errorMsg);
    }

    const responseText = await presignRes.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse presign response as JSON:", responseText);
      throw new Error("Il server ha restituito una risposta non valida (non JSON).");
    }
    
    const { signedUrl, publicUrl } = data;

    // 2. Esegui l'upload diretto su S3 usando XMLHttpRequest per il tracking del progresso
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(publicUrl);
        } else {
          console.error('S3 Upload Error Details:', {
            status: xhr.status,
            statusText: xhr.statusText,
            body: xhr.responseText
          });
          
          let friendlyError = `Errore S3 (${xhr.status}): ${xhr.statusText}`;
          if (xhr.status === 403) {
            friendlyError = "Accesso negato (403). Verifica le credenziali S3 e le impostazioni CORS del bucket su Supabase.";
          } else if (xhr.status === 404) {
            friendlyError = "Bucket non trovato (404). Assicurati che il bucket 'media' esista su Supabase.";
          }
          reject(new Error(friendlyError));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error("Errore di rete durante l'upload su S3."));
      });

      xhr.open('PUT', signedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setNewImageUrl(text);
    } catch (err) {
      console.error('Failed to read clipboard contents: ', err);
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
          role: UserRole.AUTHOR,
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
      // Carichiamo articoli, immagine di testata e apprezzamenti in parallelo
      const [articlesRes, testataRes] = await Promise.all([
        supabase
          .from('articles')
          .select('*, comments(*), apprezzamenti(user_id)')
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
        likedBy: (a.apprezzamenti || []).map((l: any) => l.user_id),
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
      
      sortArticles(formattedArticles);

      if (testataRes.data) {
        setHeaderImage(testataRes.data.imma_testata);
      }
    } catch (error: any) {
      console.error("Fetch Error:", error);
    }
  };

  const sortArticles = (articlesList: Article[]) => {
    const sorted = [...articlesList];
    
    if (user && viewMode === 'PRIORITY' && contacts.length > 0) {
      const acceptedContactIds = contacts
        .filter(c => c.status === ContattoStatus.ACCEPTED)
        .map(c => c.senderId === user.id ? c.receiverId : c.senderId);

      sorted.sort((a, b) => {
        const aIsContact = acceptedContactIds.includes(a.authorId);
        const bIsContact = acceptedContactIds.includes(b.authorId);
        
        if (aIsContact && !bIsContact) return -1;
        if (!aIsContact && bIsContact) return 1;
        return b.timestamp - a.timestamp;
      });
    } else {
      sorted.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    setArticles(sorted);
  };

  const fetchContacts = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('contatti')
        .select(`
          *,
          sender:utenti!sender_id(username, avatar, first_name, last_name),
          receiver:utenti!receiver_id(username, avatar, first_name, last_name)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`);

      if (error) throw error;

      const formattedContacts: Contatto[] = (data || []).map((c: any) => ({
        id: c.id,
        senderId: c.sender_id,
        receiverId: c.receiver_id,
        status: c.status as ContattoStatus,
        createdAt: new Date(c.created_at).getTime(),
        updatedAt: new Date(c.updated_at).getTime(),
        senderName: `${c.sender.first_name} ${c.sender.last_name}`,
        senderAvatar: c.sender.avatar,
        receiverName: `${c.receiver.first_name} ${c.receiver.last_name}`,
        receiverAvatar: c.receiver.avatar
      }));

      setContacts(formattedContacts);
    } catch (err) {
      console.error("Fetch Contacts Error:", err);
    }
  };

  const handleSendContactRequest = async (receiverId: string) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('contatti')
        .insert({
          sender_id: user.id,
          receiver_id: receiverId,
          status: ContattoStatus.PENDING
        });

      if (error) throw error;
      await fetchContacts();
      alert('Richiesta di contatto inviata!');
    } catch (err: any) {
      console.error("Send Contact Request Error:", err);
      alert(err.message || "Errore durante l'invio della richiesta.");
    }
  };

  const handleUpdateContactStatus = async (contactId: string, status: ContattoStatus) => {
    try {
      const { error } = await supabase
        .from('contatti')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', contactId);

      if (error) throw error;
      await fetchContacts();
    } catch (err: any) {
      console.error("Update Contact Status Error:", err);
      alert(err.message || "Errore durante l'aggiornamento della richiesta.");
    }
  };

  const handleRemoveContact = async (contactId: string) => {
    if (!confirm('Sei sicuro di voler rimuovere questo contatto?')) return;
    try {
      const { error } = await supabase
        .from('contatti')
        .delete()
        .eq('id', contactId);

      if (error) throw error;
      await fetchContacts();
    } catch (err: any) {
      console.error("Remove Contact Error:", err);
      alert(err.message || "Errore durante la rimozione del contatto.");
    }
  };

  const handleSearchUsers = async () => {
    if (!searchUserQuery.trim()) return;
    setIsSearchingUsers(true);
    try {
      const { data, error } = await supabase
        .from('utenti')
        .select('*')
        .or(`username.ilike.%${searchUserQuery}%,first_name.ilike.%${searchUserQuery}%,last_name.ilike.%${searchUserQuery}%`)
        .neq('id', user?.id)
        .limit(10);

      if (error) throw error;
      
      setSearchResults((data || []).map((u: any) => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role as UserRole,
        avatar: u.avatar,
        firstName: u.first_name,
        lastName: u.last_name,
        birthDate: u.birth_date
      })));
    } catch (err) {
      console.error("Search Users Error:", err);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleLike = async (articleId: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    const isLiked = article.likedBy?.includes(user.id);

    try {
      if (isLiked) {
        // Rimuovi mi piace
        const { error } = await supabase
          .from('apprezzamenti')
          .delete()
          .eq('article_id', articleId)
          .eq('user_id', user.id);
        
        if (error) throw error;

        // Decrementa il contatore nell'articolo
        await supabase.rpc('decrement_likes', { row_id: articleId });
      } else {
        // Aggiungi mi piace
        const { error } = await supabase
          .from('apprezzamenti')
          .insert({ article_id: articleId, user_id: user.id });
        
        if (error) throw error;

        // Incrementa il contatore nell'articolo
        await supabase.rpc('increment_likes', { row_id: articleId });
      }

      // Ricarica i dati per aggiornare la UI
      await fetchData();
    } catch (err) {
      console.error("Like Error:", err);
    }
  };

  const handleAddComment = async (articleId: string, content: string) => {
    if (!user) {
      setIsAuthModalOpen(true);
      return;
    }

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          article_id: articleId,
          user_id: user.id,
          username: `${user.firstName} ${user.lastName}`,
          content: content
        });

      if (error) throw error;
      
      // Ricarica i dati per mostrare il nuovo commento
      await fetchData();
      
      // Se l'articolo è aperto nella modale, aggiorniamo anche quello stato locale
      if (selectedArticle && selectedArticle.id === articleId) {
        // fetchData aggiorna la lista articles, ma selectedArticle è un oggetto separato nello stato
        // Possiamo rinfrescarlo cercando l'articolo aggiornato nella lista
        const updatedArticles = await supabase
          .from('articles')
          .select('*, comments(*), apprezzamenti(user_id)')
          .eq('id', articleId)
          .single();
        
        if (updatedArticles.data) {
          const a = updatedArticles.data;
          setSelectedArticle({
            id: a.id,
            title: a.title,
            summary: a.summary,
            content: a.content,
            authorId: a.author_id,
            authorName: a.author_name,
            category: a.category as Category,
            imageUrl: a.image_url,
            likes: a.likes || 0,
            likedBy: (a.apprezzamenti || []).map((l: any) => l.user_id),
            timestamp: new Date(a.created_at).getTime(),
            comments: (a.comments || []).map((c: any) => ({
              id: c.id,
              articleId: c.article_id,
              userId: c.user_id,
              username: c.username,
              content: c.content,
              timestamp: new Date(c.created_at).getTime()
            })).sort((a: any, b: any) => b.timestamp - a.timestamp)
          });
        }
      }
    } catch (err) {
      console.error("Comment Error:", err);
      alert("Errore durante l'invio del commento.");
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
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
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

        if (signUpError) throw signUpError;
        
        // Se la registrazione ha successo, mostriamo la modale di verifica
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

  const openProfileModal = () => {
    if (!user) return;
    setProfileFirstName(user.firstName || '');
    setProfileLastName(user.lastName || '');
    setProfileBirthDate(user.birthDate || '');
    setProfileUsername(user.username || '');
    setProfileAvatar(user.avatar || '');
    setIsProfileModalOpen(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      const { error } = await supabase
        .from('utenti')
        .update({
          first_name: profileFirstName,
          last_name: profileLastName,
          birth_date: profileBirthDate,
          username: profileUsername,
          avatar: profileAvatar
        })
        .eq('id', user.id);

      if (error) throw error;
      
      // Update local state
      setUser({
        ...user,
        firstName: profileFirstName,
        lastName: profileLastName,
        birthDate: profileBirthDate,
        username: profileUsername,
        avatar: profileAvatar
      });
      
      setIsProfileModalOpen(false);
      alert('Profilo aggiornato con successo!');
    } catch (err: any) {
      console.error("Profile Update Error:", err);
      alert(err.message || "Errore durante l'aggiornamento del profilo.");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const fileExt = file.name.split('.').pop();
      const uniqueName = `avatar-${user.id}-${Date.now()}.${fileExt}`;
      
      const publicUrl = await uploadToS3(file, uniqueName);
      
      setProfileAvatar(publicUrl);
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      alert(error.message || "Errore durante l'upload dell'avatar.");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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

      // Se c'è ancora un file selezionato (non ancora caricato), caricalo ora
      // (Normalmente handleFileUpload carica subito, ma per sicurezza lasciamo questo controllo)
      if (selectedFile) {
        setIsUploading(true);
        setUploadProgress(0);
        
        const fileExt = selectedFile.name.split('.').pop();
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
        
        try {
          const publicUrl = await uploadToS3(selectedFile, uniqueName);
          finalImageUrl = publicUrl;
          setNewImageUrl(publicUrl);
        } catch (uploadErr: any) {
          throw new Error(`Errore durante l'upload del file: ${uploadErr.message || 'Errore sconosciuto'}`);
        } finally {
          setIsUploading(false);
          setUploadProgress(0);
        }
      }

      // Inserimento nel DB
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

    // Mostriamo l'anteprima locale immediatamente
    const previewUrl = URL.createObjectURL(file);
    setNewImageUrl(previewUrl);
    setSelectedFile(file);
    setArticleError('');

    // Avviamo l'upload immediatamente per generare il link Supabase
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
      
      const publicUrl = await uploadToS3(file, uniqueName);
      setNewImageUrl(publicUrl);
      setSelectedFile(null); // Upload completato, non serve più il file originale
    } catch (err: any) {
      console.error("Upload error during selection:", err);
      setArticleError(`Errore durante l'upload: ${err.message}`);
      // Manteniamo il file selezionato così handleCreateArticle può riprovare l'upload se necessario
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleHeaderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || user.role !== UserRole.ADMIN) return;

    setIsUploadingHeader(true);
    setUploadProgress(0);
    try {
      const fileExt = file.name.split('.').pop();
      const uniqueName = `header-${Date.now()}.${fileExt}`;
      
      const publicUrl = await uploadToS3(file, uniqueName);
      
      const { error } = await supabase
        .from('testata')
        .update({ imma_testata: publicUrl })
        .eq('id', 'header_image');

      if (error) throw error;
      setHeaderImage(publicUrl);
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
              <div className="text-[11px] uppercase font-bold tracking-widest text-stone-500 border-y border-stone-200 py-3 text-center mb-4">
                {new Date().toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>

              {user && (
                <div className="mb-6 bg-stone-100 p-2 rounded-lg border border-stone-200">
                  <p className="text-[10px] uppercase font-bold text-stone-500 mb-2 px-1">Modalità di Visione</p>
                  <div className="flex flex-col gap-1">
                    <button 
                      onClick={() => setViewMode('PRIORITY')}
                      className={`text-[11px] font-bold py-2 px-3 rounded transition-all text-left flex items-center justify-between ${viewMode === 'PRIORITY' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-200'}`}
                    >
                      I miei contatti
                      {viewMode === 'PRIORITY' && <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>}
                    </button>
                    <button 
                      onClick={() => setViewMode('CHRONOLOGICAL')}
                      className={`text-[11px] font-bold py-2 px-3 rounded transition-all text-left flex items-center justify-between ${viewMode === 'CHRONOLOGICAL' ? 'bg-stone-800 text-white' : 'text-stone-600 hover:bg-stone-200'}`}
                    >
                      Visualizza tutti
                      {viewMode === 'CHRONOLOGICAL' && <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>}
                    </button>
                  </div>
                </div>
              )}

              <nav className="flex flex-col space-y-1">
                <button onClick={() => setSelectedCategory('All')} style={navStyles} className={`text-left py-2.5 px-2 text-sm uppercase tracking-tighter border-b border-stone-100 transition-all ${selectedCategory === 'All' ? 'text-red-600 border-l-4 border-l-red-600 pl-4 bg-white' : 'text-stone-800'}`}>Home Page</button>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(cat)} style={navStyles} className={`text-left py-2.5 px-2 text-sm uppercase tracking-tighter border-b border-stone-100 transition-all ${selectedCategory === cat ? 'text-red-600 border-l-4 border-l-red-600 pl-4 bg-white' : 'text-stone-800'}`}>{cat}</button>
                ))}
              </nav>
            </aside>

            <div className="lg:col-span-6 space-y-6 order-3 lg:order-2">
              <div className="space-y-4">
                {filteredArticles.length > 0 ? (
                  filteredArticles.map(article => (
                    <ArticleCard 
                      key={article.id} 
                      article={article} 
                      onClick={setSelectedArticle} 
                      onLike={() => handleLike(article.id)}
                      currentUserId={user?.id}
                    />
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
                    <div 
                      className="cursor-pointer group mb-4" 
                      onClick={openProfileModal}
                      title="Modifica Profilo"
                    >
                      <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-stone-800 mb-2 mx-auto transition-all" alt="Profile" />
                      <h4 className="text-lg font-bold newspaper-font mb-1 group-hover:text-red-600 transition-colors">{user.firstName} {user.lastName}</h4>
                    </div>
                    <span className="inline-block px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-stone-800 text-white rounded mb-6">{user.role}</span>
                    
                    <button 
                      onClick={() => setIsContactsModalOpen(true)}
                      className="w-full mb-3 bg-stone-100 text-stone-800 text-[10px] font-black py-3 uppercase rounded shadow hover:bg-stone-200 transition-colors border border-stone-200"
                    >
                      Contatti ({contacts.filter(c => c.status === ContattoStatus.ACCEPTED).length})
                    </button>

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
                  <div className="relative flex items-center">
                    <input 
                      placeholder="URL Immagine, Video o Social (YouTube, IG, FB, TikTok)" 
                      className="w-full p-3 pr-12 border-2 border-stone-100 rounded-lg text-sm" 
                      value={newImageUrl} 
                      onChange={e => setNewImageUrl(e.target.value)} 
                    />
                    <button
                      type="button"
                      onClick={handlePaste}
                      className="absolute right-2 p-2 text-stone-400 hover:text-stone-800 transition-colors"
                      title="Incolla dagli appunti"
                    >
                      <ClipboardPaste size={18} />
                    </button>
                  </div>
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
                <div className="w-full max-h-80 rounded-lg overflow-hidden border-2 border-stone-100 bg-stone-50 flex items-center justify-center">
                  {(() => {
                    const embedUrl = getEmbedUrl(newImageUrl);
                    if (embedUrl) {
                      const isTikTok = newImageUrl.includes('tiktok.com');
                      const isInstagram = newImageUrl.includes('instagram.com');
                      const isFacebook = newImageUrl.includes('facebook.com');
                      
                      let previewClass = "aspect-video w-full";
                      if (isTikTok) previewClass = "aspect-[9/16] h-80";
                      else if (isInstagram) previewClass = "aspect-[1/1.25] h-80";
                      else if (isFacebook) previewClass = "aspect-[4/3] w-full";

                      return (
                        <div className={previewClass}>
                          <iframe src={embedUrl} className="w-full h-full border-0" allowFullScreen />
                        </div>
                      );
                    }
                    if (newImageUrl.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i) || (selectedFile && selectedFile.type.startsWith('video/'))) {
                      return <video src={newImageUrl} className="w-full max-h-80 object-contain" controls />;
                    }
                    return <img src={newImageUrl} alt="Preview" className="w-full max-h-80 object-contain" />;
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

      {/* Modal Contatti */}
      {isContactsModalOpen && user && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex justify-center items-center p-6 backdrop-blur-md">
          <div className="bg-white p-8 md:p-12 max-w-2xl w-full border-t-[12px] border-stone-800 shadow-2xl rounded-xl overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-3xl font-bold newspaper-font mb-2 uppercase tracking-tighter">I Tuoi Contatti</h2>
                <p className="text-[9px] text-stone-400 uppercase font-black tracking-widest">Gestisci le tue connessioni</p>
              </div>
              <button onClick={() => setIsContactsModalOpen(false)} className="text-2xl hover:text-red-600 transition-colors">✕</button>
            </div>

            {/* Ricerca Utenti */}
            <div className="mb-10">
              <h3 className="text-xs font-black uppercase text-stone-400 mb-4 tracking-widest">Cerca nuovi contatti</h3>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Cerca per nome o username..." 
                  className="flex-1 p-3 border-2 border-stone-100 rounded-lg text-sm focus:border-stone-800 outline-none transition-colors"
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                />
                <button 
                  onClick={handleSearchUsers}
                  disabled={isSearchingUsers}
                  className="bg-stone-800 text-white px-6 py-3 rounded-lg text-xs font-black uppercase tracking-widest hover:bg-stone-700 transition-colors disabled:opacity-50"
                >
                  {isSearchingUsers ? '...' : 'Cerca'}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-4 space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-100">
                  {searchResults.map(result => {
                    const existingContact = contacts.find(c => c.senderId === result.id || c.receiverId === result.id);
                    return (
                      <div key={result.id} className="flex items-center justify-between bg-white p-3 rounded-lg shadow-sm border border-stone-100">
                        <div className="flex items-center gap-3">
                          <img src={result.avatar} className="w-10 h-10 rounded-full border border-stone-200" alt={result.username} />
                          <div>
                            <p className="text-sm font-bold">{result.firstName} {result.lastName}</p>
                            <p className="text-[10px] text-stone-400 uppercase font-bold">@{result.username}</p>
                          </div>
                        </div>
                        {existingContact ? (
                          <span className="text-[10px] font-black uppercase text-stone-400 tracking-widest">
                            {existingContact.status === ContattoStatus.PENDING ? 'Richiesta Inviata' : 'Già nei contatti'}
                          </span>
                        ) : (
                          <button 
                            onClick={() => handleSendContactRequest(result.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-700 transition-colors"
                          >
                            Aggiungi
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Richieste Pendenti */}
            {contacts.some(c => c.status === ContattoStatus.PENDING && c.receiverId === user.id) && (
              <div className="mb-10">
                <h3 className="text-xs font-black uppercase text-red-600 mb-4 tracking-widest">Richieste in sospeso</h3>
                <div className="space-y-3">
                  {contacts.filter(c => c.status === ContattoStatus.PENDING && c.receiverId === user.id).map(request => (
                    <div key={request.id} className="flex items-center justify-between bg-red-50 p-4 rounded-xl border border-red-100">
                      <div className="flex items-center gap-3">
                        <img src={request.senderAvatar} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" alt={request.senderName} />
                        <div>
                          <p className="text-sm font-bold">{request.senderName}</p>
                          <p className="text-[10px] text-stone-400 uppercase font-bold">Ti ha inviato una richiesta</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleUpdateContactStatus(request.id, ContattoStatus.REJECTED)}
                          className="bg-white text-stone-400 p-2 rounded-lg hover:text-red-600 transition-colors shadow-sm"
                        >
                          Rifiuta
                        </button>
                        <button 
                          onClick={() => handleUpdateContactStatus(request.id, ContattoStatus.ACCEPTED)}
                          className="bg-stone-800 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-stone-700 transition-colors shadow-sm"
                        >
                          Accetta
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Lista Contatti */}
            <div>
              <h3 className="text-xs font-black uppercase text-stone-400 mb-4 tracking-widest">I tuoi contatti ({contacts.filter(c => c.status === ContattoStatus.ACCEPTED).length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {contacts.filter(c => c.status === ContattoStatus.ACCEPTED).map(contact => {
                  const isSender = contact.senderId === user.id;
                  const contactName = isSender ? contact.receiverName : contact.senderName;
                  const contactAvatar = isSender ? contact.receiverAvatar : contact.senderAvatar;
                  
                  return (
                    <div key={contact.id} className="flex items-center justify-between bg-stone-50 p-3 rounded-xl border border-stone-100">
                      <div className="flex items-center gap-3">
                        <img src={contactAvatar} className="w-10 h-10 rounded-full border border-stone-200" alt={contactName} />
                        <p className="text-sm font-bold">{contactName}</p>
                      </div>
                      <button 
                        onClick={() => handleRemoveContact(contact.id)}
                        className="text-stone-300 hover:text-red-600 transition-colors p-1"
                        title="Rimuovi Contatto"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                      </button>
                    </div>
                  );
                })}
                {contacts.filter(c => c.status === ContattoStatus.ACCEPTED).length === 0 && (
                  <p className="col-span-2 text-center py-8 text-stone-400 italic text-sm">Non hai ancora nessun contatto. Usa la ricerca sopra per trovarne!</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Profilo */}
      {isProfileModalOpen && user && (
        <div className="fixed inset-0 z-[110] bg-black/80 flex justify-center items-center p-6 backdrop-blur-md">
          <div className="bg-white p-8 md:p-12 max-w-md w-full border-t-[12px] border-stone-800 shadow-2xl rounded-xl overflow-y-auto max-h-[90vh]">
            <h2 className="text-3xl font-bold newspaper-font mb-2 text-center uppercase tracking-tighter">Il Tuo Profilo</h2>
            <p className="text-center text-[9px] text-stone-400 uppercase font-black mb-8 tracking-widest">Gestisci i tuoi dati personali</p>
            
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="flex flex-col items-center mb-6">
                <div className="relative group">
                  <img 
                    src={profileAvatar} 
                    className="w-32 h-32 rounded-full border-4 border-stone-800 object-cover transition-all" 
                    alt="Avatar" 
                  />
                  <button 
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 bg-stone-800 text-white p-2 rounded-full shadow-lg hover:bg-stone-700 transition-colors"
                    title="Cambia Immagine"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  </button>
                  <input 
                    type="file" 
                    ref={avatarFileInputRef} 
                    onChange={handleAvatarUpload} 
                    className="hidden" 
                    accept="image/*" 
                  />
                </div>
                {isUploading && (
                  <div className="w-full mt-2">
                    <div className="h-1 bg-stone-100 rounded-full overflow-hidden">
                      <div className="h-full bg-stone-800 transition-all" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <p className="text-[10px] text-center mt-1 text-stone-500 uppercase font-bold">Caricamento {uploadProgress}%</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-stone-400 mb-1 block tracking-widest">Email (Non modificabile)</label>
                  <input 
                    disabled 
                    className="w-full p-3 bg-stone-50 border-2 border-stone-100 rounded-lg text-sm text-stone-400 cursor-not-allowed" 
                    value={user.email} 
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase text-stone-400 mb-1 block tracking-widest">Nome</label>
                    <input 
                      required 
                      className="w-full p-3 border-2 border-stone-100 rounded-lg text-sm focus:border-stone-800 outline-none transition-colors" 
                      value={profileFirstName} 
                      onChange={e => setProfileFirstName(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-stone-400 mb-1 block tracking-widest">Cognome</label>
                    <input 
                      required 
                      className="w-full p-3 border-2 border-stone-100 rounded-lg text-sm focus:border-stone-800 outline-none transition-colors" 
                      value={profileLastName} 
                      onChange={e => setProfileLastName(e.target.value)} 
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-stone-400 mb-1 block tracking-widest">Username</label>
                  <input 
                    required 
                    className="w-full p-3 border-2 border-stone-100 rounded-lg text-sm focus:border-stone-800 outline-none transition-colors" 
                    value={profileUsername} 
                    onChange={e => setProfileUsername(e.target.value)} 
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-stone-400 mb-1 block tracking-widest">Data di Nascita</label>
                  <input 
                    required 
                    type="date" 
                    className="w-full p-3 border-2 border-stone-100 rounded-lg text-sm focus:border-stone-800 outline-none transition-colors" 
                    value={profileBirthDate} 
                    onChange={e => setProfileBirthDate(e.target.value)} 
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className="flex-1 border-2 border-stone-100 text-stone-400 py-3 font-black uppercase tracking-widest text-[10px] rounded-lg hover:bg-stone-50 transition-all"
                >
                  Annulla
                </button>
                <button 
                  disabled={isUpdatingProfile || isUploading} 
                  type="submit" 
                  className="flex-[2] bg-stone-900 text-white py-3 font-black uppercase tracking-widest text-[10px] rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-all shadow-lg"
                >
                  {isUpdatingProfile ? 'SALVATAGGIO...' : 'SALVA MODIFICHE'}
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
              if (selectedArticle.imageUrl.match(/\.(mp4|webm|ogg|mov|avi|mkv)$/i)) {
                return <video src={selectedArticle.imageUrl} className="w-full h-auto max-h-[600px] mb-12 rounded shadow-lg" controls />;
              }
              return <img src={selectedArticle.imageUrl} className="w-full h-auto max-h-[600px] object-cover mb-12 rounded shadow-lg" alt="Cover" />;
            })()}
            <div className="prose prose-stone max-w-none text-stone-800 text-lg font-serif leading-relaxed">
              {selectedArticle.content.split('\n').map((p, i) => (
                <p key={i} className="mb-6">{p}</p>
              ))}
            </div>
            <CommentSection 
              comments={selectedArticle.comments} 
              currentUser={user} 
              onAddComment={(content) => handleAddComment(selectedArticle.id, content)} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
