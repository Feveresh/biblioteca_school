const pool = require('../config/db');
const { diasAtras, inicioDoMesAtras } = require('../utils/dataAtras');

// SQLite não tem to_char/date_trunc — strftime já devolve 'YYYY-MM' direto.
const EXPRESSAO_MES = pool.usaSqlite
  ? "strftime('%Y-%m', data_emprestimo)"
  : "to_char(date_trunc('month', data_emprestimo), 'YYYY-MM')";

// No SQLite as colunas DATE ficam guardadas como TEXT ("AAAA-MM-DD") — "data1 - data2" não
// subtrai datas, o "-" força as duas a número e cada uma vira só o prefixo "AAAA" (perde
// mês/dia), dando uma diferença sem sentido (ex: duas datas no mesmo ano sempre dão 0).
// julianday() resolve certo nos dois motores.
const EXPRESSAO_DIAS_ATE_DEVOLUCAO = pool.usaSqlite
  ? 'julianday(data_devolucao) - julianday(data_emprestimo)'
  : 'data_devolucao - data_emprestimo';

// Gera os últimos `n` meses no formato 'YYYY-MM', do mais antigo pro mais recente,
// pra garantir que o gráfico tenha um ponto por mês mesmo sem empréstimos registrados.
function ultimosMeses(n) {
  const meses = [];
  const hoje = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return meses;
}

