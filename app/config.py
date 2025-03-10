import os

class Config:
    # Clave secreta para Flask (puedes cambiarla por una más segura)
    SECRET_KEY = os.getenv('SECRET_KEY', 'clave_secreta_por_defecto')

    # Configuración de MySQL
    MYSQL_HOST = 'localhost'
    MYSQL_USER = 'root'  # Cambia esto si usas otro usuario
    MYSQL_PASSWORD = 'Laputaquetepario2025'  # Cambia esto si tu contraseña es diferente
    MYSQL_DATABASE = 'mapa_db'  # Nombre de tu base de datos
    