; Instalador da Biblioteca Escolar.
; Gera um .exe que instala o app (Node portátil + código + dependências), configura o
; PostgreSQL (guiado), registra um Windows Service via NSSM e cria atalhos.
; Pré-requisito: rodar "node installer\build.js" antes, pra montar installer\dist\.
; Compilar: ISCC installer\biblioteca.iss

#define MyAppName "Biblioteca Escolar"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Biblioteca Escolar"
#define MyServiceName "BibliotecaEscolar"
#define MyAppPort "3303"

[Setup]
AppId={{B324E844-F428-4BCB-BAD3-67EA0F31BFEB}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\BibliotecaEscolar
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=Output
OutputBaseFilename=BibliotecaEscolar-Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern
UninstallDisplayIcon={app}\app.ico

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar ícone na área de trabalho"; GroupDescription: "Ícones adicionais:"

[Files]
Source: "dist\app\*"; DestDir: "{app}"; Excludes: ".env,LEIA-ME.txt"; Flags: recursesubdirs ignoreversion
Source: "dist\runtime\*"; DestDir: "{app}\runtime"; Flags: recursesubdirs ignoreversion
Source: "dist\tools\*"; DestDir: "{app}\tools"; Flags: recursesubdirs ignoreversion
Source: "assets\app.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "http://localhost:{#MyAppPort}"; IconFilename: "{app}\app.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "http://localhost:{#MyAppPort}"; IconFilename: "{app}\app.ico"; Tasks: desktopicon

[Run]
Filename: "http://localhost:{#MyAppPort}"; Description: "Abrir {#MyAppName} agora"; Flags: postinstall shellexec skipifsilent

[UninstallRun]
Filename: "{app}\tools\nssm.exe"; Parameters: "stop {#MyServiceName}"; Flags: runhidden; RunOnceId: "PararServico"
Filename: "{app}\tools\nssm.exe"; Parameters: "remove {#MyServiceName} confirm"; Flags: runhidden; RunOnceId: "RemoverServico"
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""{#MyAppName}"""; Flags: runhidden; RunOnceId: "RemoverFirewall"

[Code]
var
  PaginaSenhaPostgres: TInputQueryWizardPage;

// Pascal Script não tem um jeito nativo de setar variável de ambiente do processo do
// instalador (herdada pelos processos filhos abertos com Exec) — chama a API do Windows
// direto, jeito padrão de fazer isso em scripts do Inno Setup.
function SetEnvironmentVariable(lpName, lpValue: string): Boolean;
  external 'SetEnvironmentVariableW@kernel32.dll stdcall';

function ServicoExiste(const Nome: String): Boolean;
begin
  Result := RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\' + Nome);
end;

function PostgresDetectado(): Boolean;
var
  Nomes: TArrayOfString;
  I: Integer;
begin
  Result := False;
  if RegGetSubkeyNames(HKLM, 'SYSTEM\CurrentControlSet\Services', Nomes) then
  begin
    for I := 0 to GetArrayLength(Nomes) - 1 do
    begin
      if Copy(Lowercase(Nomes[I]), 1, 10) = 'postgresql' then
      begin
        Result := True;
        Exit;
      end;
    end;
  end;
end;

// {app} só fica disponível depois que a página de diretório é exibida/confirmada — não
// dá pra usar ExpandConstant('{app}') dentro de InitializeWizard (roda cedo demais, foi
// exatamente o que causou o erro "attempt was made to expand the app constant before it
// was initialized"). Por isso vira uma função, chamada só depois (ShouldSkipPage,
// NextButtonClick, CurStepChanged), nunca em InitializeWizard.
function EnvJaExiste(): Boolean;
begin
  Result := FileExists(ExpandConstant('{app}\.env'));
end;

procedure InitializeWizard();
begin
  PaginaSenhaPostgres := CreateInputQueryPage(wpSelectDir,
    'Banco de dados PostgreSQL',
    'Este sistema precisa do PostgreSQL instalado neste computador',
    'Se o PostgreSQL ainda não estiver instalado, baixe e instale antes de continuar' + #13#10 +
    '(postgresql.org/download/windows — aceite as opções padrão e anote a senha do' + #13#10 +
    'usuário "postgres" que você vai definir durante a instalação dele).' + #13#10#13#10 +
    'Se o PostgreSQL já estiver instalado, informe a senha já existente do usuário "postgres".');
  PaginaSenhaPostgres.Add('Senha do usuário "postgres":', True);
end;

function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // Atualização (.env já existe): não precisa pedir a senha do Postgres de novo.
  Result := (PageID = PaginaSenhaPostgres.ID) and EnvJaExiste();
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = PaginaSenhaPostgres.ID then
  begin
    if PaginaSenhaPostgres.Values[0] = '' then
    begin
      MsgBox('Informe a senha do PostgreSQL para continuar.', mbError, MB_OK);
      Result := False;
    end
    else if not PostgresDetectado() then
    begin
      Result := (MsgBox('Não encontrei o PostgreSQL instalado neste computador.' + #13#10 +
        'Instale o PostgreSQL primeiro e depois continue esta instalação.' + #13#10#13#10 +
        'Continuar mesmo assim?', mbConfirmation, MB_YESNO) = IDYES);
    end;
  end;
end;

function RodarComando(const Executavel, Parametros, DirTrabalho: String): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec(Executavel, Parametros, DirTrabalho, SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  AppDir, NodeExe, NssmExe: String;
  BootstrapOk, InstalacaoNova: Boolean;
begin
  // Atualização: para o serviço ANTES dos arquivos serem copiados (ssInstall roda logo
  // antes da cópia), pra não sobrescrever arquivos do serviço enquanto ele ainda usa eles.
  // Reinicia só depois, já com os arquivos novos e o banco migrado (ssPostInstall).
  if CurStep = ssInstall then
  begin
    AppDir := ExpandConstant('{app}');
    if ServicoExiste('{#MyServiceName}') then
      RodarComando(AppDir + '\tools\nssm.exe', 'stop {#MyServiceName}', AppDir);
  end;

  if CurStep = ssPostInstall then
  begin
    AppDir := ExpandConstant('{app}');
    NodeExe := AppDir + '\runtime\node.exe';
    NssmExe := AppDir + '\tools\nssm.exe';
    InstalacaoNova := not EnvJaExiste();
    CreateDir(AppDir + '\logs');

    if InstalacaoNova then
      SetEnvironmentVariable('PG_SUPERUSER_SENHA', PaginaSenhaPostgres.Values[0]);

    BootstrapOk := RodarComando(NodeExe, '"' + AppDir + '\scripts\bootstrap-db.js"', AppDir);

    if InstalacaoNova then
      SetEnvironmentVariable('PG_SUPERUSER_SENHA', '');

    if not BootstrapOk then
    begin
      MsgBox('Não consegui configurar o banco de dados.' + #13#10 +
        'Verifique a senha do PostgreSQL informada e rode o instalador novamente.', mbError, MB_OK);
      Exit;
    end;

    if not ServicoExiste('{#MyServiceName}') then
    begin
      RodarComando(NssmExe, 'install {#MyServiceName} "' + NodeExe + '" "app.js"', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} AppDirectory "' + AppDir + '"', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} DisplayName "{#MyAppName}"', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} Description "Sistema de biblioteca escolar (Node.js + PostgreSQL)"', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} Start SERVICE_AUTO_START', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} AppStdout "' + AppDir + '\logs\service.log"', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} AppStderr "' + AppDir + '\logs\service.log"', AppDir);
    end;
    RodarComando(NssmExe, 'start {#MyServiceName}', AppDir);

    RodarComando('netsh', 'advfirewall firewall add rule name="{#MyAppName}" dir=in action=allow protocol=TCP localport={#MyAppPort}', AppDir);
  end;
end;
