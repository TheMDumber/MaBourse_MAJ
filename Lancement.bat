@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo             LANCEMENT MABOURSE - MODE DEV
echo ========================================================
echo.

rem Definir le chemin du projet
cd /d "%~dp0"

echo [INFO] Verification de l'environnement...

rem Verifier si le repertoire data existe, sinon le creer
if not exist data mkdir data
echo [INFO] Dossier de donnees OK.

rem Verifier les dependances
if not exist "node_modules\express" (
    echo [INFO] Installation des dependances...
    call npm install express cors
    echo [INFO] Dependances installees.
)

rem Verifier bindings natifs
if not exist "node_modules\@rollup\rollup-win32-x64-msvc" (
    echo [INFO] Installation des bindings natifs...
    call npm install @rollup/rollup-win32-x64-msvc --no-save
    call npm install @swc/core-win32-x64-msvc --no-save
    echo [INFO] Bindings installes.
)

rem Tuer les processus sur les ports 3001 et 5173
echo [INFO] Nettoyage des ports...
for /f "tokens=5" %%p in ('netstat -ano ^| find "3001" ^| find "LISTENING"') do (
    echo [INFO] Arret du processus sur le port 3001...
    taskkill /F /PID %%p > nul 2>&1
)

echo [INFO] Ports disponibles.

rem Verifier dist
if not exist "dist" (
    echo [ALERTE] Le dossier dist n'existe pas.
    choice /C ON /M "Construire l'application (O) ou continuer en mode dev (N)?"
    if ERRORLEVEL 2 goto start_servers
    if ERRORLEVEL 1 (
        echo [INFO] Construction de l'application...
        call npm run build
    )
)

:start_servers
echo.
echo [INFO] Demarrage des serveurs...

rem Demarrer le serveur backend
start cmd /k "node server.js"
timeout /t 3 > nul

rem Demarrer le serveur frontend
start cmd /k "npm run dev -- --host"
timeout /t 5 > nul

rem Ouvrir navigateur
start http://localhost:5173/

echo.
echo [INFO] Application lancee en mode developpement.
echo [INFO] Serveur API (backend): http://localhost:3001/
echo [INFO] Application (frontend): http://localhost:5173/
echo [INFO] Pour arreter les serveurs, fermez les fenetres de commande.
echo.
echo ========================================================

pause
