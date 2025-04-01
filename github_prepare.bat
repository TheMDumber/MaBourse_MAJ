@echo off
title Preparation GitHub - M Bourse

:menu
cls
echo ===================================================
echo        PREPARATION GITHUB - M BOURSE
echo ===================================================
echo.
echo  [1] Nettoyer le projet (fichiers non necessaires)
echo  [2] Initialiser un nouveau depot Git
echo  [3] Mettre a jour le depot Git existant
echo  [4] Quitter
echo.
set /p choix=Votre choix [1-4]: 

if "%choix%"=="1" goto nettoyer
if "%choix%"=="2" goto init_depot
if "%choix%"=="3" goto update_depot
if "%choix%"=="4" goto fin
goto menu

:nettoyer
cls
echo ===================================================
echo        NETTOYAGE DU PROJET
echo ===================================================
echo.

echo Les fichiers suivants vont etre supprimes :
echo  - node_modules (dossier des dependances)
echo  - dist et build (dossiers de compilation)
echo  - Fichiers temporaires (*.log, *.tmp, .DS_Store)
echo  - Fichiers d'environnement (.env)
echo.

set /p confirm=Confirmer le nettoyage? (O/N): 
if /i not "%confirm%"=="O" goto menu

echo.
echo Nettoyage en cours...

if exist node_modules (
    echo - Suppression de node_modules...
    rmdir /s /q node_modules
    echo   [OK] node_modules supprime.
) else (
    echo   [INFO] Dossier node_modules absent.
)

if exist dist (
    echo - Suppression de dist...
    rmdir /s /q dist
    echo   [OK] dist supprime.
)

if exist build (
    echo - Suppression de build...
    rmdir /s /q build
    echo   [OK] build supprime.
)

echo - Suppression des fichiers temporaires...
del /s /q *.log >nul 2>&1
del /s /q *.tmp >nul 2>&1
del /s /q .DS_Store >nul 2>&1
echo   [OK] Fichiers temporaires supprimes.

echo - Suppression des fichiers d'environnement...
if exist .env del /q .env
if exist .env.local del /q .env.local
echo   [OK] Fichiers d'environnement supprimes.

echo.
echo Nettoyage termine avec succes!
echo.
pause
goto menu

:init_depot
cls
echo ===================================================
echo        INITIALISATION DU DEPOT GIT
echo ===================================================
echo.

rem Vérifier que Git est installé
git --version >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Git n'est pas installe ou n'est pas dans le PATH.
    echo Installez Git avant de continuer.
    echo.
    pause
    goto menu
)

if exist .git (
    echo [INFO] Ce dossier contient deja un depot Git.
    set /p reinit=Souhaitez-vous reinitialiser le depot? (O/N): 
    if /i not "%reinit%"=="O" goto menu
    
    echo - Suppression du depot existant...
    rmdir /s /q .git
    echo   [OK] Ancien depot supprime.
)

echo.
echo Initialisation du depot Git...
git init
if errorlevel 1 (
    echo [ERREUR] Echec de l'initialisation du depot.
    pause
    goto menu
) else (
    echo [OK] Depot Git initialise.
)

echo.
echo Ajout des fichiers au depot...
git add .
if errorlevel 1 (
    echo [ERREUR] Echec de l'ajout des fichiers.
) else (
    echo [OK] Fichiers ajoutes au depot.
)

echo.
echo Creation du commit initial...
git commit -m "Initial commit"
if errorlevel 1 (
    echo [ERREUR] Echec du commit initial.
    echo Verifiez que votre identite Git est configuree:
    echo   git config --global user.name "Votre Nom"
    echo   git config --global user.email "votre@email.com"
) else (
    echo [OK] Commit initial cree.
)

echo.
echo Configuration du depot distant GitHub...
set /p remote_url=URL du depot GitHub (format: https://github.com/username/repo.git): 
if "%remote_url%"=="" (
    echo [INFO] Aucune URL saisie. Configuration du depot distant ignoree.
) else (
    git remote add origin %remote_url%
    if errorlevel 1 (
        echo [ERREUR] Echec de l'ajout du depot distant.
    ) else (
        echo [OK] Depot distant configure.
        
        echo.
        set /p push_confirm=Pousser le code vers GitHub maintenant? (O/N): 
        if /i "%push_confirm%"=="O" (
            git push -u origin master
            if errorlevel 1 (
                git push -u origin main
                if errorlevel 1 (
                    echo [ERREUR] Echec du push vers GitHub.
                    echo Verifiez vos identifiants et l'URL du depot.
                ) else (
                    echo [OK] Code pousse avec succes vers la branche main.
                )
            ) else (
                echo [OK] Code pousse avec succes vers la branche master.
            )
        )
    )
)

echo.
echo Initialisation du depot Git terminee!
echo.
pause
goto menu

:update_depot
cls
echo ===================================================
echo        MISE A JOUR DU DEPOT GIT
echo ===================================================
echo.

rem Vérifier que Git est installé et que le dépôt existe
git status >nul 2>&1
if errorlevel 1 (
    echo [ERREUR] Aucun depot Git valide trouve dans ce dossier.
    echo Vous devez d'abord initialiser un depot Git (option 2).
    echo.
    pause
    goto menu
)

echo Statut actuel du depot:
echo.
git status
echo.

echo Fichiers modifies a ajouter:
set /p add_confirm=Ajouter tous les fichiers modifies? (O/N): 
if /i "%add_confirm%"=="O" (
    git add .
    if errorlevel 1 (
        echo [ERREUR] Echec de l'ajout des fichiers.
    ) else (
        echo [OK] Fichiers ajoutes.
    )
)

echo.
echo Creation d'un commit:
set /p commit_msg=Message de commit (laissez vide pour annuler): 
if "%commit_msg%"=="" (
    echo [INFO] Commit annule.
) else (
    git commit -m "%commit_msg%"
    if errorlevel 1 (
        echo [ERREUR] Echec du commit.
    ) else (
        echo [OK] Commit cree avec succes.
        
        echo.
        echo Branche actuelle: 
        for /f "tokens=*" %%a in ('git rev-parse --abbrev-ref HEAD') do set current_branch=%%a
        echo %current_branch%
        
        set /p push_confirm=Pousser les modifications vers GitHub? (O/N): 
        if /i "%push_confirm%"=="O" (
            git push origin %current_branch%
            if errorlevel 1 (
                echo [ERREUR] Echec du push vers GitHub.
                echo Verifiez votre connexion et les identifiants.
            ) else (
                echo [OK] Modifications poussees avec succes vers GitHub.
            )
        )
    )
)

echo.
echo Mise a jour du depot Git terminee!
echo.
pause
goto menu

:fin
echo.
echo Au revoir!
echo.
timeout /t 2 >nul
exit
