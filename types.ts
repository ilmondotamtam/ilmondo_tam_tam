
export enum UserRole {
  ADMIN = 'ADMIN',
  AUTHOR = 'AUTHOR',
  READER = 'READER'
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  avatar: string;
}

export interface Comment {
  id: string;
  articleId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: number;
}

export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  authorId: string;
  authorName: string;
  category: Category;
  imageUrl: string;
  timestamp: number;
  comments: Comment[];
  likes?: number; // Nuovo campo per funzionalità social
}

export type Category = 
  | 'Opinioni' 
  | 'Fatti' 
  | 'Tradizioni e eventi' 
  | 'Curiosità' 
  | 'Città' 
  | 'Foto e video' 
  | 'Oggi parliamo di...';
