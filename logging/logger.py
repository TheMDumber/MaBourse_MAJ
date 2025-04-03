#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Module de journalisation pour Ma Bourse
Permet de centraliser tous les messages de log et de les exporter
"""

import os
import json
import datetime
import csv
from typing import List, Dict, Any, Optional, Literal

# Niveaux de journalisation
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]

class Logger:
    """Gestionnaire de journalisation pour Ma Bourse"""
    
    def __init__(self, max_entries: int = 10000, level: LogLevel = "INFO"):
        """
        Initialise le logger
        
        Args:
            max_entries: Nombre maximum d'entrées à conserver en mémoire
            level: Niveau minimum de journalisation
        """
        self.logs: List[Dict[str, Any]] = []
        self.max_entries = max_entries
        self.level = level
        self.level_priority = {
            "DEBUG": 0,
            "INFO": 1,
            "WARNING": 2,
            "ERROR": 3,
            "CRITICAL": 4
        }
        
        # Créer un dossier pour les journaux exportés s'il n'existe pas
        self.log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "exported_logs")
        if not os.path.exists(self.log_dir):
            os.makedirs(self.log_dir)
    
    def _should_log(self, level: LogLevel) -> bool:
        """Détermine si un message doit être journalisé selon son niveau"""
        return self.level_priority[level] >= self.level_priority[self.level]
    
    def log(self, message: str, level: LogLevel = "INFO", module: str = "", 
            additional_data: Optional[Dict[str, Any]] = None) -> None:
        """
        Ajoute une entrée au journal
        
        Args:
            message: Le message à journaliser
            level: Le niveau de journalisation
            module: Le module source du message
            additional_data: Données supplémentaires à inclure
        """
        if not self._should_log(level):
            return
            
        entry = {
            "timestamp": datetime.datetime.now().isoformat(),
            "level": level,
            "module": module,
            "message": message
        }
        
        if additional_data:
            entry["data"] = additional_data
            
        self.logs.append(entry)
        
        # Limiter la taille du journal
        if len(self.logs) > self.max_entries:
            self.logs = self.logs[-self.max_entries:]
    
    def debug(self, message: str, module: str = "", additional_data: Optional[Dict[str, Any]] = None) -> None:
        """Log de niveau DEBUG"""
        self.log(message, "DEBUG", module, additional_data)
    
    def info(self, message: str, module: str = "", additional_data: Optional[Dict[str, Any]] = None) -> None:
        """Log de niveau INFO"""
        self.log(message, "INFO", module, additional_data)
    
    def warning(self, message: str, module: str = "", additional_data: Optional[Dict[str, Any]] = None) -> None:
        """Log de niveau WARNING"""
        self.log(message, "WARNING", module, additional_data)
    
    def error(self, message: str, module: str = "", additional_data: Optional[Dict[str, Any]] = None) -> None:
        """Log de niveau ERROR"""
        self.log(message, "ERROR", module, additional_data)
    
    def critical(self, message: str, module: str = "", additional_data: Optional[Dict[str, Any]] = None) -> None:
        """Log de niveau CRITICAL"""
        self.log(message, "CRITICAL", module, additional_data)
    
    def export_json(self, filename: Optional[str] = None) -> str:
        """
        Exporte les journaux au format JSON
        
        Args:
            filename: Nom du fichier d'export (généré automatiquement si None)
            
        Returns:
            Chemin du fichier exporté
        """
        if not filename:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"mabourse_logs_{timestamp}.json"
        
        filepath = os.path.join(self.log_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(self.logs, f, ensure_ascii=False, indent=2)
        
        return filepath
    
    def export_csv(self, filename: Optional[str] = None) -> str:
        """
        Exporte les journaux au format CSV
        
        Args:
            filename: Nom du fichier d'export (généré automatiquement si None)
            
        Returns:
            Chemin du fichier exporté
        """
        if not filename:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"mabourse_logs_{timestamp}.csv"
        
        filepath = os.path.join(self.log_dir, filename)
        
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            fieldnames = ["timestamp", "level", "module", "message"]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            
            writer.writeheader()
            for entry in self.logs:
                # Filtrer uniquement les champs standard pour le CSV
                row = {field: entry.get(field, "") for field in fieldnames}
                writer.writerow(row)
        
        return filepath
    
    def export_txt(self, filename: Optional[str] = None) -> str:
        """
        Exporte les journaux au format texte
        
        Args:
            filename: Nom du fichier d'export (généré automatiquement si None)
            
        Returns:
            Chemin du fichier exporté
        """
        if not filename:
            timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"mabourse_logs_{timestamp}.txt"
        
        filepath = os.path.join(self.log_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            for entry in self.logs:
                timestamp = entry["timestamp"]
                level = entry["level"]
                module = entry["module"]
                message = entry["message"]
                
                log_line = f"[{timestamp}] {level} - {module}: {message}"
                f.write(log_line + "\n")
        
        return filepath
    
    def export(self, format: Literal["json", "csv", "txt"] = "json", filename: Optional[str] = None) -> str:
        """
        Exporte les journaux dans le format spécifié
        
        Args:
            format: Format d'exportation ("json", "csv", "txt")
            filename: Nom du fichier d'export
            
        Returns:
            Chemin du fichier exporté
        """
        if format == "json":
            return self.export_json(filename)
        elif format == "csv":
            return self.export_csv(filename)
        elif format == "txt":
            return self.export_txt(filename)
        else:
            raise ValueError(f"Format d'exportation non supporté: {format}")
    
    def clear(self) -> None:
        """Efface toutes les entrées du journal"""
        self.logs = []

# Instance singleton du logger
_logger = Logger()

# Fonctions d'accès global au logger
def get_logger() -> Logger:
    """Retourne l'instance singleton du logger"""
    return _logger

def log(message: str, level: LogLevel = "INFO", module: str = "", 
        additional_data: Optional[Dict[str, Any]] = None) -> None:
    """Fonction globale pour journaliser un message"""
    _logger.log(message, level, module, additional_data)

def debug(message: str, module: str = "", additional_data: Optional[Dict[str, Any]] = None) -> None:
    """Fonction globale pour un log de niveau DEBUG"""
    _logger.debug(message, module, additional_data)

def info(message: str, module: str = "", additional_data: Optional[Dict[str, Any]] = None) -> None:
    """Fonction globale pour un log de niveau INFO"""
    _logger.info(message, module, additional_data)

def warning(message: str, module: str = "", additional_data: Optional[Dict[str, Any]] = None) -> None:
    """Fonction globale pour un log de niveau WARNING"""
    _logger.warning(message, module, additional_data)

def error(message: str, module: str = "", additional_data: Optional[Dict[str, Any]] = None) -> None:
    """Fonction globale pour un log de niveau ERROR"""
    _logger.error(message, module, additional_data)

def critical(message: str, module: str = "", additional_data: Optional[Dict[str, Any]] = None) -> None:
    """Fonction globale pour un log de niveau CRITICAL"""
    _logger.critical(message, module, additional_data)

def export_logs(format: Literal["json", "csv", "txt"] = "json", filename: Optional[str] = None) -> str:
    """Fonction globale pour exporter les journaux"""
    return _logger.export(format, filename)

def clear_logs() -> None:
    """Fonction globale pour effacer les journaux"""
    _logger.clear()
