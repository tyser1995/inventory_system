@echo off
:: Inventory Management System - Auto-start Uninstaller
:: Removes the scheduled task created by install_autostart.bat.
:: Run as Administrator if prompted.

schtasks /delete /tn "InventorySystemServer" /f
if %errorlevel% == 0 (
    echo [OK] Auto-start removed.
) else (
    echo [WARN] Task not found or could not be removed.
)
pause
