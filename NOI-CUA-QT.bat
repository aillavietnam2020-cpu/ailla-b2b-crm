@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   NOI CUA qt.ailla.vn VOI TRANG QUAN TRI (lam 1 lan)
echo ------------------------------------------------------------
echo   Ma khoa dan o day KHONG hien len man hinh, khong luu file.
echo   Bam nut Copy tren Cloudflare truoc, roi mo file nay.
echo ============================================================
echo.
node scripts/noi-cua-access.mjs
echo.
pause
