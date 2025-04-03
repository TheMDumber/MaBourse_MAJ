from .logger import get_logger, log, debug, info, warning, error, critical, export_logs, clear_logs

# Exposer l'API du module
__all__ = [
    'get_logger',
    'log',
    'debug',
    'info',
    'warning',
    'error',
    'critical',
    'export_logs',
    'clear_logs'
]
