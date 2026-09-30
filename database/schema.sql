-- Selecione o banco indicado em DB_NAME antes de importar este arquivo.
-- Este script não apaga bancos nem tabelas existentes.
CREATE TABLE IF NOT EXISTS clientes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome_empresa VARCHAR(255) NOT NULL,
    telefone VARCHAR(30) NULL,
    nicho VARCHAR(120) NULL,
    cidade VARCHAR(120) NULL,
    estado CHAR(2) NULL,
    instagram VARCHAR(255) NULL,
    possui_site TINYINT(1) NULL DEFAULT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'nao_contatado',
    ultima_data_contato DATETIME NULL,
    proximo_contato_em DATETIME NULL,
    proxima_acao VARCHAR(1000) NULL,
    observacoes TEXT NULL,
    gancho_verificado TEXT NULL,
    nao_contatar TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clientes_proximo_contato (proximo_contato_em),
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prospeccoes (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    cliente_id INT UNSIGNED NOT NULL,
    canal VARCHAR(20) NOT NULL DEFAULT 'whatsapp',
    estrategia VARCHAR(30) NOT NULL,
    variant_id VARCHAR(80) NULL,
    mensagem TEXT NOT NULL,
    data_contato DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resultado VARCHAR(30) NOT NULL DEFAULT 'aguardando_resposta',
    data_resposta DATETIME NULL,
    PRIMARY KEY (id),
    INDEX idx_prospeccoes_cliente_data (cliente_id, data_contato, id),
    INDEX idx_prospeccoes_estrategia_variante (estrategia, variant_id),
    CONSTRAINT fk_prospeccoes_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
