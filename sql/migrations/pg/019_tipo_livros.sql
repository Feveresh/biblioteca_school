CREATE TABLE tipos (
  id    SERIAL PRIMARY KEY,
  nome  VARCHAR(60) UNIQUE NOT NULL
);

INSERT INTO tipos (nome) VALUES
  ('Livro'), ('HQ'), ('Mangá'), ('Revista')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE livros ADD COLUMN IF NOT EXISTS tipo_id INT REFERENCES tipos(id);

-- Itens já cadastrados são, por padrão, do tipo "Livro".
UPDATE livros SET tipo_id = (SELECT id FROM tipos WHERE nome = 'Livro') WHERE tipo_id IS NULL;
