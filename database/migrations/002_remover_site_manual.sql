-- OPCIONAL, MANUAL: execute somente após aprovação e backup dos dados antigos.
-- Este arquivo NÃO é executado pela aplicação nem por migrate:site.
-- A aplicação funciona com ou sem a coluna site; possui_site permanece intacta.
-- Selecione o banco correto antes de executar. Não repita se a coluna já foi removida.
ALTER TABLE clientes DROP COLUMN site;
