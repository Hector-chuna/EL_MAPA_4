from flask import jsonify, render_template, request
from app import app, mysql
import json

@app.route('/api/datos', methods=['GET'])
def get_datos():
    try:
        # Obtener parámetros de consulta
        anio_inicial = request.args.get('anio_inicial')
        anio_final = request.args.get('anio_final')

        # Consulta principal para obtener datos de ventas agrupados
        query_principal = """
        WITH VentasPorCliente AS (
            SELECT
                v.ID_CLIENTE,
                v.AÑO,
                v.SEMESTRE,
                vend.ID_VEND,
                COALESCE(vend.DESCRIPCION_VEND, 'SIN_VENDEDOR') AS DESCRIPCION_VEND,
                t.ID_TIPO,
                COALESCE(t.DESCRIPCION_TIPO, 'SIN_TIPO') AS DESCRIPCION_TIPO,
                m.ID_MARCA,
                COALESCE(m.DESCRIPCION_MARCA, 'SIN_MARCA') AS DESCRIPCION_MARCA,
                c.ID_CATEGORIA,
                COALESCE(c.DESCRIPCION_CATEGORIA, 'SIN_CATEGORIA') AS DESCRIPCION_CATEGORIA,
                SUM(COALESCE(v.CANTIDAD, 0)) AS TOTAL_CANTIDAD,
                SUM(COALESCE(v.MONTO, 0)) AS TOTAL_MONTO
            FROM ventas v
            LEFT JOIN marca m ON v.ID_MARCA = m.ID_MARCA
            LEFT JOIN categoria c ON v.ID_CATEGORIA = c.ID_CATEGORIA
            LEFT JOIN vendedor vend ON v.ID_VEND = vend.ID_VEND
            LEFT JOIN tipo t ON v.ID_TIPO = t.ID_TIPO
            GROUP BY v.ID_CLIENTE, v.AÑO, v.SEMESTRE, vend.ID_VEND, vend.DESCRIPCION_VEND, t.ID_TIPO, t.DESCRIPCION_TIPO, m.ID_MARCA, m.DESCRIPCION_MARCA, c.ID_CATEGORIA, c.DESCRIPCION_CATEGORIA
        ),
        VentasAgrupadas AS (
            SELECT
                ID_CLIENTE,
                JSON_OBJECTAGG(
                    CONCAT(
                        'AÑO_', COALESCE(AÑO, 'SIN_ANIO'),
                        '_SEMESTRE_', COALESCE(SEMESTRE, 'SIN_SEMESTRE'),
                        '_VENDEDOR_', COALESCE(ID_VEND, 'SIN_VENDEDOR'),
                        '_TIPO_', COALESCE(ID_TIPO, 'SIN_TIPO')
                    ),
                    JSON_OBJECT(
                        'MARCA', DESCRIPCION_MARCA,
                        'CATEGORIA', DESCRIPCION_CATEGORIA,
                        'VENDEDOR', DESCRIPCION_VEND, -- Agregar descripción del vendedor
                        'CANTIDAD', TOTAL_CANTIDAD,
                        'MONTO', TOTAL_MONTO
                    )
                ) AS DETALLES_VENTAS,
                MAX(ID_CATEGORIA) AS ID_CATEGORIA
            FROM VentasPorCliente
            GROUP BY ID_CLIENTE
        )
        SELECT
            pv.ID_CLIENTE,
            pv.DESCRIPCION_CLIENTE,
            COALESCE(va.ID_CATEGORIA, 'SIN_CATEGORIA') AS ID_CATEGORIA,
            COALESCE(c.DESCRIPCION_CATEGORIA, 'Sin categoría') AS DESCRIPCION_CATEGORIA,
            COALESCE(pv.ID_CIUDAD, 'SIN_CIUDAD') AS ID_CIUDAD,
            COALESCE(ciu.DESCRIPCION_CIUDAD, 'Sin ciudad') AS DESCRIPCION_CIUDAD,
            COALESCE(pv.ID_DPTO, 'SIN_DEPARTAMENTO') AS ID_DPTO,
            COALESCE(dpto.DESCRIPCION_DPTO, 'Sin departamento') AS DESCRIPCION_DPTO,
            COALESCE(pv.ID_ESTADO, 'SIN_ESTADO') AS ID_ESTADO,
            COALESCE(e.DESCRIPCION_ESTADO, 'Sin estado') AS DESCRIPCION_ESTADO,
            pv.LATITUD,
            pv.LONGITUD,
            COALESCE(va.DETALLES_VENTAS, '{}') AS DETALLES_VENTAS
        FROM puntos_venta pv
        LEFT JOIN VentasAgrupadas va ON pv.ID_CLIENTE = va.ID_CLIENTE
        LEFT JOIN categoria c ON va.ID_CATEGORIA = c.ID_CATEGORIA
        LEFT JOIN ciudad ciu ON pv.ID_CIUDAD = ciu.ID_CIUDAD
        LEFT JOIN departamento dpto ON pv.ID_DPTO = dpto.ID_DPTO
        LEFT JOIN estado e ON pv.ID_ESTADO = e.ID_ESTADO
        WHERE pv.LATITUD IS NOT NULL AND pv.LONGITUD IS NOT NULL
        """

        # Filtro de año
        if anio_inicial and anio_final:
            query_principal += f" AND (v.AÑO BETWEEN {anio_inicial} AND {anio_final})"
        elif anio_inicial:
            query_principal += f" AND (v.AÑO >= {anio_inicial})"
        elif anio_final:
            query_principal += f" AND (v.AÑO <= {anio_final})"

        # Ejecutar la consulta principal
        cursor = mysql.connection.cursor(dictionary=True)
        cursor.execute(query_principal)
        datos = cursor.fetchall()
        cursor.close()

        # Consultas adicionales para obtener valores únicos para filtros
        def fetch_unique_values(query):
            cursor = mysql.connection.cursor(dictionary=True)
            cursor.execute(query)
            results = cursor.fetchall()
            cursor.close()
            return results

        categorias = fetch_unique_values("""
            SELECT DISTINCT ID_CATEGORIA, DESCRIPCION_CATEGORIA 
            FROM categoria 
            WHERE ID_CATEGORIA IS NOT NULL AND DESCRIPCION_CATEGORIA IS NOT NULL AND TRIM(DESCRIPCION_CATEGORIA) != ''
        """)

        marcas = fetch_unique_values("""
            SELECT DISTINCT m.ID_MARCA, m.DESCRIPCION_MARCA, m.ID_CATEGORIA
            FROM marca m
            LEFT JOIN categoria c ON m.ID_CATEGORIA = c.ID_CATEGORIA
            WHERE m.ID_MARCA IS NOT NULL AND m.DESCRIPCION_MARCA IS NOT NULL AND TRIM(m.DESCRIPCION_MARCA) != ''
                AND c.ID_CATEGORIA IS NOT NULL
        """)

        departamentos = fetch_unique_values("""
            SELECT DISTINCT ID_DPTO, DESCRIPCION_DPTO 
            FROM departamento 
            WHERE ID_DPTO IS NOT NULL AND DESCRIPCION_DPTO IS NOT NULL AND TRIM(DESCRIPCION_DPTO) != ''
        """)

        ciudades = fetch_unique_values("""
            SELECT DISTINCT ID_CIUDAD, DESCRIPCION_CIUDAD 
            FROM ciudad 
            WHERE ID_CIUDAD IS NOT NULL AND DESCRIPCION_CIUDAD IS NOT NULL AND TRIM(DESCRIPCION_CIUDAD) != ''
        """)

        vendedores = fetch_unique_values("""
            SELECT DISTINCT ID_VEND, DESCRIPCION_VEND 
            FROM vendedor 
            WHERE ID_VEND IS NOT NULL AND DESCRIPCION_VEND IS NOT NULL AND TRIM(DESCRIPCION_VEND) != ''
        """)

        tipos = fetch_unique_values("""
            SELECT DISTINCT ID_TIPO, DESCRIPCION_TIPO 
            FROM tipo 
            WHERE ID_TIPO IS NOT NULL AND DESCRIPCION_TIPO IS NOT NULL AND TRIM(DESCRIPCION_TIPO) != ''
        """)

        estados = fetch_unique_values("""
            SELECT DISTINCT ID_ESTADO, DESCRIPCION_ESTADO 
            FROM estado 
            WHERE ID_ESTADO IS NOT NULL AND DESCRIPCION_ESTADO IS NOT NULL AND TRIM(DESCRIPCION_ESTADO) != ''
        """)

        años = fetch_unique_values("SELECT DISTINCT AÑO FROM ventas ORDER BY AÑO ASC")

        # Transformar los datos para incluir la estructura optimizada
        datos_optimizados = []
        for fila in datos:
            ventas = fila.pop("DETALLES_VENTAS", "{}")  # Extraer las ventas anidadas
            try:
                fila["DETALLES_VENTAS"] = json.loads(ventas) if ventas else {}  # Convertir JSON a diccionario
            except json.JSONDecodeError:
                fila["DETALLES_VENTAS"] = {}  # Si hay un error al decodificar JSON, usar un objeto vacío
            datos_optimizados.append(fila)

        return jsonify({
            "datos": datos_optimizados,
            "categorias": [{"id": cat['ID_CATEGORIA'], "descripcion": cat['DESCRIPCION_CATEGORIA']} for cat in categorias],
            "marcas": [{"id": marca['ID_MARCA'], "descripcion": marca['DESCRIPCION_MARCA'], "ID_CATEGORIA": marca['ID_CATEGORIA']} for marca in marcas],
            "departamentos": [{"id": dep['ID_DPTO'], "descripcion": dep['DESCRIPCION_DPTO']} for dep in departamentos],
            "ciudades": [{"id": ciudad['ID_CIUDAD'], "descripcion": ciudad['DESCRIPCION_CIUDAD']} for ciudad in ciudades],
            "vendedores": [{"id": vend['ID_VEND'], "descripcion": vend['DESCRIPCION_VEND']} for vend in vendedores],
            "tipos": [{"id": tipo['ID_TIPO'], "descripcion": tipo['DESCRIPCION_TIPO']} for tipo in tipos],
            "estados": [{"id": estado['ID_ESTADO'], "descripcion": estado['DESCRIPCION_ESTADO']} for estado in estados],
            "años": [año['AÑO'] for año in años]
        })

    except Exception as e:
        print(f"Error en la consulta SQL: {e}")
        return jsonify({"error": "Error interno del servidor", "details": str(e)}), 500

@app.route('/favicon.ico')
def favicon():
    return '', 204  # Respuesta vacía con código 204 (No Content)

@app.route('/')
def home():
    return render_template('index.html')