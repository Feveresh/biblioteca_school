const pool = require('../config/db');

async function buscarUsuarioAutenticado(id) {
  const { rows } = await pool.query(`
    SELECT u.id, u.nome, u.email, u.ativo, u.tokens_validos_apos,
           r.id AS papel_id, r.nome AS papel_nome, r.acesso_total,
           COALESCE(array_agg(rp.permissao_codigo) FILTER (WHERE rp.permissao_codigo IS NOT NULL), '{}') AS permissoes
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN role_permissoes rp ON rp.role_id = r.id
    WHERE u.id = $1
    GROUP BY u.id, r.id
  `, [id]);
  return rows[0];
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
