import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import db from '@/lib/db';
import { RecurringTransaction, TransactionType } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Trash2, Edit, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDeviceType } from '@/contexts/DeviceContext';
import { disableRecurringTransaction, enableRecurringTransaction } from '@/lib/recurringTransactionManager';

interface RecurringTransactionsListProps {
  accountId?: number;
}

export function RecurringTransactionsList({ accountId }: RecurringTransactionsListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isMobile } = useDeviceType();

  // Récupérer les transactions récurrentes
  const { data: recurringTransactions, isLoading, error } = useQuery({
    queryKey: ['recurringTransactions', accountId],
    queryFn: async () => {
      const allTransactions = await db.recurringTransactions.getAll();
      return accountId 
        ? allTransactions.filter(rt => rt.accountId === accountId)
        : allTransactions;
    }
  });

  // Récupérer les comptes pour afficher les noms
  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => db.accounts.getAll()
  });

  // Fonction pour formater la fréquence
  const formatFrequency = (frequency: string) => {
    switch (frequency) {
      case 'monthly': return 'Mensuelle';
      case 'weekly': return 'Hebdomadaire';
      case 'daily': return 'Quotidienne';
      case 'yearly': return 'Annuelle';
      default: return frequency;
    }
  };

  // Mutation pour activer/désactiver une transaction récurrente
  const toggleActivationMutation = useMutation({
    mutationFn: async ({ id, isDisabled }: { id: number, isDisabled: boolean }) => {
      if (isDisabled) {
        return enableRecurringTransaction(id);
      } else {
        return disableRecurringTransaction(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
      toast({
        title: 'Transaction récurrente mise à jour',
        description: 'Le statut de la transaction récurrente a été modifié avec succès',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: `Impossible de modifier le statut: ${error}`,
        variant: 'destructive',
      });
    }
  });

  // Mutation pour supprimer une transaction récurrente
  const deleteMutation = useMutation({
    mutationFn: (id: number) => db.recurringTransactions.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
      toast({
        title: 'Transaction récurrente supprimée',
        description: 'La transaction récurrente a été supprimée avec succès',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erreur',
        description: `Impossible de supprimer la transaction: ${error}`,
        variant: 'destructive',
      });
    }
  });

  // Obtenir le nom du compte
  const getAccountName = (id?: number) => {
    if (!id || !accounts) return 'Compte inconnu';
    const account = accounts.find(a => a.id === id);
    return account ? account.name : 'Compte inconnu';
  };

  // Obtenir la couleur en fonction du type de transaction
  const getTypeColor = (type: TransactionType) => {
    switch (type) {
      case TransactionType.INCOME:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case TransactionType.EXPENSE:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      case TransactionType.TRANSFER:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
    }
  };

  // Obtenir le texte du type de transaction
  const getTypeText = (type: TransactionType) => {
    switch (type) {
      case TransactionType.INCOME:
        return 'Revenu';
      case TransactionType.EXPENSE:
        return 'Dépense';
      case TransactionType.TRANSFER:
        return 'Transfert';
      default:
        return type;
    }
  };

  // Afficher un message de chargement
  if (isLoading) {
    return <div className="text-center p-4">Chargement des transactions récurrentes...</div>;
  }

  // Afficher un message d'erreur
  if (error) {
    return (
      <div className="text-center p-4 text-red-500">
        <AlertCircle className="h-5 w-5 inline-block mr-2" />
        Une erreur est survenue lors du chargement des transactions récurrentes
      </div>
    );
  }

  // Afficher un message si aucune transaction récurrente
  if (!recurringTransactions || recurringTransactions.length === 0) {
    return (
      <div className="text-center p-4 text-gray-500">
        Aucune transaction récurrente{accountId ? ' pour ce compte' : ''}
      </div>
    );
  }

  // Afficher la liste des transactions récurrentes
  return (
    <div className="space-y-4">
      {isMobile ? (
        // Vue mobile
        <div className="space-y-4">
          {recurringTransactions.map((rt) => (
            <Card key={rt.id} className={rt.isDisabled ? "opacity-70" : ""}>
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base">{rt.description}</CardTitle>
                    <CardDescription>
                      {formatFrequency(rt.frequency)} • Prochaine: {format(new Date(rt.nextExecution), 'dd/MM/yyyy')}
                    </CardDescription>
                  </div>
                  <Badge className={getTypeColor(rt.type)}>
                    {getTypeText(rt.type)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">
                      {rt.amount.toFixed(2)} €
                    </div>
                    <div className="text-sm text-gray-500">
                      {getAccountName(rt.accountId)}
                      {rt.type === TransactionType.TRANSFER && rt.toAccountId && (
                        <> → {getAccountName(rt.toAccountId)}</>
                      )}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Switch 
                      checked={!rt.isDisabled}
                      onCheckedChange={(checked) => toggleActivationMutation.mutate({ id: rt.id!, isDisabled: !checked })}
                    />
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Supprimer la transaction récurrente</DialogTitle>
                          <DialogDescription>
                            Êtes-vous sûr de vouloir supprimer cette transaction récurrente ? Cette action est irréversible.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Annuler</Button>
                          </DialogClose>
                          <Button 
                            variant="destructive" 
                            onClick={() => {
                              deleteMutation.mutate(rt.id!);
                              document.querySelector('[data-dialog-close]')?.click();
                            }}
                          >
                            Supprimer
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Vue desktop
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3">Description</th>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Montant</th>
                <th className="text-left p-3">Compte</th>
                <th className="text-left p-3">Fréquence</th>
                <th className="text-left p-3">Prochaine exécution</th>
                <th className="text-left p-3">Actif</th>
                <th className="text-center p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recurringTransactions.map((rt) => (
                <tr key={rt.id} className={`border-b ${rt.isDisabled ? "opacity-70" : ""}`}>
                  <td className="p-3">
                    {rt.description}
                  </td>
                  <td className="p-3">
                    <Badge className={getTypeColor(rt.type)}>
                      {getTypeText(rt.type)}
                    </Badge>
                  </td>
                  <td className="p-3 font-medium">
                    {rt.amount.toFixed(2)} €
                  </td>
                  <td className="p-3">
                    {getAccountName(rt.accountId)}
                    {rt.type === TransactionType.TRANSFER && rt.toAccountId && (
                      <span className="text-gray-500"> → {getAccountName(rt.toAccountId)}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {formatFrequency(rt.frequency)}
                  </td>
                  <td className="p-3">
                    {format(new Date(rt.nextExecution), 'dd/MM/yyyy')}
                  </td>
                  <td className="p-3">
                    <Switch 
                      checked={!rt.isDisabled}
                      onCheckedChange={(checked) => toggleActivationMutation.mutate({ id: rt.id!, isDisabled: !checked })}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center space-x-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Supprimer la transaction récurrente</DialogTitle>
                            <DialogDescription>
                              Êtes-vous sûr de vouloir supprimer cette transaction récurrente ? Cette action est irréversible.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter>
                            <DialogClose asChild>
                              <Button variant="outline">Annuler</Button>
                            </DialogClose>
                            <Button 
                              variant="destructive" 
                              onClick={() => {
                                deleteMutation.mutate(rt.id!);
                                document.querySelector('[data-dialog-close]')?.click();
                              }}
                            >
                              Supprimer
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