// GET /api/estatisticas — dados agregados para a tela de estatísticas (gráficos)
exports.resumo = async (req, res) => {
  const podeVerAuditoria = req.usuario.papel.acessoTotal || req.usuario.permissoes.includes('auditoria.ver');

  const consultas = [
    // 0: empréstimos por mês (últimos 12 meses)
    pool.query(`
      SELECT ${EXPRESSAO_MES} AS mes, COUNT(*)::int AS total
      FROM emprestimos
      WHERE data_emprestimo >= ${inicioDoMesAtras(11)}
      GROUP BY 1
      ORDER BY 1
    `),
    // 1: status dos empréstimos
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pendente' AND data_prevista >= CURRENT_DATE)::int AS pendentes,
        COUNT(*) FILTER (WHERE status = 'pendente' AND data_prevista < CURRENT_DATE)::int AS atrasados,
        COUNT(*) FILTER (WHERE status = 'devolvido')::int AS devolvidos
      FROM emprestimos
    `),
    // 2: top 10 livros mais emprestados
    pool.query(`
      SELECT l.titulo, COUNT(*)::int AS total
      FROM emprestimos e
      JOIN livros l ON l.id = e.livro_id
      GROUP BY l.id, l.titulo
      ORDER BY total DESC, l.titulo ASC
      LIMIT 10
    `),
    // 3: top 10 alunos que mais emprestam
    pool.query(`
      SELECT a.nome, t.nome AS turma, COUNT(*)::int AS total
      FROM emprestimos e
      JOIN alunos a ON a.id = e.aluno_id
      LEFT JOIN turmas t ON t.id = a.turma_id
      GROUP BY a.id, a.nome, t.nome
      ORDER BY total DESC, a.nome ASC
      LIMIT 10
    `),
    // 4: uso da biblioteca por turma (nº de empréstimos)
    pool.query(`
      SELECT COALESCE(t.nome, 'Sem turma') AS turma, COUNT(*)::int AS total
      FROM emprestimos e
      JOIN alunos a ON a.id = e.aluno_id
      LEFT JOIN turmas t ON t.id = a.turma_id
      GROUP BY t.nome
      ORDER BY total DESC
    `),
    // 5: livros por gênero
    pool.query(`
      SELECT COALESCE(g.nome, 'Sem gênero') AS genero, COUNT(*)::int AS total
      FROM livros l
      LEFT JOIN generos g ON g.id = l.genero_id
      GROUP BY g.nome
      ORDER BY total DESC
    `),
    // 6: disponibilidade do acervo
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE disponivel)::int AS disponiveis,
        COUNT(*) FILTER (WHERE NOT disponivel)::int AS indisponiveis
      FROM livros
    `),
    // 7: livros nunca emprestados (acervo parado) — contagem total + amostra pra tabela
    pool.query(`
      SELECT COUNT(*)::int AS total
      FROM livros l
      WHERE NOT EXISTS (SELECT 1 FROM emprestimos e WHERE e.livro_id = l.id)
    `),
    pool.query(`
      SELECT l.titulo, l.tombo
      FROM livros l
      WHERE NOT EXISTS (SELECT 1 FROM emprestimos e WHERE e.livro_id = l.id)
      ORDER BY l.titulo ASC
      LIMIT 15
    `),
    // 8: alunos por turma
    pool.query(`
      SELECT COALESCE(t.nome, 'Sem turma') AS turma, COUNT(*)::int AS total
      FROM alunos a
      LEFT JOIN turmas t ON t.id = a.turma_id
      GROUP BY t.nome
      ORDER BY total DESC
    `),
    // 9: alunos sem nenhum empréstimo
    pool.query(`
      SELECT COUNT(*)::int AS total
      FROM alunos a
      WHERE NOT EXISTS (SELECT 1 FROM emprestimos e WHERE e.aluno_id = a.id)
    `),
    // 10: tempo médio de empréstimo até devolução (dias)
    pool.query(`
      SELECT COALESCE(ROUND(AVG(${EXPRESSAO_DIAS_ATE_DEVOLUCAO})), 0)::int AS dias
      FROM emprestimos
      WHERE status = 'devolvido' AND data_devolucao IS NOT NULL
    `),
    // 11: gêneros mais emprestados (por nº de empréstimos, não de livros no acervo)
    pool.query(`
      SELECT COALESCE(g.nome, 'Sem gênero') AS genero, COUNT(*)::int AS total
      FROM emprestimos e
      JOIN livros l ON l.id = e.livro_id
      LEFT JOIN generos g ON g.id = l.genero_id
      GROUP BY g.nome
      ORDER BY total DESC
    `),
    // 12: alunos que mais leram, por soma de páginas dos livros emprestados — só
    // considera empréstimos de livros com número de páginas cadastrado
    pool.query(`
      SELECT a.nome, t.nome AS turma, SUM(l.paginas)::int AS paginas
      FROM emprestimos e
      JOIN alunos a ON a.id = e.aluno_id
      JOIN livros l ON l.id = e.livro_id
      LEFT JOIN turmas t ON t.id = a.turma_id
      WHERE l.paginas IS NOT NULL
      GROUP BY a.id, a.nome, t.nome
      ORDER BY paginas DESC
      LIMIT 10
    `),
  ];

  if (podeVerAuditoria) {
    consultas.push(
      // 13: ações mais frequentes no log de auditoria (últimos 30 dias)
      pool.query(`
        SELECT acao, COUNT(*)::int AS total
        FROM log_auditoria
        WHERE criado_em >= ${diasAtras(30)}
        GROUP BY acao
        ORDER BY total DESC
        LIMIT 10
      `),
      // 14: usuários mais ativos no sistema (últimos 30 dias)
      pool.query(`
        SELECT u.nome, COUNT(*)::int AS total
        FROM log_auditoria la
        JOIN users u ON u.id = la.usuario_id
        WHERE la.criado_em >= ${diasAtras(30)}
        GROUP BY u.nome
        ORDER BY total DESC
        LIMIT 10
      `)
    );
  }

  const resultados = await Promise.all(consultas);
  const [
    porMesRows, statusRow, topLivros, topAlunos, usoPorTurma,
    livrosPorGenero, disponibilidade, livrosParadosTotal, livrosParadosLista,
    alunosPorTurma, alunosSemEmprestimoRow, tempoMedioRow,
    generosMaisEmprestados, topAlunosPorPaginas,
  ] = resultados;

  const mapaMeses = Object.fromEntries(porMesRows.rows.map(r => [r.mes, r.total]));
  const emprestimosPorMes = ultimosMeses(12).map(mes => ({ mes, total: mapaMeses[mes] || 0 }));

  const resposta = {
    emprestimosPorMes,
    statusEmprestimos: statusRow.rows[0],
    topLivros: topLivros.rows,
    topAlunos: topAlunos.rows,
    usoPorTurma: usoPorTurma.rows,
    livrosPorGenero: livrosPorGenero.rows,
    disponibilidadeLivros: disponibilidade.rows[0],
    livrosParados: { total: livrosParadosTotal.rows[0].total, lista: livrosParadosLista.rows },
    alunosPorTurma: alunosPorTurma.rows,
    alunosSemEmprestimo: alunosSemEmprestimoRow.rows[0].total,
    tempoMedioDevolucaoDias: tempoMedioRow.rows[0].dias,
    generosMaisEmprestados: generosMaisEmprestados.rows,
    topAlunosPorPaginas: topAlunosPorPaginas.rows,
  };

  if (podeVerAuditoria) {
    resposta.auditoria = {
      porAcao: resultados[13].rows,
      porUsuario: resultados[14].rows,
    };
  }

  res.json(resposta);
};
