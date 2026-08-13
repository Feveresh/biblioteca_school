const pool = require('../config/db');

const REGEX_COR = /^#[0-9a-fA-F]{6}$/;

exports.buscar = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM configuracoes WHERE id = 1');
  res.json(rows[0]);
};

exports.atualizar = async (req, res) => {
  const {
    nome_biblioteca, cor_primaria, cor_menu, cor_login, cor_botoes, logo_data_url,
    dias_emprestimo_padrao, limite_livros_por_aluno,
    login_max_tentativas, login_bloqueio_minutos, auditoria_retencao_dias,
  } = req.body;

  if (!nome_biblioteca || !cor_primaria || !cor_menu || !cor_login || !cor_botoes || !dias_emprestimo_padrao
      || !login_max_tentativas || !login_bloqueio_minutos || !auditoria_retencao_dias) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes' });
  }
  for (const [campo, valor] of Object.entries({ cor_primaria, cor_menu, cor_login, cor_botoes })) {
    if (!REGEX_COR.test(valor)) {
      return res.status(400).json({ erro: `Cor inválida em "${campo}" (use o formato #RRGGBB)` });
    }
  }
  if (logo_data_url && logo_data_url.length > 200000) {
    return res.status(400).json({ erro: 'Logo muito grande (máximo ~150KB)' });
  }

  const { rows } = await pool.query(
    `UPDATE configuracoes SET
       nome_biblioteca=$1, cor_primaria=$2, cor_menu=$3, cor_login=$4, cor_botoes=$5, logo_data_url=$6,
       dias_emprestimo_padrao=$7, limite_livros_por_aluno=$8,
       login_max_tentativas=$9, login_bloqueio_minutos=$10, auditoria_retencao_dias=$11,
       atualizado_em=NOW(), atualizado_por=$12
     WHERE id = 1 RETURNING *`,
    [
      nome_biblioteca, cor_primaria, cor_menu, cor_login, cor_botoes, logo_data_url || null,
      dias_emprestimo_padrao, limite_livros_por_aluno || null,
      login_max_tentativas, login_bloqueio_minutos, auditoria_retencao_dias,
      req.usuario.id,
    ]
  );
  res.json(rows[0]);
};
