@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   CAP NHAT WEB AILLA (qt.ailla.vn va quantri.ailla.vn)
echo ------------------------------------------------------------
echo   Buoc 1: cap nhat co so du lieu (them bang moi, KHONG xoa gi)
echo   Buoc 2: dua ban web moi len
echo   Neu buoc 1 bao loi thi buoc 2 se KHONG chay.
echo   Khi no hoi "Ok to proceed?" thi go chu y roi bam Enter.
echo ============================================================
echo.
echo Bam phim bat ky de bat dau (hoac dong cua so de huy).
pause >nul
set CLOUDFLARE_API_TOKEN=
echo.
echo --- Buoc 1: cap nhat co so du lieu ---
call npm run db:migrate:prod
if errorlevel 1 goto loi
echo.
echo --- Buoc 2: dua web len ---
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
