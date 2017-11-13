@echo off
setlocal
set DEBUG=error
node "%~dp0\..\forward-proxy-cluster.js" %*
endlocal