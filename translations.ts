
export type Language = 'it' | 'en' | 'fr' | 'es';

export interface Translations {
  homePage: string;
  myContacts: string;
  viewAll: string;
  loading: string;
  menu: string;
  changeLogo: string;
  privateMessages: string;
  conversations: string;
  secureCommunication: string;
  noOpinionsFound: string;
  backToTop: string;
  shareStory: string;
  close: string;
  categories: { [key: string]: string };
  auth: {
    login: string;
    register: string;
    verify: string;
    forgotPassword: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    privacy: string;
    contract: string;
    submit: string;
    welcomeBack: string;
    joinUs: string;
    voiceOfTamTam: string;
    forgotPasswordQuestion: string;
    forgotPasswordInstructions: string;
    sendLink: string;
    newUserRegistration: string;
    backToLogin: string;
    haveAccountLogin: string;
    loadingAuth: string;
    resetPasswordTitle: string;
    newPasswordLabel: string;
    confirmNewPasswordLabel: string;
    resetPasswordBtn: string;
    resetPasswordSuccessMessage: string;
    passwordsDoNotMatch: string;
  };
  article: {
    author: string;
    published: string;
    readMore: string;
    comments: string;
    likes: string;
    peopleAppreciated: string;
    commentCount: string;
    like: string;
    comment: string;
    share: string;
    commentsTitle: string;
    leaveComment: string;
    publishComment: string;
    loginToComment: string;
    noCommentsYet: string;
  };
  newArticle: {
    title: string;
    summary: string;
    content: string;
    imageUrl: string;
    category: string;
    submit: string;
  };
  viewMode: string;
  todayWeTalkAbout: string;
  yourProfile: string;
  messages: string;
  contacts: string;
  newArticleBtn: string;
  logout: string;
  searchUsers: string;
  addContact: string;
  pendingRequests: string;
  noResults: string;
  you: string;
  noMessages: string;
  searchArticlesPlaceHolder: string;
}

