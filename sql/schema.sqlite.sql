-- Snapshot cumulativo do schema para SQLite (equivalente ao sql/schema.sql do Postgres).
-- SQLite é sempre instalação nova a partir deste arquivo único — não existe histórico de
-- migrations antigas pra recriar no motor SQLite (ele só passou a existir a partir daqui).
-- Diferenças do arquivo Postgres: SERIAL/BIGSERIAL -> INTEGER PRIMARY KEY AUTOINCREMENT,
-- NOW() -> CURRENT_TIMESTAMP, JSONB -> TEXT, sem "USING BRIN" (SQLite não tem métodos de
-- índice). BOOLEAN/VARCHAR(n)/CHECK/REFERENCES funcionam com a mesma sintaxe nos dois.

-- ===== Permissões e papéis =====
CREATE TABLE permissoes (
  codigo      VARCHAR(60) PRIMARY KEY,
  categoria   VARCHAR(30) NOT NULL,
  descricao   VARCHAR(150) NOT NULL
);

CREATE TABLE roles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          VARCHAR(60) UNIQUE NOT NULL,
  descricao     VARCHAR(255),
  acesso_total  BOOLEAN NOT NULL DEFAULT FALSE,
  sistema       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  ('emprestimos.renovar',    'emprestimos',    'Renovar empréstimos'),
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
  'emprestimos.criar', 'emprestimos.devolver', 'emprestimos.renovar'
);

-- ===== Usuários (acesso ao sistema) =====
CREATE TABLE users (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                  VARCHAR(150) NOT NULL,
  email                 VARCHAR(150) UNIQUE NOT NULL,
  senha_hash            VARCHAR(100) NOT NULL,
  role_id               INT NOT NULL REFERENCES roles(id),
  ativo                 BOOLEAN NOT NULL DEFAULT TRUE,
  tokens_validos_apos   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== Gêneros (catálogo fixo, com opção de adicionar novos pela tela de livros) =====
CREATE TABLE generos (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  VARCHAR(60) UNIQUE NOT NULL,
  cor   VARCHAR(7)
);
INSERT INTO generos (nome) VALUES
  ('Aventura'), ('Biografia'), ('Clássico'), ('Comédia'), ('Didático'),
  ('Drama'), ('Fantasia'), ('Ficção Científica'), ('História'), ('Infantil'),
  ('Poesia'), ('Romance'), ('Suspense'), ('Terror'), ('Outro');

-- ===== Tipos de item (Livro, HQ, Mangá, Revista...) =====
CREATE TABLE tipos (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  VARCHAR(60) UNIQUE NOT NULL
);
INSERT INTO tipos (nome) VALUES
  ('Livro'), ('HQ'), ('Mangá'), ('Revista');

-- ===== Livros (acervo — apesar do nome, cobre qualquer tipo de item) =====
CREATE TABLE livros (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tombo           VARCHAR(20) UNIQUE NOT NULL,
  titulo          VARCHAR(200) NOT NULL,
  titulo_busca    VARCHAR(200),
  autor           VARCHAR(150),
  autor_busca     VARCHAR(150),
  editora         VARCHAR(150),
  ano_publicacao  SMALLINT CHECK (ano_publicacao IS NULL OR ano_publicacao BETWEEN 1400 AND 2100),
  paginas         SMALLINT CHECK (paginas IS NULL OR paginas > 0),
  estante         VARCHAR(30),
  prateleira      VARCHAR(30),
  genero_id       INT REFERENCES generos(id),
  tipo_id         INT REFERENCES tipos(id),
  disponivel      BOOLEAN DEFAULT TRUE,
  capa_data_url   TEXT,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== Turmas (catálogo, mesmo padrão do gênero de livro) =====
CREATE TABLE turmas (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  nome VARCHAR(50) UNIQUE NOT NULL
);

-- ===== Alunos =====
CREATE TABLE alunos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       VARCHAR(150) NOT NULL,
  nome_busca VARCHAR(150),
  turma_id   INT REFERENCES turmas(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===== Empréstimos (digitaliza o caderno original) =====
CREATE TABLE emprestimos (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  livro_id         INT REFERENCES livros(id),
  aluno_id         INT REFERENCES alunos(id),
  data_emprestimo  DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista    DATE NOT NULL,
  data_devolucao   DATE,
  status           VARCHAR(20) DEFAULT 'pendente'
);

-- ===== Configurações (linha única) =====
CREATE TABLE configuracoes (
  id                        INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome_biblioteca           VARCHAR(150) NOT NULL DEFAULT 'Biblioteca Escolar',
  cor_primaria              VARCHAR(7)  NOT NULL DEFAULT '#4f46e5',
  cor_menu                  VARCHAR(7)  NOT NULL DEFAULT '#1e1b4b',
  cor_login                 VARCHAR(7)  NOT NULL DEFAULT '#4f46e5',
  cor_botoes                VARCHAR(7)  NOT NULL DEFAULT '#4f46e5',
  logo_data_url             TEXT,
  dias_emprestimo_padrao    SMALLINT NOT NULL DEFAULT 7 CHECK (dias_emprestimo_padrao > 0),
  limite_livros_por_aluno   SMALLINT CHECK (limite_livros_por_aluno IS NULL OR limite_livros_por_aluno > 0),
  login_max_tentativas      SMALLINT NOT NULL DEFAULT 5,
  login_bloqueio_minutos    SMALLINT NOT NULL DEFAULT 15,
  auditoria_retencao_dias   INT NOT NULL DEFAULT 365,
  auditoria_ultima_limpeza  TIMESTAMP,
  permitir_acesso_rede      BOOLEAN NOT NULL DEFAULT FALSE,
  versao_sistema            VARCHAR(20),
  atualizado_em             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_por            INT REFERENCES users(id)
);
INSERT INTO configuracoes (id) VALUES (1);

-- ===== Tentativas de login (rate limiting) =====
CREATE TABLE login_tentativas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       VARCHAR(150) NOT NULL,
  sucesso     BOOLEAN NOT NULL,
  criado_em   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_login_tentativas_email_data ON login_tentativas (email, criado_em);

-- ===== Log de auditoria (dados_antes/dados_depois em TEXT — SQLite não tem JSONB; a
-- aplicação faz JSON.stringify/parse na camada de middleware) =====
CREATE TABLE log_auditoria (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id    INT REFERENCES users(id) ON DELETE SET NULL,
  entidade      VARCHAR(50) NOT NULL,
  entidade_id   INT,
  acao          VARCHAR(30) NOT NULL,
  dados_antes   TEXT,
  dados_depois  TEXT,
  ip            VARCHAR(45),
  metodo_http   VARCHAR(10),
  rota          VARCHAR(255),
  criado_em     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_auditoria_entidade ON log_auditoria (entidade, entidade_id);
CREATE INDEX idx_auditoria_usuario ON log_auditoria (usuario_id);
CREATE INDEX idx_auditoria_criado_em ON log_auditoria (criado_em);

-- ===== Controle de migrations =====
CREATE TABLE schema_migrations (
  nome        VARCHAR(255) PRIMARY KEY,
  aplicado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
