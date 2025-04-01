import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRightLeft, CalendarIcon, Pencil, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import db from "@/lib/db";
import { cn } from "@/lib/utils";
import { Account, Transaction, TransactionType, ExpenseCategory } from "@/lib/types";
import { toast } from "sonner";

// Schéma de validation pour l'édition de transaction
const transactionEditSchema = z.object({
  id: z.number(),
  accountId: z.number({
    required_error: "Veuillez sélectionner un compte",
  }),
  toAccountId: z.number().optional(),
  description: z.string().min(1, "Veuillez entrer une description"),
  amount: z.number({
    required_error: "Veuillez entrer un montant",
    invalid_type_error: "Veuillez entrer un nombre valide",
  }).positive("Le montant doit être positif"),
  date: z.date({
    required_error: "Veuillez sélectionner une date",
  }),
  type: z.enum([TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER], {
    required_error: "Veuillez sélectionner un type",
  }),
  category: z.enum([ExpenseCategory.FIXED, ExpenseCategory.RECURRING, ExpenseCategory.EXCEPTIONAL]).optional(),
}).refine(data => {
  // Si c'est un transfert, toAccountId est requis et doit être différent de accountId
  if (data.type === TransactionType.TRANSFER) {
    return data.toAccountId !== undefined && data.toAccountId !== data.accountId;
  }
  return true;
}, {
  message: "Pour un transfert, veuillez sélectionner un compte destination différent du compte source",
  path: ["toAccountId"],
});

type TransactionEditValues = z.infer<typeof transactionEditSchema>;

interface TransactionEditFormProps {
  open: boolean;
  transaction: Transaction;
  onClose: () => void;
  onSuccess?: () => void;
  onDelete?: () => void;
}

