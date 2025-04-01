from datetime import date, datetime, timedelta
import calendar

def calculate_period_dates(target_month: int, target_year: int, mode: str = 'calendaire', financial_start_day: int = 1) -> tuple:
    """
    Calcule les dates de début et de fin d'une période mensuelle selon le mode choisi.
    
    Args:
        target_month (int): Mois cible (1-12)
        target_year (int): Année cible
        mode (str): Mode de calcul ('calendaire' ou 'financier')
        financial_start_day (int): Jour de début du mois financier (1-31)
    
    Returns:
        tuple: (start_date, end_date) où start_date et end_date sont des objets date
    
    Exemples:
        # Mode calendaire pour Janvier 2025
        calculate_period_dates(1, 2025, 'calendaire')
        # Retourne: (date(2025, 1, 1), date(2025, 1, 31))
        
        # Mode financier avec début au 15 pour Janvier 2025
        calculate_period_dates(1, 2025, 'financier', 15)
        # Retourne: (date(2024, 12, 15), date(2025, 1, 14))
    """
    if mode not in ['calendaire', 'financier']:
        raise ValueError("Le mode doit être 'calendaire' ou 'financier'")
    
    if not 1 <= target_month <= 12:
        raise ValueError("Le mois doit être compris entre 1 et 12")
    
    if not 1 <= financial_start_day <= 31:
        raise ValueError("Le jour de début du mois financier doit être compris entre 1 et 31")
    
    if mode == 'calendaire':
        # Mode calendaire: du 1er au dernier jour du mois
        start_date = date(target_year, target_month, 1)
        
        # Obtenir le dernier jour du mois (en tenant compte des mois de longueur variable)
        last_day = calendar.monthrange(target_year, target_month)[1]
        end_date = date(target_year, target_month, last_day)
        
    else:  # mode == 'financier'
        # Mode financier: du jour J du mois M-1 au jour J-1 du mois M
        
        # Calculer le mois et l'année précédents
        if target_month == 1:  # Janvier
            prev_month = 12
            prev_year = target_year - 1
        else:
            prev_month = target_month - 1
            prev_year = target_year
        
        # S'assurer que financial_start_day ne dépasse pas le nombre de jours du mois précédent
        prev_month_days = calendar.monthrange(prev_year, prev_month)[1]
        actual_start_day = min(financial_start_day, prev_month_days)
        
        # Date de début: jour J du mois précédent
        start_date = date(prev_year, prev_month, actual_start_day)
        
        # Calculer la date de fin (veille du jour J du mois courant)
        if financial_start_day == 1:
            # Si le jour de début est le 1er, la fin est le dernier jour du mois précédent
            end_date = date(prev_year, prev_month, prev_month_days)
        else:
            # S'assurer que le jour de fin n'excède pas le nombre de jours du mois courant
            current_month_days = calendar.monthrange(target_year, target_month)[1]
            end_day = min(financial_start_day - 1, current_month_days)
            end_date = date(target_year, target_month, end_day)
    
    return (start_date, end_date)
