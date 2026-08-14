; Instalador da Biblioteca Escolar.
; Gera um .exe que instala o app (Node portátil + código + dependências, banco SQLite —
; sem precisar de nenhum banco de dados externo instalado), registra um Windows Service
; via NSSM e cria atalhos.
; PostgreSQL é opcional e não faz parte da instalação: quem quiser usar (ex: vários
; computadores acessando pela rede) migra depois, já dentro do sistema, em
; Configurações → Administração → "Migrar para PostgreSQL".
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
function ServicoExiste(const Nome: String): Boolean;
begin
  Result := RegKeyExists(HKLM, 'SYSTEM\CurrentControlSet\Services\' + Nome);
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
  BootstrapOk: Boolean;
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
    CreateDir(AppDir + '\logs');

    BootstrapOk := RodarComando(NodeExe, '"' + AppDir + '\scripts\bootstrap-db.js"', AppDir);

    if not BootstrapOk then
    begin
      MsgBox('Não consegui configurar o banco de dados.' + #13#10 +
        'Rode o instalador novamente ou verifique os arquivos em "' + AppDir + '\logs".', mbError, MB_OK);
      Exit;
    end;

    if not ServicoExiste('{#MyServiceName}') then
    begin
      RodarComando(NssmExe, 'install {#MyServiceName} "' + NodeExe + '" "app.js"', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} AppDirectory "' + AppDir + '"', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} DisplayName "{#MyAppName}"', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} Description "Sistema de biblioteca escolar (Node.js)"', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} Start SERVICE_AUTO_START', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} AppStdout "' + AppDir + '\logs\service.log"', AppDir);
      RodarComando(NssmExe, 'set {#MyServiceName} AppStderr "' + AppDir + '\logs\service.log"', AppDir);
    end;
    RodarComando(NssmExe, 'start {#MyServiceName}', AppDir);

    RodarComando('netsh', 'advfirewall firewall add rule name="{#MyAppName}" dir=in action=allow protocol=TCP localport={#MyAppPort}', AppDir);
  end;
end;
