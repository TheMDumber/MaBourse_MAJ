
import { MainLayout } from '@/components/layout/MainLayout';

const Index = () => {
  return (
    <MainLayout hideHeader={true}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Bienvenue sur Ma Bourse 💰</h1>
        <p className="text-muted-foreground">
          Gérez vos finances personnelles facilement et en toute sécurité avec Ma Bourse. 
          Vos données sont stockées localement et ne quittent jamais votre navigateur.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-card shadow-sm rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Commencer avec Ma Bourse 💰</h2>
            <p className="text-muted-foreground mb-4">
              Pour commencer, créez votre premier compte bancaire et ajoutez vos premières transactions.
            </p>
            <ul className="space-y-2 list-disc pl-6 mb-4">
              <li>Naviguez vers la page "Comptes" pour créer un compte</li>
              <li>Ajoutez vos revenus et dépenses dans "Transactions"</li>
              <li>Suivez l'évolution de vos finances dans "Statistiques"</li>
            </ul>
          </div>
          
          <div className="bg-card shadow-sm rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Fonctionnalités principales</h2>
            <ul className="space-y-2 list-disc pl-6">
              <li>Gestion de plusieurs comptes bancaires</li>
              <li>Suivi des revenus, dépenses et transferts</li>
              <li>Visualisation de vos finances avec des graphiques</li>
              <li>Configuration d'opérations récurrentes</li>
              <li>Personnalisation de l'interface avec trois thèmes visuels</li>
              <li>Stockage 100% local pour protéger votre vie privée</li>
            </ul>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;
