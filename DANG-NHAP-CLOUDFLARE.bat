@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   DANG NHAP CLOUDFLARE CHO AILLA B2B CRM
echo ------------------------------------------------------------
echo   1. Trinh duyet se tu mo mot tab Cloudflare.
echo   2. Bam nut xanh "Authorize" NGAY (chi co 2 phut).
echo   3. Cho toi khi thay dong "Successfully logged in".
echo ============================================================
echo.
call npx wrangler login
echo.
echo ------------------------------------------------------------
call npx wrangler whoami
echo ------------------------------------------------------------
echo Neu thay email tai khoan o tren la da dang nhap thanh cong.
echo Neu bao "Timed out" thi chi can dong cua so nay va bam lai file.
echo.
pause
