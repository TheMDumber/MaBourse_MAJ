import db from './db';
import { Account } from './types';

/**
 * Utilitaire pour détecter et gérer les doublons de comptes
 * Ce module centralise la logique de détection des doublons pour une meilleure cohérence.
 * 
 * TODO: Assurer la validation et la prévention des doublons côté backend.
 * Les vérifications implémentées ici sont côté client uniquement et empêchent l'affichage de doublons,
 * mais l'API doit garantir l'unicité des comptes dans la base de données.
 * 
 * Dans un environnement de production, les contraintes d'unicité devraient être:
 * 1. Appliquées au niveau de la base de données (contrainte UNIQUE)
 * 2. Validées par le backend avant toute insertion/mise à jour
 * 3. Gérées proprement lors des synchronisations (stratégie de réconciliation)
 * 
 * Cette protection côté client est une amélioration UX, mais ne remplace pas 
 * une architecture robuste de validation côté serveur.
 */

/**
 * Vérifie si un compte avec un nom identique ou similaire existe déjà
 * @param accountName Le nom du compte à vérifier
 * @param excludeId ID à exclure de la vérification (utile pour les mises à jour)
 * @returns true si un compte avec ce nom existe, false sinon
 */
export async function accountNameExists(accountName: string, excludeId?: number): Promise<boolean> {
  if (!accountName) return false;
  
  // Normaliser le nom pour la comparaison (lowercase)
  const normalizedName = accountName.toLowerCase();
  
  try {
    // Récupérer tous les comptes
    const accounts = await db.accounts.getAll();
    
    // Vérifier si un compte avec ce nom existe déjà (insensible à la casse)
    return accounts.some(account => 
      account.name && 
      account.name.toLowerCase() === normalizedName && 
      (!excludeId || account.id !== excludeId)
    );
  } catch (error) {
    console.error('Erreur lors de la vérification d\'existence de nom de compte:', error);
    return false; // Par défaut, considérer que le nom n'existe pas en cas d'erreur
  }
}

/**
 * Normalise un nom de compte pour limiter les différences mineures
 * @param accountName Nom de compte à normaliser
 * @returns Nom normalisé
 */
export function normalizeAccountName(accountName: string): string {
  if (!accountName) return '';
  
  // Normalisation du nom:
  // 1. Suppression des espaces en début et fin
  // 2. Première lettre en majuscule, reste en minuscule
  // 3. Conversion des caractères spéciaux
  
  return accountName
    .trim()
    .replace(/\s+/g, ' ') // Remplacer plusieurs espaces par un seul
    .replace(/^(.)(.*)$/, (_, first, rest) => first.toUpperCase() + rest.toLowerCase());
}

/**
 * Fonction utilitaire pour dédupliquer une liste de comptes par ID
 * @param accounts Liste de comptes à dédupliquer
 * @returns Liste de comptes sans doublons
 */
export function removeDuplicateAccounts(accounts: Account[]): Account[] {
  // Utiliser un Map pour éliminer les doublons basés sur l'ID
  return Array.from(
    new Map(accounts.map(account => [account.id, account])).values()
  );
}

/**
 * Fonction utilitaire pour dédupliquer une liste de comptes par nom (insensible à la casse)
 * @param accounts Liste de comptes à dédupliquer
 * @returns Liste de comptes sans doublons de noms
 */
export function removeDuplicateAccountsByName(accounts: Account[]): Account[] {
  const uniqueAccounts: Account[] = [];
  const nameMap = new Map<string, boolean>();
  
  for (const account of accounts) {
    if (!account.name) continue;
    
    const normalizedName = account.name.toLowerCase();
    if (!nameMap.has(normalizedName)) {
      nameMap.set(normalizedName, true);
      uniqueAccounts.push(account);
    }
  }
  
  return uniqueAccounts;
}

/**
 * Valide un nom de compte et retourne un nom valide
 * @param accountName Nom de compte à valider
 * @returns Nom de compte normalisé et validé
 */
export async function validateAccountName(accountName: string): Promise<string> {
  if (!accountName) {
    throw new Error("Le nom du compte ne peut pas être vide");
  }
  
  // Normaliser le nom
  const normalizedName = normalizeAccountName(accountName);
  
  // Vérifier les caractères interdits
  if (!/^[a-zA-Z0-9\s\-_àáâãäåçèéêëìíîïñòóôõöùúûüýÿ]+$/.test(normalizedName)) {
    throw new Error("Le nom du compte contient des caractères non autorisés");
  }
  
  // Vérifier la longueur
  if (normalizedName.length < 2) {
    throw new Error("Le nom du compte doit contenir au moins 2 caractères");
  }
  
  if (normalizedName.length > 30) {
    throw new Error("Le nom du compte est trop long (maximum 30 caractères)");
  }
  
  // Vérifier si le nom existe déjà
  const nameExists = await accountNameExists(normalizedName);
  if (nameExists) {
    throw new Error(`Un compte avec le nom "${normalizedName}" existe déjà`);
  }
  
  return normalizedName;
}

/**
 * Obtient une version unique d'un nom de compte en ajoutant un numéro si nécessaire
 * @param baseAccountName Nom de base du compte
 * @returns Nom de compte unique
 */
export async function getUniqueAccountName(baseAccountName: string): Promise<string> {
  let normalizedName = normalizeAccountName(baseAccountName);
  let counter = 1;
  let candidateName = normalizedName;
  
  while (await accountNameExists(candidateName)) {
    counter++;
    candidateName = `${normalizedName} ${counter}`;
  }
  
  return candidateName;
}
