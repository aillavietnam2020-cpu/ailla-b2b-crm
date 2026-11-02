@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   NOI GOOGLE DRIVE VOI WEB (Thu muc lam viec)
echo ------------------------------------------------------------
echo   Chon file khoa .json cua tai khoan may Google vua tai ve.
echo   Khoa duoc dat thang vao web, KHONG hien tren man hinh.
echo   Xong se bo file .json vao Thung rac cho an toan.
echo ============================================================
echo.
echo Bam phim bat ky de chon file (hoac dong cua so de huy).
pause >nul
set CLOUDFLARE_API_TOKEN=
powershell -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0scripts\noi-google-drive.ps1"
if errorlevel 1 goto loi
echo.
echo ============================================================
echo   XONG. Gio vao web quan tri: Cau hinh ^> Thu muc Drive cac phong
echo   de dan link thu muc tung phong.
echo ============================================================
pause
exit /b 0
:loi
echo.
echo CO LOI. Chup man hinh gui lai cho em.
pause
exit /b 1
