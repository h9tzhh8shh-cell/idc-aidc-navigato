@echo off
cd /d "%~dp0"
node scripts\serve.mjs dist 5050
pause
