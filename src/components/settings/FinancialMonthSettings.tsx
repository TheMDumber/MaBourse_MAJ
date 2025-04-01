import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useFinancialMonth } from "@/contexts/FinancialMonthContext";
import { Account } from "@/lib/types";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface FinancialMonthSettingsProps {
  accounts: Account[];
}

export function FinancialMonthSettings({ accounts }: FinancialMonthSettingsProps) {
  const {
    isFinancialMonthEnabled,
    financialMonthStartDay,
    financialMonthAccountId,
    toggleFinancialMonth,
    setFinancialMonthStartDay,
    setFinancialMonthAccount,
    isLoading
  } = useFinancialMonth();

  const queryClient = useQueryClient();
  const [startDay, setStartDay] = useState<string>(financialMonthStartDay.toString());
  const [startDayError, setStartDayError] = useState<string | null>(null);

  // Mettre à jour le jour de début lorsque la valeur change dans le contexte
  useEffect(() => {
    setStartDay(financialMonthStartDay.toString());
  }, [financialMonthStartDay]);

  // Gérer le changement de jour de début
  const handleStartDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStartDay(value);
    
    // Vérifier si la valeur est un nombre valide
    const dayNumber = parseInt(value);
    if (isNaN(dayNumber) || dayNumber < 1 || dayNumber > 31) {
      setStartDayError('Jour invalide (1-31)');
    } else {
      setStartDayError(null);
    }
  };

  // Appliquer le changement de jour de début
  const handleApplyStartDay = async () => {
    const dayNumber = parseInt(startDay);
    if (!isNaN(dayNumber) && dayNumber >= 1 && dayNumber <= 31) {
      await setFinancialMonthStartDay(dayNumber);
      setStartDayError(null);
      
      // Invalider les requêtes pour forcer la mise à jour de l'affichage
      queryClient.invalidateQueries({ queryKey: ['financialDates'] });
      queryClient.invalidateQueries({ queryKey: ['forecastBalance'] });
      
      // Forcer un refresh immédiat
      queryClient.refetchQueries({ queryKey: ['financialDates'] });
    } else {
      setStartDayError('Jour invalide (1-31)');
    }
  };

  // Trouver le nom du compte sélectionné
  const selectedAccountName = financialMonthAccountId
    ? accounts.find(a => a.id === financialMonthAccountId)?.name
    : undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Mois financier</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p>Le mois financier vous permet de personnaliser le début et la fin de chaque mois selon vos besoins financiers personnels, comme la date de réception de votre salaire.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>
          Personnalisez votre cycle financier mensuel en fonction de vos revenus
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement des paramètres...</p>
        ) : (
          <>
            {/* Activer/désactiver le mois financier */}
            <div className="flex flex-row items-center justify-between space-y-0 py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Utiliser le mois financier</Label>
                <p className="text-sm text-muted-foreground">
                  Définir une période mensuelle personnalisée qui démarre à la date de votre revenu principal
                </p>
              </div>
              <Switch
                checked={isFinancialMonthEnabled}
                onCheckedChange={async (checked) => {
                  const wasEnabled = isFinancialMonthEnabled;
                  await toggleFinancialMonth();
                  
                  // Invalider les requêtes pour forcer la mise à jour de l'affichage
                  queryClient.invalidateQueries({ 
                    queryKey: ['isFinancialMonthEnabled'],
                    refetchType: 'active'
                  });
                  queryClient.invalidateQueries({ 
                    queryKey: ['financialDates'],
                    refetchType: 'active' 
                  });
                  queryClient.invalidateQueries({ 
                    queryKey: ['forecastBalance'],
                    refetchType: 'active'
                  });
                  
                  // Forcer un recalcul immédiat
                  queryClient.refetchQueries({ queryKey: ['financialDates'] });
                  
                  // Si on active le mode mois financier, vérifier si nous devons changer de mois actuel
                  if (checked) {
                    // Émettre un événement pour informer l'application qu'elle doit vérifier si le mois actuel doit changer
                    localStorage.setItem('financialMonthModeToggled', Date.now().toString());
                    
                    // Vérifier et mettre à jour le mois financier directement
                    try {
                      // Importer les fonctions nécessaires
                      const { getFinancialMonthRange } = await import('@/lib/financialMonthUtils');
                      
                      // Obtenir la date actuelle
                      const today = new Date();
                      
                      // Obtenir le mois financier actuel basé sur la date du jour
                      const currentFinancialMonth = await getFinancialMonthRange(today);
                      
                      // Extraire le mois et l'année du nom du mois financier
                      const [monthName, yearStr] = currentFinancialMonth.name.split(' ');
                      
                      // Convertir le nom du mois en numéro de mois (0-11)
                      const monthNames = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 
                                       'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
                      const monthIndex = monthNames.findIndex(m => 
                        m.toLowerCase() === monthName.toLowerCase());
                      
                      if (monthIndex === -1 || !yearStr) {
                        console.error('Format de nom de mois financier non reconnu:', currentFinancialMonth.name);
                        return;
                      }
                      
                      // Créer le format YYYY-MM pour le mois financier
                      const year = parseInt(yearStr);
                      const monthNum = monthIndex + 1; // Convertir de 0-11 à 1-12
                      const financialMonthYearMonth = `${year}-${monthNum.toString().padStart(2, '0')}`;
                      
                      // Obtenir le mois calendaire actuel
                      const currentCalendarYearMonth = format(today, 'yyyy-MM');
                      
                      console.log(`Mois financier actuel: ${financialMonthYearMonth}, mois calendaire: ${currentCalendarYearMonth}`);
                      
                      // Si le mois financier est différent du mois calendaire actuel
                      if (financialMonthYearMonth !== currentCalendarYearMonth) {
                        console.log(`Mise à jour de l'affichage pour montrer le mois financier: ${financialMonthYearMonth}`);
                        
                        // Construire la nouvelle URL avec le mois financier
                        const url = new URL(window.location.href);
                        const searchParams = new URLSearchParams(url.search);
                        searchParams.set('month', financialMonthYearMonth);
                        url.search = searchParams.toString();
                        
                        // Naviguer vers la nouvelle URL
                        window.history.pushState({}, '', url.toString());
                        
                        // Recharger la page pour appliquer le changement
                        window.location.href = url.toString();
                      }
                    } catch (error) {
                      console.error('Erreur lors de la mise à jour du mois financier:', error);
                    }
                  }
                  
                  // Forcer un refresh immédiat
                  queryClient.refetchQueries({ queryKey: ['financialDates'] });
                }}
              />
            </div>
            
            {/* Configuration du jour de début */}
            <div className={`space-y-3 ${isFinancialMonthEnabled ? 'opacity-100' : 'opacity-50'}`}>
              <Label htmlFor="start-day" className="text-base font-medium">
                Jour de début du mois financier
              </Label>
              <p className="text-sm text-muted-foreground">
                Jour du mois où vous recevez votre revenu principal
              </p>
              <div className="flex items-center gap-2">
                <Input
                  id="start-day"
                  type="number"
                  min="1"
                  max="31"
                  value={startDay}
                  onChange={handleStartDayChange}
                  className={`w-24 ${startDayError ? 'border-red-500' : ''}`}
                  disabled={!isFinancialMonthEnabled}
                />
                <Button 
                  onClick={handleApplyStartDay}
                  disabled={!isFinancialMonthEnabled || !!startDayError}
                  variant="outline"
                >
                  Appliquer
                </Button>
              </div>
              {startDayError && (
                <p className="text-xs text-red-500">{startDayError}</p>
              )}
              
              <div className="bg-muted p-3 rounded-md mt-2 text-sm">
                <p className="font-semibold mb-1">Comment fonctionne le mois financier :</p>
                <p>Si votre revenu arrive le {financialMonthStartDay} du mois, alors :</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Votre "mois financier de Mars" commence le {financialMonthStartDay} Février et se termine le {financialMonthStartDay-1 > 0 ? financialMonthStartDay-1 : 31+financialMonthStartDay-1} Mars</li>
                  <li>Vos transactions sont regroupées par mois financier et non par mois calendaire</li>
                </ul>
              </div>
            </div>
            
            {/* Sélection du compte pour le mois financier (future implémentation) */}
            {isFinancialMonthEnabled && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label htmlFor="financial-account" className="text-base font-medium">
                    Compte de référence (optionnel)
                  </Label>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                    Fonctionnalité avancée
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Associer la période à un compte spécifique pour une meilleure organisation
                </p>
                <Select
                  value={financialMonthAccountId?.toString() || "none"}
                  onValueChange={(value) => {
                    setFinancialMonthAccount(value === "none" ? undefined : parseInt(value));
                  }}
                >
                  <SelectTrigger id="financial-account" className="w-full md:w-[300px]">
                    <SelectValue placeholder="Sélectionner un compte (optionnel)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      <span>Aucun compte spécifique</span>
                    </SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id!.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{account.name}</span>
                          {financialMonthAccountId === account.id && (
                            <Badge variant="outline" className="ml-2 bg-primary/10 text-primary">actif</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
