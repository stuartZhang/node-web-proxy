@echo off
setlocal
set DEBUG=error
node "%~dp0\..\service-register.js"
endlocal