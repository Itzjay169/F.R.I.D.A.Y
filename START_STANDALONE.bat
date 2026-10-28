@echo off
title F.R.I.D.A.Y. - Portable Zero-Dependency Launch
cls
echo ========================================================
echo  F.R.I.D.A.Y. - THE TRADING DESK [ZERO SOFTWARE LAUNCH]
echo ========================================================
echo  Starting local HUD server using native Windows PowerShell...
echo  No Node.js, Python, or installations required!
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_portable_server.ps1"
pause
