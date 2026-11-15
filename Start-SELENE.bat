@echo off
setlocal
title SELENE - Local launcher
cd /d "%~dp0"
set "SELENE_NODE="
for /f "delims=" %%I in ('where node.exe 2^>nul') do if not defined SELENE_NODE set "SELENE_NODE=%%I"
if not defined SELENE_NODE set "SELENE_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%SELENE_NODE%" (
    echo Node.js was not found. Install Node.js from https://nodejs.org/ and try again.
    pause
    exit /b 1
)
"%SELENE_NODE%" "%~dp0server\launch-selene.cjs"
if errorlevel 1 (
    echo.
    echo SELENE could not start. See the message above.
    pause
    exit /b 1
)
endlocal
