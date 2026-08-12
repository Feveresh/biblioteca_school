const pool = require('../config/db');

// GET /api/dashboard — resumo para a tela inicial
exports.resumo = async (req, res) => {
  const [livros, alunos, emprestimos, ultimos] = await Promise.all([
    pool.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE disponivel)::int AS disponiveis
      FROM livros
    `),
    pool.query(`SELECT COUNT(*)::int AS total FROM alunos`),
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pendente' AND data_prevista >= CURRENT_DATE)::int AS pendentes,
        COUNT(*) FILTER (WHERE status = 'pendente' AND data_prevista < CURRENT_DATE)::int AS atrasados,
        COUNT(*) FILTER (WHERE status = 'devolvido')::int AS devolvidos
      FROM emprestimos
    `),
    pool.query(`
      SELECT e.id, a.nome AS aluno, l.titulo AS livro, e.data_emprestimo, e.data_prevista, e.status
      FROM emprestimos e
      JOIN alunos a ON a.id = e.aluno_id
      JOIN livros l ON l.id = e.livro_id
      ORDER BY e.data_emprestimo DESC
      LIMIT 5
    `),
  ]);

  res.json({
    livros: {
      total: livros.rows[0].total,
      disponiveis: livros.rows[0].disponiveis,
      emprestados: livros.rows[0].total - livros.rows[0].disponiveis,
    },
    alunos: { total: alunos.rows[0].total },
    emprestimos: emprestimos.rows[0],
    ultimosEmprestimos: ultimos.rows,
  });
};
