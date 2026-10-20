@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   TAO KHOA CAU NOI (nhan agent tu web)
echo ------------------------------------------------------------
echo   Lenh nay tao 1 khoa ngau nhien, dat vao web, va CHEP SAN
echo   vao bo nho tam (clipboard). Khoa KHONG hien tren man hinh,
echo   KHONG luu vao file nao.
echo   Sau do chi vao Termius (VPS), chay:  abos-relay-khoa
echo   va bam Ctrl+V de dan khoa.
echo ============================================================
echo.
echo Bam phim bat ky de bat dau (hoac dong cua so de huy).
pause >nul
set CLOUDFLARE_API_TOKEN=
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\tao-khoa-cau-noi.ps1"
if errorlevel 1 goto loi
echo.
echo ============================================================
echo   XONG. Khoa da dat vao web va dang nam trong clipboard.
echo   Gio vao Termius: abos-relay-khoa  roi Ctrl+V.
echo   (Dung copy gi khac truoc khi dan xong.)
echo ============================================================
pause
exit /b 0
:loi
echo.
echo CO LOI. Chup man hinh gui lai cho em.
pause
exit /b 1
