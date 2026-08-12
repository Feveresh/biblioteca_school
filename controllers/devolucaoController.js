const pool = require('../config/db');

// Registrar devolução
exports.devolver = async (req, res) => {
  const { id } = req.params; // id do empréstimo

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const emprestimo = await client.query(
      'SELECT * FROM emprestimos WHERE id = $1 FOR UPDATE', [id]
    );
    if (!emprestimo.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Empréstimo não encontrado' });
    }
    if (emprestimo.rows[0].status === 'devolvido') {
      await client.query('ROLLBACK');
      return res.status(409).json({ erro: 'Livro já foi devolvido' });
    }

    const { rows } = await client.query(
      `UPDATE emprestimos
       SET status = 'devolvido', data_devolucao = CURRENT_DATE
       WHERE id = $1 RETURNING *`,
      [id]
    );

    await client.query(
      'UPDATE livros SET disponivel = TRUE WHERE id = $1',
      [emprestimo.rows[0].livro_id]
    );

    await client.query('COMMIT');
    res.json({ mensagem: 'Devolução registrada', emprestimo: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
