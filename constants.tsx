
import { Article, UserRole, Category } from './types';

export const CATEGORIES: Category[] = [
  'Politica', 'Economia', 'Tecnologia', 'Cultura', 'Sport', 'Cronaca'
];

export const INITIAL_ARTICLES: Article[] = [
  {
    id: '1',
    title: 'L\'intelligenza Artificiale e il Futuro dell\'Informazione',
    summary: 'Come i modelli linguistici stanno cambiando il modo in cui consumiamo le notizie.',
    content: 'Negli ultimi anni, l\'avvento dell\'IA ha trasformato radicalmente il giornalismo. Dalla redazione automatizzata alla personalizzazione estrema dei feed, le sfide etiche sono molteplici...',
    authorId: 'auth1',
    authorName: 'Mario Rossi',
    category: 'Tecnologia',
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
    title: 'Nuove Misure Economiche in Arrivo',
    summary: 'Il governo annuncia un pacchetto di incentivi per le piccole imprese locali.',
    content: 'Una manovra da diversi miliardi per sostenere il tessuto produttivo italiano in un momento di transizione energetica...',
    authorId: 'auth2',
    authorName: 'Giulia Bianchi',
    category: 'Economia',
    imageUrl: 'https://picsum.photos/800/450?random=2',
    timestamp: Date.now() - 172800000,
    comments: []
  }
];
