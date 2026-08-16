@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   DUA MA NGUON LEN GITHUB RIENG TU
echo ------------------------------------------------------------
echo   Repo: https://github.com/aillavietnam2020-cpu/ailla-b2b-crm
echo.
echo   Lan dau chay, mot cua so dang nhap GitHub se hien ra.
echo   Chi dang nhap bang tai khoan aillavietnam2020-cpu.
echo ============================================================
echo.

git remote remove origin 2>nul
git remote add origin https://github.com/aillavietnam2020-cpu/ailla-b2b-crm.git
git branch -M main

echo Dang day code len GitHub...
git push -u origin main

echo.
if %ERRORLEVEL%==0 (
  echo ✅ Xong. Mo lai trang repo tren GitHub la thay day du code.
) else (
  echo ❌ Chua day duoc. Chup man hinh nay gui lai de xu ly tiep.
)
echo.
pause
