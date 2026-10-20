@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   SAO LUU DU LIEU WEB AILLA NGAY BAY GIO
echo   File se nam o F:\SAO-LUU-WEB-AILLA
echo ============================================================
echo.
node scripts/sao-luu.mjs
echo.
pause
