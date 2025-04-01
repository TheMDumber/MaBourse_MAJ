import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { 
  ensureDataDir, 
  saveUserData, 
  loadUserData, 
  userExists, 
  getUsersList,
  deleteUser
} from './fileStorage.js';
import {
  ensureAdminFile,
  verifyAdmin,
  changeAdminPassword,
  addAdmin,
  getAdminsList,
  removeAdmin
} from './adminAuth.js';

// Configuration du serveur
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001;

// Configuration CORS plus large pour permettre les connexions de n'importe où
const corsOptions = {
  origin: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204,
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Servir les fichiers statiques (public, puis racine)
app.use(express.static(join(__dirname, 'public')));
app.use(express.static(__dirname));

// Si 'dist' existe, le servir aussi
const distPath = join(__dirname, 'dist');
try {
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    console.log('Servir le contenu du dossier dist');
  } else {
    console.log('Attention: Le dossier dist n\'existe pas. L\'application n\'est peut-être pas construite.');
  }
} catch (error) {
  console.error('Erreur lors de la vérification du dossier dist:', error);
}

// S'assurer que le dossier de données existe et que le fichier admin existe
ensureDataDir();
ensureAdminFile();

// Middleware pour logger les requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Route API pour la connexion
app.post('/api/storage/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nom d\'utilisateur et mot de passe requis' 
      });
    }
    
    const userData = await loadUserData(username, password);
    
    if (userData) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: 'Nom d\'utilisateur ou mot de passe incorrect' 
      });
    }
  } catch (error) {
    console.error('Erreur de connexion:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour l'inscription
app.post('/api/storage/register', async (req, res) => {
  try {
    const { username, password, data } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nom d\'utilisateur et mot de passe requis' 
      });
    }
    
    // Vérifier si l'utilisateur existe déjà
    const exists = await userExists(username);
    if (exists) {
      return res.status(409).json({ 
        success: false, 
        error: 'Nom d\'utilisateur déjà pris' 
      });
    }
    
    await saveUserData(username, password, data);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur d\'inscription:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour charger les données utilisateur
app.post('/api/storage/data', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nom d\'utilisateur et mot de passe requis' 
      });
    }
    
    // Récupérer l'ID de l'utilisateur pour obtenir les métadonnées
    const usersListContent = await fs.promises.readFile(USERS_FILE, 'utf-8');
    const usersList = JSON.parse(usersListContent);
    const userEntry = usersList.users.find(u => u.username === username);
    
    // Date de création du compte
    let accountCreationDate = null;
    if (userEntry && userEntry.createdAt) {
      accountCreationDate = userEntry.createdAt;
    }
    
    const userData = await loadUserData(username, password);
    
    if (userData) {
      // Ajouter la date de création du compte au contexte comme premier mois autorisé
      const minSelectableMonth = accountCreationDate ? 
                               new Date(accountCreationDate).toISOString().substring(0, 7) : // Format YYYY-MM
                               null;
      
      return res.json({ 
        success: true, 
        data: userData,
        accountCreationDate,
        minSelectableMonth,  // Nouveau nom plus clair: premier mois autorisé
        accountCreationMonth: minSelectableMonth  // Garder l'ancien nom pour compatibilité
      });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: 'Nom d\'utilisateur ou mot de passe incorrect' 
      });
    }
  } catch (error) {
    console.error('Erreur de chargement des données:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour sauvegarder les données utilisateur
app.post('/api/storage/save', async (req, res) => {
  try {
    const { username, password, data } = req.body;
    
    if (!username || !password || !data) {
      return res.status(400).json({ 
        success: false, 
        error: 'Paramètres invalides' 
      });
    }
    
    // Vérifier les identifiants avant d'enregistrer
    const userData = await loadUserData(username, password);
    if (!userData) {
      return res.status(401).json({ 
        success: false,
        error: 'Nom d\'utilisateur ou mot de passe incorrect' 
      });
    }
    
    // TODO: Assurer la validation et la prévention des doublons côté backend.
    // Cette validation côté serveur est ESSENTIELLE et représente la source de vérité.
    // Les vérifications côté client sont importantes pour l'UX mais ne peuvent pas
    // garantir l'intégrité des données.
    //
    // Recommandations pour le serveur:
    // 1. Valider que les noms de comptes sont uniques dans data.accounts avant sauvegarde
    // 2. Implémenter une contrainte d'unicité dans la base de données
    // 3. Renvoyer un code d'erreur spécifique en cas de violation d'unicité
    // 4. Logger les tentatives d'ajout de comptes en double pour débogage
    
    await saveUserData(username, password, data);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Erreur de sauvegarde des données:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour vérifier si un nom d'utilisateur existe
app.post('/api/storage/check-username', async (req, res) => {
  try {
    const { username } = req.body;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nom d\'utilisateur requis' 
      });
    }
    
    const exists = await userExists(username);
    return res.json({ success: true, data: exists });
  } catch (error) {
    console.error('Erreur de vérification du nom d\'utilisateur:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour obtenir la liste des utilisateurs
app.get('/api/storage/users-list', async (req, res) => {
  try {
    const users = await getUsersList();

    // Par défaut, renvoyer uniquement les noms d'utilisateur pour compatibilité
    if (req.query.detailed !== 'true') {
      const usernames = users.map(user => user.username);
      return res.json({ success: true, data: usernames });
    }
    
    // Si le paramètre detailed=true est spécifié, renvoyer les métadonnées complètes
    const usersData = users.map(user => ({
      username: user.username,
      id: user.id,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin
    }));
    
    return res.json({ success: true, data: usersData });
  } catch (error) {
    console.error('Erreur de récupération de la liste des utilisateurs:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour supprimer un utilisateur
app.post('/api/storage/delete-user', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nom d\'utilisateur et mot de passe requis' 
      });
    }
    
    const success = await deleteUser(username, password);
    
    if (success) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: 'Nom d\'utilisateur ou mot de passe incorrect' 
      });
    }
  } catch (error) {
    console.error('Erreur de suppression d\'utilisateur:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// === ROUTES ADMINISTRATIVES ===

// Route API pour l'authentification des administrateurs
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nom d\'utilisateur et mot de passe requis' 
      });
    }
    
    const isAdmin = await verifyAdmin(username, password);
    
    if (isAdmin) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: 'Identifiants administrateur incorrects' 
      });
    }
  } catch (error) {
    console.error('Erreur d\'authentification administrateur:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour changer le mot de passe d'un administrateur
app.post('/api/admin/change-password', async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    
    if (!username || !currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tous les champs sont requis' 
      });
    }
    
    const success = await changeAdminPassword(username, currentPassword, newPassword);
    
    if (success) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: 'Mot de passe actuel incorrect' 
      });
    }
  } catch (error) {
    console.error('Erreur de modification du mot de passe administrateur:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour ajouter un administrateur
app.post('/api/admin/add', async (req, res) => {
  try {
    const { adminUsername, adminPassword, newUsername, newPassword } = req.body;
    
    if (!adminUsername || !adminPassword || !newUsername || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tous les champs sont requis' 
      });
    }
    
    const success = await addAdmin(adminUsername, adminPassword, newUsername, newPassword);
    
    if (success) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: 'Identifiants administrateur incorrects ou nom d\'utilisateur déjà utilisé' 
      });
    }
  } catch (error) {
    console.error('Erreur d\'ajout d\'administrateur:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour obtenir la liste des administrateurs
app.post('/api/admin/list', async (req, res) => {
  try {
    const { adminUsername, adminPassword } = req.body;
    
    if (!adminUsername || !adminPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Nom d\'utilisateur et mot de passe administrateur requis' 
      });
    }
    
    const adminsList = await getAdminsList(adminUsername, adminPassword);
    
    if (adminsList) {
      return res.json({ success: true, data: adminsList });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: 'Identifiants administrateur incorrects' 
      });
    }
  } catch (error) {
    console.error('Erreur de récupération de la liste des administrateurs:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour supprimer un administrateur
app.post('/api/admin/remove', async (req, res) => {
  try {
    const { adminUsername, adminPassword, usernameToRemove } = req.body;
    
    if (!adminUsername || !adminPassword || !usernameToRemove) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tous les champs sont requis' 
      });
    }
    
    const success = await removeAdmin(adminUsername, adminPassword, usernameToRemove);
    
    if (success) {
      return res.json({ success: true });
    } else {
      return res.status(401).json({ 
        success: false, 
        error: 'Identifiants administrateur incorrects ou impossible de supprimer le dernier administrateur' 
      });
    }
  } catch (error) {
    console.error('Erreur de suppression d\'administrateur:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour la suppression administrative d'un utilisateur (par un admin)
app.post('/api/admin/delete-user', async (req, res) => {
  try {
    const { adminUsername, adminPassword, userToDelete } = req.body;
    
    if (!adminUsername || !adminPassword || !userToDelete) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tous les champs sont requis' 
      });
    }
    
    // Vérifier d'abord que c'est bien un administrateur
    const isAdmin = await verifyAdmin(adminUsername, adminPassword);
    if (!isAdmin) {
      return res.status(401).json({ 
        success: false, 
        error: 'Identifiants administrateur incorrects' 
      });
    }
    
    // Trouver l'ID de l'utilisateur à supprimer
    const users = await getUsersList();
    const userEntry = users.find(u => u.username === userToDelete);
    
    if (!userEntry) {
      return res.status(404).json({ 
        success: false, 
        error: 'Utilisateur non trouvé' 
      });
    }
    
    // Appeler la fonction de suppression (avec modification pour accepter l'ID)
    const userDeleted = await deleteUser(userToDelete, null, true);
    
    if (userDeleted) {
      return res.json({ success: true });
    } else {
      return res.status(500).json({ 
        success: false, 
        error: 'Erreur lors de la suppression de l\'utilisateur' 
      });
    }
  } catch (error) {
    console.error('Erreur lors de la suppression administrative d\'un utilisateur:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});

// Route API pour la réinitialisation du mot de passe d'un utilisateur (par un admin)
app.post('/api/admin/reset-user-password', async (req, res) => {
  try {
    const { adminUsername, adminPassword, userToReset, newPassword } = req.body;
    
    if (!adminUsername || !adminPassword || !userToReset || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Tous les champs sont requis' 
      });
    }
    
    // Vérifier d'abord que c'est bien un administrateur
    const isAdmin = await verifyAdmin(adminUsername, adminPassword);
    if (!isAdmin) {
      return res.status(401).json({ 
        success: false, 
        error: 'Identifiants administrateur incorrects' 
      });
    }
    
    // Vérifier que l'utilisateur existe
    const userExists = await getUsersList().then(users => 
      users.some(u => u.username === userToReset)
    );
    
    if (!userExists) {
      return res.status(404).json({ 
        success: false, 
        error: 'Utilisateur non trouvé' 
      });
    }
    
    // Charger les données de l'utilisateur (sans vérification de mot de passe)
    // Cette partie nécessiterait une modification de fileStorage.js
    // pour permettre un chargement privé des données sans vérification
    
    // Pour cette démo, nous allons informer que cette fonction n'est pas entièrement implémentée
    console.log(`Demande de réinitialisation du mot de passe pour ${userToReset} par l'administrateur ${adminUsername}`);
    
    return res.json({ 
      success: true, 
      message: 'Cette fonctionnalité nécessiterait une modification supplémentaire de fileStorage.js' 
    });
    
  } catch (error) {
    console.error('Erreur lors de la réinitialisation du mot de passe d\'un utilisateur:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Erreur interne du serveur' 
    });
  }
});


// Route pour toutes les autres requêtes -> SPA React
app.get('*', (req, res) => {
  // Vérifier si nous avons un fichier à la racine du projet
  const rootIndex = join(__dirname, 'index.html');
  const distIndex = join(__dirname, 'dist', 'index.html');
  
  try {
    if (fs.existsSync(distIndex)) {
      res.sendFile(distIndex);
    } else if (fs.existsSync(rootIndex)) {
      res.sendFile(rootIndex);
    } else {
      res.status(404).send('Application non construite. Veuillez exécuter "npm run build" ou ouvrir directement les fichiers HTML.');
    }
  } catch (error) {
    console.error('Erreur lors de l\'accès aux fichiers index:', error);
    res.status(500).send('Erreur serveur lors de l\'accès aux fichiers. Veuillez vérifier les logs.');
  }
});

// Démarrer le serveur et afficher l'adresse IP du serveur
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur en écoute sur le port ${PORT}`);
  console.log(`URL API locale: http://localhost:${PORT}/api/storage`);
  console.log(`URL API réseau: http://${process.env.COMPUTERNAME || 'localhost'}:${PORT}/api/storage`);
  console.log(`Dossier de données: ${join(__dirname, 'data')}`);
});
