@echo off
setlocal enabledelayedexpansion

echo ========================================================
echo             LANCEMENT MABOURSE - MODE DEV
echo ========================================================
echo.

:: Définir le chemin du projet
set "PROJET_PATH=%~dp0"
cd "%PROJET_PATH%"

echo [INFO] Vérification des dépendances critiques...

:: Vérifier si node_modules existe
if not exist node_modules (
    echo [ALERTE] Le dossier node_modules n'existe pas. Installation complète requise.
    goto :install_deps
)

:: Vérifier si le répertoire data existe, sinon le créer
if not exist data mkdir data
echo [INFO] Dossier de données vérifié.

:: Vérifier les bindings natifs critiques
set REINSTALL=0
if not exist "node_modules\@rollup\rollup-win32-x64-msvc" (
    echo [ALERTE] Binding natif Rollup manquant.
    set REINSTALL=1
)

if not exist "node_modules\@swc\core-win32-x64-msvc" (
    echo [ALERTE] Binding natif SWC manquant.
    set REINSTALL=1
)

if %REINSTALL%==1 (
    goto :fix_deps
) else (
    echo [INFO] Toutes les dépendances critiques sont présentes.
    goto :start_dev
)

:install_deps
echo.
echo [ACTION] Installation complète des dépendances...
echo.
call npm install
if %errorlevel% neq 0 (
    echo [ERREUR] L'installation a échoué. Tentative de correction...
    goto :fix_deps
) else (
    echo [SUCCÈS] Installation des dépendances terminée.
    goto :fix_deps
)

:fix_deps
echo.
echo [ACTION] Installation des bindings natifs critiques...
echo.
:: Installer spécifiquement les bindings natifs qui posent problème
call npm install @rollup/rollup-win32-x64-msvc --no-save
call npm install @swc/core-win32-x64-msvc --no-save

if %errorlevel% neq 0 (
    echo [ERREUR] La correction des dépendances a échoué.
    echo [INFO] Solutions possibles:
    echo    - Essayez de supprimer manuellement node_modules et package-lock.json
    echo    - Utilisez une version LTS de Node.js (les versions trop récentes peuvent causer des problèmes)
    goto :end
) else (
    echo [SUCCÈS] Installation des bindings natifs terminée.
)

:start_dev
echo.
echo [ACTION] Démarrage du serveur API (backend)...
echo.

:: Démarrer le serveur backend dans une nouvelle fenêtre
start cmd /k "node server.js"

:: Attendre 3 secondes pour que le serveur backend démarre complètement
timeout /t 3 /nobreak >nul

echo [ACTION] Démarrage du serveur de développement (frontend)...
echo.

:: Démarrer le serveur frontend dans une nouvelle fenêtre
start cmd /k "npm run dev -- --host"

:: Attendre 5 secondes pour que le serveur frontend démarre
timeout /t 5 /nobreak

:: Ouvrir le navigateur avec l'URL locale de l'application
start http://localhost:5173/

:: Obtenir l'adresse IP locale pour l'accès réseau
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set IP=%%a
    set IP=!IP:~1!
    goto :got_ip
)

:got_ip
echo.
echo [INFO] Application lancée en mode développement.
echo [INFO] Serveur API (backend): http://localhost:3001/
echo [INFO] Serveur API sur réseau: http://!IP!:3001/
echo [INFO] Application (frontend): http://localhost:5173/
echo [INFO] Application sur réseau: http://!IP!:5173/ (accessible depuis d'autres appareils)
echo [INFO] Pour arrêter les serveurs, fermez les fenêtres de commande ouvertes.
echo.

:end
echo.
echo ========================================================
echo Appuyez sur une touche pour quitter...
pause > nul