export function TransactionEditForm({
  open,
  transaction,
  onClose,
  onSuccess,
  onDelete,
}: TransactionEditFormProps) {
  // Log pour confirmer que le composant est bien rendu
  console.log('TransactionEditForm - Composant initialisé', { open, transaction });
  
  // État pour la confirmation de suppression
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Options d'édition/suppression pour les transactions
  const [affectAllRecurring, setAffectAllRecurring] = useState(false);
  const [affectAllOccurrences, setAffectAllOccurrences] = useState(false);
  
  const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      return db.accounts.getAll();
    },
  });

  const form = useForm<TransactionEditValues>({
    resolver: zodResolver(transactionEditSchema),
    defaultValues: {
      id: transaction.id,
      type: transaction.type,
      description: transaction.description,
      amount: transaction.amount,
      date: new Date(transaction.date), // S'assurer que c'est un objet Date valide
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId,
      category: transaction.category as ExpenseCategory | undefined,
    },
  });

  // Reset le formulaire quand la transaction change
  useEffect(() => {
    console.log('Transaction à éditer:', transaction);
    if (transaction && open) {
      form.reset({
        id: transaction.id,
        type: transaction.type,
        description: transaction.description,
        amount: transaction.amount,
        date: new Date(transaction.date),
        accountId: transaction.accountId,
        toAccountId: transaction.toAccountId,
        category: transaction.category as ExpenseCategory | undefined,
      });
    }
  }, [transaction, open, form]);

  // Ajustement du formulaire selon le type de transaction
  const transactionType = form.watch("type");
  const accountId = form.watch("accountId");

  // Soumission du formulaire
  async function onSubmit(data: TransactionEditValues) {
    try {
      if (!transaction.id) {
        toast.error("Identifiant de transaction manquant");
        return;
      }

      console.log('Données du formulaire:', data);
      console.log('ID de transaction à mettre à jour:', transaction.id);
      console.log('Affecter toutes les transactions récurrentes:', affectAllRecurring);

      // S'assurer que la date est bien un objet Date
      const updatedDate = data.date instanceof Date ? 
        data.date : 
        new Date(data.date);
        
      const updateData = {
        accountId: data.accountId,
        toAccountId: data.type === TransactionType.TRANSFER ? data.toAccountId : undefined,
        amount: data.amount,
        type: data.type,
        category: data.type === TransactionType.EXPENSE ? data.category : undefined,
        description: data.description,
        date: updatedDate,
      };
      
      // Option 1: Si la transaction fait partie d'une série récurrente et que l'option est active
      if (affectAllRecurring && transaction.recurringId) {
        // Récupérer toutes les transactions avec le même ID récurrent
        const allTransactions = await db.transactions.getAll();
        const recurringTransactions = allTransactions.filter(tx => 
          tx.recurringId === transaction.recurringId
        );
        
        // Mettre à jour toutes les transactions récurrentes
        for (const tx of recurringTransactions) {
          if (tx.id) {
            try {
              // Vérifier que la transaction existe toujours avant de la mettre à jour
              const exists = await db.transactions.getAll().then(txs => txs.some(t => t.id === tx.id));
              if (exists) {
                await db.transactions.update(tx.id, {
                  ...updateData,
                  // Conserver la date d'origine pour chaque transaction de la série
                  date: tx.date 
                });
              }
            } catch (e) {
              console.error(`Erreur lors de la mise à jour de la transaction récurrente ${tx.id}:`, e);
            }
          }
        }
        toast.success(`${recurringTransactions.length} transactions récurrentes mises à jour !`);
      } 
      // Option 2: Si on veut mettre à jour toutes les occurrences similaires
      else if (affectAllOccurrences) {
        // Récupérer toutes les transactions
        const allTransactions = await db.transactions.getAll();
        
        // Filtrer les transactions similaires (même description et montant) dans les mois à venir
        const currentDate = new Date(transaction.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const similarTransactions = allTransactions.filter(tx => 
          tx.description === transaction.description &&
          tx.amount === transaction.amount &&
          tx.type === transaction.type &&
          tx.accountId === transaction.accountId &&
          new Date(tx.date) >= today // Uniquement les transactions futures ou d'aujourd'hui
        );
        
        // Mettre à jour toutes les transactions similaires
        let successCount = 0;
        for (const tx of similarTransactions) {
          if (tx.id) {
            try {
              // Vérifier que la transaction existe toujours avant de la mettre à jour
              const exists = await db.transactions.getAll().then(txs => txs.some(t => t.id === tx.id));
              if (exists) {
                await db.transactions.update(tx.id, {
                  ...updateData,
                  // Conserver la date d'origine pour chaque transaction
                  date: tx.date
                });
                successCount++;
              }
            } catch (e) {
              console.error(`Erreur lors de la mise à jour de la transaction similaire ${tx.id}:`, e);
            }
          }
        }
        
        toast.success(`${successCount} transactions similaires mises à jour !`);
      } else {
        // Mettre à jour uniquement la transaction courante
        await db.transactions.update(transaction.id, updateData);
        toast.success("Transaction mise à jour avec succès !");
      }
      
      form.reset();
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la transaction:", error);
      toast.error("Erreur lors de la mise à jour de la transaction");
    }
  }
  
  // Fonction pour supprimer la transaction
  async function handleDelete() {
    try {
      if (!transaction.id) {
        toast.error("Identifiant de transaction manquant");
        return;
      }
      
      // Option 1: Si la transaction fait partie d'une série récurrente et que l'option est active
      if (affectAllRecurring && transaction.recurringId) {
        // Récupérer toutes les transactions avec le même ID récurrent
        const allTransactions = await db.transactions.getAll();
        const recurringTransactions = allTransactions.filter(tx => 
          tx.recurringId === transaction.recurringId
        );
        
        // Supprimer toutes les transactions récurrentes
        for (const tx of recurringTransactions) {
          if (tx.id) {
            await db.transactions.delete(tx.id);
          }
        }
        toast.success(`${recurringTransactions.length} transactions récurrentes supprimées !`);
      }
      // Option 2: Si on veut supprimer toutes les occurrences similaires
      else if (affectAllOccurrences) {
        // Récupérer toutes les transactions
        const allTransactions = await db.transactions.getAll();
        
        // Filtrer les transactions similaires (même description et montant) dans les mois à venir
        const currentDate = new Date(transaction.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const similarTransactions = allTransactions.filter(tx => 
          tx.description === transaction.description &&
          tx.amount === transaction.amount &&
          tx.type === transaction.type &&
          tx.accountId === transaction.accountId &&
          new Date(tx.date) >= today // Uniquement les transactions futures ou d'aujourd'hui
        );
        
        // Supprimer toutes les transactions similaires
        let count = 0;
        for (const tx of similarTransactions) {
          if (tx.id) {
            await db.transactions.delete(tx.id);
            count++;
          }
        }
        
        toast.success(`${count} transactions similaires supprimées !`);
      } else {
        // Supprimer uniquement la transaction courante
        await db.transactions.delete(transaction.id);
        toast.success("Transaction supprimée avec succès !");
      }
      
      onDelete?.();
      onSuccess?.(); // Pour rafraîchir la liste
      onClose();
    } catch (error) {
      console.error("Erreur lors de la suppression de la transaction:", error);
      toast.error("Erreur lors de la suppression de la transaction");
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier la transaction</DialogTitle>
            <DialogDescription>
              Modifiez les informations de cette transaction
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Type de transaction */}
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de transaction</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={TransactionType.INCOME}>Revenu</SelectItem>
                        <SelectItem value={TransactionType.EXPENSE}>Dépense</SelectItem>
                        <SelectItem value={TransactionType.TRANSFER}>Transfert</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Compte source */}
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {transactionType === TransactionType.TRANSFER ? "Compte source" : "Compte"}
                    </FormLabel>
                    <Select
                      disabled={isLoadingAccounts}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      defaultValue={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un compte" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {accounts?.map((account) => (
                          <SelectItem
                            key={account.id}
                            value={account.id!.toString()}
                          >
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Compte destination (pour les transferts) */}
              {transactionType === TransactionType.TRANSFER && (
                <FormField
                  control={form.control}
                  name="toAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Compte destination</FormLabel>
                      <Select
                        disabled={isLoadingAccounts}
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un compte" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts?.filter(account => account.id !== accountId).map((account) => (
                            <SelectItem
                              key={account.id}
                              value={account.id!.toString()}
                            >
                              {account.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder={
                          transactionType === TransactionType.TRANSFER 
                            ? "Ex: Transfert vers compte épargne..." 
                            : transactionType === TransactionType.INCOME 
                              ? "Ex: Salaire, Prime..." 
                              : "Ex: Courses, Loyer..."
                        } 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Montant */}
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Catégorie (uniquement pour les dépenses) */}
              {transactionType === TransactionType.EXPENSE && (
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Catégorie</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une catégorie" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={ExpenseCategory.FIXED}>Fixe</SelectItem>
                          <SelectItem value={ExpenseCategory.RECURRING}>Courante</SelectItem>
                          <SelectItem value={ExpenseCategory.EXCEPTIONAL}>Exceptionnelle</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              {/* Date */}
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: fr })
                            ) : (
                              <span>Sélectionner une date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Options pour les transactions */}
              <div className="space-y-4 py-4 border-t">
                {/* Option 1: Pour les transactions récurrentes */}
                {transaction.recurringId && (
                  <div className="flex items-center justify-between space-x-2 py-2">
                    <div>
                      <h4 className="font-medium">Appliquer à toutes les transactions récurrentes</h4>
                      <p className="text-sm text-muted-foreground">
                        {affectAllRecurring 
                          ? "Modifiera toutes les transactions de cette série récurrente" 
                          : "Modifiera uniquement cette transaction"}
                      </p>
                    </div>
                    <Switch
                      checked={affectAllRecurring}
                      onCheckedChange={(checked) => {
                        setAffectAllRecurring(checked);
                        if (checked) setAffectAllOccurrences(false); // Désactiver l'autre option
                      }}
                    />
                  </div>
                )}
                
                {/* Option 2: Pour toutes les occurrences */}
                <div className="flex items-center justify-between space-x-2 py-2">
                  <div>
                    <h4 className="font-medium">Toutes les occurrences</h4>
                    <p className="text-sm text-muted-foreground">
                      {affectAllOccurrences 
                        ? "Modifiera toutes les transactions similaires à venir" 
                        : "Modifiera uniquement cette transaction"}
                    </p>
                  </div>
                  <Switch
                    checked={affectAllOccurrences}
                    onCheckedChange={(checked) => {
                      setAffectAllOccurrences(checked);
                      if (checked) setAffectAllRecurring(false); // Désactiver l'autre option
                    }}
                  />
                </div>
              </div>
              
              <DialogFooter className="flex gap-2 pt-2">
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="mr-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Supprimer
                </Button>
                <Button type="button" variant="outline" onClick={onClose}>
                  Annuler
                </Button>
                <Button type="submit">
                  <Pencil className="mr-2 h-4 w-4" />
                  Mettre à jour
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action ne peut pas être annulée.
              {transaction.recurringId && affectAllRecurring
                ? " Toutes les transactions récurrentes associées seront supprimées."
                : " La transaction sera définitivement supprimée."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4 mb-4 border-t border-b">
            {/* Option 1: Pour les transactions récurrentes */}
            {transaction.recurringId && (
              <div className="flex items-center justify-between space-x-2 py-2">
                <div>
                  <h4 className="font-medium">Supprimer toutes les transactions récurrentes</h4>
                  <p className="text-sm text-muted-foreground">
                    {affectAllRecurring 
                      ? "Supprimera toutes les transactions de cette série récurrente" 
                      : "Supprimera uniquement cette transaction"}
                  </p>
                </div>
                <Switch
                  checked={affectAllRecurring}
                  onCheckedChange={(checked) => {
                    setAffectAllRecurring(checked);
                    if (checked) setAffectAllOccurrences(false); // Désactiver l'autre option
                  }}
                />
              </div>
            )}
            
            {/* Option 2: Pour toutes les occurrences */}
            <div className="flex items-center justify-between space-x-2 py-2">
              <div>
                <h4 className="font-medium">Supprimer toutes les occurrences similaires</h4>
                <p className="text-sm text-muted-foreground">
                  {affectAllOccurrences 
                    ? "Supprimera toutes les transactions similaires à venir" 
                    : "Supprimera uniquement cette transaction"}
                </p>
              </div>
              <Switch
                checked={affectAllOccurrences}
                onCheckedChange={(checked) => {
                  setAffectAllOccurrences(checked);
                  if (checked) setAffectAllRecurring(false); // Désactiver l'autre option
                }}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="mr-2 h-4 w-4" />
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
