CREATE TABLE generos (
  id    SERIAL PRIMARY KEY,
  nome  VARCHAR(60) UNIQUE NOT NULL
);

INSERT INTO generos (nome) VALUES
  ('Aventura'), ('Biografia'), ('Clássico'), ('Comédia'), ('Didático'),
  ('Drama'), ('Fantasia'), ('Ficção Científica'), ('História'), ('Infantil'),
  ('Poesia'), ('Romance'), ('Suspense'), ('Terror'), ('Outro')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE livros ADD COLUMN IF NOT EXISTS genero_id INT REFERENCES generos(id);
