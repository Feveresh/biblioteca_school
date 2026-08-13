INSERT INTO permissoes (codigo, categoria, descricao) VALUES
  ('emprestimos.renovar', 'emprestimos', 'Renovar empréstimos')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO role_permissoes (role_id, permissao_codigo)
SELECT (SELECT id FROM roles WHERE nome = 'Bibliotecário'), 'emprestimos.renovar'
ON CONFLICT DO NOTHING;
