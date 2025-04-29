import { useState, useEffect } from 'react';
import { accountsAPI } from '@/lib/db';
import { Account, Currency } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { AccountForm } from './AccountForm';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Fonction pour formater les dates
const formatDate = (date: Date | string) => {
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
};

// Fonction pour formater les montants selon la devise
const formatAmount = (amount: number, currency: Currency) => {
  const formatter = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2
  });
  return formatter.format(amount);
};

export const AccountsList = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Chargement des comptes
  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      const data = await accountsAPI.getAll();
      
      // Éliminer les doublons basés sur l'ID avant de mettre à jour l'état
      const uniqueAccounts = Array.from(
        new Map(data.map(account => [account.id, account])).values()
      );
      
      // Tri des comptes par nom pour une meilleure expérience utilisateur
      uniqueAccounts.sort((a, b) => a.name.localeCompare(b.name));
      
      console.log(`Comptes chargés: ${data.length}, après déduplication: ${uniqueAccounts.length}`);
      
      // Remplacer complètement l'état avec les comptes uniques
      setAccounts(uniqueAccounts);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
      console.error('Erreur détaillée lors du chargement des comptes:', error);
      toast({
        title: "Erreur de chargement",
        description: `Impossible de charger les comptes: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  // Suppression d'un compte
  const handleDelete = async (id: number | undefined) => {
    if (id === undefined) return;
    
    try {
      await accountsAPI.delete(id);
      // Invalider toutes les requêtes liées pour forcer un rafraîchissement dans l'application
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recurringTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      toast({
        title: "Succès",
        description: "Compte supprimé avec succès",
      });
      loadAccounts(); // Recharger la liste
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Une erreur inconnue est survenue';
      console.error('Erreur détaillée lors de la suppression du compte:', error);
      toast({
        title: "Erreur de suppression",
        description: `Impossible de supprimer le compte: ${errorMessage}`,
        variant: "destructive"
      });
    }
  };

  // Traitement après ajout ou édition
  const handleFormSuccess = () => {
    // Invalider toutes les requêtes liées pour forcer un rafraîchissement
    queryClient.invalidateQueries({ queryKey: ['accounts'] });
    loadAccounts(); // Recharger la liste
    setIsAddDialogOpen(false);
    setIsEditDialogOpen(false);
    setEditingAccount(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Mes comptes</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau compte
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Nouveau compte</DialogTitle>
            <AccountForm 
              onSuccess={handleFormSuccess} 
              onCancel={() => setIsAddDialogOpen(false)} 
            />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-6 bg-muted rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="h-10 bg-muted rounded mb-4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-6">
            <p className="text-muted-foreground mb-4">Vous n'avez pas encore de compte</p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Créer mon premier compte
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card key={account.id} className="overflow-hidden">
              <CardHeader className="bg-primary/5 pb-2">
                <CardTitle className="flex justify-between items-center">
                  <span>
                    {account.name}{' '}
                    <span className="text-xs text-muted-foreground">
                      (créé le {formatDate(account.createdAt)})
                    </span>
                  </span>
                  <div className="flex space-x-1">
                    <Dialog open={isEditDialogOpen && editingAccount?.id === account.id} onOpenChange={(open) => {
                      setIsEditDialogOpen(open);
                      if (!open) setEditingAccount(null);
                    }}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => setEditingAccount(account)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogTitle>Modifier le compte</DialogTitle>
                        {editingAccount && (
                          <AccountForm 
                            existingAccount={editingAccount} 
                            onSuccess={handleFormSuccess} 
                            onCancel={() => {
                              setIsEditDialogOpen(false);
                              setEditingAccount(null);
                            }} 
                          />
                        )}
                      </DialogContent>
                    </Dialog>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer le compte</AlertDialogTitle>
                          <AlertDialogDescription>
                            Êtes-vous sûr de vouloir supprimer ce compte ? Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(account.id)}
                            className="bg-destructive text-destructive-foreground"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold mb-2">
                  {formatAmount(account.initialBalance, account.currency)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {account.type === 'checking' && 'Compte courant'}
                  {account.type === 'savings' && 'Compte épargne'}
                  {account.type === 'creditCard' && 'Carte de crédit'}
                  {account.type === 'cash' && 'Espèces'}
                  {account.type === 'investment' && 'Investissement'}
                  {account.type === 'other' && 'Autre'}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
