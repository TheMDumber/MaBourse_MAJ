@echo off
echo =============================================
echo Construction et démarrage de l'application
echo =============================================

echo.
echo 1. Installation des dépendances...
echo ------------------------------------------
call npm install
if %errorlevel% neq 0 (
  echo Erreur lors de l'installation des dépendances.
  pause
  exit /b %errorlevel%
)

echo.
echo 2. Construction de l'application...
echo ------------------------------------------
call npm run build
if %errorlevel% neq 0 (
  echo Erreur lors de la construction de l'application.
  pause
  exit /b %errorlevel%
)

echo.
echo 3. Démarrage du serveur...
echo ------------------------------------------
echo Serveur en démarrage sur http://localhost:3001
echo Panel admin: http://localhost:3001/admin-users.html
echo.
echo Appuyez sur Ctrl+C pour arrêter le serveur
echo.
node server.js