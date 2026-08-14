-- Cor opcional por gênero — usada como fundo do badge de gênero na listagem de itens.
ALTER TABLE generos ADD COLUMN IF NOT EXISTS cor VARCHAR(7);
