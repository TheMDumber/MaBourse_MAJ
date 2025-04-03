import pandas as pd
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
import numpy as np
import calendar
import sys
import os

# Ajouter le répertoire parent au chemin d'importation pour pouvoir importer le module de journalisation
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from logging import debug, info, warning, error

def get_month_boundaries(date: datetime, month_mode: str, financial_month_day: int, account_id: int = None) -> tuple:
    """
    Détermine les limites d'un mois donné selon le mode (calendaire ou financier).
    
    Args:
        date (datetime): Date pour laquelle déterminer les limites du mois
        month_mode (str): 'calendar' pour les mois calendaires, 'financial' pour les mois financiers
        financial_month_day (int): Jour définissant les limites du mois financier (ex: 15)
        account_id (int, optional): ID du compte pour les filtrages spécifiques
        
    Returns:
        tuple: (start_date, end_date) pour le mois contenant la date
    """
    year = date.year
    month = date.month
    
    if month_mode == 'calendar':
        # Mois calendaire standard (1er jour au dernier jour du mois)
        start_date = datetime(year, month, 1)
        # Calculer le dernier jour du mois
        last_day = calendar.monthrange(year, month)[1]
        end_date = datetime(year, month, last_day, 23, 59, 59)
    else:
        # Mois financier (du jour financier au jour financier-1 du mois suivant)
        day = date.day
        
        # Si nous sommes avant le jour financier du mois, nous sommes dans le mois financier précédent
        if day < financial_month_day:
            # Mois financier précédent
            prev_month_date = date - relativedelta(months=1)
            start_date = datetime(prev_month_date.year, prev_month_date.month, financial_month_day)
            end_date = datetime(year, month, financial_month_day - 1, 23, 59, 59)
        else:
            # Mois financier actuel
            start_date = datetime(year, month, financial_month_day)
            next_month_date = date + relativedelta(months=1)
            end_date = datetime(next_month_date.year, next_month_date.month, financial_month_day - 1, 23, 59, 59)
    
    return (start_date, end_date)

def get_next_month_start(date: datetime, month_mode: str, financial_month_day: int) -> datetime:
    """
    Calcule la date de début du mois suivant un mois donné.
    
    Args:
        date (datetime): Date à partir de laquelle calculer
        month_mode (str): 'calendar' pour les mois calendaires, 'financial' pour les mois financiers
        financial_month_day (int): Jour définissant le début du mois financier
        
    Returns:
        datetime: Date de début du mois suivant
    """
    if month_mode == 'calendar':
        # Pour le mode calendaire, c'est le 1er du mois suivant
        next_month = date + relativedelta(months=1)
        return datetime(next_month.year, next_month.month, 1)
    else:
        # Pour le mode financier, c'est le jour financier du mois actuel ou suivant
        year = date.year
        month = date.month
        day = date.day
        
        if day < financial_month_day:
            # Si nous sommes avant le jour financier, le prochain mois financier commence ce mois-ci
            return datetime(year, month, financial_month_day)
        else:
            # Sinon, il commence le mois prochain
            next_month = date + relativedelta(months=1)
            return datetime(next_month.year, next_month.month, financial_month_day)

def format_month_key(date: datetime) -> str:
    """
    Formate une date au format 'YYYY-MM' pour l'utiliser comme clé.
    
    Args:
        date (datetime): Date à formater
        
    Returns:
        str: Chaîne au format 'YYYY-MM'
    """
    return f"{date.year}-{date.month:02d}"

