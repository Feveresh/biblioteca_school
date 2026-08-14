-- Catálogo de permissões (fonte da verdade é o código, ver constants/permissoes.js;
-- a tabela existe para dar integridade referencial a role_permissoes e alimentar a UI).
CREATE TABLE permissoes (
  codigo      VARCHAR(60) PRIMARY KEY,
  categoria   VARCHAR(30) NOT NULL,
  descricao   VARCHAR(150) NOT NULL
);

CREATE TABLE roles (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(60) UNIQUE NOT NULL,
  descricao     VARCHAR(255),
  acesso_total  BOOLEAN NOT NULL DEFAULT FALSE,  -- true só p/ Admin: bypassa checagem de permissão
  sistema       BOOLEAN NOT NULL DEFAULT FALSE,  -- true p/ Admin/Bibliotecário: não pode ser excluído
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
  ('auditoria.ver',          'administracao',  'Consultar o log de auditoria')
ON CONFLICT (codigo) DO UPDATE SET categoria = EXCLUDED.categoria, descricao = EXCLUDED.descricao;

INSERT INTO roles (nome, descricao, acesso_total, sistema) VALUES
  ('Admin', 'Acesso total ao sistema', TRUE, TRUE),
  ('Bibliotecário', 'Operação do dia a dia: livros, alunos e empréstimos', FALSE, TRUE)
ON CONFLICT (nome) DO NOTHING;

INSERT INTO role_permissoes (role_id, permissao_codigo)
SELECT (SELECT id FROM roles WHERE nome = 'Bibliotecário'), codigo
FROM permissoes
WHERE codigo IN (
  'livros.criar', 'livros.editar', 'livros.excluir',
  'alunos.criar', 'alunos.editar', 'alunos.excluir',
  'emprestimos.criar', 'emprestimos.devolver'
)
ON CONFLICT DO NOTHING;
