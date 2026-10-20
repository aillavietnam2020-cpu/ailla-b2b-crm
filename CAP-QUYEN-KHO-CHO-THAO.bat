@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo   CAP QUYEN XU LY DON O KHO CHO CHI THAO QUAN LY
echo ------------------------------------------------------------
echo   Chi them DUNG MOT quyen "xu ly don o kho" (giong chi Hue).
echo   Khong xoa va khong doi quyen nao khac.
echo   Chi Thao dang nhap lai la co hieu luc.
echo ============================================================
echo.
echo Bam phim bat ky de lam (hoac dong cua so de huy).
pause >nul
set CLOUDFLARE_API_TOKEN=
echo.
echo --- Dang cap quyen ---
call npx wrangler d1 execute ailla_crm_prod --remote --env production --command "INSERT OR IGNORE INTO user_permissions (user_id, permission, granted_by, created_at) SELECT u.id, 'order.kho.process', (SELECT id FROM users WHERE role = 'CEO' AND deleted_at IS NULL ORDER BY created_at LIMIT 1), datetime('now') FROM users u WHERE u.display_name LIKE 'Th%%o Qu%%n L%%' AND u.deleted_at IS NULL AND u.status = 'ACTIVE'"
if errorlevel 1 goto loi
echo.
echo --- Quyen hien tai cua chi Thao ---
call npx wrangler d1 execute ailla_crm_prod --remote --env production --command "SELECT u.display_name AS ten, group_concat(p.permission, ', ') AS quyen FROM users u JOIN user_permissions p ON p.user_id = u.id WHERE u.display_name LIKE 'Th%%o Qu%%n L%%' GROUP BY u.id"
echo.
echo ============================================================
echo   XONG. Neu thay "order.kho.process" trong danh sach tren la da cap.
echo ============================================================
pause
exit /b 0
:loi
echo.
echo *** CO LOI, CHUA CAP QUYEN. Chup man hinh nay gui em. ***
pause
exit /b 1
