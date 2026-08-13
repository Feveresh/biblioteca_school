const os = require('os');
const pool = require('../config/db');

const REGEX_COR = /^#[0-9a-fA-F]{6}$/;

// IPv4 não-interno (ex: 192.168.x.x) de alguma interface de rede da máquina — é o
// endereço que outros computadores da rede local usariam pra acessar este servidor.
// Pode não haver nenhum (ex: sem cabo/wifi conectado) — nesse caso fica null.
function enderecoRede() {
  const interfaces = Object.values(os.networkInterfaces()).flat();
  const ipv4 = interfaces.find(i => i && i.family === 'IPv4' && !i.internal);
  return ipv4?.address ?? null;
}

exports.buscar = async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM configuracoes WHERE id = 1');
  const porta = process.env.PORT || 3303;
  const ipRede = enderecoRede();
  res.json({
    ...rows[0],
    enderecos: {
      local: `http://localhost:${porta}`,
      rede: ipRede ? `http://${ipRede}:${porta}` : null,
    },
  });
};

exports.atualizar = async (req, res) => {
  const {
    nome_biblioteca, cor_primaria, cor_menu, cor_login, cor_botoes, logo_data_url,
    dias_emprestimo_padrao, limite_livros_por_aluno,
    login_max_tentativas, login_bloqueio_minutos, auditoria_retencao_dias,
    permitir_acesso_rede,
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
       permitir_acesso_rede=$12,
       atualizado_em=NOW(), atualizado_por=$13
     WHERE id = 1 RETURNING *`,
    [
      nome_biblioteca, cor_primaria, cor_menu, cor_login, cor_botoes, logo_data_url || null,
      dias_emprestimo_padrao, limite_livros_por_aluno || null,
      login_max_tentativas, login_bloqueio_minutos, auditoria_retencao_dias,
      Boolean(permitir_acesso_rede),
      req.usuario.id,
    ]
  );
  res.json(rows[0]);
};
