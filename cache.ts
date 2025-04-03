/**
 * Cache for storing monthly balance calculations
 */
import { debug, info } from './logging/logger';

export const monthly_balance_cache: Record<string, number> = {};

/**
 * Récupère une valeur du cache avec journalisation
 */
export function getCachedBalance(month: string): number | undefined {
    const value = monthly_balance_cache[month];
    
    if (value !== undefined) {
        debug(`Cache hit pour le mois ${month}: ${value}`, 'cache');
    } else {
        debug(`Cache miss pour le mois ${month}`, 'cache');
    }
    
    return value;
}

/**
 * Enregistre une valeur dans le cache avec journalisation
 */
export function setCachedBalance(month: string, balance: number): void {
    monthly_balance_cache[month] = balance;
    debug(`Mise en cache du solde pour le mois ${month}: ${balance}`, 'cache');
}

/**
 * Efface le cache
 */
export function clearCache(): void {
    // Vider l'objet cache en supprimant toutes les clés
    Object.keys(monthly_balance_cache).forEach(key => {
        delete monthly_balance_cache[key];
    });
    
    info('Cache de soldes mensuels effacé', 'cache');
}

// Initialisation du module
info('Module cache.ts chargé', 'cache');
