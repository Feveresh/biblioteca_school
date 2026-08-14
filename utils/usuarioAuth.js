const pool = require('../config/db');

// Mesmo caso do papelController: SQLite não tem array_agg, usa group_concat (string
// separada por vírgula, ou null sem permissões) em vez de array de verdade.
const CAMPO_PERMISSOES = pool.usaSqlite
  ? 'group_concat(rp.permissao_codigo)'
  : `COALESCE(array_agg(rp.permissao_codigo) FILTER (WHERE rp.permissao_codigo IS NOT NULL), '{}')`;

async function buscarUsuarioAutenticado(id) {
  const { rows } = await pool.query(`
    SELECT u.id, u.nome, u.email, u.ativo, u.tokens_validos_apos,
           r.id AS papel_id, r.nome AS papel_nome, r.acesso_total,
           ${CAMPO_PERMISSOES} AS permissoes
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN role_permissoes rp ON rp.role_id = r.id
    WHERE u.id = $1
    GROUP BY u.id, r.id
  `, [id]);
  const usuario = rows[0];
  if (usuario && pool.usaSqlite) {
    usuario.permissoes = usuario.permissoes ? usuario.permissoes.split(',') : [];
  }
  return usuario;
}

function formatarUsuario(usuario) {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    papel: { id: usuario.papel_id, nome: usuario.papel_nome, acessoTotal: usuario.acesso_total },
    permissoes: usuario.permissoes,
  };
}

module.exports = { buscarUsuarioAutenticado, formatarUsuario };
