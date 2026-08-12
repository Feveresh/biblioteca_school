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
