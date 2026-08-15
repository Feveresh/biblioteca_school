-- Cores padrão pros gêneros do catálogo fixo — só preenche quem ainda não tem cor
-- escolhida (não sobrescreve customização feita pela tela).
UPDATE generos SET cor = '#ffdd00' WHERE nome = 'Aventura'           AND cor IS NULL;
UPDATE generos SET cor = '#7a4700' WHERE nome = 'Biografia'          AND cor IS NULL;
UPDATE generos SET cor = '#ffae3d' WHERE nome = 'Clássico'           AND cor IS NULL;
UPDATE generos SET cor = '#a6ff00' WHERE nome = 'Comédia'            AND cor IS NULL;
UPDATE generos SET cor = '#002aff' WHERE nome = 'Didático'           AND cor IS NULL;
UPDATE generos SET cor = '#ff4000' WHERE nome = 'Drama'              AND cor IS NULL;
UPDATE generos SET cor = '#ff24c5' WHERE nome = 'Fantasia'           AND cor IS NULL;
UPDATE generos SET cor = '#007bff' WHERE nome = 'Ficção Científica'  AND cor IS NULL;
UPDATE generos SET cor = '#b65535' WHERE nome = 'História'           AND cor IS NULL;
UPDATE generos SET cor = '#47b9ff' WHERE nome = 'Infantil'           AND cor IS NULL;
UPDATE generos SET cor = '#95a3b7' WHERE nome = 'Outro'              AND cor IS NULL;
UPDATE generos SET cor = '#9900ff' WHERE nome = 'Poesia'             AND cor IS NULL;
UPDATE generos SET cor = '#ff0059' WHERE nome = 'Romance'            AND cor IS NULL;
UPDATE generos SET cor = '#ff0000' WHERE nome = 'Suspense'           AND cor IS NULL;
UPDATE generos SET cor = '#7a0000' WHERE nome = 'Terror'             AND cor IS NULL;
