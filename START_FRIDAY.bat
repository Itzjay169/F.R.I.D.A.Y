@echo off
title F.R.I.D.A.Y. - The Trading Desk
cls
echo ========================================================
echo        F.R.I.D.A.Y. – THE VOICE TRADING DESK
echo ========================================================
echo  Checking environment and auto-configuring portable runtime...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup_portable_runtime.ps1"
pause
