@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   DUA BAN WEB MOI LEN (qt.ailla.vn va quantri.ailla.vn)
echo ------------------------------------------------------------
echo   Chi dua web len, KHONG dong vao co so du lieu.
echo   Dung khi lan cap nhat truoc bao loi o buoc "co so du lieu"
echo   hoac khi em bao "lan nay khong doi du lieu".
echo ============================================================
echo.
echo Bam phim bat ky de bat dau (hoac dong cua so de huy).
pause >nul
set CLOUDFLARE_API_TOKEN=
echo.
call npm run deploy:prod
if errorlevel 1 goto loi
echo.
echo ============================================================
echo   XONG. Web da duoc cap nhat.
echo ============================================================
pause
exit /b 0

:loi
echo.
echo ============================================================
echo   CO LOI. Chup man hinh nay gui cho em, dung chay lai nhieu lan.
echo ============================================================
pause
exit /b 1
