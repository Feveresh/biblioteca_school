const pool = require('../config/db');

// Listar empréstimos (com join — replica o caderno atual)
exports.listar = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      e.id,
      e.aluno_id,
      e.livro_id,
      a.nome        AS aluno,
      a.turma,
      l.tombo,
      l.titulo      AS livro,
      e.data_emprestimo,
      e.data_prevista,
      e.data_devolucao,
      e.status
    FROM emprestimos e
    JOIN alunos  a ON a.id = e.aluno_id
    JOIN livros  l ON l.id = e.livro_id
    ORDER BY e.data_emprestimo DESC
  `);
  res.json(rows);
};

// Listar só pendentes (livros ainda não devolvidos)
exports.pendentes = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      e.id,
      e.aluno_id,
      e.livro_id,
      a.nome        AS aluno,
      a.turma,
      l.tombo,
      l.titulo      AS livro,
      e.data_emprestimo,
      e.data_prevista,
      CASE
        WHEN CURRENT_DATE > e.data_prevista THEN 'atrasado'
        ELSE 'pendente'
      END AS status
    FROM emprestimos e
    JOIN alunos  a ON a.id = e.aluno_id
    JOIN livros  l ON l.id = e.livro_id
    WHERE e.status = 'pendente'
    ORDER BY e.data_prevista ASC
  `);
  res.json(rows);
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
