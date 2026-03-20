
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
  firstName?: string;
  lastName?: string;
  birthDate?: string;
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
  likes?: number;
  likedBy?: string[];
}

export enum ContattoStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED'
}

export interface Contatto {
  id: string;
  senderId: string;
  receiverId: string;
  status: ContattoStatus;
  createdAt: number;
  updatedAt: number;
  // Extended info for UI
  senderName?: string;
  senderAvatar?: string;
  receiverName?: string;
  receiverAvatar?: string;
}

export type Category = 
  | 'Opinioni' 
  | 'Fatti' 
  | 'Tradizioni e eventi' 
  | 'Cibi e bevande'
  | 'Sport'
  | 'Curiosità' 
  | 'Risate' 
  | 'Città e paesi' 
  | 'Oggi parliamo di...';
