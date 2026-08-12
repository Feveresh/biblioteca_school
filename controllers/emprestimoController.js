const pool = require('../config/db');
const { construirOrdenacao, construirPaginacao } = require('../utils/listagem');

const COLUNAS_ORDENACAO = ['data_emprestimo', 'data_prevista'];

// Listar empréstimos (com join — replica o caderno atual) — filtros, ordenação e paginação
exports.listar = async (req, res) => {
  const { aluno_id, status, de, ate, ordenarPor, ordem } = req.query;
  const condicoes = [];
  const valores = [];

  if (aluno_id) { valores.push(aluno_id); condicoes.push(`e.aluno_id = $${valores.length}`); }
  if (status)   { valores.push(status);   condicoes.push(`e.status = $${valores.length}`); }
  if (de)       { valores.push(de);       condicoes.push(`e.data_emprestimo >= $${valores.length}`); }
  if (ate)      { valores.push(ate);      condicoes.push(`e.data_emprestimo <= $${valores.length}`); }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const orderBy = 'e.' + construirOrdenacao(ordenarPor, ordem, COLUNAS_ORDENACAO, 'data_emprestimo');
  const { pagina, porPagina, offset } = construirPaginacao(req.query);

  const { rows: totalRows } = await pool.query(
    `SELECT COUNT(*) FROM emprestimos e ${where}`, valores
  );
  const total = Number(totalRows[0].count);

  const valoresPagina = [...valores, porPagina, offset];
  const { rows } = await pool.query(`
    SELECT
      e.id, e.aluno_id, e.livro_id,
      a.nome AS aluno, a.turma,
      l.tombo, l.titulo AS livro,
      e.data_emprestimo, e.data_prevista, e.data_devolucao, e.status
    FROM emprestimos e
    JOIN alunos  a ON a.id = e.aluno_id
    JOIN livros  l ON l.id = e.livro_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${valoresPagina.length - 1} OFFSET $${valoresPagina.length}
  `, valoresPagina);

  res.json({ dados: rows, total, pagina, porPagina });
};

// Listar só pendentes (livros ainda não devolvidos) — filtros, ordenação e paginação
exports.pendentes = async (req, res) => {
  const { aluno_id, de, ate, ordenarPor, ordem } = req.query;
  const condicoes = [`e.status = 'pendente'`];
  const valores = [];

  if (aluno_id) { valores.push(aluno_id); condicoes.push(`e.aluno_id = $${valores.length}`); }
  if (de)       { valores.push(de);       condicoes.push(`e.data_prevista >= $${valores.length}`); }
  if (ate)      { valores.push(ate);      condicoes.push(`e.data_prevista <= $${valores.length}`); }

  const where = `WHERE ${condicoes.join(' AND ')}`;
  const orderBy = 'e.' + construirOrdenacao(ordenarPor, ordem, COLUNAS_ORDENACAO, 'data_prevista');
  const { pagina, porPagina, offset } = construirPaginacao(req.query);

  const { rows: totalRows } = await pool.query(
    `SELECT COUNT(*) FROM emprestimos e ${where}`, valores
  );
  const total = Number(totalRows[0].count);

  const valoresPagina = [...valores, porPagina, offset];
  const { rows } = await pool.query(`
    SELECT
      e.id, e.aluno_id, e.livro_id,
      a.nome AS aluno, a.turma,
      l.tombo, l.titulo AS livro,
      e.data_emprestimo, e.data_prevista,
      CASE WHEN CURRENT_DATE > e.data_prevista THEN 'atrasado' ELSE 'pendente' END AS status
    FROM emprestimos e
    JOIN alunos  a ON a.id = e.aluno_id
    JOIN livros  l ON l.id = e.livro_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${valoresPagina.length - 1} OFFSET $${valoresPagina.length}
  `, valoresPagina);

  res.json({ dados: rows, total, pagina, porPagina });
};

// Registrar empréstimo
exports.criar = async (req, res) => {
  const { aluno_id, livro_id, data_prevista } = req.body;
  if (!aluno_id || !livro_id || !data_prevista) {
    return res.status(400).json({ erro: 'aluno_id, livro_id e data_prevista são obrigatórios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Trava a linha do livro para evitar duplo empréstimo em requisições concorrentes
    const livro = await client.query(
      'SELECT disponivel FROM livros WHERE id = $1 FOR UPDATE', [livro_id]
    );
    if (!livro.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Livro não encontrado' });
    }
    if (!livro.rows[0].disponivel) {
      await client.query('ROLLBACK');
      return res.status(409).json({ erro: 'Livro já está emprestado' });
    }

    const aluno = await client.query('SELECT id FROM alunos WHERE id = $1', [aluno_id]);
    if (!aluno.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Aluno não encontrado' });
    }

    const { rows: cfgRows } = await client.query('SELECT limite_livros_por_aluno FROM configuracoes WHERE id = 1');
    const limite = cfgRows[0]?.limite_livros_por_aluno;
    if (limite) {
      const { rows: contagem } = await client.query(
        "SELECT COUNT(*) FROM emprestimos WHERE aluno_id = $1 AND status = 'pendente'",
        [aluno_id]
      );
      if (Number(contagem[0].count) >= limite) {
        await client.query('ROLLBACK');
        return res.status(409).json({ erro: `Aluno já atingiu o limite de ${limite} livro(s) emprestado(s) simultaneamente` });
      }
    }

    const { rows } = await client.query(
      `INSERT INTO emprestimos (aluno_id, livro_id, data_prevista)
       VALUES ($1, $2, $3) RETURNING *`,
      [aluno_id, livro_id, data_prevista]
    );
    await client.query('UPDATE livros SET disponivel = FALSE WHERE id = $1', [livro_id]);
    await client.query('COMMIT');

    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