def calculate_monthly_balances(transactions_df: pd.DataFrame, 
                              account_creation_date: datetime, 
                              initial_balance: float, 
                              month_mode: str, # 'calendar' or 'financial'
                              financial_month_day: int, # Day of the month for financial mode boundaries
                              end_date: datetime,
                              account_id: int = None) -> pd.Series: # Ou dict
    """
    Calculates the end-of-month balances from the account creation date up to the end_date.

    Args:
        transactions_df (pd.DataFrame): DataFrame containing transactions with 'Date', 'Amount', 'Type' columns.
        account_creation_date (datetime): The starting date for calculations.
        initial_balance (float): The balance at the account_creation_date.
        month_mode (str): 'calendar' for standard months, 'financial' for custom day boundaries.
        financial_month_day (int): The day defining the start/end of a financial month (e.g., 15).
        end_date (datetime): The date up to which balances should be pre-calculated.
        account_id (int, optional): The account ID to filter transactions, or None for all accounts.

    Returns:
        pd.Series: A Series indexed by month ('YYYY-MM') with the final balance for each month.
    """
    
    debug(f"Calculating monthly balances - Mode: {month_mode}, Fin Day: {financial_month_day}, Start: {account_creation_date}, End: {end_date}", module="balance_calculator")
    
    # Vérifions d'abord que le DataFrame a les colonnes requises
    required_columns = ['Date', 'Amount', 'Type']
    for col in required_columns:
        if col not in transactions_df.columns:
            raise ValueError(f"La colonne {col} est manquante dans le DataFrame des transactions")
    
    # Convertir toutes les dates en type datetime si elles ne le sont pas déjà
    if not pd.api.types.is_datetime64_dtype(transactions_df['Date']):
        transactions_df['Date'] = pd.to_datetime(transactions_df['Date'])
    
    # Assurons-nous que account_creation_date et end_date sont des objets datetime
    if isinstance(account_creation_date, str):
        account_creation_date = datetime.fromisoformat(account_creation_date)
    if isinstance(end_date, str):
        end_date = datetime.fromisoformat(end_date)
    
    # Créer un dictionnaire pour stocker les soldes mensuels
    monthly_balances = {}
    
    # Initialiser la date courante et le solde
    current_date = account_creation_date
    current_balance = initial_balance
    
    # Itérer mois par mois jusqu'à la date de fin
    while current_date <= end_date:
        # Déterminer les limites du mois actuel
        month_start, month_end = get_month_boundaries(current_date, month_mode, financial_month_day)
        
        # Clé du mois au format 'YYYY-MM'
        month_key = format_month_key(month_start)
        
        # Filtrer les transactions pour ce mois
        month_transactions = transactions_df[
            (transactions_df['Date'] >= month_start) &
            (transactions_df['Date'] <= month_end)
        ]
        
        # Calculer le solde du mois
        month_balance = 0
        
        if not month_transactions.empty:
            # Si un account_id est spécifié, filtrer les transactions pour ce compte
            if account_id is not None:
                # Filtrer d'abord par account ID (source)
                account_transactions = month_transactions[
                    month_transactions['AccountId'] == account_id
                ] if 'AccountId' in month_transactions.columns else pd.DataFrame()
                
                # Puis par toAccountId (destination pour les transferts)
                transfer_to_transactions = month_transactions[
                    month_transactions['ToAccountId'] == account_id
                ] if 'ToAccountId' in month_transactions.columns else pd.DataFrame()
                
                # Utiliser ces transactions filtrées
                month_transactions = pd.concat([account_transactions, transfer_to_transactions]).drop_duplicates()
            
            # Calculer les revenus (Type == 'income')
            incomes = month_transactions[month_transactions['Type'] == 'income']['Amount'].sum()
            
            # Calculer les dépenses (Type == 'expense')
            expenses = month_transactions[month_transactions['Type'] == 'expense']['Amount'].sum()
            
            # Pour les transferts, il faut tenir compte du compte source et destination
            transfers_out = 0
            transfers_in = 0
            
            if 'AccountId' in month_transactions.columns and 'ToAccountId' in month_transactions.columns:
                # Transferts sortants (de ce compte vers un autre)
                transfers_out = month_transactions[
                    (month_transactions['Type'] == 'transfer') &
                    (month_transactions['AccountId'] == account_id)
                ]['Amount'].sum() if account_id is not None else 0
                
                # Transferts entrants (d'un autre compte vers celui-ci)
                transfers_in = month_transactions[
                    (month_transactions['Type'] == 'transfer') &
                    (month_transactions['ToAccountId'] == account_id)
                ]['Amount'].sum() if account_id is not None else 0
            
            # Si nous n'avons pas spécifié d'account_id (tous les comptes), les transferts s'annulent
            if account_id is None:
                transfers_out = 0
                transfers_in = 0
            
            # Calculer le solde du mois
            month_balance = incomes - expenses - transfers_out + transfers_in
        
        # Mettre à jour le solde courant
        current_balance += month_balance
        
        # Stocker le solde dans le dictionnaire
        monthly_balances[month_key] = current_balance
        
        # Passer au mois suivant
        current_date = get_next_month_start(month_end, month_mode, financial_month_day)
    
    # Convertir le dictionnaire en Series pandas pour un accès plus facile
    calculated_balances = pd.Series(monthly_balances)
    
    debug(f"Returning calculated balances: {calculated_balances}", module="balance_calculator")
    
    return calculated_balances

