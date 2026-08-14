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
        COUNT(*) FILTER (WHERE status = 'devolvido')::int AS devolvidos,
        COUNT(DISTINCT aluno_id) FILTER (WHERE status = 'pendente' AND data_prevista >= CURRENT_DATE)::int AS alunos_pendentes,
        COUNT(DISTINCT aluno_id) FILTER (WHERE status = 'pendente' AND data_prevista < CURRENT_DATE)::int AS alunos_atrasados
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
    alunos: {
      total: alunos.rows[0].total,
      comPendente: emprestimos.rows[0].alunos_pendentes,
      comAtrasado: emprestimos.rows[0].alunos_atrasados,
    },
    emprestimos: {
      pendentes: emprestimos.rows[0].pendentes,
      atrasados: emprestimos.rows[0].atrasados,
      devolvidos: emprestimos.rows[0].devolvidos,
    },
    ultimosEmprestimos: ultimos.rows,
  });
};
