@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   DAT MAT KHAU DANG NHAP CRM (ban DEMO)
echo ------------------------------------------------------------
echo   Mat khau go o day KHONG hien len man hinh va khong gui
echo   di dau ngoai database cua cong ty.
echo ============================================================
echo.
set /p EMAIL="Email tai khoan (tai khoan CEO la ceo@ailla.vn): "
echo.
set CLOUDFLARE_API_TOKEN=
node scripts/set-password.mjs --env demo --email %EMAIL% --save-sql
echo.
pause
