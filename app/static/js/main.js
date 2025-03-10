console.log("main.js cargado.");
let map;
let markers = [];
let datosFiltrados = [];
let años = [];
let marcas = []; // Almacenar todas las marcas recibidas del backend
let categorias = []; // Almacenar todas las categorías recibidas del backend

// Inicializar el mapa
function initMap() {
  map = L.map("map").setView([-25.3142442882, -57.5792973848], 6); // Coordenadas iniciales
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);
}

// Cargar datos desde el backend
async function cargarDatos() {
  try {
    const response = await fetch("/api/datos");
    if (!response.ok) {
      throw new Error(`Error en la solicitud al backend: ${response.status}`);
    }
    const data = await response.json();
    // Validar estructura de los datos
    if (!data || !Array.isArray(data.datos)) {
      throw new Error("Los datos recibidos desde el backend no tienen el formato esperado.");
    }
    datosFiltrados = data.datos; // Guardar los datos completos
    años = data.años || []; // Guardar los años únicos
    marcas = data.marcas || []; // Guardar las marcas
    categorias = data.categorias || []; // Guardar las categorías
    // Poblar los filtros con los datos recibidos
    poblarSelect("categoria", categorias);
    poblarSelect("estado", data.estados);
    poblarSelect("marca", marcas); // Poblar inicialmente con todas las marcas
    poblarSelect("departamento", data.departamentos);
    poblarSelect("ciudad", data.ciudades);
    poblarSelect("vendedor", data.vendedores);
    poblarSelect("tipo", data.tipos);
    // Poblar los selectores de año
    poblarSelect("anio_inicial", años.map(año => ({ id: año, descripcion: año })));
    poblarSelect("anio_final", años.map(año => ({ id: año, descripcion: año })));
    // Mostrar todos los marcadores inicialmente
    actualizarMapa(datosFiltrados);
    // Mensaje final de carga
    console.log("✅ Datos cargados correctamente.");
  } catch (error) {
    console.error("❌ Error al cargar datos:", error);
  }
}

// Función auxiliar para poblar un select
function poblarSelect(idSelect, opciones) {
  const select = document.getElementById(idSelect);
  if (!select) {
    console.error(`El elemento con ID "${idSelect}" no existe.`);
    return;
  }
  // Validar que las opciones sean un array
  if (!Array.isArray(opciones)) {
    console.error(`Datos inválidos para el filtro "${idSelect}":`, opciones);
    return;
  }
  select.innerHTML = '<option value="todos">Todos</option>';
  opciones.forEach(opcion => {
    if (opcion.id && opcion.descripcion) { // Filtrar valores válidos
      const option = document.createElement("option");
      option.value = opcion.id;
      option.textContent = opcion.descripcion;
      select.appendChild(option);
    }
  });
}

// Filtrar datos según los filtros seleccionados
function filtrarDatos() {
  const anioInicial = document.getElementById("anio_inicial").value || null;
  const anioFinal = document.getElementById("anio_final").value || null;
  const categoria = document.getElementById("categoria").value;
  const estado = document.getElementById("estado").value;
  const marca = document.getElementById("marca").value;
  const departamento = document.getElementById("departamento").value;
  const ciudad = document.getElementById("ciudad").value;
  const vendedor = document.getElementById("vendedor").value;
  const tipo = document.getElementById("tipo").value;
  let filtrados = datosFiltrados;
  // Aplicar filtros básicos
  if (anioInicial && anioInicial !== "todos") filtrados = filtrados.filter(d => d.AÑO >= parseInt(anioInicial));
  if (anioFinal && anioFinal !== "todos") filtrados = filtrados.filter(d => d.AÑO <= parseInt(anioFinal));
  if (estado !== "todos") filtrados = filtrados.filter(d => d.ID_ESTADO == estado);
  if (departamento !== "todos") filtrados = filtrados.filter(d => d.ID_DPTO == departamento);
  if (ciudad !== "todos") filtrados = filtrados.filter(d => d.ID_CIUDAD == ciudad);
  if (vendedor !== "todos") filtrados = filtrados.filter(d => d.ID_VEND == vendedor);
  if (tipo !== "todos") filtrados = filtrados.filter(d => d.ID_TIPO == tipo);
  // Filtrar marcas según la categoría seleccionada
  if (categoria && categoria !== "todos") {
    const marcasFiltradas = marcas.filter(marca => marca.ID_CATEGORIA == categoria);
    poblarSelect("marca", marcasFiltradas); // Actualizar el selector de marcas
    console.log(`Categoría seleccionada: ${categoria}. Se encontraron ${marcasFiltradas.length} marcas.`);
  } else {
    poblarSelect("marca", marcas); // Restaurar todas las marcas si se selecciona "Todos"
    console.log("Categoría seleccionada: Todos. Todas las marcas restauradas.");
  }
  // Actualizar el mapa con los datos filtrados
  actualizarMapa(filtrados);
}

// Función auxiliar para obtener la descripción de un vendedor
function obtenerDescripcionVendedor(idVendedor) {
  const vendedor = datosFiltrados.find(d => d.ID_VEND == idVendedor);
  return vendedor ? vendedor.DESCRIPCION_VEND : "Sin descripción";
}

