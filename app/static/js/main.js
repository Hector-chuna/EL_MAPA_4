console.log("main.js cargado.");

// Variables globales
let map;
let markers = [];
let datosFiltrados = [];
let años = [];
let marcas = []; // Almacenar todas las marcas recibidas del backend
let categorias = []; // Almacenar todas las categorías recibidas del backend

// ===========================
// INICIALIZACIÓN DEL MAPA
// ===========================
function initMap() {
  console.log("Inicializando el mapa...");
  map = L.map("map").setView([-25.3142442882, -57.5792973848], 6); // Coordenadas iniciales
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "© OpenStreetMap"
  }).addTo(map);
  console.log("✅ Mapa inicializado correctamente.");
}

// ===========================
// CARGAR DATOS DESDE EL BACKEND
// ===========================
async function cargarDatos() {
  try {
    console.log("Cargando datos desde el backend...");
    const response = await fetch("/api/datos");
    if (!response.ok) {
      throw new Error(`Error en la solicitud al backend: ${response.status}`);
    }
    const data = await response.json();

    // Validar estructura de los datos
    if (!data || !Array.isArray(data.datos)) {
      throw new Error("Los datos recibidos desde el backend no tienen el formato esperado.");
    }

    // Guardar los datos completos
    datosFiltrados = data.datos;
    años = data.años || [];
    marcas = data.marcas || [];
    categorias = data.categorias || [];

    // Poblar los filtros con los datos recibidos
    poblarSelect("categoria", categorias);
    poblarSelect("estado", data.estados);
    poblarSelect("marca", marcas); // Poblar inicialmente con todas las marcas
    poblarSelect("departamento", data.departamentos);
    poblarSelect("ciudad", data.ciudades);
    poblarSelect("vendedor", procesarVendedoresUnicos(data.vendedores)); // Usar vendedores únicos
    poblarSelect("tipo", data.tipos);

    // Poblar los selectores de año
    poblarSelect("anio_inicial", años.map(año => ({ id: año, descripcion: año })));
    poblarSelect("anio_final", años.map(año => ({ id: año, descripcion: año })));

    // Mostrar todos los marcadores inicialmente
    actualizarMapa(datosFiltrados);

    console.log("✅ Datos cargados correctamente.");
  } catch (error) {
    console.error("❌ Error al cargar datos:", error);
  }
}

// ===========================
// FUNCIONES AUXILIARES
// ===========================

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

  console.log(`Poblando el selector "${idSelect}" con ${opciones.length} opciones...`);
  select.innerHTML = '<option value="todos">Todos</option>';
  opciones.forEach(opcion => {
    if (opcion.id && opcion.descripcion) { // Filtrar valores válidos
      const option = document.createElement("option");
      option.value = opcion.id;
      option.textContent = opcion.descripcion;
      select.appendChild(option);
    }
  });
  console.log(`✅ Selector "${idSelect}" poblado correctamente.`);
}

// Procesar vendedores únicos para evitar duplicados
function procesarVendedoresUnicos(vendedores) {
  const vendedoresUnicos = [];
  const descripcionesVendedores = new Set();
  vendedores.forEach(vendedor => {
    if (vendedor.descripcion && !descripcionesVendedores.has(vendedor.descripcion)) {
      descripcionesVendedores.add(vendedor.descripcion);
      vendedoresUnicos.push(vendedor);
    }
  });
  return vendedoresUnicos;
}

// ===========================
// FILTRADO DE DATOS
// ===========================

// Aplicar filtros según los valores seleccionados
function filtrarDatos() {
  console.log("Aplicando filtros...");

  const anioInicial = document.getElementById("anio_inicial").value || null;
  const anioFinal = document.getElementById("anio_final").value || null;
  const categoria = document.getElementById("categoria").value;
  const estado = document.getElementById("estado").value;
  const marca = document.getElementById("marca").value;
  const departamento = document.getElementById("departamento").value;
  const ciudad = document.getElementById("ciudad").value;
  const vendedor = document.getElementById("vendedor").value;

  let filtrados = datosFiltrados;

  // Aplicar filtros básicos
  if (anioInicial && anioInicial !== "todos") filtrados = filtrados.filter(d => d.AÑO >= parseInt(anioInicial));
  if (anioFinal && anioFinal !== "todos") filtrados = filtrados.filter(d => d.AÑO <= parseInt(anioFinal));
  if (estado !== "todos") filtrados = filtrados.filter(d => d.ID_ESTADO == estado);
  if (departamento !== "todos") filtrados = filtrados.filter(d => d.ID_DPTO == departamento);
  if (ciudad !== "todos") filtrados = filtrados.filter(d => d.ID_CIUDAD == ciudad);
  if (vendedor !== "todos") filtrados = filtrados.filter(d => d.ID_VEND == vendedor);

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
  actualizarMapa(filtrados, categoria, marca, vendedor);
}

