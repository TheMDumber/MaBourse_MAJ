import { RecurringTransaction, TransactionType } from './types';
import db from './db';
import { format, addMonths, addWeeks, addDays, isBefore, isAfter, parseISO } from 'date-fns';
import { toast } from 'sonner';

/**
 * Vérifie et exécute les transactions récurrentes qui doivent être exécutées aujourd'hui
 * @returns Le nombre de transactions récurrentes exécutées
 */
export async function executeRecurringTransactions(): Promise<number> {
    try {
        // Récupérer toutes les transactions récurrentes actives
        const recurringTransactions = await db.recurringTransactions.getAll();
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Normalisez la date à minuit

        let executionCount = 0;
        const toExecute: RecurringTransaction[] = recurringTransactions.filter(rt => {
            // Vérifier si la transaction est active
            if (rt.isDisabled) {
                return false;
            }

            // Vérifier si la date de fin est dépassée
            if (rt.endDate && isAfter(today, new Date(rt.endDate))) {
                return false;
            }

            // La date de prochaine exécution doit être dans le passé par rapport à today
            const nextExecution = new Date(rt.nextExecution);
            nextExecution.setHours(0, 0, 0, 0);
            return isBefore(nextExecution, today) || nextExecution.getTime() === today.getTime();
        });

        if (toExecute.length > 0) {
            console.log(`Exécution de ${toExecute.length} transactions récurrentes...`);
        }

        // Créer les transactions 
        for (const rt of toExecute) {
            try {
                // Vérifier si le compte existe toujours
                const account = await db.accounts.getById(rt.accountId);
                if (!account) {
                    console.warn(`Le compte ${rt.accountId} n'existe plus, désactivation de la transaction récurrente ${rt.id}`);
                    await db.recurringTransactions.update(rt.id!, { isDisabled: true });
                    continue;
                }

                // Pour les transferts, vérifier que le compte destinataire existe toujours
                if (rt.type === TransactionType.TRANSFER && rt.toAccountId) {
                    const toAccount = await db.accounts.getById(rt.toAccountId);
                    if (!toAccount) {
                        console.warn(`Le compte destinataire ${rt.toAccountId} n'existe plus, désactivation de la transaction récurrente ${rt.id}`);
                        await db.recurringTransactions.update(rt.id!, { isDisabled: true });
                        continue;
                    }
                }

                // Créer la transaction
                await db.transactions.create({
                    description: rt.description,
                    amount: rt.amount,
                    date: new Date(), // Date d'aujourd'hui
                    type: rt.type,
                    category: rt.category,
                    accountId: rt.accountId,
                    toAccountId: rt.toAccountId,
                    note: `Transaction automatique: ${rt.description}`
                });

                // Calculer la date de prochaine exécution en fonction de la fréquence
                let nextExecution = new Date(rt.nextExecution);
                switch (rt.frequency) {
                    case 'monthly':
                        nextExecution = addMonths(nextExecution, 1);
                        break;
                    case 'weekly':
                        nextExecution = addWeeks(nextExecution, 1);
                        break;
                    case 'daily':
                        nextExecution = addDays(nextExecution, 1);
                        break;
                    case 'yearly':
                        nextExecution = addMonths(nextExecution, 12);
                        break;
                    default:
                        nextExecution = addMonths(nextExecution, 1); // Par défaut mensuel
                }

                // Mettre à jour la transaction récurrente
                await db.recurringTransactions.update(rt.id!, {
                    lastExecuted: new Date(),
                    nextExecution: nextExecution
                });

                executionCount++;
                console.log(`Transaction récurrente ${rt.id} exécutée avec succès, prochaine exécution le ${format(nextExecution, 'dd/MM/yyyy')}`);
            } catch (error) {
                console.error(`Erreur lors de l'exécution de la transaction récurrente ${rt.id}:`, error);
            }
        }

        if (executionCount > 0) {
            toast.success(`${executionCount} transaction(s) récurrente(s) exécutée(s)`, {
                description: "Les transactions ont été générées automatiquement."
            });
        }

        return executionCount;
    } catch (error) {
        console.error('Erreur lors de l\'exécution des transactions récurrentes:', error);
        return 0;
    }
}

/**
 * Désactive une transaction récurrente
 * @param id ID de la transaction récurrente
 * @returns true si la désactivation a réussi
 */
export async function disableRecurringTransaction(id: number): Promise<boolean> {
    try {
        await db.recurringTransactions.update(id, { isDisabled: true });
        return true;
    } catch (error) {
        console.error(`Erreur lors de la désactivation de la transaction récurrente ${id}:`, error);
        return false;
    }
}

/**
 * Réactive une transaction récurrente
 * @param id ID de la transaction récurrente
 * @returns true si la réactivation a réussi
 */
export async function enableRecurringTransaction(id: number): Promise<boolean> {
    try {
        await db.recurringTransactions.update(id, { isDisabled: false });
        return true;
    } catch (error) {
        console.error(`Erreur lors de la réactivation de la transaction récurrente ${id}:`, error);
        return false;
    }
}
