/**
 * Module de journalisation simplifié pour le frontend
 */

// Types des niveaux de journalisation
export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
export type ExportFormat = 'json' | 'csv' | 'txt';

// Interface pour les entrées de journal
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, any>;
}

/**
 * Classe Logger pour gérer les journaux dans l'application
 */
class Logger {
  private logs: LogEntry[] = [];
  private maxEntries: number;
  private level: LogLevel;
  private levelPriority: Record<LogLevel, number> = {
    'DEBUG': 0,
    'INFO': 1,
    'WARNING': 2,
    'ERROR': 3,
    'CRITICAL': 4
  };

  /**
   * Initialise le logger
   */
  constructor(maxEntries: number = 10000, level: LogLevel = 'INFO') {
    this.maxEntries = maxEntries;
    this.level = level;
    
    // Charger les logs depuis le localStorage s'ils existent
    this.loadFromStorage();
  }

  /**
   * Détermine si un message doit être journalisé selon son niveau
   */
  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level];
  }

  /**
   * Sauvegarde les logs dans le localStorage
   */
  private saveToStorage(): void {
    try {
      // Ne garder que les 1000 dernières entrées pour le localStorage
      const logsToSave = this.logs.slice(-1000);
      localStorage.setItem('appLogs', JSON.stringify(logsToSave));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des logs:', error);
    }
  }

  /**
   * Charge les logs depuis le localStorage
   */
  private loadFromStorage(): void {
    try {
      const savedLogs = localStorage.getItem('appLogs');
      if (savedLogs) {
        this.logs = JSON.parse(savedLogs);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des logs:', error);
    }
  }

  /**
   * Ajoute une entrée au journal
   */
  log(message: string, level: LogLevel = 'INFO', module: string = '', additionalData?: Record<string, any>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module,
      message
    };

    if (additionalData) {
      entry.data = additionalData;
    }

    this.logs.push(entry);

    // Limiter la taille du journal
    if (this.logs.length > this.maxEntries) {
      this.logs = this.logs.slice(-this.maxEntries);
    }

    // Sauvegarder les logs dans le localStorage
    this.saveToStorage();

    // En mode développement, afficher également dans la console
    const consoleMethod = this.getConsoleMethod(level);
    consoleMethod(`[${level}] ${module ? `${module}: ` : ''}${message}`);
  }

  /**
   * Obtient la méthode console appropriée pour le niveau de log
   */
  private getConsoleMethod(level: LogLevel): (...data: any[]) => void {
    switch (level) {
      case 'DEBUG': return console.debug;
      case 'INFO': return console.info;
      case 'WARNING': return console.warn;
      case 'ERROR': 
      case 'CRITICAL': return console.error;
      default: return console.log;
    }
  }

  /**
   * Log de niveau DEBUG
   */
  debug(message: string, module: string = '', additionalData?: Record<string, any>): void {
    this.log(message, 'DEBUG', module, additionalData);
  }

  /**
   * Log de niveau INFO
   */
  info(message: string, module: string = '', additionalData?: Record<string, any>): void {
    this.log(message, 'INFO', module, additionalData);
  }

  /**
   * Log de niveau WARNING
   */
  warning(message: string, module: string = '', additionalData?: Record<string, any>): void {
    this.log(message, 'WARNING', module, additionalData);
  }

  /**
   * Log de niveau ERROR
   */
  error(message: string, module: string = '', additionalData?: Record<string, any>): void {
    this.log(message, 'ERROR', module, additionalData);
  }

  /**
   * Log de niveau CRITICAL
   */
  critical(message: string, module: string = '', additionalData?: Record<string, any>): void {
    this.log(message, 'CRITICAL', module, additionalData);
  }

  /**
   * Exporte les journaux au format JSON
   */
  exportJson(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Exporte les journaux au format CSV
   */
  exportCsv(): string {
    const headers = ['timestamp', 'level', 'module', 'message'];
    const headerRow = headers.join(',');
    
    const rows = this.logs.map(entry => {
      return [
        entry.timestamp,
        entry.level,
        `"${(entry.module || '').replace(/"/g, '""')}"`, // Échapper les guillemets
        `"${entry.message.replace(/"/g, '""')}"` // Échapper les guillemets
      ].join(',');
    });
    
    return [headerRow, ...rows].join('\n');
  }

  /**
   * Exporte les journaux au format texte
   */
  exportTxt(): string {
    return this.logs.map(entry => {
      return `[${entry.timestamp}] ${entry.level} - ${entry.module || ''}: ${entry.message}`;
    }).join('\n');
  }

  /**
   * Exporte les journaux dans le format spécifié
   */
  export(format: ExportFormat = 'json'): string {
    switch (format) {
      case 'json': return this.exportJson();
      case 'csv': return this.exportCsv();
      case 'txt': return this.exportTxt();
      default: throw new Error(`Format d'exportation non supporté: ${format}`);
    }
  }

  /**
   * Télécharge les journaux dans un fichier
   */
  downloadLogs(format: ExportFormat = 'json', filename?: string): void {
    // Générer le contenu à télécharger
    const content = this.export(format);
    
    // Déterminer le type MIME
    let mimeType: string;
    let extension: string;
    
    switch (format) {
      case 'json': 
        mimeType = 'application/json';
        extension = 'json';
        break;
      case 'csv': 
        mimeType = 'text/csv';
        extension = 'csv';
        break;
      case 'txt':
      default: 
        mimeType = 'text/plain';
        extension = 'txt';
        break;
    }
    
    // Générer un nom de fichier par défaut si nécessaire
    if (!filename) {
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0].replace('T', '_');
      filename = `mabourse_logs_${timestamp}.${extension}`;
    }
    
    // Créer un blob et un lien de téléchargement
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyage
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * Efface toutes les entrées du journal
   */
  clear(): void {
    this.logs = [];
    localStorage.removeItem('appLogs');
  }

  /**
   * Retourne toutes les entrées du journal
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Filtre les logs par niveau
   */
  filterByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter(entry => entry.level === level);
  }

  /**
   * Filtre les logs par module
   */
  filterByModule(module: string): LogEntry[] {
    return this.logs.filter(entry => entry.module === module);
  }
}

// Instance singleton du logger
const _logger = new Logger();

// Exporter les fonctions d'accès global
export function getLogger(): Logger {
  return _logger;
}

export function log(message: string, level: LogLevel = 'INFO', module: string = '', additionalData?: Record<string, any>): void {
  _logger.log(message, level, module, additionalData);
}

export function debug(message: string, module: string = '', additionalData?: Record<string, any>): void {
  _logger.debug(message, module, additionalData);
}

export function info(message: string, module: string = '', additionalData?: Record<string, any>): void {
  _logger.info(message, module, additionalData);
}

export function warning(message: string, module: string = '', additionalData?: Record<string, any>): void {
  _logger.warning(message, module, additionalData);
}

export function error(message: string, module: string = '', additionalData?: Record<string, any>): void {
  _logger.error(message, module, additionalData);
}

export function critical(message: string, module: string = '', additionalData?: Record<string, any>): void {
  _logger.critical(message, module, additionalData);
}

export function downloadLogs(format: ExportFormat = 'json', filename?: string): void {
  _logger.downloadLogs(format, filename);
}

export function clearLogs(): void {
  _logger.clear();
}

export default {
  getLogger,
  log,
  debug,
  info,
  warning,
  error,
  critical,
  downloadLogs,
  clearLogs
};
