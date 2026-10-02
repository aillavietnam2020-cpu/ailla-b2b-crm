@echo off
chcp 65001 >nul
cd /d "%~dp0"
rem Dung tai khoan Cloudflare da dang nhap; token trong bien moi truong thieu quyen D1.
set CLOUDFLARE_API_TOKEN=
echo ============================================================
echo   DAT MAT KHAU DANG NHAP CRM (ban that tren Cloudflare)
echo ------------------------------------------------------------
echo   Mat khau go o day KHONG hien len man hinh va khong gui
echo   di dau ngoai database cua cong ty.
echo ============================================================
echo.
set /p EMAIL="Email tai khoan (vi du aillavietnam2020@gmail.com): "
echo.
node scripts/set-password.mjs --env production --email %EMAIL%
echo.
pause
