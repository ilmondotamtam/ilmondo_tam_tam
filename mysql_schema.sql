-- ==========================================================
-- SCHEMA DATABASE MYSQL PER ARUBA BUSINESS
-- IL MONDO TAM TAM
-- Compatibile con MySQL 5.7+ / 8.0+ / MariaDB 10.3+
-- Charset: utf8mb4 / Collation: utf8mb4_unicode_ci
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------
-- 1. TABELLA UTENTI (Profili e Autenticazione)
-- Nuova gestione password con hash compatibili (bcrypt / PHP password_hash)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `utenti` (
  `id` VARCHAR(36) NOT NULL,
  `username` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) DEFAULT NULL,
  `last_name` VARCHAR(100) DEFAULT NULL,
  `birth_date` DATE DEFAULT NULL,
  `role` ENUM('ADMIN', 'AUTHOR', 'READER', 'GESTOR') NOT NULL DEFAULT 'AUTHOR',
  `avatar` TEXT DEFAULT NULL,
  `city` VARCHAR(100) DEFAULT NULL,
  `mobile` VARCHAR(50) DEFAULT NULL,
  `job` VARCHAR(100) DEFAULT NULL,
  `bio` TEXT DEFAULT NULL,
  `privacy_accepted` TINYINT(1) NOT NULL DEFAULT 0,
  `contract_accepted` TINYINT(1) NOT NULL DEFAULT 0,
  `last_login` DATETIME DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_utenti_username` (`username`),
  UNIQUE KEY `idx_utenti_email` (`email`),
  KEY `idx_utenti_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 2. TABELLA ARTICOLI
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `articles` (
  `id` VARCHAR(36) NOT NULL,
  `title` VARCHAR(500) NOT NULL,
  `summary` TEXT DEFAULT NULL,
  `content` MEDIUMTEXT NOT NULL,
  `author_id` VARCHAR(36) DEFAULT NULL,
  `author_name` VARCHAR(255) NOT NULL,
  `category` VARCHAR(100) NOT NULL,
  `image_url` TEXT DEFAULT NULL,
  `likes` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_articles_author_id` (`author_id`),
  KEY `idx_articles_category` (`category`),
  KEY `idx_articles_created_at` (`created_at`),
  CONSTRAINT `fk_articles_author` FOREIGN KEY (`author_id`) REFERENCES `utenti` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 3. TABELLA COMMENTI
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `comments` (
  `id` VARCHAR(36) NOT NULL,
  `article_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) DEFAULT NULL,
  `username` VARCHAR(255) NOT NULL,
  `content` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_comments_article_id` (`article_id`),
  KEY `idx_comments_user_id` (`user_id`),
  KEY `idx_comments_created_at` (`created_at`),
  CONSTRAINT `fk_comments_article` FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_comments_user` FOREIGN KEY (`user_id`) REFERENCES `utenti` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 4. TABELLA APPREZZAMENTI (Likes)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `apprezzamenti` (
  `id` VARCHAR(36) NOT NULL,
  `article_id` VARCHAR(36) NOT NULL,
  `user_id` VARCHAR(36) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_like_unique` (`article_id`, `user_id`),
  KEY `idx_apprezzamenti_user_id` (`user_id`),
  CONSTRAINT `fk_apprezzamenti_article` FOREIGN KEY (`article_id`) REFERENCES `articles` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_apprezzamenti_user` FOREIGN KEY (`user_id`) REFERENCES `utenti` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 5. TABELLA TESTATA (Logo e Banner)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `testata` (
  `id` VARCHAR(50) NOT NULL,
  `imma_testata` TEXT NOT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 6. TABELLA CONTATTI (Relazioni / Amicizie tra Autori)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `contatti` (
  `id` VARCHAR(36) NOT NULL,
  `sender_id` VARCHAR(36) NOT NULL,
  `receiver_id` VARCHAR(36) NOT NULL,
  `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_contatto_unique` (`sender_id`, `receiver_id`),
  KEY `idx_contatti_receiver_id` (`receiver_id`),
  KEY `idx_contatti_status` (`status`),
  CONSTRAINT `fk_contatti_sender` FOREIGN KEY (`sender_id`) REFERENCES `utenti` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_contatti_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `utenti` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 7. TABELLA MESSAGGI (Chat Privata tra Autori)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `messaggi` (
  `id` VARCHAR(36) NOT NULL,
  `sender_id` VARCHAR(36) NOT NULL,
  `receiver_id` VARCHAR(36) NOT NULL,
  `content` TEXT NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_messaggi_sender` (`sender_id`),
  KEY `idx_messaggi_receiver` (`receiver_id`),
  KEY `idx_messaggi_is_read` (`is_read`),
  KEY `idx_messaggi_created_at` (`created_at`),
  CONSTRAINT `fk_messaggi_sender` FOREIGN KEY (`sender_id`) REFERENCES `utenti` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_messaggi_receiver` FOREIGN KEY (`receiver_id`) REFERENCES `utenti` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 8. TABELLA PASSWORD RESETS (Recupero Password Sicuro)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `token_hash` VARCHAR(255) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `used` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_resets_email` (`email`),
  KEY `idx_resets_token_hash` (`token_hash`),
  KEY `idx_resets_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 9. DATI INIZIALI
-- ----------------------------------------------------------
INSERT INTO `testata` (`id`, `imma_testata`)
VALUES ('header_image', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2070&auto=format&fit=crop')
ON DUPLICATE KEY UPDATE `imma_testata` = VALUES(`imma_testata`);

SET FOREIGN_KEY_CHECKS = 1;
