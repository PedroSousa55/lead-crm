-- Migração aditiva. Para reaplicação segura use npm run migrate:pipeline.
ALTER TABLE clientes ADD COLUMN proximo_contato_em DATETIME NULL;
ALTER TABLE clientes ADD COLUMN proxima_acao VARCHAR(1000) NULL;
CREATE INDEX idx_clientes_proximo_contato ON clientes (proximo_contato_em);
