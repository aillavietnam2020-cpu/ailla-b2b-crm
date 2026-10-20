@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   DAT MAT KHAU DANG NHAP BAN THU (staging)
echo   Dia chi: https://ailla-b2b-crm-staging.aillavietnam2020.workers.dev/
echo ------------------------------------------------------------
echo   Mat khau go o day KHONG hien len man hinh va chi luu
echo   trong database cua BAN THU, khong dinh gi toi web chinh.
echo   Tai khoan CEO cua ban thu la: ceo@ailla.vn
echo ============================================================
echo.
set /p EMAIL="Email tai khoan (go ceo@ailla.vn roi Enter): "
echo.
set CLOUDFLARE_API_TOKEN=
node scripts/set-password.mjs --env staging --email %EMAIL%
echo.
pause
