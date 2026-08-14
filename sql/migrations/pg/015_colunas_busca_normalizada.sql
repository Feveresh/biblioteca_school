-- Colunas-sombra pra busca sem distinguir maiúscula/acento, iguais nos dois motores de
-- banco (a aplicação usa uma função JS pura pra normalizar, sem depender da extensão
-- unaccent do Postgres, nem sempre disponível). Aqui só criamos as colunas; a partir de
-- agora toda criação/edição grava o valor certo (com acento removido) via aplicação.
--
-- Backfill dos registros já existentes: só minúsculas (sem remover acento) — mais fraco que
-- o valor que a aplicação vai gravar dali pra frente, mas não exige nenhuma extensão do
-- Postgres. Editar um registro antigo (mesmo sem mudar nada) já recalcula o valor completo.
ALTER TABLE livros ADD COLUMN IF NOT EXISTS titulo_busca VARCHAR(200);
ALTER TABLE livros ADD COLUMN IF NOT EXISTS autor_busca VARCHAR(150);
ALTER TABLE alunos ADD COLUMN IF NOT EXISTS nome_busca VARCHAR(150);

UPDATE livros SET
  titulo_busca = lower(titulo),
  autor_busca = lower(autor)
WHERE titulo_busca IS NULL;

UPDATE alunos SET nome_busca = lower(nome) WHERE nome_busca IS NULL;
