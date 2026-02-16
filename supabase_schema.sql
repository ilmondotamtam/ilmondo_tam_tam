
-- Estensione per UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabella Utenti (Profilo pubblico esteso) - SCOLLEGATA da auth.users
CREATE TABLE IF NOT EXISTS utenti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    birth_date DATE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'READER',
    avatar TEXT,
    is_verified BOOLEAN DEFAULT false, -- Nuova colonna per verifica mail
    verification_code TEXT,            -- Nuova colonna per codice di verifica
    last_login TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella Articoli
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_id UUID REFERENCES utenti(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella Commenti
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    user_id UUID REFERENCES utenti(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabella Testata
CREATE TABLE IF NOT EXISTS testata (
    id TEXT PRIMARY KEY,
    imma_testata TEXT NOT NULL
);

-- Inserimento record iniziale per la testata
INSERT INTO testata (id, imma_testata) 
VALUES ('header_image', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop')
ON CONFLICT (id) DO NOTHING;
