@echo off
chcp 65001 >nul
cd /d "%~dp0"
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
