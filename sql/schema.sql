-- Snapshot cumulativo do schema (estado após todas as migrations em sql/migrations/).
-- Instalação NOVA: rode este arquivo direto.
-- Banco JÁ EXISTENTE (com dados): NÃO rode este arquivo — use `npm run migrate`,
-- que aplica só as migrations pendentes.

-- ===== Permissões e papéis =====
CREATE TABLE permissoes (
  codigo      VARCHAR(60) PRIMARY KEY,
  categoria   VARCHAR(30) NOT NULL,
  descricao   VARCHAR(150) NOT NULL
);

CREATE TABLE roles (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(60) UNIQUE NOT NULL,
  descricao     VARCHAR(255),
  acesso_total  BOOLEAN NOT NULL DEFAULT FALSE,
  sistema       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE role_permissoes (
  role_id           INT REFERENCES roles(id) ON DELETE CASCADE,
  permissao_codigo  VARCHAR(60) REFERENCES permissoes(codigo) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permissao_codigo)
);

INSERT INTO permissoes (codigo, categoria, descricao) VALUES
  ('livros.criar',           'livros',         'Cadastrar livros'),
  ('livros.editar',          'livros',         'Editar livros'),
  ('livros.excluir',         'livros',         'Excluir livros'),
  ('alunos.criar',           'alunos',         'Cadastrar alunos'),
  ('alunos.editar',          'alunos',         'Editar alunos'),
  ('alunos.excluir',         'alunos',         'Excluir alunos'),
  ('emprestimos.criar',      'emprestimos',    'Registrar empréstimos'),
  ('emprestimos.devolver',   'emprestimos',    'Registrar devoluções'),
  ('usuarios.gerenciar',     'administracao',  'Gerenciar usuários do sistema'),
  ('papeis.gerenciar',       'administracao',  'Gerenciar papéis e permissões'),
  ('configuracoes.gerenciar','administracao',  'Alterar configurações da biblioteca'),
  ('auditoria.ver',          'administracao',  'Consultar o log de auditoria');

INSERT INTO roles (nome, descricao, acesso_total, sistema) VALUES
  ('Admin', 'Acesso total ao sistema', TRUE, TRUE),
  ('Bibliotecário', 'Operação do dia a dia: livros, alunos e empréstimos', FALSE, TRUE);

INSERT INTO role_permissoes (role_id, permissao_codigo)
SELECT (SELECT id FROM roles WHERE nome = 'Bibliotecário'), codigo
FROM permissoes
WHERE codigo IN (
  'livros.criar', 'livros.editar', 'livros.excluir',
  'alunos.criar', 'alunos.editar', 'alunos.excluir',
  'emprestimos.criar', 'emprestimos.devolver'
);

-- ===== Usuários (acesso ao sistema) =====
CREATE TABLE users (
  id                    SERIAL PRIMARY KEY,
  nome                  VARCHAR(150) NOT NULL,
  email                 VARCHAR(150) UNIQUE NOT NULL,
  senha_hash            VARCHAR(100) NOT NULL,
  role_id               INT NOT NULL REFERENCES roles(id),
  ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
  tokens_validos_apos   TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMP DEFAULT NOW()
);

-- ===== Livros =====
CREATE TABLE livros (
  id          SERIAL PRIMARY KEY,
  tombo       VARCHAR(20) UNIQUE NOT NULL,  -- número do carimbo
  titulo      VARCHAR(200) NOT NULL,
  autor       VARCHAR(150),
  estante     VARCHAR(30),
  prateleira  VARCHAR(30),
  disponivel  BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- ===== Alunos =====
CREATE TABLE alunos (
  id        SERIAL PRIMARY KEY,
  nome      VARCHAR(150) NOT NULL,
  turma     VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ===== Empréstimos (digitaliza o caderno original) =====
CREATE TABLE emprestimos (
  id               SERIAL PRIMARY KEY,
  livro_id         INT REFERENCES livros(id),
  aluno_id         INT REFERENCES alunos(id),
  data_emprestimo  DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista    DATE NOT NULL,             -- data de devolução prevista
  data_devolucao   DATE,                      -- preenchida ao devolver
  status           VARCHAR(20) DEFAULT 'pendente'  -- pendente | devolvido | atrasado
);

-- ===== Configurações (linha única) =====
CREATE TABLE configuracoes (
  id                        SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome_biblioteca           VARCHAR(150) NOT NULL DEFAULT 'Biblioteca Escolar',
  cor_primaria              VARCHAR(7)  NOT NULL DEFAULT '#4f46e5',
  logo_data_url             TEXT,
  dias_emprestimo_padrao    SMALLINT NOT NULL DEFAULT 7 CHECK (dias_emprestimo_padrao > 0),
  limite_livros_por_aluno   SMALLINT CHECK (limite_livros_por_aluno IS NULL OR limite_livros_por_aluno > 0),
  login_max_tentativas      SMALLINT NOT NULL DEFAULT 5,
  login_bloqueio_minutos    SMALLINT NOT NULL DEFAULT 15,
  auditoria_retencao_dias   INT NOT NULL DEFAULT 365,
  auditoria_ultima_limpeza  TIMESTAMP,
  atualizado_em             TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_por            INT REFERENCES users(id)
);
INSERT INTO configuracoes (id) VALUES (1);

-- ===== Tentativas de login (rate limiting) =====
CREATE TABLE login_tentativas (
  id          BIGSERIAL PRIMARY KEY,
  email       VARCHAR(150) NOT NULL,
  sucesso     BOOLEAN NOT NULL,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_login_tentativas_email_data ON login_tentativas (email, criado_em);

-- ===== Log de auditoria =====
CREATE TABLE log_auditoria (
  id            BIGSERIAL PRIMARY KEY,
  usuario_id    INT REFERENCES users(id) ON DELETE SET NULL,
  entidade      VARCHAR(50) NOT NULL,
  entidade_id   INT,
  acao          VARCHAR(30) NOT NULL,
  dados_antes   JSONB,
  dados_depois  JSONB,
  ip            VARCHAR(45),
  metodo_http   VARCHAR(10),
  rota          VARCHAR(255),
  criado_em     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_auditoria_entidade ON log_auditoria (entidade, entidade_id);
CREATE INDEX idx_auditoria_usuario ON log_auditoria (usuario_id);
CREATE INDEX idx_auditoria_criado_em_brin ON log_auditoria USING BRIN (criado_em);

-- ===== Controle de migrations =====
-- Marca as migrations já embutidas neste snapshot como aplicadas, para que
-- `npm run migrate` não tente reaplicá-las num banco criado a partir deste arquivo.
CREATE TABLE schema_migrations (
  nome        VARCHAR(255) PRIMARY KEY,
  aplicado_em TIMESTAMP NOT NULL DEFAULT NOW()
);
INSERT INTO schema_migrations (nome) VALUES
  ('001_permissoes_e_papeis.sql'),
  ('002_users_papel_e_seguranca.sql'),
  ('003_livros_localizacao.sql'),
  ('004_configuracoes.sql'),
  ('005_login_tentativas.sql'),
  ('006_log_auditoria.sql');