def calculate_monthly_balances_with_adjustments(
    transactions_df: pd.DataFrame,
    account_creation_date: datetime,
    initial_balance: float,
    month_mode: str,
    financial_month_day: int,
    end_date: datetime,
    account_id: int = None,
    balance_adjustments: pd.DataFrame = None
) -> pd.Series:
    """
    Version améliorée qui prend en compte les ajustements de solde manuels.
    
    Args:
        transactions_df (pd.DataFrame): DataFrame des transactions
        account_creation_date (datetime): Date de création du compte
        initial_balance (float): Solde initial
        month_mode (str): Mode de mois ('calendar' ou 'financial')
        financial_month_day (int): Jour du début du mois financier
        end_date (datetime): Date de fin pour les calculs
        account_id (int, optional): ID du compte pour filtrer les transactions
        balance_adjustments (pd.DataFrame, optional): DataFrame des ajustements de solde
        
    Returns:
        pd.Series: Series des soldes mensuels avec prise en compte des ajustements
    """
    # Calculer d'abord les soldes normaux
    monthly_balances = calculate_monthly_balances(
        transactions_df,
        account_creation_date,
        initial_balance,
        month_mode,
        financial_month_day,
        end_date,
        account_id
    )
    
    # Si pas d'ajustements ou pas d'ID de compte, retourner les soldes normaux
    if balance_adjustments is None or account_id is None:
        return monthly_balances
    
    # Vérifier que le DataFrame des ajustements a les colonnes requises
    required_columns = ['YearMonth', 'AccountId', 'AdjustedBalance']
    for col in required_columns:
        if col not in balance_adjustments.columns:
            warning(f"La colonne {col} est manquante dans le DataFrame des ajustements", module="balance_calculator")
            return monthly_balances
    
    # Filtrer les ajustements pour ce compte
    account_adjustments = balance_adjustments[
        balance_adjustments['AccountId'] == account_id
    ]
    
    # Si pas d'ajustements pour ce compte, retourner les soldes normaux
    if account_adjustments.empty:
        return monthly_balances
    
    # Créer un dictionnaire depuis les soldes calculés
    balances_dict = monthly_balances.to_dict()
    
    # Appliquer les ajustements
    for _, adjustment in account_adjustments.iterrows():
        year_month = adjustment['YearMonth']
        adjusted_balance = adjustment['AdjustedBalance']
        
        # Si ce mois existe dans nos calculs, appliquer l'ajustement
        if year_month in balances_dict:
            debug(f"Applying adjustment for {year_month}: {adjusted_balance}", module="balance_calculator")
            balances_dict[year_month] = adjusted_balance
    
    # Reconvertir en Series
    adjusted_balances = pd.Series(balances_dict)
    
    return adjusted_balances
