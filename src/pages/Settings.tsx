import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { forceFullSync, forceServerSync } from '@/lib/syncUtils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Download, Save, Upload, Trash2, HelpCircle, RotateCcw, RefreshCw, Database, AlertCircle } from 'lucide-react';
import { exportData, importData, cleanOldTransactions, downloadFile, ImportOptions, resetAllData } from '@/lib/dataManagement';
import { useToast } from '@/components/ui/use-toast';
import db from '@/lib/db';
import { Account } from '@/lib/types';
import { ResetTipsButton } from '@/components/tips/AppTips';
import { useAuth } from '@/contexts/AuthContext';
import { useDeviceContext } from '@/contexts/DeviceContext';
import { FinancialMonthSettings } from '@/components/settings/FinancialMonthSettings';

const Settings = () => {
  const { toast } = useToast();
  const { username, logout, syncData, lastSyncTime } = useAuth();
  const { isMobile } = useDeviceContext();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // Détecter si on est en vue mobile pour l'interface
  useEffect(() => {
    setIsMobileView(isMobile);
  }, [isMobile]);
  
  // Gestion des comptes
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedExportAccount, setSelectedExportAccount] = useState<string>('all');
  const [selectedImportAccount, setSelectedImportAccount] = useState<string>('');
  const [importMode, setImportMode] = useState<'create' | 'overwrite' | 'merge'>('create');
  
  // Chargement des comptes
  useEffect(() => {
    const loadAccounts = async () => {
      const accountsList = await db.accounts.getAll();
      setAccounts(accountsList);
      
      // Sélectionner le premier compte par défaut pour l'import s'il y en a
      if (accountsList.length > 0) {
        setSelectedImportAccount(accountsList[0].id!.toString());
      }
    };
    
    loadAccounts();
  }, []);

  // Exportation des données
  const handleExport = async () => {
    try {
      setIsExporting(true);
      
      // Déterminer s'il faut exporter un compte spécifique ou tous les comptes
      const accountIdToExport = selectedExportAccount === 'all' ? undefined : parseInt(selectedExportAccount);
      
      // Générer le nom du fichier en fonction du mode d'exportation
      let filename = "budget-app-export";
      if (accountIdToExport) {
        const account = accounts.find(a => a.id === accountIdToExport);
        if (account) {
          filename += `-${account.name.replace(/\s+/g, '-').toLowerCase()}`;
        }
      }
      filename += `-${new Date().toISOString().slice(0, 10)}.json`;
      
      // Exporter les données
      const data = await exportData(accountIdToExport);
      downloadFile(data, filename, 'application/json');
      
      toast({
        title: "Exportation réussie",
        description: accountIdToExport 
          ? "Le compte sélectionné a été exporté avec succès" 
          : "Toutes vos données ont été exportées avec succès",
      });
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error);
      toast({
        title: "Erreur d'exportation",
        description: "Une erreur est survenue lors de l'exportation des données",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Sélection d'un fichier pour l'importation
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Importation des données
  const handleImport = async () => {
    if (!selectedFile) {
      toast({
        title: "Aucun fichier sélectionné",
        description: "Veuillez sélectionner un fichier à importer",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsImporting(true);
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        if (e.target?.result) {
          const jsonData = e.target.result.toString();
          
          // Préparer les options d'importation
          const options: ImportOptions = {
            mode: importMode,
            clearExisting: importMode === 'create' && false, // En mode création, on ne vide pas tout
          };
          
          // Si nous sommes en mode écrasement, définir le compte cible
          if (importMode === 'overwrite' && selectedImportAccount) {
            options.targetAccountId = parseInt(selectedImportAccount);
          }
          
          // Importer les données avec les options personnalisées et forcer la mise à jour de l'UI
          const success = await importData(jsonData, options, true);
          
          if (success) {
            setImportDialogOpen(false);
            setSelectedFile(null);
            
            // Message personnalisé selon le mode d'importation
            let message = "";
            switch (importMode) {
              case 'create':
                message = "De nouveaux comptes ont été créés à partir des données importées";
                break;
              case 'overwrite':
                message = "Le compte sélectionné a été écrasé avec les données importées";
                break;
              case 'merge':
                message = "Les données ont été fusionnées avec vos données existantes";
                break;
              default:
                message = "Vos données ont été importées avec succès";
            }
            
            toast({
              title: "Importation réussie",
              description: message,
            });
            
            // Recharger les comptes après l'importation
            const updatedAccounts = await db.accounts.getAll();
            setAccounts(updatedAccounts);
            
            // Forcer la mise à jour de l'UI complète via React Query
            try {
              const { queryClient } = await import('@/lib/queryConfig');
              if (queryClient) {
                console.log('Mise à jour de l\'UI après importation...');
                
                // Invalider toutes les requêtes importantes avec plus de précision
                queryClient.resetQueries({ queryKey: ['accounts'] });
                queryClient.resetQueries({ queryKey: ['transactions'] });
                queryClient.resetQueries({ queryKey: ['recurringTransactions'] });
                queryClient.resetQueries({ queryKey: ['balanceAdjustments'] });
                queryClient.resetQueries({ queryKey: ['statistics'] });
                
                // Forcer un rafraîchissement de la page actuelle après un court délai
                // pour s'assurer que toutes les invalidations ont eu le temps de se propager
                setTimeout(() => {
                  window.location.reload();
                }, 500);
              }
            } catch (e) {
              console.error('Erreur lors de la mise à jour de l\'UI:', e);
              // En cas d'erreur, forcer un rafraîchissement de la page
              window.location.reload();
            }
          } else {
            throw new Error("Échec de l'importation");
          }
        }
        setIsImporting(false);
      };
      
      reader.onerror = () => {
        setIsImporting(false);
        toast({
          title: "Erreur de lecture",
          description: "Impossible de lire le fichier sélectionné",
          variant: "destructive",
        });
      };
      
      reader.readAsText(selectedFile);
    } catch (error) {
      console.error('Erreur lors de l\'importation:', error);
      setIsImporting(false);
      toast({
        title: "Erreur d'importation",
        description: "Une erreur est survenue lors de l'importation des données",
        variant: "destructive",
      });
    }
  };

  // Réinitialiser toutes les données
  const handleReset = async () => {
    if (!username) {
      toast({
        title: "Erreur de réinitialisation",
        description: "Vous devez être connecté pour effectuer cette opération",
        variant: "destructive",
      });
      return;
    }
    
    if (!password) {
      toast({
        title: "Erreur de réinitialisation",
        description: "Mot de passe requis pour confirmer la réinitialisation",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setIsResetting(true);
      
      console.log('Début de la réinitialisation des données...');
      
      // Réinitialiser toutes les données locales et du serveur
      const success = await resetAllData(username, password);
      
      if (success) {
        console.log('Réinitialisation complète terminée avec succès');
        
        // Fermer la boîte de dialogue
        setResetDialogOpen(false);
        setPassword('');
        
        toast({
          title: "Réinitialisation réussie",
          description: "Toutes vos données ont été supprimées",
        });
        
        // Rafraîchir complètement l'application pour éviter les soucis de cache
        setTimeout(() => {
          // Déconnexion locale
          logout();
          // Forcer un rechargement complet pour vider tous les caches
          window.location.href = '/auth';
        }, 1500);
      } else {
        // Mot de passe incorrect ou autre erreur
        toast({
          title: "Erreur de réinitialisation",
          description: "Mot de passe incorrect ou erreur lors de la réinitialisation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      toast({
        title: "Erreur de réinitialisation",
        description: "Une erreur est survenue lors de la réinitialisation des données",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
    }
  };
  
  // Synchronisation des données
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const success = await syncData();
      if (success) {
        toast({
          title: "Synchronisation réussie",
          description: "Vos données ont été synchronisées avec succès",
          variant: "default",
        });
      } else {
        toast({
          title: "Erreur de synchronisation",
          description: "Une erreur est survenue lors de la synchronisation",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erreur lors de la synchronisation:', error);
      toast({
        title: "Erreur de synchronisation",
        description: "Une erreur inattendue est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Paramètres</h1>
        
        {/* Gestion des données */}
        <Card>
          <CardHeader>
            <CardTitle>Gestion des données</CardTitle>
            <CardDescription>
              Sauvegardez, restaurez ou nettoyez vos données
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Exportation des données */}
            <div className="grid gap-2">
              <h3 className="text-lg font-medium">Sauvegarde des données</h3>
              <p className="text-sm text-muted-foreground">
                Exportez vos données dans un fichier JSON pour les sauvegarder
              </p>
              
              <div className="grid gap-2">
                <Label htmlFor="export-account" className="font-semibold text-primary">Compte à exporter</Label>
                <Select 
                  value={selectedExportAccount} 
                  onValueChange={setSelectedExportAccount}
                >
                  <SelectTrigger id="export-account" className="border-2 border-primary font-medium">
                    <SelectValue placeholder="Sélectionnez un compte" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center justify-between w-full">
                        <span>Tous les comptes</span>
                        {selectedExportAccount === "all" && (
                          <Badge variant="outline" className="ml-2 bg-primary text-primary-foreground">actif</Badge>
                        )}
                      </div>
                    </SelectItem>
                    {accounts.map(account => (
                      <SelectItem key={account.id} value={account.id!.toString()}>
                        <div className="flex items-center justify-between w-full">
                          <span>{account.name}</span>
                          {selectedExportAccount === account.id!.toString() && (
                            <Badge variant="outline" className="ml-2 bg-primary text-primary-foreground">actif</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                onClick={handleExport} 
                className="w-full sm:w-auto mt-2"
                disabled={isExporting}
              >
                <Download className="mr-2 h-4 w-4" />
                {isExporting ? 'Exportation...' : 'Exporter les données'}
              </Button>
            </div>
            
            {/* Synchronisation des données */}
            <div className="grid gap-2">
              <h3 className="text-lg font-medium">Synchronisation des données</h3>
              <p className="text-sm text-muted-foreground">
                Synchronisez vos données avec le serveur pour les sécuriser
              </p>
              <div className="grid gap-2">
                <Button 
                  onClick={handleSync} 
                  variant="outline" 
                  className="w-full sm:w-auto flex items-center justify-center"
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 ${isMobileView ? '' : 'mr-2'} ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Synchronisation...' : 'Synchroniser les données'}
                </Button>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => {
                      forceFullSync();
                      toast({
                        title: "Réinitialisation de synchronisation",
                        description: "Les données locales seront envoyées vers le serveur et remplaceront complètement les données serveur lors de la prochaine synchronisation.",
                      });
                    }}
                    variant="outline"
                    className="w-full sm:w-auto bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Envoyer données locales au serveur
                  </Button>
                  
                  <Button
                    onClick={() => {
                      forceServerSync();
                      toast({
                        title: "Récupération des données du serveur",
                        description: "Les données du serveur vont remplacer les données locales lors de la prochaine synchronisation.",
                      });
                      // Lancer la synchronisation immédiatement
                      setIsSyncing(true);
                      syncData(true).then(() => {
                        setIsSyncing(false);
                        toast({
                          title: "Données récupérées",
                          description: "Les données du serveur ont été récupérées avec succès.",
                        });
                      }).catch(() => {
                        setIsSyncing(false);
                        toast({
                          title: "Erreur",
                          description: "Impossible de récupérer les données du serveur.",
                        });
                      });
                    }}
                    variant="outline"
                    className="w-full sm:w-auto bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300"
                    disabled={isSyncing}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Récupérer données du serveur
                  </Button>
                </div>
              </div>
              {/* Afficher la date de dernière synchronisation seulement si disponible */}
              {lastSyncTime && (
                <p className="text-xs text-muted-foreground">
                  Dernière synchronisation: {format(new Date(lastSyncTime), 'dd/MM/yyyy HH:mm', { locale: fr })}
                </p>
              )}
            </div>
            
            {/* Importation des données */}
            <div className="grid gap-2">
              <h3 className="text-lg font-medium">Restauration des données</h3>
              <p className="text-sm text-muted-foreground">
                Restaurez vos données à partir d'un fichier de sauvegarde
              </p>
              <Button 
                onClick={() => setImportDialogOpen(true)} 
                variant="outline" 
                className="w-full sm:w-auto"
              >
                <Upload className="mr-2 h-4 w-4" />
                Importer des données
              </Button>
            </div>
            
            {/* Réinitialisation des données */}
            <div className="grid gap-2 mt-4">
              <h3 className="text-lg font-medium">Réinitialisation complète</h3>
              <p className="text-sm text-muted-foreground">
                Supprimer toutes vos données (comptes, transactions, etc.) et réinitialiser l'application
              </p>
              <Button 
                onClick={() => setResetDialogOpen(true)} 
                variant="destructive" 
                className="w-full sm:w-auto bg-red-700 hover:bg-red-800"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Réinitialisation complète
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Alerte de stockage local */}
        <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              Important : Risque de perte de données
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <span className="font-bold">Attention :</span> Vos données sont stockées localement dans votre navigateur (IndexedDB).
              Si vous nettoyez l'historique, les cookies ou les données de navigation, vous risquez de <span className="font-bold">perdre
              toutes vos données locales</span>.
            </p>
            
            <div className="mt-3 p-3 bg-amber-100 dark:bg-amber-900/50 rounded-md border border-amber-300 dark:border-amber-700">
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">Que faire en cas de perte de données :</h3>
              <ol className="list-decimal ml-5 text-sm text-amber-700 dark:text-amber-400 space-y-1 mt-2">
                <li>Ne paniquez pas, vos données sont probablement sauvegardées sur le serveur</li>
                <li>Reconnectez-vous à l'application et patientez pendant la restauration automatique</li>
                <li>Si nécessaire, utilisez le bouton "Synchroniser les données" ci-dessus</li>
              </ol>
            </div>
            
            <div className="grid gap-2 mt-3">
              <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400">Prévention :</h3>
              <ul className="list-disc ml-5 text-sm text-amber-700 dark:text-amber-400 space-y-1">
                <li>Synchronisez régulièrement vos données avec le serveur</li>
                <li>Exportez vos données sous forme de fichier JSON pour les sauvegarder</li>
                <li>Lorsque vous nettoyez votre navigateur, <span className="font-bold">conservez les données du site</span> ou <span className="font-bold">ajoutez notre domaine en exception</span></li>
              </ul>
            </div>
          </CardContent>
        </Card>
        
        {/* Paramètres du mois financier */}
        <FinancialMonthSettings accounts={accounts} />
        
        {/* Carte des préférences d'affichage */}
        <Card>
          <CardHeader>
            <CardTitle>Préférences d'affichage</CardTitle>
            <CardDescription>
              Personnalisez l'affichage de l'application
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Réinitialiser les astuces */}
            <div className="grid gap-2">
              <h3 className="text-lg font-medium">Astuces de navigation</h3>
              <p className="text-sm text-muted-foreground">
                Réinitialisez les astuces contextuelles pour les afficher à nouveau
              </p>
              <div className="flex items-center gap-2">
                <ResetTipsButton />
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Boîte de dialogue d'importation */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Importer des données</DialogTitle>
              <DialogDescription>
                Sélectionnez un fichier JSON contenant des données exportées depuis cette application
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="file-import">
                  Fichier à importer
                </Label>
                <Input
                  id="file-import"
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    Fichier sélectionné: {selectedFile.name}
                  </p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label className="font-semibold text-primary">Mode d'importation</Label>
                <RadioGroup 
                  value={importMode} 
                  onValueChange={(value) => setImportMode(value as 'create' | 'overwrite' | 'merge')}
                  className="bg-muted/30 p-3 rounded-md border"
                >
                  <div className="flex items-center space-x-2 pb-2">
                    <RadioGroupItem value="create" id="create" className="border-primary" />
                    <Label htmlFor="create" className="cursor-pointer font-medium">Créer de nouveaux comptes</Label>
                    {importMode === "create" && <Badge className="ml-2 bg-primary/10 text-primary">sélectionné</Badge>}
                  </div>
                  <div className="flex items-center space-x-2 pb-2">
                    <RadioGroupItem value="merge" id="merge" className="border-primary" />
                    <Label htmlFor="merge" className="cursor-pointer font-medium">Fusionner avec les données existantes</Label>
                    {importMode === "merge" && <Badge className="ml-2 bg-primary/10 text-primary">sélectionné</Badge>}
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="overwrite" id="overwrite" className="border-primary" />
                    <Label htmlFor="overwrite" className="cursor-pointer font-medium">Écraser un compte existant</Label>
                    {importMode === "overwrite" && <Badge className="ml-2 bg-primary/10 text-primary">sélectionné</Badge>}
                  </div>
                </RadioGroup>
              </div>
              
              {/* Afficher le sélecteur de compte uniquement en mode écrasement */}
              {importMode === 'overwrite' && accounts.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="import-account" className="font-semibold text-primary">Compte à écraser</Label>
                  <Select 
                    value={selectedImportAccount} 
                    onValueChange={setSelectedImportAccount}
                    disabled={accounts.length === 0}
                  >
                    <SelectTrigger id="import-account" className="border-2 border-primary font-medium">
                      <SelectValue placeholder="Sélectionnez un compte" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id!.toString()}>
                          <div className="flex items-center justify-between w-full">
                            <span>{account.name}</span>
                            {selectedImportAccount === account.id!.toString() && (
                              <Badge variant="outline" className="ml-2 bg-primary text-primary-foreground">sélectionné</Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex items-center space-x-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <p className="text-yellow-500">
                  {importMode === 'overwrite' 
                    ? "Attention: Cette opération remplacera les données du compte sélectionné" 
                    : importMode === 'create' 
                      ? "Attention: Cette opération va créer de nouveaux comptes sans modifier vos données existantes"
                      : "Attention: Cette opération fusionnera les données importées avec vos données existantes"}
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setImportDialogOpen(false)}
                disabled={isImporting}
              >
                Annuler
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={!selectedFile || isImporting || (importMode === 'overwrite' && !selectedImportAccount)}
              >
                {isImporting ? 'Importation...' : 'Importer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Boîte de dialogue de réinitialisation */}
        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Réinitialisation complète</DialogTitle>
              <DialogDescription>
                <span className="font-semibold text-destructive">Attention:</span> Cette opération supprimera définitivement toutes vos données 
                locales et sur le serveur. Cette action est irréversible.  
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <label htmlFor="reset-password" className="text-sm font-semibold text-primary">
                  Entrez votre mot de passe pour confirmer
                </label>
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="Votre mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-2 border-destructive"
                />
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-destructive font-medium">
                  Après réinitialisation, vous serez déconnecté de l'application.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setResetDialogOpen(false);
                  setPassword('');
                }}
                disabled={isResetting}
              >
                Annuler
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleReset}
                disabled={isResetting || !password}
                className="bg-red-700 hover:bg-red-800"
              >
                {isResetting ? 'Réinitialisation...' : 'Confirmer la réinitialisation'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default Settings;
