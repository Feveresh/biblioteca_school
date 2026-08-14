CREATE TABLE login_tentativas (
  id          BIGSERIAL PRIMARY KEY,
  email       VARCHAR(150) NOT NULL,
  sucesso     BOOLEAN NOT NULL,
  criado_em   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_login_tentativas_email_data ON login_tentativas (email, criado_em);
