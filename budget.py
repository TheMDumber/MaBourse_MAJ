#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from datetime import date, datetime
from utils_date import calculate_period_dates

def calculate_forecast_balance(target_month: int, target_year: int, mode: str = 'calendaire', financial_start_day: int = 1):
    """
    Calcule le solde prévisionnel pour un mois donné en utilisant le mode spécifié.
    
    Args:
        target_month (int): Mois cible (1-12)
        target_year (int): Année cible
        mode (str): Mode de calcul ('calendaire' ou 'financier')
        financial_start_day (int): Jour de début du mois financier (1-31)
    
    Returns:
        dict: Informations sur le solde prévisionnel
    """
    # Utilisation de la fonction calculate_period_dates pour obtenir les dates de début et fin
    start_date, end_date = calculate_period_dates(target_month, target_year, mode, financial_start_day)
    
    print(f"Calcul du solde prévisionnel pour la période: {start_date} au {end_date}")
    
    # Ici, vous implémenteriez la logique de calcul du solde prévisionnel
    # en vous basant sur les transactions de la période
    
    # Exemple simple pour démonstration
    initial_balance = 1000  # À remplacer par la logique réelle
    incomes = 500           # À calculer à partir des transactions de la période
    expenses = 300          # À calculer à partir des transactions de la période
    final_balance = initial_balance + incomes - expenses
    
    return {
        'period_start': start_date,
        'period_end': end_date,
        'mode': mode,
        'initial_balance': initial_balance,
        'incomes': incomes,
        'expenses': expenses,
        'final_balance': final_balance
    }

def main():
    """
    Exemple d'utilisation de la fonction de calcul du solde prévisionnel.
    """
    # Mois courant
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    # Exemple en mode calendaire
    result_calendaire = calculate_forecast_balance(current_month, current_year, 'calendaire')
    print("\nRésultat en mode calendaire:")
    for key, value in result_calendaire.items():
        print(f"  {key}: {value}")
    
    # Exemple en mode financier avec début au 15
    result_financier = calculate_forecast_balance(current_month, current_year, 'financier', 15)
    print("\nRésultat en mode financier (début au 15):")
    for key, value in result_financier.items():
        print(f"  {key}: {value}")

if __name__ == "__main__":
    main()
