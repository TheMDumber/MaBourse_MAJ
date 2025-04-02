/**
 * Cache for storing monthly balance calculations
 */
export const monthly_balance_cache: Record<string, number> = {};

// Optional: Add helper functions if needed
export function getCachedBalance(month: string): number | undefined {
    return monthly_balance_cache[month];
}

export function setCachedBalance(month: string, balance: number): void {
    monthly_balance_cache[month] = balance;
}
