/**
 * Utilitaire pour journaliser les réparations de la base de données
 * Cela permet de garder une trace des problèmes et des solutions appliquées
 */

// Variable globale pour stocker l'historique des réparations dans cette session
let repairHistory: RepairLogEntry[] = [];

// Interface pour représenter une entrée de journal de réparation
interface RepairLogEntry {
  timestamp: Date;
  type: 'check' | 'repair' | 'error';
  target: string;
  status: 'success' | 'failure';
  message: string;
  details?: any;
}

/**
 * Ajoute une entrée dans le journal de réparation
 */
export function logRepairEvent(
  type: 'check' | 'repair' | 'error',
  target: string,
  status: 'success' | 'failure',
  message: string,
  details?: any
): void {
  const entry: RepairLogEntry = {
    timestamp: new Date(),
    type,
    target,
    status,
    message,
    details
  };
  
  // Ajouter à l'historique en mémoire
  repairHistory.push(entry);
  
  // Stocker dans localStorage (avec un maximum d'entrées pour éviter de dépasser la limite)
  try {
    // Récupérer l'historique existant
    const storedHistory = localStorage.getItem('dbRepairHistory');
    let history: RepairLogEntry[] = [];
    
    if (storedHistory) {
      history = JSON.parse(storedHistory);
    }
    
    // Ajouter la nouvelle entrée
    history.push(entry);
    
    // Garder uniquement les 50 dernières entrées
    if (history.length > 50) {
      history = history.slice(history.length - 50);
    }
    
    // Sauvegarder dans localStorage
    localStorage.setItem('dbRepairHistory', JSON.stringify(history));
  } catch (error) {
    console.error('Erreur lors de la journalisation de l\'événement de réparation:', error);
  }
  
  // Afficher dans la console avec un style selon le type
  const logStyle = status === 'success' 
    ? 'color: green; font-weight: bold;'
    : 'color: red; font-weight: bold;';
  
  console.log(
    `%c[DB Repair - ${type.toUpperCase()}] ${target}: ${message}`,
    logStyle,
    details || ''
  );
}

/**
 * Récupère l'historique des réparations
 */
export function getRepairHistory(): RepairLogEntry[] {
  // Combiner l'historique en mémoire avec celui stocké dans localStorage
  try {
    const storedHistory = localStorage.getItem('dbRepairHistory');
    
    if (storedHistory) {
      const parsedHistory = JSON.parse(storedHistory);
      
      // Filtrer pour éviter les doublons (par timestamp)
      const timestamps = new Set(repairHistory.map(entry => entry.timestamp.toISOString()));
      const uniqueStoredEntries = parsedHistory.filter(
        (entry: RepairLogEntry) => !timestamps.has(new Date(entry.timestamp).toISOString())
      );
      
      return [...uniqueStoredEntries, ...repairHistory];
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'historique des réparations:', error);
  }
  
  return repairHistory;
}

/**
 * Efface l'historique des réparations
 */
export function clearRepairHistory(): void {
  repairHistory = [];
  localStorage.removeItem('dbRepairHistory');
}

/**
 * Exporte l'historique des réparations au format JSON
 */
export function exportRepairHistory(): string {
  const history = getRepairHistory();
  return JSON.stringify(history, null, 2);
}
