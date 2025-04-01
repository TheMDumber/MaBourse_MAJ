import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Structure de données de l'utilisateur (version JS)
// Structure du fichier utilisateur avec authentification
// Structure pour stocker la liste des utilisateurs

// Chemin vers le dossier de données
const DATA_DIR = path.resolve(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Assurer que le dossier de données existe
export function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Dossier de données créé: ${DATA_DIR}`);
  }
  
  // Créer le fichier users.json s'il n'existe pas
  if (!fs.existsSync(USERS_FILE)) {
    const initialUsersList = {
      users: [],
      lastUpdated: new Date()
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsersList, null, 2));
    console.log(`Fichier utilisateurs créé: ${USERS_FILE}`);
  }
}

// Hacher un mot de passe avec un sel
function hashPassword(password, salt) {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

// Vérifier si un mot de passe correspond au hash stocké
function verifyPassword(password, storedHash, salt) {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

// Sauvegarder les données d'un utilisateur
export async function saveUserData(username, password, data) {
  ensureDataDir();
  
  // Générer un ID unique basé sur le nom d'utilisateur
  const userId = crypto.createHash('md5').update(username).digest('hex');
  const userFilePath = path.join(DATA_DIR, `${userId}.json`);
  
  // Hacher le mot de passe
  const { hash: passwordHash, salt } = hashPassword(password);
  
  // Vérifier si le fichier utilisateur existe déjà
  const isNewUser = !fs.existsSync(userFilePath);
  const currentDate = new Date();
  
  // Créer ou mettre à jour le fichier utilisateur
  let userFile;
  
  if (isNewUser) {
    // Nouvel utilisateur
    userFile = {
      username,
      passwordHash,
      salt,
      createdAt: currentDate,
      lastLogin: currentDate,
      data: {
        ...data,
        lastSyncTime: currentDate
      }
    };
  } else {
    // Utilisateur existant, charger le fichier pour préserver les dates
    const existingContent = await fs.promises.readFile(userFilePath, 'utf-8');
    const existingUserFile = JSON.parse(existingContent);
    
    userFile = {
      username,
      passwordHash,
      salt,
      createdAt: existingUserFile.createdAt || currentDate, // Conserver la date de création
      lastLogin: existingUserFile.lastLogin, // Conserver la dernière connexion
      data: {
        ...data,
        lastSyncTime: currentDate
      }
    };
  }
  
  // Écrire le fichier
  await fs.promises.writeFile(userFilePath, JSON.stringify(userFile, null, 2));
  console.log(`Données utilisateur sauvegardées: ${userFilePath}`);
  
  // Mettre à jour la liste des utilisateurs avec les métadonnées
  await updateUsersList(username, userId, isNewUser ? currentDate : null);
}

// Mettre à jour la liste des utilisateurs
async function updateUsersList(username, userId, createdAt = null) {
  try {
    // Lire la liste actuelle
    const usersListContent = await fs.promises.readFile(USERS_FILE, 'utf-8');
    const usersList = JSON.parse(usersListContent);
    
    // Vérifier si l'utilisateur existe déjà
    const existingUserIndex = usersList.users.findIndex(u => u.id === userId);
    
    if (existingUserIndex >= 0) {
      // Mise à jour de l'utilisateur existant
      // Préserver les métadonnées existantes
      const existingUser = usersList.users[existingUserIndex];
      usersList.users[existingUserIndex] = { 
        ...existingUser,
        username,
        id: userId
      };
    } else {
      // Ajout d'un nouvel utilisateur avec métadonnées
      usersList.users.push({
        username, 
        id: userId,
        createdAt: createdAt || new Date(),
        lastLogin: null
      });
    }
    
    usersList.lastUpdated = new Date();
    
    // Écrire la liste mise à jour
    await fs.promises.writeFile(USERS_FILE, JSON.stringify(usersList, null, 2));
    console.log(`Liste des utilisateurs mise à jour: ${usersList.users.length} utilisateurs`);
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la liste des utilisateurs:', error);
    throw error;
  }
}

// Charger les données d'un utilisateur
export async function loadUserData(username, password) {
  ensureDataDir();
  
  try {
    // Trouver l'ID de l'utilisateur
    const usersListContent = await fs.promises.readFile(USERS_FILE, 'utf-8');
    const usersList = JSON.parse(usersListContent);
    
    const userEntry = usersList.users.find(u => u.username === username);
    if (!userEntry) {
      console.error(`Utilisateur ${username} non trouvé`);
      return null;
    }
    
    // Charger le fichier de l'utilisateur
    const userFilePath = path.join(DATA_DIR, `${userEntry.id}.json`);
    if (!fs.existsSync(userFilePath)) {
      console.error(`Fichier de données pour ${username} non trouvé: ${userFilePath}`);
      return null;
    }
    
    const userFileContent = await fs.promises.readFile(userFilePath, 'utf-8');
    const userFile = JSON.parse(userFileContent);
    
    // Vérifier le mot de passe
    if (!verifyPassword(password, userFile.passwordHash, userFile.salt)) {
      console.error('Mot de passe incorrect pour', username);
      return null;
    }
    
    // Mettre à jour la date de dernière connexion
    const currentDate = new Date();
    userFile.lastLogin = currentDate;
    await fs.promises.writeFile(userFilePath, JSON.stringify(userFile, null, 2));
    
    // Mettre à jour également la date dans la liste des utilisateurs
    const userIndex = usersList.users.findIndex(u => u.username === username);
    if (userIndex >= 0) {
      usersList.users[userIndex].lastLogin = currentDate;
      usersList.lastUpdated = currentDate;
      await fs.promises.writeFile(USERS_FILE, JSON.stringify(usersList, null, 2));
    }
    
    return userFile.data;
  } catch (error) {
    console.error('Erreur lors du chargement des données utilisateur:', error);
    return null;
  }
}

// Obtenir la liste des utilisateurs avec leurs métadonnées
export async function getUsersList() {
  ensureDataDir();
  
  try {
    const usersListContent = await fs.promises.readFile(USERS_FILE, 'utf-8');
    const usersList = JSON.parse(usersListContent);
    
    // Si certains utilisateurs n'ont pas de métadonnées (pour la rétrocompatibilité),
    // ajouter des valeurs par défaut
    return usersList.users.map(user => ({
      ...user,
      createdAt: user.createdAt || null,
      lastLogin: user.lastLogin || null
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des utilisateurs:', error);
    return [];
  }
}

// Vérifier si un utilisateur existe
export async function userExists(username) {
  try {
    const users = await getUsersList();
    return users.some(u => u.username === username);
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'existence de l\'utilisateur:', error);
    return false;
  }
}

// Supprimer un utilisateur
export async function deleteUser(username, password, isAdminRequest = false) {
  ensureDataDir();
  
  try {
    // Si ce n'est pas une requête administrative, vérifier le mot de passe
    if (!isAdminRequest) {
      const userData = await loadUserData(username, password);
      if (!userData) {
        return false; // Utilisateur non trouvé ou mot de passe incorrect
      }
    }
    
    // Trouver l'ID de l'utilisateur
    const usersListContent = await fs.promises.readFile(USERS_FILE, 'utf-8');
    const usersList = JSON.parse(usersListContent);
    
    const userEntry = usersList.users.find(u => u.username === username);
    if (!userEntry) {
      return false;
    }
    
    // Supprimer le fichier de données
    const userFilePath = path.join(DATA_DIR, `${userEntry.id}.json`);
    if (fs.existsSync(userFilePath)) {
      await fs.promises.unlink(userFilePath);
      console.log(`Fichier utilisateur supprimé: ${userFilePath}`);
    }
    
    // Mettre à jour la liste des utilisateurs
    usersList.users = usersList.users.filter(u => u.username !== username);
    usersList.lastUpdated = new Date();
    
    await fs.promises.writeFile(USERS_FILE, JSON.stringify(usersList, null, 2));
    console.log(`Utilisateur ${username} supprimé de la liste`);
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    return false;
  }
}
