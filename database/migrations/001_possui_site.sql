-- Execute uma única vez no banco existente, antes de iniciar a API atualizada.
-- Não modifica nem apaga os valores antigos de site ou outros campos.
ALTER TABLE clientes ADD COLUMN possui_site TINYINT(1) NULL DEFAULT NULL AFTER instagram;
