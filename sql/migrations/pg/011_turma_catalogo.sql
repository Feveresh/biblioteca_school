-- Mesmo padrão do gênero de livro: catálogo em tabela própria + FK, em vez de texto livre.
CREATE TABLE turmas (
  id   SERIAL PRIMARY KEY,
  nome VARCHAR(50) UNIQUE NOT NULL
);

-- popula o catálogo com os valores já usados pelos alunos existentes
INSERT INTO turmas (nome)
SELECT DISTINCT turma FROM alunos WHERE turma IS NOT NULL AND turma <> ''
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE alunos ADD COLUMN turma_id INT REFERENCES turmas(id);

-- migra cada aluno pro id correspondente da turma que ele já tinha em texto
UPDATE alunos a SET turma_id = t.id
FROM turmas t
WHERE a.turma = t.nome;

ALTER TABLE alunos DROP COLUMN turma;
