import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ensureDataDir } from './fileStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chemin vers le dossier de données
const DATA_DIR = path.resolve(__dirname, 'data');
const ADMINS_FILE = path.join(DATA_DIR, 'admins.json');

// Compte administrateur par défaut
const DEFAULT_ADMIN = {
  username: 'admin',
  passwordHash: '', // Sera généré à la première exécution
  salt: '',
  isDefault: true,
  createdAt: new Date(),
  lastLogin: null
};

// Assurer que le fichier des administrateurs existe
export function ensureAdminFile() {
  ensureDataDir();
  
  if (!fs.existsSync(ADMINS_FILE)) {
    // Créer un mot de passe par défaut
    const defaultPassword = 'admin123';
    const { hash, salt } = hashPassword(defaultPassword);
    
    DEFAULT_ADMIN.passwordHash = hash;
    DEFAULT_ADMIN.salt = salt;
    
    const initialAdminsList = {
      admins: [DEFAULT_ADMIN],
      lastUpdated: new Date()
    };
    
    fs.writeFileSync(ADMINS_FILE, JSON.stringify(initialAdminsList, null, 2));
    console.log(`Fichier administrateurs créé: ${ADMINS_FILE}`);
    console.log(`Compte administrateur par défaut créé: admin / ${defaultPassword}`);
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

// Vérifier les identifiants d'un administrateur
export async function verifyAdmin(username, password) {
  ensureAdminFile();
  
  try {
    const adminsContent = await fs.promises.readFile(ADMINS_FILE, 'utf-8');
    const adminsList = JSON.parse(adminsContent);
    
    const admin = adminsList.admins.find(a => a.username === username);
    if (!admin) {
      return false;
    }
    
    // Vérifier le mot de passe
    const isValid = verifyPassword(password, admin.passwordHash, admin.salt);
    
    if (isValid) {
      // Mettre à jour la date de dernière connexion
      admin.lastLogin = new Date();
      adminsList.lastUpdated = new Date();
      
      await fs.promises.writeFile(ADMINS_FILE, JSON.stringify(adminsList, null, 2));
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'administrateur:', error);
    return false;
  }
}

// Modifier le mot de passe administrateur
export async function changeAdminPassword(username, currentPassword, newPassword) {
  ensureAdminFile();
  
  try {
    // Vérifier d'abord que l'administrateur existe et que le mot de passe actuel est correct
    const isValid = await verifyAdmin(username, currentPassword);
    if (!isValid) {
      return false;
    }
    
    const adminsContent = await fs.promises.readFile(ADMINS_FILE, 'utf-8');
    const adminsList = JSON.parse(adminsContent);
    
    const admin = adminsList.admins.find(a => a.username === username);
    if (!admin) {
      return false;
    }
    
    // Générer le nouveau hash
    const { hash, salt } = hashPassword(newPassword);
    
    // Mettre à jour le hash et le sel
    admin.passwordHash = hash;
    admin.salt = salt;
    admin.isDefault = false; // N'est plus le mot de passe par défaut
    adminsList.lastUpdated = new Date();
    
    // Sauvegarder les modifications
    await fs.promises.writeFile(ADMINS_FILE, JSON.stringify(adminsList, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur lors de la modification du mot de passe administrateur:', error);
    return false;
  }
}

// Ajouter un nouvel administrateur
export async function addAdmin(adminUsername, adminPassword, newUsername, newPassword) {
  ensureAdminFile();
  
  try {
    // Vérifier d'abord que l'administrateur a les droits pour faire cette opération
    const isValid = await verifyAdmin(adminUsername, adminPassword);
    if (!isValid) {
      return false;
    }
    
    const adminsContent = await fs.promises.readFile(ADMINS_FILE, 'utf-8');
    const adminsList = JSON.parse(adminsContent);
    
    // Vérifier si l'utilisateur existe déjà
    if (adminsList.admins.some(a => a.username === newUsername)) {
      return false;
    }
    
    // Générer le hash pour le nouveau mot de passe
    const { hash, salt } = hashPassword(newPassword);
    
    // Créer le nouvel administrateur
    const newAdmin = {
      username: newUsername,
      passwordHash: hash,
      salt: salt,
      isDefault: false,
      createdAt: new Date(),
      lastLogin: null
    };
    
    // Ajouter à la liste
    adminsList.admins.push(newAdmin);
    adminsList.lastUpdated = new Date();
    
    // Sauvegarder les modifications
    await fs.promises.writeFile(ADMINS_FILE, JSON.stringify(adminsList, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'ajout d\'un administrateur:', error);
    return false;
  }
}

// Obtenir la liste des administrateurs (sans leurs mots de passe)
export async function getAdminsList(adminUsername, adminPassword) {
  ensureAdminFile();
  
  try {
    // Vérifier d'abord que l'administrateur a les droits pour faire cette opération
    const isValid = await verifyAdmin(adminUsername, adminPassword);
    if (!isValid) {
      return null;
    }
    
    const adminsContent = await fs.promises.readFile(ADMINS_FILE, 'utf-8');
    const adminsList = JSON.parse(adminsContent);
    
    // Retourner la liste sans les informations sensibles
    return adminsList.admins.map(admin => ({
      username: admin.username,
      isDefault: admin.isDefault,
      createdAt: admin.createdAt,
      lastLogin: admin.lastLogin
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération de la liste des administrateurs:', error);
    return null;
  }
}

// Supprimer un administrateur
export async function removeAdmin(adminUsername, adminPassword, usernameToRemove) {
  ensureAdminFile();
  
  try {
    // Vérifier d'abord que l'administrateur a les droits pour faire cette opération
    const isValid = await verifyAdmin(adminUsername, adminPassword);
    if (!isValid) {
      return false;
    }
    
    const adminsContent = await fs.promises.readFile(ADMINS_FILE, 'utf-8');
    const adminsList = JSON.parse(adminsContent);
    
    // Empêcher la suppression du dernier administrateur
    if (adminsList.admins.length <= 1) {
      return false;
    }
    
    // Vérifier que l'administrateur existe
    const adminToRemove = adminsList.admins.find(a => a.username === usernameToRemove);
    if (!adminToRemove) {
      return false;
    }
    
    // Supprimer l'administrateur de la liste
    adminsList.admins = adminsList.admins.filter(a => a.username !== usernameToRemove);
    adminsList.lastUpdated = new Date();
    
    // Sauvegarder les modifications
    await fs.promises.writeFile(ADMINS_FILE, JSON.stringify(adminsList, null, 2));
    return true;
  } catch (error) {
    console.error('Erreur lors de la suppression d\'un administrateur:', error);
    return false;
  }
}
