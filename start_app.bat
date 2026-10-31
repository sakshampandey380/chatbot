@echo off
title PolyChat 3D - AI Server
cd /d "%~dp0"
echo ======================================================
echo   Starting PolyChat 3D AI Server...
echo   Opening http://127.0.0.1:8000 in your browser...
echo ======================================================
start "" "http://127.0.0.1:8000"
python run.py
pause
