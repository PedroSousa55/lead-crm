-- Migração aditiva para bancos das etapas anteriores. Selecione DB_NAME.
-- Para reaplicar com segurança, use npm run migrate:prospeccao (verifica colunas existentes).
ALTER TABLE clientes ADD COLUMN gancho_verificado TEXT NULL;
ALTER TABLE clientes ADD COLUMN nao_contatar TINYINT(1) NOT NULL DEFAULT 0;

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
