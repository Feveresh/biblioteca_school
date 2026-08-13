# Gera installer/assets/app.ico (pilha de livros, cores da marca) — usado nos atalhos
# do instalador. Formato PNG-in-ICO (suportado desde o Windows Vista), com várias
# resoluções pra ficar nítido tanto no atalho da área de trabalho quanto no Menu Iniciar.
Add-Type -AssemblyName System.Drawing

function Desenhar-Icone([int]$Tamanho) {
    $bmp = New-Object System.Drawing.Bitmap $Tamanho, $Tamanho
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $margem = $Tamanho * 0.12
    $alturaLivro = ($Tamanho - 2 * $margem) / 3.4
    $cores = @('#4338CA', '#4F46E5', '#818CF8')
    $larguras = @(1.0, 0.88, 0.74)

    for ($i = 0; $i -lt 3; $i++) {
        $y = $margem + $i * ($alturaLivro * 1.05)
        $largura = ($Tamanho - 2 * $margem) * $larguras[$i]
        $x = $margem + (($Tamanho - 2 * $margem) - $largura) / 2
        $cor = [System.Drawing.ColorTranslator]::FromHtml($cores[$i])
        $pincel = New-Object System.Drawing.SolidBrush $cor
        $raio = [Math]::Max(2, $Tamanho * 0.035)
        $retangulo = New-Object System.Drawing.RectangleF $x, $y, $largura, $alturaLivro

        $caminho = New-Object System.Drawing.Drawing2D.GraphicsPath
        $d = $raio * 2
        $caminho.AddArc($retangulo.X, $retangulo.Y, $d, $d, 180, 90)
        $caminho.AddArc($retangulo.Right - $d, $retangulo.Y, $d, $d, 270, 90)
        $caminho.AddArc($retangulo.Right - $d, $retangulo.Bottom - $d, $d, $d, 0, 90)
        $caminho.AddArc($retangulo.X, $retangulo.Bottom - $d, $d, $d, 90, 90)
        $caminho.CloseFigure()
        $g.FillPath($pincel, $caminho)
        $pincel.Dispose()
        $caminho.Dispose()
    }

    $g.Dispose()
    return $bmp
}

$tamanhos = @(16, 32, 48, 256)
$pngs = @()
foreach ($t in $tamanhos) {
    $bmp = Desenhar-Icone $t
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $pngs += ,($t, $ms.ToArray())
    $bmp.Dispose()
}

$saida = Join-Path $PSScriptRoot 'app.ico'
$fs = [System.IO.File]::Open($saida, [System.IO.FileMode]::Create)
$bw = New-Object System.IO.BinaryWriter $fs

# Cabeçalho ICO: reserved(2)=0, type(2)=1, count(2)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$pngs.Count)

$offset = 6 + (16 * $pngs.Count)
foreach ($item in $pngs) {
    $t = $item[0]
    $dados = $item[1]
    $ladoDir = if ($t -ge 256) { 0 } else { $t }  # 256 é representado como 0 no formato ICO
    $bw.Write([Byte]$ladoDir)      # largura
    $bw.Write([Byte]$ladoDir)      # altura
    $bw.Write([Byte]0)             # paleta de cores (0 = sem paleta)
    $bw.Write([Byte]0)             # reservado
    $bw.Write([UInt16]1)           # color planes
    $bw.Write([UInt16]32)          # bits por pixel
    $bw.Write([UInt32]$dados.Length)
    $bw.Write([UInt32]$offset)
    $offset += $dados.Length
}
foreach ($item in $pngs) {
    $bw.Write([Byte[]]$item[1])
}

$bw.Close()
$fs.Close()

Write-Output "Icone gerado: $saida"
