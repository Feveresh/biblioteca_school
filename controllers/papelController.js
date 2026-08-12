const pool = require('../config/db');

const SELECT_PAPEL = `
  SELECT r.*, COALESCE(array_agg(rp.permissao_codigo) FILTER (WHERE rp.permissao_codigo IS NOT NULL), '{}') AS permissoes
  FROM roles r
  LEFT JOIN role_permissoes rp ON rp.role_id = r.id
`;

exports.listar = async (req, res) => {
  const { rows } = await pool.query(`${SELECT_PAPEL} GROUP BY r.id ORDER BY r.nome`);
  res.json(rows);
};

exports.buscar = async (req, res) => {
  const { rows } = await pool.query(`${SELECT_PAPEL} WHERE r.id = $1 GROUP BY r.id`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ erro: 'Papel não encontrado' });
  res.json(rows[0]);
};

// A tabela `permissoes` é a fonte da verdade do catálogo válido (populada pelas migrations) —
// validar contra ela evita duplicar essa lista em código e ela nunca fica fora de sincronia.
async function permissoesInvalidas(client, codigos) {
  if (!codigos || !codigos.length) return [];
  const { rows } = await client.query('SELECT codigo FROM permissoes WHERE codigo = ANY($1::varchar[])', [codigos]);
  const validos = new Set(rows.map(r => r.codigo));
  return codigos.filter(c => !validos.has(c));
}

exports.criar = async (req, res) => {
  const { nome, descricao, permissoes } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

  const client = await pool.connect();
  try {
    const invalidas = await permissoesInvalidas(client, permissoes);
    if (invalidas.length) {
      return res.status(400).json({ erro: `Permissões inválidas: ${invalidas.join(', ')}` });
    }

    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO roles (nome, descricao) VALUES ($1, $2) RETURNING *',
      [nome, descricao || null]
    );
    const papel = rows[0];
    for (const codigo of permissoes || []) {
      await client.query('INSERT INTO role_permissoes (role_id, permissao_codigo) VALUES ($1, $2)', [papel.id, codigo]);
    }
    await client.query('COMMIT');
    res.status(201).json({ ...papel, permissoes: permissoes || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ erro: 'Já existe um papel com esse nome' });
    throw err;
  } finally {
    client.release();
  }
};

exports.atualizar = async (req, res) => {
  const { nome, descricao, permissoes } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });

  const client = await pool.connect();
  try {
    const invalidas = await permissoesInvalidas(client, permissoes);
    if (invalidas.length) {
      return res.status(400).json({ erro: `Permissões inválidas: ${invalidas.join(', ')}` });
    }

    await client.query('BEGIN');
    const { rows } = await client.query(
      'UPDATE roles SET nome=$1, descricao=$2 WHERE id=$3 RETURNING *',
      [nome, descricao || null, req.params.id]
    );
    if (!rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Papel não encontrado' });
    }
    await client.query('DELETE FROM role_permissoes WHERE role_id = $1', [req.params.id]);
    for (const codigo of permissoes || []) {
      await client.query('INSERT INTO role_permissoes (role_id, permissao_codigo) VALUES ($1, $2)', [req.params.id, codigo]);
    }
    await client.query('COMMIT');
    res.json({ ...rows[0], permissoes: permissoes || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ erro: 'Já existe um papel com esse nome' });
    throw err;
  } finally {
    client.release();
  }
};

exports.remover = async (req, res) => {
  const { rows } = await pool.query('SELECT sistema FROM roles WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ erro: 'Papel não encontrado' });
  if (rows[0].sistema) {
    return res.status(409).json({ erro: 'Papéis padrão do sistema (Admin/Bibliotecário) não podem ser excluídos' });
  }

  try {
    const { rowCount } = await pool.query('DELETE FROM roles WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Papel não encontrado' });
    res.json({ mensagem: 'Papel removido com sucesso' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ erro: 'Papel está em uso por usuários e não pode ser removido' });
    }
    throw err;
  }
};