export const translations: Record<Language, Translations> = {
  it: {
    homePage: 'Home Page',
    myContacts: 'I miei contatti',
    viewAll: 'Visualizza tutti',
    loading: 'Caricamento in corso...',
    menu: 'Menu',
    changeLogo: 'Cambia Logo',
    privateMessages: 'Messaggi Privati',
    conversations: 'Conversazioni',
    secureCommunication: 'Comunicazione sicura tra utenti',
    noOpinionsFound: 'Nessuna opinione trovata.',
    backToTop: 'Torna in alto',
    shareStory: 'Condividi la tua opinione con il mondo',
    close: 'Chiudi',
    viewMode: 'Modalità di Visione',
    todayWeTalkAbout: 'Oggi parliamo di...',
    yourProfile: 'Il Tuo Profilo',
    messages: 'Messaggi',
    contacts: 'Contatti',
    newArticleBtn: 'Nuovo',
    logout: 'Logout',
    searchUsers: 'Cerca Utenti',
    addContact: 'Aggiungi Contatto',
    pendingRequests: 'Richieste in Sospeso',
    noResults: 'Nessun risultato',
    you: 'Tu',
    noMessages: 'Nessun messaggio',
    categories: {
      'Opinioni': 'Opinioni',
      'Fatti': 'Fatti',
      'Tradizioni e eventi': 'Tradizioni e eventi',
      'Cibi e bevande': 'Cibi e bevande',
      'Sport': 'Sport',
      'Curiosità': 'Curiosità',
      'Risate': 'Risate',
      'Città e paesi': 'Città e paesi',
      'Canzoni': 'Canzoni',
      'Politica': 'Politica',
      'Oggi parliamo di...': 'Oggi parliamo di...'
    },
    auth: {
      login: 'Accedi',
      register: 'Registrati',
      verify: 'Verifica',
      forgotPassword: 'Password dimenticata',
      email: 'Email',
      password: 'Password',
      firstName: 'Nome',
      lastName: 'Cognome',
      birthDate: 'Data di Nascita',
      privacy: 'Accetto la Privacy Policy',
      contract: 'Accetto il contratto editoriale',
      submit: 'Invia',
      welcomeBack: 'Bentornato',
      joinUs: 'Unisciti a Noi',
      voiceOfTamTam: 'La Voce del Tam Tam',
      forgotPasswordQuestion: 'Password dimenticata?',
      forgotPasswordInstructions: 'Inserisci la tua email per ricevere un link di ripristino della password.',
      sendLink: 'INVIA LINK',
      newUserRegistration: 'Nuovo utente? Registrati',
      backToLogin: 'Torna al Login',
      haveAccountLogin: 'Hai un account? Accedi',
      loadingAuth: 'CARICAMENTO...',
      resetPasswordTitle: 'Reimposta la tua Password',
      newPasswordLabel: 'Nuova Password (min. 6 caratteri)',
      confirmNewPasswordLabel: 'Conferma Nuova Password',
      resetPasswordBtn: 'REIMPOSTA PASSWORD',
      resetPasswordSuccessMessage: 'Password aggiornata con successo! Ora puoi effettuare il login.',
      passwordsDoNotMatch: 'Le due password inserite non coincidono.'
    },
    article: {
      author: 'Autore',
      published: 'Pubblicato il',
      readMore: 'Leggi tutto',
      comments: 'Commenti',
      likes: 'Apprezzamenti',
      peopleAppreciated: 'persone hanno apprezzato',
      commentCount: 'commenti',
      like: 'Mi piace',
      comment: 'Commenta',
      share: 'Condividi',
      commentsTitle: 'Commenti',
      leaveComment: 'Lascia un commento...',
      publishComment: 'Pubblica Commento',
      loginToComment: 'Accedi per poter commentare questa opinione.',
      noCommentsYet: 'Nessun commento ancora. Sii il primo!'
    },
    newArticle: {
      title: 'Titolo',
      summary: 'Sommario',
      content: 'Contenuto',
      imageUrl: 'URL Immagine o Video',
      category: 'Categoria',
      submit: 'Pubblica Opinione'
    },
    searchArticlesPlaceHolder: 'Cerca...'
  },
  en: {
    homePage: 'Home Page',
    myContacts: 'My Contacts',
    viewAll: 'View All',
    loading: 'Loading...',
    menu: 'Menu',
    changeLogo: 'Change Logo',
    privateMessages: 'Private Messages',
    conversations: 'Conversations',
    secureCommunication: 'Secure communication between users',
    noOpinionsFound: 'No opinions found.',
    backToTop: 'Back to Top',
    shareStory: 'Share your opinion with the world',
    close: 'Close',
    viewMode: 'View Mode',
    todayWeTalkAbout: 'Today we talk about...',
    yourProfile: 'Your Profile',
    messages: 'Messages',
    contacts: 'Contacts',
    newArticleBtn: 'New',
    logout: 'Logout',
    searchUsers: 'Search Users',
    addContact: 'Add Contact',
    pendingRequests: 'Pending Requests',
    noResults: 'No results',
    you: 'You',
    noMessages: 'No messages',
    categories: {
      'Opinioni': 'Opinions',
      'Fatti': 'Facts',
      'Tradizioni e eventi': 'Traditions and events',
      'Cibi e bevande': 'Food and drinks',
      'Sport': 'Sport',
      'Curiosità': 'Curiosities',
      'Risate': 'Laughter',
      'Città e paesi': 'Cities and countries',
      'Canzoni': 'Songs',
      'Politica': 'Politics',
      'Oggi parliamo di...': 'Today we talk about...'
    },
    auth: {
      login: 'Login',
      register: 'Register',
      verify: 'Verify',
      forgotPassword: 'Forgot Password',
      email: 'Email',
      password: 'Password',
      firstName: 'First Name',
      lastName: 'Last Name',
      birthDate: 'Birth Date',
      privacy: 'I accept the Privacy Policy',
      contract: 'I accept the editorial contract',
      submit: 'Submit',
      welcomeBack: 'Welcome Back',
      joinUs: 'Join Us',
      voiceOfTamTam: 'The Voice of Tam Tam',
      forgotPasswordQuestion: 'Forgot Password?',
      forgotPasswordInstructions: 'Enter your email to receive a password reset link.',
      sendLink: 'SEND LINK',
      newUserRegistration: 'New user? Register',
      backToLogin: 'Back to Login',
      haveAccountLogin: 'Have an account? Login',
      loadingAuth: 'LOADING...',
      resetPasswordTitle: 'Reset your Password',
      newPasswordLabel: 'New Password (min. 6 chars)',
      confirmNewPasswordLabel: 'Confirm New Password',
      resetPasswordBtn: 'RESET PASSWORD',
      resetPasswordSuccessMessage: 'Password updated successfully! You can now log in.',
      passwordsDoNotMatch: 'The two passwords do not match.'
    },
    article: {
      author: 'Author',
      published: 'Published on',
      readMore: 'Read more',
      comments: 'Comments',
      likes: 'Likes',
      peopleAppreciated: 'people appreciated',
      commentCount: 'comments',
      like: 'Like',
      comment: 'Comment',
      share: 'Share',
      commentsTitle: 'Comments',
      leaveComment: 'Leave a comment...',
      publishComment: 'Publish Comment',
      loginToComment: 'Login to comment on this opinion.',
      noCommentsYet: 'No comments yet. Be the first!'
    },
    newArticle: {
      title: 'Title',
      summary: 'Summary',
      content: 'Content',
      imageUrl: 'Image or Video URL',
      category: 'Category',
      submit: 'Publish Opinion'
    },
    searchArticlesPlaceHolder: 'Search...'
  },
  fr: {
    homePage: 'Page d\'accueil',
    myContacts: 'Mes Contacts',
    viewAll: 'Voir tout',
    loading: 'Chargement en cours...',
    menu: 'Menu',
    changeLogo: 'Changer le Logo',
    privateMessages: 'Messages Privés',
    conversations: 'Conversations',
    secureCommunication: 'Communication sécurisée entre utilisateurs',
    noOpinionsFound: 'Aucune opinion trouvée.',
    backToTop: 'Retour en haut',
    shareStory: 'Partagez votre opinion avec le monde',
    close: 'Fermer',
    viewMode: 'Mode de vue',
    todayWeTalkAbout: 'Aujourd\'hui nous parlons de...',
    yourProfile: 'Votre Profil',
    messages: 'Messages',
    contacts: 'Contacts',
    newArticleBtn: 'Nouveau',
    logout: 'Déconnexion',
    searchUsers: 'Rechercher des utilisateurs',
    addContact: 'Ajouter un contact',
    pendingRequests: 'Demandes en attente',
    noResults: 'Aucun résultat',
    you: 'Vous',
    noMessages: 'Aucun message',
    categories: {
      'Opinioni': 'Opinions',
      'Fatti': 'Faits',
      'Tradizioni e eventi': 'Traditions et événements',
      'Cibi e bevande': 'Nourriture et boissons',
      'Sport': 'Sport',
      'Curiosità': 'Curiosités',
      'Risate': 'Rire',
      'Città e paesi': 'Villes et pays',
      'Canzoni': 'Chansons',
      'Politica': 'Politique',
      'Oggi parliamo di...': 'Aujourd\'hui nous parlons de...'
    },
    auth: {
      login: 'Connexion',
      register: 'S\'inscrire',
      verify: 'Vérifier',
      forgotPassword: 'Mot de passe oublié',
      email: 'Email',
      password: 'Mot de passe',
      firstName: 'Prénom',
      lastName: 'Nom',
      birthDate: 'Date de naissance',
      privacy: 'J\'accepte la politique de confidentialité',
      contract: 'J\'accepte le contrat éditorial',
      submit: 'Envoyer',
      welcomeBack: 'Bon retour',
      joinUs: 'Rejoignez-nous',
      voiceOfTamTam: 'La Voix du Tam Tam',
      forgotPasswordQuestion: 'Mot de passe oublié ?',
      forgotPasswordInstructions: 'Entrez votre email pour recevoir un lien de réinitialisation de mot de passe.',
      sendLink: 'ENVOYER LE LIEN',
      newUserRegistration: 'Nouvel utilisateur ? S\'inscrire',
      backToLogin: 'Retour à la connexion',
      haveAccountLogin: 'Vous avez déjà un compte ? Connexion',
      loadingAuth: 'CHARGEMENT...',
      resetPasswordTitle: 'Réinitialiser votre mot de passe',
      newPasswordLabel: 'Nouveau mot de passe (min. 6 car.)',
      confirmNewPasswordLabel: 'Confirmer le nouveau mot de passe',
      resetPasswordBtn: 'RÉINITIALISER LE MOT DE PASSE',
      resetPasswordSuccessMessage: 'Mot de passe mis à jour avec succès ! Vous pouvez maintenant vous connecter.',
      passwordsDoNotMatch: 'Les deux mots de passe ne correspondent pas.'
    },
    article: {
      author: 'Auteur',
      published: 'Publié le',
      readMore: 'Lire la suite',
      comments: 'Commentaires',
      likes: 'J\'aime',
      peopleAppreciated: 'personnes ont apprécié',
      commentCount: 'commentaires',
      like: 'J\'aime',
      comment: 'Commenter',
      share: 'Partager',
      commentsTitle: 'Commentaires',
      leaveComment: 'Laisser un commentaire...',
      publishComment: 'Publier un commentaire',
      loginToComment: 'Connectez-vous pour commenter cette opinion.',
      noCommentsYet: 'Aucun commentaire pour l\'instant. Soyez le premier !'
    },
    newArticle: {
      title: 'Titre',
      summary: 'Résumé',
      content: 'Contenu',
      imageUrl: 'URL Image ou Vidéo',
      category: 'Catégorie',
      submit: 'Publier l\'opinion'
    },
    searchArticlesPlaceHolder: 'Rechercher...'
  },
  es: {
    homePage: 'Página de inicio',
    myContacts: 'Mis Contactos',
    viewAll: 'Ver todo',
    loading: 'Cargando...',
    menu: 'Menú',
    changeLogo: 'Cambiar Logo',
    privateMessages: 'Mensajes Privados',
    conversations: 'Conversaciones',
    secureCommunication: 'Comunicación segura entre usuarios',
    noOpinionsFound: 'No se encontraron opiniones.',
    backToTop: 'Volver arriba',
    shareStory: 'Comparte tu opinión con el mundo',
    close: 'Cerrar',
    viewMode: 'Modo de vista',
    todayWeTalkAbout: 'Hoy hablamos de...',
    yourProfile: 'Tu Perfil',
    messages: 'Mensajes',
    contacts: 'Contactos',
    newArticleBtn: 'Nuevo',
    logout: 'Cerrar sesión',
    searchUsers: 'Buscar usuarios',
    addContact: 'Añadir contacto',
    pendingRequests: 'Solicitudes pendientes',
    noResults: 'Sin resultados',
    you: 'Tú',
    noMessages: 'Sin mensajes',
    categories: {
      'Opinioni': 'Opiniones',
      'Fatti': 'Hechos',
      'Tradizioni e eventi': 'Tradiciones y eventos',
      'Cibi e bevande': 'Comida y bebida',
      'Sport': 'Deporte',
      'Curiosità': 'Curiosidades',
      'Risate': 'Risas',
      'Città e paesi': 'Ciudades y países',
      'Canzoni': 'Canciones',
      'Politica': 'Política',
      'Oggi parliamo di...': 'Hoy hablamos de...'
    },
    auth: {
      login: 'Acceso',
      register: 'Registrarse',
      verify: 'Verificar',
      forgotPassword: 'Contraseña olvidada',
      email: 'Correo electrónico',
      password: 'Contraseña',
      firstName: 'Nombre',
      lastName: 'Apellido',
      birthDate: 'Fecha de nacimiento',
      privacy: 'Acepto la política de privacidad',
      contract: 'Acepto el contrato editorial',
      submit: 'Enviar',
      welcomeBack: 'Bienvenido de nuevo',
      joinUs: 'Únete a nosotros',
      voiceOfTamTam: 'La Voz del Tam Tam',
      forgotPasswordQuestion: '¿Olvidó su contraseña?',
      forgotPasswordInstructions: 'Ingrese su correo electrónico para recibir un enlace de restablecimiento de contraseña.',
      sendLink: 'ENVIAR ENLACE',
      newUserRegistration: '¿Nuevo usuario? Regístrese',
      backToLogin: 'Volver al inicio de sesión',
      haveAccountLogin: '¿Ya tiene una cuenta? Acceso',
      loadingAuth: 'CARGANDO...',
      resetPasswordTitle: 'Restablecer su contraseña',
      newPasswordLabel: 'Nueva contraseña (mín. 6 car.)',
      confirmNewPasswordLabel: 'Confirmar nueva contraseña',
      resetPasswordBtn: 'RESTABLECER CONTRASEÑA',
      resetPasswordSuccessMessage: '¡Contraseña actualizada con éxito! Ahora puede iniciar sesión.',
      passwordsDoNotMatch: 'Las dos contraseñas no coinciden.'
    },
    article: {
      author: 'Autor',
      published: 'Publicado el',
      readMore: 'Leer más',
      comments: 'Comentarios',
      likes: 'Me gusta',
      peopleAppreciated: 'personas han apreciado',
      commentCount: 'comentarios',
      like: 'Me gusta',
      comment: 'Comentar',
      share: 'Compartir',
      commentsTitle: 'Comentarios',
      leaveComment: 'Dejar un comentario...',
      publishComment: 'Publicar comentario',
      loginToComment: 'Inicia sesión para comentar esta opinión.',
      noCommentsYet: 'Sin comentarios aún. ¡Sé el primero!'
    },
    newArticle: {
      title: 'Título',
      summary: 'Resumen',
      content: 'Contenido',
      imageUrl: 'URL del video o imagen',
      category: 'Categoría',
      submit: 'Publicar opinión'
    },
    searchArticlesPlaceHolder: 'Buscar...'
  },
};
