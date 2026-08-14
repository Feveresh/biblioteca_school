const pool = require('../config/db');
const { construirOrdenacao, construirPaginacao } = require('../utils/listagem');
const { normalizarBusca } = require('../utils/normalizarBusca');

const COLUNAS_ORDENACAO = ['titulo', 'autor', 'tombo', 'disponivel', 'estante'];
const TAMANHO_MAX_CAPA = 300 * 1024; // base64 já embutido no JSON — igual ao padrão do logo em Configurações

// Listar livros — busca, filtros, ordenação (inclui "genero", tratado à parte por não
// ser uma coluna de livros) e paginação
exports.listar = async (req, res) => {
  const { busca, disponivel, estante, genero_id, ordenarPor, ordem } = req.query;
  const condicoes = [];
  const valores = [];

  if (busca) {
    valores.push(`%${normalizarBusca(busca)}%`);
    condicoes.push(`(l.titulo_busca LIKE $${valores.length} OR l.autor_busca LIKE $${valores.length} OR LOWER(l.tombo) LIKE $${valores.length})`);
  }
  if (disponivel === 'true' || disponivel === 'false') {
    valores.push(disponivel === 'true');
    condicoes.push(`l.disponivel = $${valores.length}`);
  }
  if (estante) {
    valores.push(estante);
    condicoes.push(`l.estante = $${valores.length}`);
  }
  if (genero_id) {
    valores.push(genero_id);
    condicoes.push(`l.genero_id = $${valores.length}`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  // "genero" ordena primeiro pelo nome do gênero, depois por título dentro de cada
  // gênero — não é uma coluna real de livros, então não passa pela allow-list genérica.
  const orderBy = ordenarPor === 'genero'
    ? `g.nome ${ordem === 'desc' ? 'DESC' : 'ASC'} NULLS LAST, l.titulo ASC`
    : 'l.' + construirOrdenacao(ordenarPor, ordem, COLUNAS_ORDENACAO, 'titulo');

  const { pagina, porPagina, offset } = construirPaginacao(req.query);

  const { rows: totalRows } = await pool.query(`SELECT COUNT(*) FROM livros l ${where}`, valores);
  const total = Number(totalRows[0].count);

  const valoresPagina = [...valores, porPagina, offset];
  const { rows } = await pool.query(`
    SELECT l.*, g.nome AS genero_nome
    FROM livros l
    LEFT JOIN generos g ON g.id = l.genero_id
    ${where}
    ORDER BY ${orderBy}
    LIMIT $${valoresPagina.length - 1} OFFSET $${valoresPagina.length}
  `, valoresPagina);

  res.json({ dados: rows, total, pagina, porPagina });
};

// Valores distintos de estante já usados, pro filtro de localização na listagem —
// não é um catálogo (sem tela de gerenciamento), só os valores livres já cadastrados.
exports.estantes = async (req, res) => {
  const { rows } = await pool.query(
    `SELECT DISTINCT estante FROM livros WHERE estante IS NOT NULL AND estante <> '' ORDER BY estante`
  );
  res.json(rows.map(r => r.estante));
};

// Buscar livro por ID
exports.buscar = async (req, res) => {
  const { rows } = await pool.query(`
    SELECT l.*, g.nome AS genero_nome
    FROM livros l
    LEFT JOIN generos g ON g.id = l.genero_id
    WHERE l.id = $1
  `, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ erro: 'Livro não encontrado' });
  res.json(rows[0]);
};

// Cadastrar livro
exports.criar = async (req, res) => {
  const { tombo, titulo, autor, editora, ano_publicacao, paginas, estante, prateleira, genero_id, capa_data_url } = req.body;
  if (!tombo || !titulo) {
    return res.status(400).json({ erro: 'Tombo e título são obrigatórios' });
  }
  if (capa_data_url && capa_data_url.length > TAMANHO_MAX_CAPA) {
    return res.status(400).json({ erro: 'Capa muito grande (máximo ~220KB)' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO livros (tombo, titulo, titulo_busca, autor, autor_busca, editora, ano_publicacao, paginas, estante, prateleira, genero_id, capa_data_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [tombo, titulo, normalizarBusca(titulo), autor, normalizarBusca(autor), editora || null, ano_publicacao || null, paginas || null, estante || null, prateleira || null, genero_id || null, capa_data_url || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Tombo já cadastrado' });
    if (err.code === '23503') return res.status(400).json({ erro: 'Gênero informado não existe' });
    if (err.code === '23514') return res.status(400).json({ erro: err.constraint === 'livros_paginas_check' ? 'Número de páginas inválido' : 'Ano de publicação inválido' });
    throw err;
  }
};

// Atualizar livro
exports.atualizar = async (req, res) => {
  const { tombo, titulo, autor, editora, ano_publicacao, paginas, estante, prateleira, genero_id, capa_data_url } = req.body;
  if (!tombo || !titulo) {
    return res.status(400).json({ erro: 'Tombo e título são obrigatórios' });
  }
  if (capa_data_url && capa_data_url.length > TAMANHO_MAX_CAPA) {
    return res.status(400).json({ erro: 'Capa muito grande (máximo ~220KB)' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE livros SET tombo=$1, titulo=$2, titulo_busca=$3, autor=$4, autor_busca=$5, editora=$6, ano_publicacao=$7,
                          paginas=$8, estante=$9, prateleira=$10, genero_id=$11, capa_data_url=$12
       WHERE id=$13 RETURNING *`,
      [tombo, titulo, normalizarBusca(titulo), autor, normalizarBusca(autor), editora || null, ano_publicacao || null, paginas || null, estante || null, prateleira || null, genero_id || null, capa_data_url || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Livro não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Tombo já cadastrado' });
    if (err.code === '23514') return res.status(400).json({ erro: err.constraint === 'livros_paginas_check' ? 'Número de páginas inválido' : 'Ano de publicação inválido' });
    if (err.code === '23503') return res.status(400).json({ erro: 'Gênero informado não existe' });
    throw err;
  }
};

// Alternar disponibilidade (clique rápido no status, sem passar pelo formulário) —
// marcar como indisponível é sempre permitido (ex: livro perdido/em manutenção), mas
// marcar como disponível é bloqueado se houver empréstimo pendente em aberto: o caminho
// correto nesse caso é registrar a devolução, não sobrescrever o status manualmente.
exports.alternarDisponibilidade = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const livro = await client.query('SELECT disponivel FROM livros WHERE id = $1 FOR UPDATE', [id]);
    if (!livro.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ erro: 'Livro não encontrado' });
    }

    if (!livro.rows[0].disponivel) {
      const emprestimoAtivo = await client.query(
        "SELECT id FROM emprestimos WHERE livro_id = $1 AND status = 'pendente'",
        [id]
      );
      if (emprestimoAtivo.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          erro: 'Este livro está com um empréstimo em aberto — registre a devolução em vez de marcar como disponível manualmente',
        });
      }
    }

    const { rows } = await client.query(
      'UPDATE livros SET disponivel = NOT disponivel WHERE id = $1 RETURNING *',
      [id]
    );
    await client.query('COMMIT');
    res.locals.auditAcao = 'alternar_disponibilidade';
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Remover livro
exports.remover = async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM livros WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ erro: 'Livro não encontrado' });
    res.json({ mensagem: 'Livro removido com sucesso' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ erro: 'Livro possui empréstimos vinculados e não pode ser removido' });
    }
    throw err;
  }
};
