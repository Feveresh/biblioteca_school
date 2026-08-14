-- A URL do servidor de verificação de atualização passa a viver só no .env (arquivo
-- protegido) — não deve ser um dado editável pela interface web nem guardado no banco.
ALTER TABLE configuracoes DROP COLUMN IF EXISTS url_verificacao_atualizacao;
