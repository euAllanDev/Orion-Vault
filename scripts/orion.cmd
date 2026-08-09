@echo off
setlocal

if "%ORION_NODE_PATH%"=="" (
  echo Orion Vault: ORION_NODE_PATH indisponivel. Abra pelo Modo dev. 1>&2
  exit /b 1
)

if "%ORION_APP_ROOT%"=="" (
  echo Orion Vault: ORION_APP_ROOT indisponivel. Abra pelo Modo dev. 1>&2
  exit /b 1
)

"%ORION_NODE_PATH%" "%ORION_APP_ROOT%\dist\cli\main.mjs" %*
exit /b %ERRORLEVEL%
