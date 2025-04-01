import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Account, Transaction, RecurringTransaction, UserPreferences } from './types';

// Structure de données de l'utilisateur
export interface UserData {
  accounts: Account[];
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  preferences: UserPreferences;
  lastSyncTime: Date;
  syncId?: string;      // Identifiant unique de synchronisation
  deviceId?: string;    // Identifiant de l'appareil source
}

// Structure du fichier utilisateur avec authentification
export interface UserFile {
  username: string;
  passwordHash: string;
  salt: string;
  data: UserData;
}

// Structure pour stocker la liste des utilisateurs
export interface UsersList {
  users: { username: string, id: string }[];
  lastUpdated: Date;
}

// Chemin vers le dossier de données
const DATA_DIR = path.resolve(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Assurer que le dossier de données existe
export function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`Dossier de données créé: ${DATA_DIR}`);
  }
  
  // Créer le fichier users.json s'il n'existe pas
  if (!fs.existsSync(USERS_FILE)) {
    const initialUsersList: UsersList = {
      users: [],
      lastUpdated: new Date()
    };
    fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsersList, null, 2));
    console.log(`Fichier utilisateurs créé: ${USERS_FILE}`);
  }
}

// Hacher un mot de passe avec un sel
function hashPassword(password: string, salt?: string): { hash: string, salt: string } {
  const generatedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, generatedSalt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt: generatedSalt };
}

// Vérifier si un mot de passe correspond au hash stocké
function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  return hash === storedHash;
}

// Sauvegarder les données d'un utilisateur
export async function saveUserData(username: string, password: string, data: UserData): Promise<void> {
  ensureDataDir();
  
  // Générer un ID unique basé sur le nom d'utilisateur
  const userId = crypto.createHash('md5').update(username).digest('hex');
  const userFilePath = path.join(DATA_DIR, `${userId}.json`);
  
  // Hacher le mot de passe
  const { hash: passwordHash, salt } = hashPassword(password);
  
  // Créer le fichier utilisateur
  const userFile: UserFile = {
    username,
    passwordHash,
    salt,
    data: {
      ...data,
      lastSyncTime: new Date()
    }
  };
  
  // Écrire le fichier
  await fs.promises.writeFile(userFilePath, JSON.stringify(userFile, null, 2));
  console.log(`Données utilisateur sauvegardées: ${userFilePath}`);
  
  // Mettre à jour la liste des utilisateurs
  await updateUsersList(username, userId);
}

// Mettre à jour la liste des utilisateurs
async function updateUsersList(username: string, userId: string): Promise<void> {
  try {
    // Lire la liste actuelle
    const usersListContent = await fs.promises.readFile(USERS_FILE, 'utf-8');
    const usersList: UsersList = JSON.parse(usersListContent);
    
    // Vérifier si l'utilisateur existe déjà
    const existingUserIndex = usersList.users.findIndex(u => u.id === userId);
    
    if (existingUserIndex >= 0) {
      // Mise à jour de l'utilisateur existant
      usersList.users[existingUserIndex] = { username, id: userId };
    } else {
      // Ajout d'un nouvel utilisateur
      usersList.users.push({ username, id: userId });
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
export async function loadUserData(username: string, password: string): Promise<UserData | null> {
  ensureDataDir();
  
  try {
    // Trouver l'ID de l'utilisateur
    const usersListContent = await fs.promises.readFile(USERS_FILE, 'utf-8');
    const usersList: UsersList = JSON.parse(usersListContent);
    
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
    const userFile: UserFile = JSON.parse(userFileContent);
    
    // Vérifier le mot de passe
    if (!verifyPassword(password, userFile.passwordHash, userFile.salt)) {
      console.error('Mot de passe incorrect pour', username);
      return null;
    }
    
    return userFile.data;
  } catch (error) {
    console.error('Erreur lors du chargement des données utilisateur:', error);
    return null;
  }
}

// Obtenir la liste des utilisateurs (sans leurs données ni mots de passe)
export async function getUsersList(): Promise<{ username: string, id: string }[]> {
  ensureDataDir();
  
  try {
    const usersListContent = await fs.promises.readFile(USERS_FILE, 'utf-8');
    const usersList: UsersList = JSON.parse(usersListContent);
    return usersList.users;
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des utilisateurs:', error);
    return [];
  }
}

// Vérifier si un utilisateur existe
export async function userExists(username: string): Promise<boolean> {
  try {
    const users = await getUsersList();
    return users.some(u => u.username === username);
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'existence de l\'utilisateur:', error);
    return false;
  }
}

// Supprimer un utilisateur
export async function deleteUser(username: string, password: string): Promise<boolean> {
  ensureDataDir();
  
  try {
    // Vérifier le mot de passe
    const userData = await loadUserData(username, password);
    if (!userData) {
      return false; // Utilisateur non trouvé ou mot de passe incorrect
    }
    
    // Trouver l'ID de l'utilisateur
    const usersListContent = await fs.promises.readFile(USERS_FILE, 'utf-8');
    const usersList: UsersList = JSON.parse(usersListContent);
    
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
