; nsis-hooks.nsh — MEC-30 · correção do Setup NSIS
; =================================================
; Problema: ao instalar/desinstalar/reinstalar, os processos filhos do app
; (node.exe do backend, postgres.exe, python.exe) continuam em execução e
; seguram os arquivos nativos de `backend\node_modules\@img\sharp-win32-x64\lib`
; (libvips-42.dll, libvips-cpp-8.18.3.dll, sharp-win32-x64-0.35.3.node) e de
; `@msgpackr-extract` (node.napi.node). O NSIS então falha com
; "Error opening file for writing" e, se o usuário clicar em Ignorar, o app
; instala sem as DLLs e quebra no login.
;
; O template padrão do Tauri só encerra o binário principal
; (mangaink-desktop.exe) via CheckIfAppIsRunning — os filhos sobrevivem e
; mantêm o lock. Estes hooks encerram TODOS os processos cujo executável esteja
; dentro de $INSTDIR (mantém a árvore de processos do app) antes de instalar e
; antes de desinstalar, excluindo o próprio instalador/desinstalador em execução.
;
; Nota de implementação: usamos um arquivo .ps1 temporário em vez de passar o
; script inline via -Command. O nsExec::ExecToLog interpreta `|`, `>`, `<` como
; redirecionamento — um script com pipes inline trava o instalador.

!macro KillMangaInkAgentProcesses
  ; PID do processo NSIS atual (instalador ou desinstalador) para nunca se matar
  System::Call "kernel32::GetCurrentProcessId() i.r0"

  ; Escreve o script de encerramento em $TEMP (cada linha com fim de linha).
  ; O script encerra os processos sob $INSTDIR e POLLA até não restar nenhum
  ; (até ~10s), em vez de um Sleep fixo — o Stop-Process é assíncrono e, em
  ; máquinas lentas, 1500ms não garantiam que os handles de arquivo fossem
  ; liberados (race que reproduzia o "Error opening file for writing").
  FileOpen $9 "$TEMP\mangaink-kill.ps1" w
  FileWrite $9 'param([string]$$installDir, [int]$$installerPid)$\r$\n'
  FileWrite $9 '$$deadline = (Get-Date).AddSeconds(10)$\r$\n'
  FileWrite $9 'do {$\r$\n'
  FileWrite $9 '  $$victims = Get-CimInstance Win32_Process | Where-Object { $$_.ProcessId -ne $$installerPid -and $$_.ProcessId -ne $$PID -and $$_.ExecutablePath -and $$_.ExecutablePath.ToLower().StartsWith($$installDir.ToLower()) }$\r$\n'
  FileWrite $9 '  foreach ($$p in $$victims) { Stop-Process -Id $$p.ProcessId -Force -ErrorAction SilentlyContinue }$\r$\n'
  FileWrite $9 '  if ($$victims.Count -eq 0) { break }$\r$\n'
  FileWrite $9 '  Start-Sleep -Milliseconds 200$\r$\n'
  FileWrite $9 '} while ((Get-Date) -lt $$deadline)$\r$\n'
  FileWrite $9 '$$remaining = Get-CimInstance Win32_Process | Where-Object { $$_.ProcessId -ne $$installerPid -and $$_.ProcessId -ne $$PID -and $$_.ExecutablePath -and $$_.ExecutablePath.ToLower().StartsWith($$installDir.ToLower()) }$\r$\n'
  FileWrite $9 'if ($$remaining.Count -gt 0) { Write-Error "$$($$remaining.Count) processo(s) do MangaInk Agent ainda em execução após 10s — arquivos podem ficar bloqueados."; exit 1 }$\r$\n'
  FileWrite $9 'exit 0$\r$\n'
  FileClose $9

  DetailPrint "Encerrando processos do MangaInk Agent (se em execução)..."
  nsExec::ExecToLog 'powershell -NoProfile -ExecutionPolicy Bypass -File "$TEMP\mangaink-kill.ps1" "$INSTDIR" $0'
  ; nsExec::ExecToLog é síncrono (aguarda o powershell sair); o Sleep residual
  ; é só uma folga para o SO liberar handles de arquivo após o término.
  Sleep 500
  Delete "$TEMP\mangaink-kill.ps1"
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro KillMangaInkAgentProcesses
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro KillMangaInkAgentProcesses
!macroend

; NSIS_HOOK_POSTINSTALL — corrige o ícone dos atalhos (desktop + start menu).
;
; O template do Tauri cria os atalhos com `CreateShortcut` sem IconFile explícito,
; então o .lnk guarda IconLocation vazio e o Explorer resolve o ícone a partir
; do cache por caminho do exe. Depois de várias instalações/desinstalações o
; cache fica obsoleto e o desktop mostra ícone genérico/em branco em vez da logo.
; Aqui recriamos os atalhos apontando explicitamente para o ícone do exe e
; notificamos o shell para re-renderizar.
!macro NSIS_HOOK_POSTINSTALL
  ; Recria o atalho do desktop com ícone explícito do exe instalado.
  CreateShortcut "$DESKTOP\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
  !insertmacro SetLnkAppUserModelId "$DESKTOP\${PRODUCTNAME}.lnk"
  ; Recria o atalho do start menu com o mesmo ícone explícito.
  CreateShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
  !insertmacro SetLnkAppUserModelId "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  ; Força o Explorer a re-ler o ícone do atalho (SHChangeNotify SHCNE_ASSOCCHANGED).
  System::Call "shell32::SHChangeNotify(i 0x08000000, i 0x1000, i 0, i 0)"
!macroend
