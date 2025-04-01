import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AccountType, Currency, Account } from '@/lib/types';
import { accountsAPI } from '@/lib/db';

interface AccountFormProps {
  onSuccess?: (accountId: number) => void;
  onCancel?: () => void;
  existingAccount?: Account;
}

export const AccountForm = ({ onSuccess, onCancel, existingAccount }: AccountFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameExists, setNameExists] = useState(false);
  
  // Initialiser le state avec les valeurs de l'account existant ou des valeurs par défaut
  const [name, setName] = useState(existingAccount?.name || '');
  const [type, setType] = useState<AccountType>(existingAccount?.type || AccountType.CHECKING);
  const [initialBalance, setInitialBalance] = useState<string>(
    existingAccount ? existingAccount.initialBalance.toString() : '0'
  );
  const [currency, setCurrency] = useState<Currency>(existingAccount?.currency || Currency.EUR);
  const [creationDate, setCreationDate] = useState<string>(() => {
    if (existingAccount?.createdAt) {
      // Format yyyy-MM-dd pour l'input type date
      // S'assurer que createdAt est bien un objet Date
      const date = existingAccount.createdAt instanceof Date 
        ? existingAccount.createdAt
        : new Date(existingAccount.createdAt);
      
      return date.toISOString().split('T')[0];
    }
    return new Date().toISOString().split('T')[0]; // Date actuelle par défaut
  });
  
  const isEditing = !!existingAccount;
  
  // Fonction pour capitaliser la première lettre
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Capitaliser automatiquement la première lettre
    let value = e.target.value;
    if (value.length > 0) {
      value = value.charAt(0).toUpperCase() + value.slice(1);
    }
    setName(value);
  };
  
  // Vérifier si le nom existe déjà à chaque changement
  useEffect(() => {
    const checkName = async () => {
      if (name.trim()) {
        const exists = await accountsAPI.checkNameExists(
          name, 
          isEditing ? existingAccount?.id : undefined
        );
        setNameExists(exists);
      } else {
        setNameExists(false);
      }
    };
    
    checkName();
  }, [name, isEditing, existingAccount]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du compte est obligatoire",
        variant: "destructive"
      });
      return;
    }
    
    if (nameExists) {
      toast({
        title: "Erreur",
        description: "Un compte avec ce nom existe déjà",
        variant: "destructive"
      });
      return;
    }
    
    // Convertir et valider le solde initial
    const initialBalanceNumber = initialBalance === '' || initialBalance === '-' || initialBalance === '-.' 
      ? 0 
      : parseFloat(initialBalance);

    if (isNaN(initialBalanceNumber)) {
      toast({
        title: "Erreur",
        description: "Le solde initial doit être un nombre valide",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      let accountId: number;
      
      if (isEditing && existingAccount.id) {
        // Mise à jour d'un compte existant
        const updatedAccount: Partial<Account> = {
          name,
          type,
          initialBalance: initialBalanceNumber,
          currency
        };
        
        // Validation de la date de création
        if (creationDate) {
          const newCreationDate = new Date(creationDate);
          
          // Vérifier si la date est valide
          if (isNaN(newCreationDate.getTime())) {
            toast({
              title: "Erreur",
              description: "La date de création est invalide. Veuillez entrer une date au format JJ/MM/AAAA.",
              variant: "destructive"
            });
            return;
          }
          
          // Convertir la date existante en objet Date si ce n'est pas déjà le cas
          const originalDate = existingAccount.createdAt instanceof Date
            ? existingAccount.createdAt
            : new Date(existingAccount.createdAt);
          
          // Obtenir le format YYYY-MM-DD pour la comparaison
          const originalDateStr = originalDate.toISOString().split('T')[0];
          
          // Vérifier si la date a changé
          if (originalDateStr !== creationDate) {
            console.log(`Mise à jour de la date de création: ${originalDateStr} -> ${creationDate}`);
            updatedAccount.createdAt = newCreationDate;
          }
        }
        
        accountId = await accountsAPI.update(existingAccount.id, updatedAccount);
        
        // Log de confirmation spécifique pour la modification de la date
        if (updatedAccount.createdAt) {
          console.log(`Date de création du compte ${name} mise à jour avec succès`);
        }
        
        toast({
          title: "Succès",
          description: "Compte mis à jour avec succès",
        });
      } else {
        // Création d'un nouveau compte
        accountId = await accountsAPI.create({
          name,
          type,
          initialBalance: initialBalanceNumber,
          currency
        });
        
        toast({
          title: "Succès",
          description: "Compte créé avec succès",
        });
      }
      
      if (onSuccess) {
        onSuccess(accountId);
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du compte:', error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la sauvegarde du compte",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>{isEditing ? 'Modifier le compte' : 'Nouveau compte'}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du compte</Label>
            <Input
              id="name"
              value={name}
              onChange={handleNameChange}
              placeholder="Ex: Compte courant"
              required
              className={nameExists ? "border-red-500" : ""}
            />
            {nameExists && (
              <p className="text-sm text-red-500">Un compte avec ce nom existe déjà</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="type">Type de compte</Label>
            <Select 
              value={type} 
              onValueChange={(value) => setType(value as AccountType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AccountType.CHECKING}>Compte courant</SelectItem>
                <SelectItem value={AccountType.SAVINGS}>Compte épargne</SelectItem>
                <SelectItem value={AccountType.CREDIT_CARD}>Carte de crédit</SelectItem>
                <SelectItem value={AccountType.CASH}>Espèces</SelectItem>
                <SelectItem value={AccountType.INVESTMENT}>Investissement</SelectItem>
                <SelectItem value={AccountType.OTHER}>Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="initialBalance">Solde initial (les valeurs négatives sont acceptées)</Label>
            <Input
              id="initialBalance"
              type="text"
              pattern="-?\d*\.?\d*"
              value={initialBalance}
              onChange={(e) => {
                const value = e.target.value;
                // Accepter: vide, -, -., chiffres avec éventuellement un point décimal
                if (value === '' || value === '-' || value === '-.' || /^-?\d*\.?\d*$/.test(value)) {
                  setInitialBalance(value);
                }
              }}
              placeholder="0.00"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="currency">Devise</Label>
            <Select 
              value={currency} 
              onValueChange={(value) => setCurrency(value as Currency)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une devise" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={Currency.EUR}>Euro (€)</SelectItem>
                <SelectItem value={Currency.USD}>Dollar US ($)</SelectItem>
                <SelectItem value={Currency.GBP}>Livre Sterling (£)</SelectItem>
                <SelectItem value={Currency.CHF}>Franc Suisse (CHF)</SelectItem>
                <SelectItem value={Currency.CAD}>Dollar Canadien (CAD)</SelectItem>
                <SelectItem value={Currency.JPY}>Yen Japonais (¥)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {isEditing && (
            <div className="space-y-2">
              <Label htmlFor="creationDate">Date de Création</Label>
              <Input
                id="creationDate"
                type="date"
                value={creationDate}
                onChange={(e) => setCreationDate(e.target.value)}
              />
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Annuler
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting || nameExists}>
            {isSubmitting ? 'Enregistrement...' : isEditing ? 'Mettre à jour' : 'Créer le compte'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};
