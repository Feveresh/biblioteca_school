-- URL de um servidor externo que informa a versão mais recente disponível (checado no
-- login) — em branco por padrão, e nesse caso o sistema nem tenta verificar.
ALTER TABLE configuracoes ADD COLUMN IF NOT EXISTS url_verificacao_atualizacao VARCHAR(255);
