@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python bulunamadi. Dosyalari bir yerel web sunucusuyla acmaniz gerekir.
  pause
  exit /b 1
)
start "Buzul Kasifi Web Sunucusu" /min python -m http.server 8000 --bind 127.0.0.1
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:8000/
echo Sunucu calisiyor. Durdurmak icin acilan sunucu penceresini kapatin.
endlocal