// ===========================
// ACTUALIZACIÓN DEL MAPA
// ===========================

function actualizarMapa(datos, categoriaSeleccionada, marcaSeleccionada, vendedorSeleccionado) {
  console.log("Actualizando el mapa...");

  // Limpiar marcadores anteriores
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];

  // Filtrar puntos con coordenadas válidas
  const puntosConCoordenadas = datos.filter(p => p.LATITUD && p.LONGITUD);
  console.log(`Se encontraron ${puntosConCoordenadas.length} puntos con coordenadas válidas.`);

  // Definir colores por estado
  const coloresPorEstado = {
    1: "green",   // Activo
    2: "yellow",  // Inactivo
    3: "red"      // Bloqueado
  };

  // Contador para puntos azules y puntos rosas
  let puntosAzules = 0;
  let puntosRosas = 0;

  // Agregar nuevos marcadores
  puntosConCoordenadas.forEach(punto => {
    // Obtener el color basado en ID_ESTADO
    const estadoNum = Number(punto.ID_ESTADO) || 0; // Convertir a número
    let color = coloresPorEstado[estadoNum] || "blue"; // Color predeterminado si no hay coincidencia

    // Manejar los detalles de ventas (DETALLES_VENTAS)
    const ventas = punto.DETALLES_VENTAS || {};
    let haVendidoMarca = false;
    let haAtendidoVendedor = false;

    // Verificar si el punto ha vendido la marca seleccionada
    if (marcaSeleccionada && marcaSeleccionada !== "todos") {
      haVendidoMarca = Object.values(ventas).some(detalle =>
        detalle.MARCA === marcaSeleccionada
      );
      if (haVendidoMarca) {
        color = "blue"; // Cambiar a azul si el punto ha vendido la marca
        puntosAzules++; // Incrementar el contador
      }
    }

    // Verificar si el vendedor seleccionado ha atendido el punto
    if (vendedorSeleccionado && vendedorSeleccionado !== "todos") {
      haAtendidoVendedor = Object.values(ventas).some(detalle =>
        detalle.VENDEDOR === vendedorSeleccionado && detalle.MARCA === marcaSeleccionada
      );
      if (haAtendidoVendedor) {
        color = "pink"; // Cambiar a rosa si el vendedor ha atendido el punto
        puntosRosas++; // Incrementar el contador
      } else {
        return; // No mostrar el punto si no hay coincidencias
      }
    }

    // Crear un ícono de color personalizado usando leaflet-color-markers
    const icono = L.icon({
      iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [0, -41],
      shadowSize: [41, 41]
    });

    // Construir el contenido del popup
    const popupContent = `
      <div style="font-family: Arial, sans-serif; line-height: 1.4; max-width: 250px;">
        <h3 style="margin: 0; font-size: 16px; color: #333;">${punto.DESCRIPCION_CLIENTE}</h3>
        <hr style="border: 0; border-top: 1px solid #ccc; margin: 8px 0;">
        <p style="margin: 4px 0; font-size: 14px;">
          <strong>Estado:</strong> ${punto.DESCRIPCION_ESTADO}<br>
          <strong>Ventas:</strong><br>${Object.entries(ventas).map(([clave, detalle]) => 
            `<strong>${clave}:</strong> ${detalle.MARCA || "Sin marca"}`
          ).join("<br>") || "Sin ventas registradas"}
        </p>
      </div>
    `;

    // Crear el marcador
    const marker = L.marker([parseFloat(punto.LATITUD), parseFloat(punto.LONGITUD)], { icon: icono })
      .addTo(map)
      .bindPopup(popupContent);
    markers.push(marker);
  });

  // Mostrar mensaje en la consola
  if (marcaSeleccionada && marcaSeleccionada !== "todos") {
    console.log(`Marca seleccionada: ${marcaSeleccionada}. Puntos azules: ${puntosAzules}`);
  }
  if (vendedorSeleccionado && vendedorSeleccionado !== "todos") {
    console.log(`Vendedor seleccionado: ${vendedorSeleccionado}. Puntos rosas: ${puntosRosas}`);
  }

  // Mostrar mensaje si no hay puntos en el mapa
  if (markers.length === 0) {
    alert("No hay puntos de venta que coincidan con los filtros seleccionados.");
  }
  console.log("✅ Mapa actualizado correctamente.");
}

// ===========================
// INICIALIZACIÓN DEL DOM
// ===========================

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM cargado. Inicializando...");
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

  console.log("✅ Eventos asignados correctamente.");
});
