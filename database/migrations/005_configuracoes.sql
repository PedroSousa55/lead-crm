-- Aditiva e repetível. Não modifica clientes nem prospeccoes.
CREATE TABLE IF NOT EXISTS configuracoes (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 nome_remetente VARCHAR(100) NOT NULL,
 profissao_remetente VARCHAR(100) NOT NULL,
 demo_academia_disponivel TINYINT(1) NOT NULL DEFAULT 0,
 demo_academia_url VARCHAR(2048) NOT NULL DEFAULT '',
 demo_clinica_disponivel TINYINT(1) NOT NULL DEFAULT 0,
 demo_clinica_url VARCHAR(2048) NOT NULL DEFAULT '',
 demo_estetica_disponivel TINYINT(1) NOT NULL DEFAULT 0,
 demo_estetica_url VARCHAR(2048) NOT NULL DEFAULT '',
 leads_por_pagina SMALLINT UNSIGNED NOT NULL DEFAULT 25,
 tela_inicial VARCHAR(20) NOT NULL DEFAULT 'dashboard',
 atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT chk_configuracoes_unica CHECK (id=1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO configuracoes (id,nome_remetente,profissao_remetente)
SELECT 1,'Pedro Henrique','desenvolvedor web' WHERE NOT EXISTS (SELECT 1 FROM configuracoes WHERE id=1);
