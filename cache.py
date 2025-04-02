# cache.py
# Ce module sert de simple cache en mémoire pour partager des données entre différentes parties de l'application.

# Cache pour stocker les soldes finaux mensuels calculés par la page Statistiques.
# La clé sera le mois au format 'YYYY-MM', la valeur sera le solde final (float).
monthly_balance_cache = {}

# Vous pouvez ajouter d'autres variables de cache ici si nécessaire à l'avenir.
print("[Cache Init] Module cache.py chargé.") # Pour confirmation lors du chargement
