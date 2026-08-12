const pool = require('../config/db');

exports.buscar = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM configuracoes WHERE id = 1');
  res.json(rows[0]);
};

exports.atualizar = async (req, res) => {
  const {
    nome_biblioteca, cor_primaria, logo_data_url,
    dias_emprestimo_padrao, limite_livros_por_aluno,
    login_max_tentativas, login_bloqueio_minutos, auditoria_retencao_dias,
  } = req.body;

  if (!nome_biblioteca || !cor_primaria || !dias_emprestimo_padrao
      || !login_max_tentativas || !login_bloqueio_minutos || !auditoria_retencao_dias) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes' });
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(cor_primaria)) {
    return res.status(400).json({ erro: 'Cor primária inválida (use o formato #RRGGBB)' });
  }
  if (logo_data_url && logo_data_url.length > 200000) {
    return res.status(400).json({ erro: 'Logo muito grande (máximo ~150KB)' });
  }

  const { rows } = await pool.query(
    `UPDATE configuracoes SET
       nome_biblioteca=$1, cor_primaria=$2, logo_data_url=$3,
       dias_emprestimo_padrao=$4, limite_livros_por_aluno=$5,
       login_max_tentativas=$6, login_bloqueio_minutos=$7, auditoria_retencao_dias=$8,
       atualizado_em=NOW(), atualizado_por=$9
     WHERE id = 1 RETURNING *`,
    [
      nome_biblioteca, cor_primaria, logo_data_url || null,
      dias_emprestimo_padrao, limite_livros_por_aluno || null,
      login_max_tentativas, login_bloqueio_minutos, auditoria_retencao_dias,
      req.usuario.id,
    ]
  );
  res.json(rows[0]);
};
