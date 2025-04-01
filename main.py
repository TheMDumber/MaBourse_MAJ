#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import argparse
import getpass
from mabourse.mabourse import Mabourse

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='Mabourse - Gestionnaire de portefeuille boursier')
    
    # Groupes d'arguments mutuellement exclusifs
    group = parser.add_mutually_exclusive_group()
    
    # Arguments de configuration
    parser.add_argument('--config-path', type=str, default='config.json',
                      help='Chemin vers le fichier de configuration')
    group.add_argument('--delete-config', action='store_true',
                       help='Supprimer le fichier de configuration existant')
    
    # Autres arguments possibles
    # parser.add_argument('--autre-option', type=str, help='Description')
    
    return parser.parse_args()

def main():
    """Point d'entrée principal du programme"""
    # Analyser les arguments
    args = parse_arguments()
    
    # Définir le chemin de configuration
    config_path = args.config_path
    
    # Initialiser l'objet Mabourse
    mb = Mabourse()
    mb.config_file_path = config_path
    
    # Traitement des commandes en fonction des arguments
    
    # Gestion de la suppression de la configuration
    if args.delete_config:
        print("La suppression de la configuration nécessite votre mot de passe Boursorama.")
        try:
            # Demander le mot de passe de manière sécurisée
            password_attempt = getpass.getpass("Entrez votre mot de passe : ")
            # Appeler delete_config avec le mot de passe et vérifier le retour
            if mb.delete_config(password_check=password_attempt):
                print(f"Le fichier de configuration '{config_path}' a été supprimé avec succès.")
            else:
                # Des messages d'erreur plus spécifiques sont imprimés dans delete_config
                print("Échec de la suppression du fichier de configuration.")
        except Exception as e:
            print(f"Une erreur est survenue lors de la tentative de suppression : {e}")
            # Optionnel: logger l'erreur ou ajouter plus de détails si nécessaire
    
    # Autres traitements possibles
    # if args.autre_option:
    #     # Traitement
    
    print("Fin du programme.")

if __name__ == "__main__":
    main()
