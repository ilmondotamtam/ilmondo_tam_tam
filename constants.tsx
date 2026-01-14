
import { Article, Category } from './types';

export const CATEGORIES: Category[] = [
  'Opinioni', 'Tradizioni', 'Eventi', 'Fatti'
];

export const INITIAL_ARTICLES: Article[] = [
  {
    id: '1',
    title: 'L\'intelligenza Artificiale e il Futuro dell\'Informazione',
    summary: 'Come i modelli linguistici stanno cambiando il modo in cui consumiamo le notizie.',
    content: 'Negli ultimi anni, l\'avvento dell\'IA ha trasformato radicalmente il giornalismo. Dalla redazione automatizzata alla personalizzazione estrema dei feed, le sfide etiche sono molteplici...',
    authorId: 'auth1',
    authorName: 'Mario Rossi',
    category: 'Opinioni',
    imageUrl: 'https://picsum.photos/800/450?random=1',
    timestamp: Date.now() - 86400000,
    comments: [
      {
        id: 'c1',
        articleId: '1',
        userId: 'u1',
        username: 'Gianni',
        content: 'Articolo molto interessante, spero che l\'etica rimanga al centro.',
        timestamp: Date.now() - 3600000
      }
    ]
  },
  {
    id: '2',
    title: 'Le antiche feste del Tam Tam',
    summary: 'Un viaggio nelle radici culturali che uniscono il pianeta attraverso il ritmo.',
    content: 'Le tradizioni popolari non sono solo folklore, ma il battito vitale di comunità che resistono all\'omologazione globale...',
    authorId: 'auth2',
    authorName: 'Giulia Bianchi',
    category: 'Tradizioni',
    imageUrl: 'https://picsum.photos/800/450?random=2',
    timestamp: Date.now() - 172800000,
    comments: []
  },
  {
    id: '3',
    title: 'Festival del Cinema Internazionale',
    summary: 'Le date e gli eventi principali della prossima kermesse cinematografica.',
    content: 'Tutto pronto per l\'evento dell\'anno che vedrà protagonisti i migliori registi indipendenti...',
    authorId: 'auth1',
    authorName: 'Mario Rossi',
    category: 'Eventi',
    imageUrl: 'https://picsum.photos/800/450?random=3',
    timestamp: Date.now() - 50000000,
    comments: []
  },
  {
    id: '4',
    title: 'Rapporto sulla Sostenibilità Urbana',
    summary: 'I fatti concreti dietro le politiche green delle grandi metropoli.',
    content: 'Dati alla mano, ecco come stanno cambiando i trasporti e la gestione dei rifiuti nelle zone urbane più avanzate...',
    authorId: 'auth2',
    authorName: 'Giulia Bianchi',
    category: 'Fatti',
    imageUrl: 'https://picsum.photos/800/450?random=4',
    timestamp: Date.now() - 25000000,
    comments: []
  }
];
