@echo off
echo ===================================================
echo    Démarrage de l'application Mon Bourse
echo ===================================================
echo.

REM Vérifier le mode de démarrage
set /p mode=Mode (1: Production avec serveur, 2: Développement avec hot-reload): 
echo.

REM Vérifier si le répertoire data existe, sinon le créer
if not exist data mkdir data
echo Dossier de données vérifié.

REM Installer les dépendances si nécessaires
if not exist node_modules (
  echo Installation des dépendances...
  call npm install
  REM Installation des bindings natifs pour Windows si nécessaire
  echo Installation des bindings natifs pour Windows...
  call npm install @rollup/rollup-win32-x64-msvc --no-save
  call npm install @swc/core-win32-x64-msvc --no-save
) else (
  echo Dépendances déjà installées.
)

IF "%mode%"=="1" (
  REM Mode production avec serveur centralisé
  echo Mode: Production avec stockage centralisé
  echo.
  
  REM Construire l'application
  echo Construction de l'application...
  call npm run build
  
  REM Démarrer l'application avec serveur
  echo.
  echo Démarrage du serveur et de l'application...
  echo.
  echo Accédez à l'application via: http://localhost:3001
  echo Accédez à l'application sur réseau via: http://%COMPUTERNAME%:3001
  echo Panel administrateur: http://localhost:3001/admin-users.html
  echo.
  echo Appuyez sur Ctrl+C pour arrêter le serveur.
  echo ===================================================
  
  node server.js
) ELSE (
  REM Mode développement
  echo Mode: Développement avec hot-reload
  echo.
  
  REM Démarrer le serveur en arrière-plan
  start cmd /k "node server.js"
  
  REM Attendre un peu que le serveur démarre
  timeout /t 2 /nobreak > nul
  
  REM Démarrer l'application en mode développement avec --host
  echo.
  echo Démarrage de l'application en mode développement...
  echo.
  echo Serveur API: http://localhost:3001
  echo Serveur API sur réseau: http://%COMPUTERNAME%:3001
  echo Panel administrateur: http://localhost:3001/admin-users.html
  echo Application sur réseau: http://%COMPUTERNAME%:5173
  echo.
  echo Appuyez sur Ctrl+C pour arrêter l'application.
  echo Pour arrêter le serveur, fermez sa fenêtre.
  echo ===================================================
  
  call npm run dev -- --host
)
