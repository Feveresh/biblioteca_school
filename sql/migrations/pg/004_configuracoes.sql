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

INSERT INTO configuracoes (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
