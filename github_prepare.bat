@echo off
title Preparation GitHub - Mabourse

:menu
cls
echo ========================================================
echo   PREPARATION DU DEPOT GITHUB - MABOURSE
echo ========================================================
echo.
echo Options:
echo [1] Nettoyer le projet
echo [2] Initialiser un nouveau depot GitHub
echo [3] Mettre a jour un depot GitHub existant
echo [4] Creer fichier .gitignore
echo [5] Quitter
echo.
set /p choice=Votre choix [1-5]: 

if "%choice%"=="1" goto clean
if "%choice%"=="2" goto init_repo
if "%choice%"=="3" goto update_repo
if "%choice%"=="4" goto create_gitignore
if "%choice%"=="5" goto end
goto menu

:clean
cls
echo ========================================================
echo   NETTOYAGE DU PROJET
echo ========================================================
echo.
echo Suppression des fichiers et dossiers non necessaires...

if exist node_modules (
    echo - Suppression du dossier node_modules...
    rmdir /s /q node_modules
    echo   [OK] Dossier node_modules supprime.
)

if exist build (
    echo - Suppression du dossier build...
    rmdir /s /q build
    echo   [OK] Dossier build supprime.
)

if exist dist (
    echo - Suppression du dossier dist...
    rmdir /s /q dist
    echo   [OK] Dossier dist supprime.
)

echo - Suppression des fichiers de log...
if exist *.log del /q *.log
echo   [OK] Fichiers de log supprimes.

echo - Suppression des fichiers d'environnement...
if exist .env del /q .env
echo   [OK] Fichiers d'environnement supprimes.

echo.
echo Nettoyage termine avec succes!
echo.
pause
goto menu

:update_repo
cls
echo ========================================================
echo   MISE A JOUR DU DEPOT GITHUB
echo ========================================================
echo.

echo Etape 1: Ajout des fichiers modifies
git add .
echo [OK] Fichiers ajoutes

echo.
echo Etape 2: Creation d'un commit
set /p commit_msg=Message de commit: 
git commit -m "%commit_msg%"
echo [OK] Commit cree

echo.
echo Etape 3: Envoi des changements
set /p push_confirm=Pousser vers GitHub? (O/N): 
if /i "%push_confirm%"=="O" (
    git push
    echo [OK] Changements envoyes
)

echo.
echo Mise a jour terminee!
echo.
pause
goto menu

:init_repo
cls
echo ========================================================
echo   INITIALISATION D'UN NOUVEAU DEPOT
echo ========================================================
echo.
echo Pour initialiser un nouveau depot:
echo 1. git init
echo 2. git add .
echo 3. git commit -m "Initial commit"
echo 4. git remote add origin URL_DEPOT
echo 5. git push -u origin main
echo.
pause
goto menu

:create_gitignore
cls
echo ========================================================
echo   CREATION DU FICHIER .GITIGNORE
echo ========================================================
echo.

echo Creation du fichier .gitignore...
echo # Dependances > .gitignore
echo node_modules/ >> .gitignore
echo npm-debug.log >> .gitignore
echo yarn-error.log >> .gitignore
echo package-lock.json >> .gitignore
echo.
echo # Production >> .gitignore
echo build/ >> .gitignore
echo dist/ >> .gitignore
echo.
echo # Environnement >> .gitignore
echo .env >> .gitignore
echo .env.local >> .gitignore

echo Fichier .gitignore cree avec succes!
echo.
pause
goto menu

:end
echo.
echo Merci d'avoir utilise cet outil!
echo.
pause
exit
