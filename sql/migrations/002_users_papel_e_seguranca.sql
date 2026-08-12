ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id INT REFERENCES roles(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tokens_validos_apos TIMESTAMP NOT NULL DEFAULT NOW();

-- Usuários existentes (criados antes de papéis existirem) viram Admin por padrão.
UPDATE users SET role_id = (SELECT id FROM roles WHERE nome = 'Admin') WHERE role_id IS NULL;

ALTER TABLE users ALTER COLUMN role_id SET NOT NULL;
