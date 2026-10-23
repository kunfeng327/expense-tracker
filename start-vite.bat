@echo off
cd /d "%~dp0frontend"
node node_modules\vite\bin\vite.js --port 5173 > ..\vite.log 2>&1
