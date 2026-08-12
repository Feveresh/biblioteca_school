-- Tabela de usuários (acesso ao sistema)
CREATE TABLE users (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(150) NOT NULL,
  email       VARCHAR(150) UNIQUE NOT NULL,
  senha_hash  VARCHAR(100) NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Tabela de livros
CREATE TABLE livros (
  id          SERIAL PRIMARY KEY,
  tombo       VARCHAR(20) UNIQUE NOT NULL,  -- número do carimbo
  titulo      VARCHAR(200) NOT NULL,
  autor       VARCHAR(150),
  disponivel  BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Tabela de alunos
CREATE TABLE alunos (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(150) NOT NULL,
  turma     VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de empréstimos (digitaliza o caderno atual)
CREATE TABLE emprestimos (
  id               SERIAL PRIMARY KEY,
  livro_id         INT REFERENCES livros(id),
  aluno_id         INT REFERENCES alunos(id),
  data_emprestimo  DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista    DATE NOT NULL,             -- data de devolução prevista
  data_devolucao   DATE,                      -- preenchida ao devolver
  status           VARCHAR(20) DEFAULT 'pendente'  -- pendente | devolvido | atrasado
);