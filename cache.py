# cache.py
# Ce module sert de simple cache en mémoire pour partager des données entre différentes parties de l'application.

import sys
import os

# Ajouter le répertoire parent au chemin d'importation pour pouvoir importer le module de journalisation
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from logging import info, debug

# Cache pour stocker les soldes finaux mensuels calculés par la page Statistiques.
# La clé sera le mois au format 'YYYY-MM', la valeur sera le solde final (float).
monthly_balance_cache = {}

# Fonctions d'accès au cache avec journalisation
def get_cached_balance(month_key):
    """Récupère une valeur du cache avec journalisation"""
    value = monthly_balance_cache.get(month_key)
    if value is not None:
        debug(f"Cache hit pour le mois {month_key}: {value}", module="cache")
    else:
        debug(f"Cache miss pour le mois {month_key}", module="cache")
    return value

def set_cached_balance(month_key, value):
    """Enregistre une valeur dans le cache avec journalisation"""
    monthly_balance_cache[month_key] = value
    debug(f"Mise en cache du solde pour le mois {month_key}: {value}", module="cache")

def clear_cache():
    """Efface le cache"""
    monthly_balance_cache.clear()
    info("Cache de soldes mensuels effacé", module="cache")

# Vous pouvez ajouter d'autres variables de cache ici si nécessaire à l'avenir.
info("Module cache.py chargé", module="cache")
