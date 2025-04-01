
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowRightLeft, CalendarIcon, CreditCard, X } from "lucide-react";

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
  FormDescription,
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
import db from "@/lib/db";
import { cn } from "@/lib/utils";
import { Account, TransactionType, ExpenseCategory, RecurringFrequency } from "@/lib/types";
import { toast } from "sonner";

// Create a conditional schema based on transaction type
const transactionFormSchema = z.object({
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
  isRecurring: z.boolean().default(false),
  recurringMonths: z.number().min(1, "Veuillez entrer un nombre de mois valide").default(12).optional(),
}).refine(data => {
  // If it's a transfer, toAccountId is required and must be different from accountId
  if (data.type === TransactionType.TRANSFER) {
    return data.toAccountId !== undefined && data.toAccountId !== data.accountId;
  }
  return true;
}, {
  message: "Pour un transfert, veuillez sélectionner un compte destination différent du compte source",
  path: ["toAccountId"],
}).refine(data => {
  // If it's recurring, recurringMonths is required
  if (data.isRecurring) {
    return data.recurringMonths !== undefined && data.recurringMonths > 0;
  }
  return true;
}, {
  message: "Veuillez spécifier un nombre de mois valide pour cette transaction récurrente",
  path: ["recurringMonths"],
});

type TransactionFormValues = z.infer<typeof transactionFormSchema>;

interface TransactionFormProps {
  open: boolean;
  defaultType?: TransactionType;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TransactionForm({
  open,
  defaultType = TransactionType.EXPENSE,
  onClose,
  onSuccess,
}: TransactionFormProps) {
  const [isRecurring, setIsRecurring] = useState(false);

  const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      return db.accounts.getAll();
    },
  });

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      type: defaultType,
      description: "",
      date: new Date(),
      isRecurring: false,
      recurringMonths: 12,
    },
  });

  // Mettre à jour le formulaire quand le type par défaut change ou quand la modale s'ouvre
  useEffect(() => {
    form.setValue("type", defaultType);
    
    // Réinitialiser l'état de récurrence à chaque ouverture
    if (open) {
      setIsRecurring(false);
      form.setValue("isRecurring", false);
    }

    // Définir le compte par défaut s'il n'y a qu'un seul compte
    if (accounts && accounts.length === 1 && accounts[0].id) {
      form.setValue("accountId", accounts[0].id);
    }
  }, [defaultType, form, accounts, open]);

  // Ajustement du formulaire selon le type de transaction
  const transactionType = form.watch("type");
  const accountId = form.watch("accountId");

  async function onSubmit(data: TransactionFormValues) {
    try {
      if (data.isRecurring && data.recurringMonths) {
        // Créer plusieurs instances de transactions sur les prochains mois
        const months = data.recurringMonths;
        const baseTransaction = {
          accountId: data.accountId,
          toAccountId: data.type === TransactionType.TRANSFER ? data.toAccountId : undefined,
          amount: data.amount,
          type: data.type,
          category: data.type === TransactionType.EXPENSE ? data.category : undefined,
          description: data.description,
        };

        // Créer les transactions pour chaque mois demandé
        for (let i = 0; i < months; i++) {
          const transactionDate = new Date(data.date);
          transactionDate.setMonth(transactionDate.getMonth() + i);
          
          await db.transactions.create({
            ...baseTransaction,
            date: transactionDate,
          });
        }
        
        toast.success(`${data.type === TransactionType.INCOME ? "Revenus" : "Dépenses"} mensuels créés pour ${months} mois !`);
      } else {
        // Créer une transaction normale
        const transactionId = await db.transactions.create({
          accountId: data.accountId,
          toAccountId: data.type === TransactionType.TRANSFER ? data.toAccountId : undefined,
          amount: data.amount,
          type: data.type,
          category: data.type === TransactionType.EXPENSE ? data.category : undefined,
          description: data.description,
          date: data.date,
        });
        
        // Si c'est un transfert, mettre à jour les soldes des comptes
        if (data.type === TransactionType.TRANSFER && data.toAccountId) {
          // Cette partie est gérée par la base de données
          toast.success("Transfert effectué avec succès !");
        } else {
          const typeText = data.type === TransactionType.INCOME ? "Revenu" : "Dépense";
          toast.success(`${typeText} ajouté avec succès !`);
        }
      }
      
      form.reset();
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Erreur lors de l'ajout de la transaction:", error);
      toast.error("Erreur lors de l'ajout de la transaction");
    }
  }

  // Générer un titre approprié selon le type de transaction
  const getDialogTitle = () => {
    switch (transactionType) {
      case TransactionType.INCOME:
        return "Ajouter un revenu";
      case TransactionType.EXPENSE:
        return "Ajouter une dépense";
      case TransactionType.TRANSFER:
        return "Effectuer un transfert";
      default:
        return "Ajouter une transaction";
    }
  };

  // Générer une description appropriée selon le type de transaction
  const getDialogDescription = () => {
    switch (transactionType) {
      case TransactionType.INCOME:
        return "Remplissez les informations ci-dessous pour enregistrer un revenu.";
      case TransactionType.EXPENSE:
        return "Remplissez les informations ci-dessous pour enregistrer une dépense.";
      case TransactionType.TRANSFER:
        return "Remplissez les informations ci-dessous pour effectuer un transfert entre vos comptes.";
      default:
        return "Remplissez les informations ci-dessous.";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{getDialogDescription()}</DialogDescription>
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
            
            {/* Transaction récurrente */}
            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>Transaction récurrente</FormLabel>
                    <FormDescription>
                      Répéter automatiquement cette transaction
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Button
                      type="button"
                      variant={field.value ? "default" : "outline"}
                      onClick={() => {
                        const newValue = !field.value;
                        field.onChange(newValue);
                        setIsRecurring(newValue);
                        if (newValue) {
                          // Définir automatiquement 12 mois par défaut
                          form.setValue("recurringMonths", 12);
                        }
                      }}
                      className="ml-3"
                    >
                      {field.value ? (
                        <>
                          <span className="mr-2">Activée</span>
                          <X className="h-4 w-4" />
                        </>
                      ) : (
                        <>
                          <span className="mr-2">Activer</span>
                          <CreditCard className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </FormControl>
                </FormItem>
              )}
            />
            
            {/* Options de récurrence */}
            {isRecurring && (
              <div className="space-y-4 border p-3 rounded-lg">
                <FormField
                  control={form.control}
                  name="recurringMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de mois</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          placeholder="12"
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          value={field.value || 12}
                        />
                      </FormControl>
                      <FormDescription>
                        Cette transaction sera répétée mensuellement pendant ce nombre de mois
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            <DialogFooter className="flex flex-col sm:flex-row gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              <Button 
                type="submit"
                className="w-full sm:w-auto bg-primary"
              >
                {transactionType === TransactionType.INCOME ? "Ajouter le revenu" : 
                 transactionType === TransactionType.EXPENSE ? "Ajouter la dépense" : 
                 "Effectuer le transfert"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
