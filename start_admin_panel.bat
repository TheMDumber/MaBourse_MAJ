@echo off
echo =============================================
echo Démarrage du panel administrateur
echo =============================================

echo.
echo Si ce script échoue, essayez d'installer les dépendances:
echo npm install
echo.

echo Démarrage du serveur...
echo ------------------------------------------
echo Panel admin: http://localhost:3001/admin-users.html
echo.
echo Appuyez sur Ctrl+C pour arrêter le serveur
echo.
node server.js