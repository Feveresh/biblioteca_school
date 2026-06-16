const pool = require('../config/db');

// Registrar devolução
exports.devolver = async (req, res) => {
  const { id } = req.params; // id do empréstimo

  try {
    const emprestimo = await pool.query(
      'SELECT * FROM emprestimos WHERE id = $1', [id]
    );
    if (!emprestimo.rows[0]) {
      return res.status(404).json({ erro: 'Empréstimo não encontrado' });
    }
    if (emprestimo.rows[0].status === 'devolvido') {
      return res.status(409).json({ erro: 'Livro já foi devolvido' });
    }

    await pool.query('BEGIN');

    const { rows } = await pool.query(
      `UPDATE emprestimos
       SET status = 'devolvido', data_devolucao = CURRENT_DATE
       WHERE id = $1 RETURNING *`,
      [id]
    );

    await pool.query(
      'UPDATE livros SET disponivel = TRUE WHERE id = $1',
      [emprestimo.rows[0].livro_id]
    );

    await pool.query('COMMIT');
    res.json({ mensagem: 'Devolução registrada', emprestimo: rows[0] });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ erro: err.message });
  }
};