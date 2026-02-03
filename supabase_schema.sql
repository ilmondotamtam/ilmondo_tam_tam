
-- Estensione per UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabella Utenti
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL,
    avatar TEXT,
    last_login TIMESTAMPTZ DEFAULT now()
);

-- Tabella Articoli
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella Commenti
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella Testata (Sostituisce settings)
CREATE TABLE IF NOT EXISTS testata (
    id TEXT PRIMARY KEY,
    imma_testata TEXT NOT NULL -- Immagine in formato Base64
);

-- Inserimento record iniziale per la testata
INSERT INTO testata (id, imma_testata) 
VALUES ('header_image', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop')
ON CONFLICT (id) DO NOTHING;
