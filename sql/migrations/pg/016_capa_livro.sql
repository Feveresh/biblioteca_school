-- Capa do livro (opcional) — mesmo padrão do logo da biblioteca em Configurações: imagem em
-- base64 direto na coluna, sem servidor de arquivos separado (acervo pequeno, sem necessidade
-- de servir estático/CDN à parte).
ALTER TABLE livros ADD COLUMN IF NOT EXISTS capa_data_url TEXT;
