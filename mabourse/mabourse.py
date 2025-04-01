import os

class Mabourse:
    def __init__(self):
        self.config_file_path = "config.json"
        self.password = "default_password"  # Exemple pour la démonstration
        # Autres initialisations

    # Autres méthodes de la classe
    
    def delete_config(self, password_check: str) -> bool:
        # Vérifier si le mot de passe fourni correspond à celui chargé
        if not self.password:
            # Si aucun mot de passe n'est chargé (config peut-être déjà supprimée ou init échouée)
            print("Erreur : Impossible de vérifier le mot de passe (aucun mot de passe chargé).")
            return False
        if password_check != self.password:
            print("Erreur : Le mot de passe fourni est incorrect.")
            return False
        # Si les vérifications passent, continuer vers la suppression
        print("Mot de passe correct. Tentative de suppression de la configuration...") # Ajout pour feedback
        
        if os.path.exists(self.config_file_path):
            os.remove(self.config_file_path)
            print(f"Le fichier de configuration '{self.config_file_path}' a été supprimé.")
            return True
        else:
            print(f"Le fichier de configuration '{self.config_file_path}' n'existe pas.")
            return False
