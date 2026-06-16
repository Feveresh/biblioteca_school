const pool = require('../config/db');

// Listar empréstimos (com join — replica o caderno atual)
exports.listar = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        e.id,
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
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

// Listar só pendentes (livros ainda não devolvidos)
exports.pendentes = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        e.id,
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
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

// Registrar empréstimo
exports.criar = async (req, res) => {
  const { aluno_id, livro_id, data_prevista } = req.body;
  if (!aluno_id || !livro_id || !data_prevista) {
    return res.status(400).json({ erro: 'aluno_id, livro_id e data_prevista são obrigatórios' });
  }
  try {
    // Verifica se livro está disponível
    const livro = await pool.query(
      'SELECT disponivel FROM livros WHERE id = $1', [livro_id]
    );
    if (!livro.rows[0]) return res.status(404).json({ erro: 'Livro não encontrado' });
    if (!livro.rows[0].disponivel) {
      return res.status(409).json({ erro: 'Livro já está emprestado' });
    }

    // Cria empréstimo e marca livro como indisponível
    await pool.query('BEGIN');
    const { rows } = await pool.query(
      `INSERT INTO emprestimos (aluno_id, livro_id, data_prevista)
       VALUES ($1, $2, $3) RETURNING *`,
      [aluno_id, livro_id, data_prevista]
    );
    await pool.query(
      'UPDATE livros SET disponivel = FALSE WHERE id = $1', [livro_id]
    );
    await pool.query('COMMIT');

    res.status(201).json(rows[0]);
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ erro: err.message });
  }
};