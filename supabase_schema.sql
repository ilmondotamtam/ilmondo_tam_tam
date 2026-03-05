
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
    privacy_accepted BOOLEAN DEFAULT FALSE,
    contract_accepted BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Abilita RLS (Row Level Security) per sicurezza su utenti
ALTER TABLE public.utenti ENABLE ROW LEVEL SECURITY;

-- 4. Politiche di accesso utenti
CREATE POLICY "Profili pubblici visibili a tutti" ON public.utenti FOR SELECT USING (true);
CREATE POLICY "Utenti possono aggiornare il proprio profilo" ON public.utenti FOR UPDATE USING (auth.uid() = id);

-- 5. FUNZIONE TRIGGER: Questa funzione crea il profilo automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.utenti (
    id, username, first_name, last_name, birth_date, email, avatar, 
    privacy_accepted, contract_accepted
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    (new.raw_user_meta_data->>'birth_date')::date,
    new.email,
    'https://api.dicebear.com/7.x/miniavs/svg?seed=' || COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE((new.raw_user_meta_data->>'privacy_accepted')::boolean, FALSE),
    COALESCE((new.raw_user_meta_data->>'contract_accepted')::boolean, FALSE)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. TRIGGER: Esegue la funzione sopra dopo ogni registrazione in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 7. Tabella Articoli
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

-- RLS per Articoli
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Articoli visibili a tutti" ON public.articles FOR SELECT USING (true);

CREATE POLICY "Autori possono inserire articoli" ON public.articles FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.utenti
    WHERE utenti.id = auth.uid() 
    AND (utenti.role = 'AUTHOR' OR utenti.role = 'ADMIN')
  )
);

CREATE POLICY "Autori possono gestire i propri articoli" ON public.articles FOR ALL USING (
  auth.uid() = author_id OR 
  EXISTS (SELECT 1 FROM public.utenti WHERE utenti.id = auth.uid() AND utenti.role = 'ADMIN')
);

-- 8. Tabella Commenti
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    user_id UUID REFERENCES public.utenti(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS per Commenti
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commenti visibili a tutti" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Utenti autenticati possono commentare" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Utenti possono eliminare i propri commenti" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- 9. Tabella Testata
CREATE TABLE IF NOT EXISTS public.testata (
    id TEXT PRIMARY KEY,
    imma_testata TEXT NOT NULL
);

INSERT INTO public.testata (id, imma_testata) 
VALUES ('header_image', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop')
ON CONFLICT (id) DO NOTHING;

-- 10. Tabella Apprezzamenti (Likes)
CREATE TABLE IF NOT EXISTS public.apprezzamenti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.utenti(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(article_id, user_id)
);

-- RLS per Apprezzamenti
ALTER TABLE public.apprezzamenti ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Apprezzamenti visibili a tutti" ON public.apprezzamenti FOR SELECT USING (true);
CREATE POLICY "Utenti possono mettere mi piace" ON public.apprezzamenti FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Utenti possono togliere mi piace" ON public.apprezzamenti FOR DELETE USING (auth.uid() = user_id);

-- 11. Funzioni per incrementare/decrementare i likes
CREATE OR REPLACE FUNCTION increment_likes(row_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.articles
  SET likes = COALESCE(likes, 0) + 1
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_likes(row_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.articles
  SET likes = GREATEST(0, COALESCE(likes, 0) - 1)
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
