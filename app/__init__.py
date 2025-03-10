from flask import Flask
from flask_mysql_connector import MySQL
from app.config import Config  # Importamos la clase Config

app = Flask(__name__)

# Cargamos la configuración desde Config
app.config.from_object(Config)

# Inicializamos la extensión de MySQL
mysql = MySQL(app)

from app import routes