// Actualizar el mapa con los datos filtrados
function actualizarMapa(datos) {
  // Limpiar marcadores anteriores
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];
  // Filtrar puntos con coordenadas válidas
  const puntosConCoordenadas = datos.filter(p => p.LATITUD && p.LONGITUD);
  // Definir colores por estado
  const coloresPorEstado = {
    1: "green",   // Activo
    2: "yellow",  // Inactivo
    3: "red"      // Bloqueado
  };
  // Obtener la marca seleccionada
  const marcaSeleccionada = document.getElementById("marca").value;
  let puntosAzules = 0;

  // Agregar nuevos marcadores
  puntosConCoordenadas.forEach(punto => {
    // Obtener el color basado en ID_ESTADO
    const estadoNum = Number(punto.ID_ESTADO) || 0; // Convertir a número
    let color = coloresPorEstado[estadoNum] || "blue"; // Color predeterminado si no hay coincidencia

    // Procesar los detalles de ventas (DETALLES_VENTAS)
    const ventas = punto.DETALLES_VENTAS || {}; // Datos anidados de ventas
    const vendedoresUnicos = new Set(); // Para almacenar vendedores únicos
    const marcasUnicas = new Set(); // Para almacenar marcas únicas

    // Extraer vendedores y marcas únicas
    Object.entries(ventas).forEach(([clave, detalle]) => {
      // Extraer descripción del vendedor directamente del detalle
      const descripcionVendedor = detalle.VENDEDOR || "Sin descripción";
      if (descripcionVendedor) vendedoresUnicos.add(descripcionVendedor);
      // Extraer marcas
      const { MARCA } = detalle;
      if (MARCA) marcasUnicas.add(MARCA);
    });

    // Cambiar el color a azul si la marca seleccionada está en las marcas únicas
    if (marcaSeleccionada !== "todos" && marcasUnicas.has(marcaSeleccionada)) {
      color = "blue";
      puntosAzules++;
    }

    // Construir el contenido del popup
    let popupContent = `<div style="font-family: Arial, sans-serif; line-height: 1.4; max-width: 250px;">`;
    popupContent += `<h3 style="margin: 0; font-size: 16px; color: #333;">${punto.DESCRIPCION_CLIENTE}</h3>`;
    popupContent += `<hr style="border: 0; border-top: 1px solid #ccc; margin: 8px 0;">`;
    popupContent += `<p style="margin: 4px 0; font-size: 14px;"><strong>Estado:</strong> ${punto.DESCRIPCION_ESTADO}<br>`;
    popupContent += `<strong>Vendedores:</strong><br>`;
    // Mostrar la lista de vendedores únicos
    if (vendedoresUnicos.size > 0) {
      vendedoresUnicos.forEach(vendedor => {
        popupContent += `- ${vendedor}<br>`;
      });
    } else {
      popupContent += `- Sin vendedores registrados<br>`;
    }
    // Mostrar la lista de marcas únicas
    popupContent += `<strong>Marcas:</strong><br>`;
    if (marcasUnicas.size > 0) {
      marcasUnicas.forEach(marca => {
        popupContent += `- ${marca}<br>`;
      });
    } else {
      popupContent += `- Sin marcas registradas<br>`;
    }
    popupContent += `</p></div>`;
    // Crear un ícono de color personalizado usando leaflet-color-markers
    const icono = L.icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      iconSize: [25, 41],       // Tamaño del ícono
      iconAnchor: [12, 41],     // Punto de anclaje del ícono
      popupAnchor: [0, -41],    // Punto de anclaje del popup
      shadowSize: [41, 41]      // Tamaño de la sombra
    });
    // Crear el marcador
    const marker = L.marker([parseFloat(punto.LATITUD), parseFloat(punto.LONGITUD)], { icon: icono })
      .addTo(map)
      .bindPopup(popupContent);
    markers.push(marker);
  });

  // Mostrar mensaje si no hay puntos en el mapa
  if (markers.length === 0) {
    alert("No hay puntos de venta que coincidan con los filtros seleccionados.");
  }

  // Punto de control en consola
  console.log(`Marca seleccionada: ${marcaSeleccionada}. Puntos azules: ${puntosAzules}`);
  console.log("✅ Mapa actualizado correctamente.");
}

// Inicializar cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  cargarDatos();
  // Asignar eventos a los filtros
  document.getElementById("anio_inicial").addEventListener("change", filtrarDatos);
  document.getElementById("anio_final").addEventListener("change", filtrarDatos);
  document.getElementById("categoria").addEventListener("change", filtrarDatos);
  document.getElementById("estado").addEventListener("change", filtrarDatos);
  document.getElementById("marca").addEventListener("change", filtrarDatos);
  document.getElementById("departamento").addEventListener("change", filtrarDatos);
  document.getElementById("ciudad").addEventListener("change", filtrarDatos);
  document.getElementById("vendedor").addEventListener("change", filtrarDatos);
  document.getElementById("tipo").addEventListener("change", filtrarDatos);
});