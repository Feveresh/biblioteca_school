const pool = require('../config/db');
const { construirOrdenacao, construirPaginacao } = require('../utils/listagem');
const { normalizarBusca } = require('../utils/normalizarBusca');

const COLUNAS_ORDENACAO = ['nome'];

// Listar alunos — busca, filtro por turma, ordenação (inclui "turma", tratado à parte
// por não ser uma coluna de alunos — mesmo padrão do gênero de livro) e paginação
exports.listar = async (req, res) => {
  const { busca, turma_id, ordenarPor, ordem } = req.query;
  const condicoes = [];
  const valores = [];

  if (busca) {
    valores.push(`%${normalizarBusca(busca)}%`);
    condicoes.push(`(a.nome_busca LIKE $${valores.length} OR LOWER(t.nome) LIKE $${valores.length})`);
  }
  if (turma_id) {
    valores.push(turma_id);
    condicoes.push(`a.turma_id = $${valores.length}`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  // "turma" ordena primeiro pelo nome da turma, depois por nome do aluno dentro de cada
  // turma — não é uma coluna real de alunos, então não passa pela allow-list genérica.
  const orderBy = ordenarPor === 'turma'
    ? `t.nome ${ordem === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, a.nome ASC`
    : 'a.' + construirOrdenacao(ordenarPor, ordem, COLUNAS_ORDENACAO, 'nome');

  const { pagina, porPagina, offset } = construirPaginacao(req.query);

  const { rows: totalRows } = await pool.query(
    `SELECT COUNT(*) FROM alunos a LEFT JOIN turmas t ON t.id = a.turma_id ${where}`, valores
  );
  const total = Number(totalRows[0].count);

  const valoresPagina = [...valores, porPagina, offset];
  const { rows } = await pool.query(`
    SELECT a.*, t.nome AS turma_nome
    FROM alunos a
    LEFT JOIN turmas t ON t.id = a.turma_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${valoresPagina.length - 1} OFFSET $${valoresPagina.length}
  `, valoresPagina);

  res.json({ dados: rows, total, pagina, porPagina });
};

exports.buscar = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT a.*, t.nome AS turma_nome
    FROM alunos a
    LEFT JOIN turmas t ON t.id = a.turma_id
    WHERE a.id = $1
  `, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ erro: 'Aluno não encontrado' });
  res.json(rows[0]);
};

exports.criar = async (req, res) => {
  const { nome, turma_id } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO alunos (nome, nome_busca, turma_id) VALUES ($1, $2, $3) RETURNING *',
      [nome, normalizarBusca(nome), turma_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ erro: 'Turma informada não existe' });
    throw err;
  }
};

exports.atualizar = async (req, res) => {
  const { nome, turma_id } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  try {
    const { rows } = await pool.query(
      'UPDATE alunos SET nome=$1, nome_busca=$2, turma_id=$3 WHERE id=$4 RETURNING *',
      [nome, normalizarBusca(nome), turma_id || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Aluno não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ erro: 'Turma informada não existe' });
    throw err;
  }
};

exports.remover = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM alunos WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Aluno não encontrado' });
    res.json({ mensagem: 'Aluno removido com sucesso' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ erro: 'Aluno possui empréstimos vinculados e não pode ser removido' });
    }
    throw err;
  }
};
