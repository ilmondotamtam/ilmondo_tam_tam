
-- 1. Estensioni necessarie
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabella Utenti (Profilo pubblico)
CREATE TABLE IF NOT EXISTS public.utenti (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    first_name TEXT,
    last_name TEXT,
    birth_date DATE,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'READER',
    avatar TEXT,
    last_login TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Abilita RLS (Row Level Security) per sicurezza
ALTER TABLE public.utenti ENABLE ROW LEVEL SECURITY;

-- 4. Politiche di accesso (Tutti possono leggere i profili, solo l'utente può modificare il suo)
CREATE POLICY "Profili pubblici visibili a tutti" ON public.utenti FOR SELECT USING (true);
CREATE POLICY "Utenti possono aggiornare il proprio profilo" ON public.utenti FOR UPDATE USING (auth.uid() = id);

-- 5. FUNZIONE TRIGGER: Questa funzione crea il profilo automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.utenti (id, username, first_name, last_name, birth_date, email, avatar)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    (new.raw_user_meta_data->>'birth_date')::date,
    new.email,
    'https://api.dicebear.com/7.x/miniavs/svg?seed=' || COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. TRIGGER: Esegue la funzione sopra dopo ogni registrazione in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Tabella Articoli (se non esiste)
CREATE TABLE IF NOT EXISTS public.articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    author_name TEXT NOT NULL,
    author_id UUID REFERENCES public.utenti(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    likes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Tabella Commenti (se non esiste)
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    user_id UUID REFERENCES public.utenti(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Tabella Testata (se non esiste)
CREATE TABLE IF NOT EXISTS public.testata (
    id TEXT PRIMARY KEY,
    imma_testata TEXT NOT NULL
);

INSERT INTO public.testata (id, imma_testata) 
VALUES ('header_image', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop')
ON CONFLICT (id) DO NOTHING;
