// Instructivos en video de Montao GPS («¿Qué hacer?» por módulo: Gestión, Inventario). Los videos viven en Montao Cloud
// (soporte@montao.net) y el backend resuelve su URL temporal en GET /tutorials/:id/playback.
// Generado por tutorial-vehiculo/scripts/gen-gps-data.cjs (Remotion); no editar a mano:
// los pasos son la narración de cada video.
export interface TutorialVideo {
  id: string;
  title: string;
  description: string;
  duration: string;
  /** Agrupa los instructivos en el catálogo (p. ej. Objetivos, Usuarios). */
  category: string;
  /** Ícono de PrimeIcons de la tarjeta del catálogo (p. ej. pi-share-alt). */
  icon: string;
  /**
   * Quién puede ver la guía: los mismos privilegios que exige la acción en la app y en el backend
   * ('módulo.acción', p. ej. 'devices.update') y, si employee es true, ser personal de Montao.
   */
  requires: { employee: boolean; privileges: string[] };
  poster: string;
  captions: string;
  steps: string[];
}


// MANAGEMENT: 24 instructivo(s).
export const MANAGEMENT_TUTORIALS: readonly TutorialVideo[] = [
  {
    "id": "conoce-gestion-gps",
    "title": "Conoce Gestión de Montao GPS",
    "description": "Qué puedes hacer en Gestión: tus objetivos, el mapa, el menú Acciones, tus usuarios y dónde encontrar ayuda.",
    "category": "Recorrido",
    "icon": "pi-compass",
    "requires": {
      "employee": false,
      "privileges": []
    },
    "duration": "1:07",
    "poster": "tutorials/conoce-gestion-gps.jpg?v=45d5034cd1e9",
    "captions": "tutorials/conoce-gestion-gps.vtt?v=b4d217e61b33",
    "steps": [
      "Gestión es el centro de tu cuenta de Montao GPS. Aquí administras tus objetivos, es decir, tus vehículos con GPS, y los usuarios que acceden a tu cuenta.",
      "En Objetivos ves cada vehículo con su estado de conexión, su IMEI, su SIM y la fecha de expiración del servicio.",
      "Con el buscador lo encuentras por nombre, placa o IMEI, y con el embudo filtras por estado o por etiqueta.",
      "En cada fila editas sus datos, le pones una etiqueta o lo guardas en tus accesos directos.",
      "Marca uno o varios objetivos para usar el menú Acciones.",
      "Pulsa Acciones.",
      "Desde aquí los compartes, los transfieres a otra cuenta o les creas alertas.",
      "En Usuarios administras a las personas que acceden a tu cuenta: las creas, las editas o entras a revisar lo que tienen.",
      "Y cuando tengas una duda, pulsa ¿Qué hacer?",
      "Busca la tarea o elige una categoría, y sigue el video paso a paso."
    ]
  },
  {
    "id": "etiquetar-objetivo",
    "title": "Asignar una etiqueta a un objetivo",
    "description": "Agrupa tus vehículos con etiquetas de color para reconocerlos y filtrarlos.",
    "category": "Objetivos",
    "icon": "pi-tag",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.update"
      ]
    },
    "duration": "0:21",
    "poster": "tutorials/etiquetar-objetivo.jpg?v=d4f7ebfb60d7",
    "captions": "tutorials/etiquetar-objetivo.vtt?v=c68bade1028b",
    "steps": [
      "En Objetivos, pulsa el ícono de etiqueta del vehículo.",
      "Abre la lista de etiquetas.",
      "Elige una, por ejemplo Flota.",
      "Pulsa Guardar.",
      "El ícono toma el color de la etiqueta. Luego puedes filtrar tus objetivos por ella."
    ]
  },
  {
    "id": "buscar-objetivos",
    "title": "Buscar un objetivo",
    "description": "Encuentra un vehículo de tu cuenta por su nombre, su placa o el IMEI de su GPS.",
    "category": "Objetivos",
    "icon": "pi-search",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.read"
      ]
    },
    "duration": "0:20",
    "poster": "tutorials/buscar-objetivos.jpg?v=4fd37646ae4f",
    "captions": "tutorials/buscar-objetivos.vtt?v=dc259dacf1de",
    "steps": [
      "En Gestión, la pestaña Objetivos muestra los vehículos de tu cuenta con su estado de conexión.",
      "Escribe en el buscador el nombre, la placa o el IMEI del vehículo.",
      "La lista muestra solo los objetivos que coinciden. Borra el texto para ver otra vez todos."
    ]
  },
  {
    "id": "editar-objetivo",
    "title": "Editar los datos de un objetivo",
    "description": "Cambia el nombre, la placa, el color o la descripción de un vehículo.",
    "category": "Objetivos",
    "icon": "pi-pen-to-square",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.update"
      ]
    },
    "duration": "0:27",
    "poster": "tutorials/editar-objetivo.jpg?v=1a4cc737130c",
    "captions": "tutorials/editar-objetivo.vtt?v=986e81c5eb93",
    "steps": [
      "En Objetivos, pulsa el lápiz del vehículo que quieres editar.",
      "En Vehículo, cambia el nombre con el que lo reconoces.",
      "Agrega una descripción si te ayuda a identificarlo.",
      "Aquí también corriges la placa, el chasis o el color.",
      "Pulsa Actualizar.",
      "El objetivo se actualiza en tu lista con el nuevo nombre."
    ]
  },
  {
    "id": "filtrar-objetivos",
    "title": "Filtrar objetivos por estado o etiqueta",
    "description": "Muestra solo los vehículos en línea, los que están fuera de línea o los de una etiqueta.",
    "category": "Objetivos",
    "icon": "pi-filter",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.read"
      ]
    },
    "duration": "0:31",
    "poster": "tutorials/filtrar-objetivos.jpg?v=a50257c6104f",
    "captions": "tutorials/filtrar-objetivos.vtt?v=f51d173b45ce",
    "steps": [
      "En Objetivos, pulsa el embudo de filtros.",
      "Puedes filtrar por etiqueta, por ejemplo tu flota de trabajo, o por el estado de conexión.",
      "Elige Fuera de línea para ver los GPS que no están reportando.",
      "La lista muestra solo los objetivos del filtro.",
      "Para ver otra vez todos, vuelve a abrir Filtros.",
      "Y pulsa Limpiar filtros.",
      "La lista vuelve a mostrar todos tus objetivos."
    ]
  },
  {
    "id": "accesos-directos",
    "title": "Guardar objetivos en accesos directos",
    "description": "Marca los vehículos que consultas a menudo para abrirlos desde un solo botón.",
    "category": "Objetivos",
    "icon": "pi-bookmark",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.read"
      ]
    },
    "duration": "0:21",
    "poster": "tutorials/accesos-directos.jpg?v=37e31ea22c7a",
    "captions": "tutorials/accesos-directos.vtt?v=32314f4e2595",
    "steps": [
      "En Objetivos, pulsa el marcador del vehículo que consultas a menudo.",
      "Puedes marcar varios.",
      "Pulsa Accesos directos, abajo a la derecha.",
      "Aquí tienes tus vehículos marcados para abrirlos con un clic. Para quitar uno, vuelve a pulsar su marcador."
    ]
  },
  {
    "id": "ver-objetivo-mapa",
    "title": "Ver un objetivo en el mapa",
    "description": "Abre el mapa de un vehículo: su ubicación, el recorrido de hoy, el tiempo de parada y sus herramientas.",
    "category": "Objetivos",
    "icon": "pi-map-marker",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.read"
      ]
    },
    "duration": "0:36",
    "poster": "tutorials/ver-objetivo-mapa.jpg?v=329f0e27a360",
    "captions": "tutorials/ver-objetivo-mapa.vtt?v=0d7c148d7b6d",
    "steps": [
      "En Objetivos, pulsa el nombre del vehículo.",
      "El mapa muestra dónde está ahora.",
      "Abajo ves su estado, la velocidad, lo que ha recorrido hoy y cuánto tiempo lleva detenido.",
      "Pulsa Herramientas.",
      "Desde aquí abres la ubicación en Google Maps o en Waze, ves el historial de recorrido o generas un enlace en tiempo real.",
      "Cierra las herramientas.",
      "Para ver otro vehículo, pulsa su nombre en la lista de la izquierda."
    ]
  },
  {
    "id": "link-tiempo-real",
    "title": "Compartir la ubicación en tiempo real",
    "description": "Genera un enlace temporal para que alguien vea dónde está el vehículo, sin darle acceso a tu cuenta.",
    "category": "Compartir y transferir",
    "icon": "pi-clock",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.update"
      ]
    },
    "duration": "0:31",
    "poster": "tutorials/link-tiempo-real.jpg?v=ee7a2126234d",
    "captions": "tutorials/link-tiempo-real.vtt?v=2f516e786490",
    "steps": [
      "En Objetivos, marca el vehículo cuya ubicación quieres compartir.",
      "Pulsa Acciones.",
      "Elige Compartir.",
      "Selecciona Compartir link en tiempo real.",
      "Elige cuánto tiempo estará activo el enlace, por ejemplo dos horas.",
      "Pulsa Generar link. El enlace se copia solo.",
      "Pégalo en un mensaje. Quien lo abra verá la ubicación hasta que el enlace expire."
    ]
  },
  {
    "id": "compartir-dispositivo",
    "title": "Compartir un dispositivo con otra cuenta",
    "description": "Da acceso a uno de tus dispositivos a otra cuenta de Montao GPS con su correo, y quítaselo cuando quieras.",
    "category": "Compartir y transferir",
    "icon": "pi-share-alt",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.update"
      ]
    },
    "duration": "0:49",
    "poster": "tutorials/compartir-dispositivo.jpg?v=27901fae32da",
    "captions": "tutorials/compartir-dispositivo.vtt?v=e5cadaf0cf3e",
    "steps": [
      "En Gestión, abre tus objetivos y marca el dispositivo que quieres compartir.",
      "Pulsa Acciones.",
      "Elige Compartir.",
      "Selecciona Compartir acceso al dispositivo, para que otra cuenta lo vea en su plataforma.",
      "Escribe el correo de la otra cuenta. Debe estar registrada en Montao GPS.",
      "Pulsa el botón más. El sistema verifica la cuenta y guarda el acceso al instante.",
      "El correo aparece en la lista de compartidos. Con la equis le quitas el acceso cuando quieras.",
      "Pulsa Cerrar.",
      "Cuando la otra persona entra con su cuenta, el dispositivo aparece en sus objetivos, marcado como compartido."
    ]
  },
  {
    "id": "crear-cuenta-transferir",
    "title": "Crear una cuenta y transferirle un objetivo",
    "description": "Registra a la persona que recibirá el vehículo y pásale el objetivo en un solo paso.",
    "category": "Compartir y transferir",
    "icon": "pi-user-plus",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.update",
        "users.create"
      ]
    },
    "duration": "1:09",
    "poster": "tutorials/crear-cuenta-transferir.jpg?v=0e863a7d7d6f",
    "captions": "tutorials/crear-cuenta-transferir.vtt?v=b68cf5dc892e",
    "steps": [
      "En Objetivos, marca el vehículo que vas a entregar.",
      "Pulsa Acciones.",
      "Elige Crear cuenta y transferir.",
      "Elige Manual para escribir los datos de la nueva cuenta.",
      "Escribe el nombre.",
      "Los apellidos.",
      "El correo con el que entrará a Montao GPS.",
      "Y su número de WhatsApp.",
      "Escribe su cédula.",
      "Elige el rol, que define lo que podrá hacer.",
      "Crea una contraseña.",
      "Y repítela para confirmarla.",
      "Pulsa Guardar. Se crea la cuenta y el objetivo pasa a ella.",
      "Aparece la confirmación de la transferencia. Pulsa Entendido.",
      "Gestión abre la cuenta nueva, que ya tiene el vehículo. Con Volver regresas a tu cuenta, donde ya no aparece."
    ]
  },
  {
    "id": "transferir-objetivos",
    "title": "Transferir un objetivo a otra cuenta",
    "description": "Pasa un vehículo a otra cuenta de Montao GPS; deja de aparecer en la tuya.",
    "category": "Compartir y transferir",
    "icon": "pi-reply",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.update"
      ]
    },
    "duration": "0:33",
    "poster": "tutorials/transferir-objetivos.jpg?v=d4046999411a",
    "captions": "tutorials/transferir-objetivos.vtt?v=7c5f1aeceeee",
    "steps": [
      "En Objetivos, marca el vehículo que vas a transferir.",
      "Pulsa Acciones.",
      "Elige Transferir.",
      "Escribe el correo de la cuenta que lo recibirá.",
      "Pulsa Buscar usuario para confirmar que la cuenta existe.",
      "Revisa el nombre de la cuenta y pulsa Transferir.",
      "El vehículo pasa a la otra cuenta y ya no aparece en tu lista. Si solo quieres prestarlo, usa Compartir."
    ]
  },
  {
    "id": "crear-alerta",
    "title": "Crear una alerta para un vehículo",
    "description": "Activa avisos como la guardia de estacionamiento, el GPS desconectado o un límite de velocidad.",
    "category": "Alertas",
    "icon": "pi-bell",
    "requires": {
      "employee": false,
      "privileges": [
        "devices.update"
      ]
    },
    "duration": "0:28",
    "poster": "tutorials/crear-alerta.jpg?v=ee7a2126234d",
    "captions": "tutorials/crear-alerta.vtt?v=7f9d9f393a4c",
    "steps": [
      "En Objetivos, marca el vehículo.",
      "Pulsa Acciones.",
      "Elige Crear alerta para la selección.",
      "Escoge el tipo de aviso. Por ejemplo, Guardia de estacionamiento te avisa si el vehículo se mueve estando estacionado.",
      "Revisa el resumen y pulsa Activar.",
      "La alerta queda activa. En Alertas creadas ves las que tiene este vehículo."
    ]
  },
  {
    "id": "entrar-usuario",
    "title": "Buscar un usuario y entrar a su cuenta",
    "description": "Encuentra a un usuario de tu cuenta y revisa sus objetivos y subusuarios.",
    "category": "Usuarios",
    "icon": "pi-sign-in",
    "requires": {
      "employee": false,
      "privileges": [
        "users.read"
      ]
    },
    "duration": "0:29",
    "poster": "tutorials/entrar-usuario.jpg?v=f2ad87a73975",
    "captions": "tutorials/entrar-usuario.vtt?v=9619ccb97bfd",
    "steps": [
      "En Gestión, la pestaña Usuarios muestra las personas que dependen de tu cuenta.",
      "Escribe su nombre o su correo en el buscador.",
      "Pulsa la flecha para entrar al usuario.",
      "Ahora ves su panel: sus usuarios y sus objetivos. La ruta de arriba muestra dónde estás.",
      "Pulsa Volver para regresar a tu cuenta.",
      "Estás de nuevo en tu cuenta, con todos tus usuarios."
    ]
  },
  {
    "id": "crear-usuario",
    "title": "Crear un usuario",
    "description": "Da acceso a otra persona dentro de tu cuenta con su propio correo y contraseña.",
    "category": "Usuarios",
    "icon": "pi-user-plus",
    "requires": {
      "employee": false,
      "privileges": [
        "users.read",
        "users.create"
      ]
    },
    "duration": "0:53",
    "poster": "tutorials/crear-usuario.jpg?v=7482dacdccfb",
    "captions": "tutorials/crear-usuario.vtt?v=a001f2dc7dd9",
    "steps": [
      "En Gestión, abre la pestaña Usuarios y pulsa Nuevo usuario.",
      "Elige Manual para escribir tú sus datos.",
      "Escribe el nombre.",
      "Los apellidos.",
      "El correo con el que entrará a Montao GPS.",
      "Y su número de WhatsApp.",
      "Escribe su cédula.",
      "Elige el rol, que define lo que podrá hacer.",
      "Crea una contraseña.",
      "Y repítela para confirmarla.",
      "Pulsa Guardar.",
      "El usuario aparece en tu lista y ya puede entrar con su correo y su contraseña."
    ]
  },
  {
    "id": "editar-usuario",
    "title": "Editar un usuario",
    "description": "Corrige los datos de un usuario, su rol o suspende su acceso.",
    "category": "Usuarios",
    "icon": "pi-pencil",
    "requires": {
      "employee": false,
      "privileges": [
        "users.read",
        "users.update"
      ]
    },
    "duration": "0:20",
    "poster": "tutorials/editar-usuario.jpg?v=0f743d38c477",
    "captions": "tutorials/editar-usuario.vtt?v=fc877764d628",
    "steps": [
      "En Usuarios, pulsa el lápiz del usuario.",
      "Cambia el dato que necesites, por ejemplo su WhatsApp.",
      "En Estado puedes suspender su acceso sin borrar el usuario.",
      "Pulsa Guardar.",
      "Los cambios quedan guardados en su ficha."
    ]
  },
  {
    "id": "eliminar-usuario",
    "title": "Eliminar un usuario",
    "description": "Quita a un usuario de tu cuenta cuando ya no debe tener acceso.",
    "category": "Usuarios",
    "icon": "pi-trash",
    "requires": {
      "employee": false,
      "privileges": [
        "users.read",
        "users.delete"
      ]
    },
    "duration": "0:21",
    "poster": "tutorials/eliminar-usuario.jpg?v=7c47dcfc0887",
    "captions": "tutorials/eliminar-usuario.vtt?v=b119df05f56d",
    "steps": [
      "En Usuarios, pulsa la papelera del usuario que quieres quitar.",
      "Confirma que es la persona correcta. Si solo quieres pausar su acceso, edítalo y suspéndelo.",
      "Pulsa Sí para eliminarlo.",
      "El usuario deja de aparecer en tu lista y ya no puede entrar."
    ]
  },
  {
    "id": "link-registro-usuario",
    "title": "Invitar a un usuario con un enlace de registro",
    "description": "Genera un enlace para que la persona complete ella misma su registro y cree su contraseña.",
    "category": "Usuarios",
    "icon": "pi-link",
    "requires": {
      "employee": false,
      "privileges": [
        "users.read",
        "users.create"
      ]
    },
    "duration": "0:30",
    "poster": "tutorials/link-registro-usuario.jpg?v=7482dacdccfb",
    "captions": "tutorials/link-registro-usuario.vtt?v=6c5038120b58",
    "steps": [
      "En Usuarios, pulsa Nuevo usuario.",
      "Elige Link de registro.",
      "Indica si será un cliente o un subcliente de tu cuenta.",
      "Elige el rol que tendrá al registrarse.",
      "Por ejemplo, Cliente.",
      "Pulsa Crear link.",
      "Pulsa Copiar link y envíaselo. Cuando termine su registro, aparecerá en tu lista de usuarios."
    ]
  },
  {
    "id": "activar-gps",
    "title": "Activar o reactivar un GPS",
    "description": "Configura a distancia un GPS que no está reportando y sigue cada paso hasta que se conecte.",
    "category": "Personal de Montao",
    "icon": "pi-bolt",
    "requires": {
      "employee": true,
      "privileges": [
        "devices.update"
      ]
    },
    "duration": "0:28",
    "poster": "tutorials/activar-gps.jpg?v=6df7d1e969ad",
    "captions": "tutorials/activar-gps.vtt?v=5a199dc289b4",
    "steps": [
      "En los objetivos del cliente, abre el GPS que aparece fuera de línea.",
      "En la lista de la izquierda, pulsa Reactivar GPS.",
      "El sistema valida la SIM y le envía al equipo la configuración del APN y del servidor. Aquí ves el paso en curso.",
      "Al confirmar la conexión, el GPS aparece en línea. Si un paso falla, revisa la SIM o registra una revisión de oficina."
    ]
  },
  {
    "id": "proceso-masivo",
    "title": "Aplicar un proceso a varios objetivos",
    "description": "Cambia la fecha de expiración, el técnico, el modelo de GPS u otro dato en varios objetivos juntos.",
    "category": "Personal de Montao",
    "icon": "pi-list-check",
    "requires": {
      "employee": true,
      "privileges": [
        "devices.update"
      ]
    },
    "duration": "0:39",
    "poster": "tutorials/proceso-masivo.jpg?v=1eac3a70e12f",
    "captions": "tutorials/proceso-masivo.vtt?v=e5b7aecc3210",
    "steps": [
      "En los objetivos del cliente, marca los que vas a modificar.",
      "Puedes marcar varios.",
      "Pulsa Acciones.",
      "Elige Realizar proceso.",
      "Elige el proceso, por ejemplo Modificar fecha de expiración.",
      "Indica la nueva fecha de expiración.",
      "Y el motivo del cambio.",
      "Pulsa Aplicar.",
      "El proceso se registra en cada objetivo seleccionado y ves el resultado de cada uno."
    ]
  },
  {
    "id": "cancelar-objetivo",
    "title": "Cancelar un objetivo",
    "description": "Da de baja un objetivo registrando el motivo y qué pasa con el equipo GPS.",
    "category": "Personal de Montao",
    "icon": "pi-ban",
    "requires": {
      "employee": true,
      "privileges": [
        "devices.update"
      ]
    },
    "duration": "0:37",
    "poster": "tutorials/cancelar-objetivo.jpg?v=104f263e1e87",
    "captions": "tutorials/cancelar-objetivo.vtt?v=384e7bc711f5",
    "steps": [
      "En los objetivos del cliente, pulsa el ícono de cancelar del objetivo.",
      "Confirma que quieres cancelarlo.",
      "Elige el motivo, por ejemplo Vehículo vendido.",
      "Describe lo ocurrido.",
      "Indica qué pasa con el equipo GPS: si regresa a Montao, lo conserva el cliente o no se recuperó.",
      "Pulsa Confirmar cancelación.",
      "El objetivo sale de la lista y queda en Cancelados, arriba, desde donde se puede restaurar."
    ]
  },
  {
    "id": "acceso-soporte",
    "title": "Entrar a una cuenta con acceso de soporte",
    "description": "Abre temporalmente la cuenta de un cliente para ver lo mismo que él, con motivo y registro de auditoría.",
    "category": "Personal de Montao",
    "icon": "pi-key",
    "requires": {
      "employee": true,
      "privileges": [
        "users.read"
      ]
    },
    "duration": "0:29",
    "poster": "tutorials/acceso-soporte.jpg?v=5c57f13f8fed",
    "captions": "tutorials/acceso-soporte.vtt?v=8c2b501d52ce",
    "steps": [
      "En la ficha del cliente, pulsa la llave de acceso de soporte.",
      "Escribe el motivo. Queda registrado en la auditoría.",
      "Elige si abrirás el panel de escritorio o la app móvil.",
      "Pulsa Abrir escritorio. Verás la cuenta como la ve el cliente durante quince minutos; al terminar, pulsa Cerrar acceso de soporte para volver a tu sesión."
    ]
  },
  {
    "id": "registrar-objetivo",
    "title": "Registrar un objetivo nuevo",
    "description": "Da de alta un vehículo con GPS en la cuenta del cliente: datos del vehículo y de la instalación.",
    "category": "Personal de Montao",
    "icon": "pi-plus-circle",
    "requires": {
      "employee": true,
      "privileges": [
        "devices.create"
      ]
    },
    "duration": "1:08",
    "poster": "tutorials/registrar-objetivo.jpg?v=80b523a1d6b5",
    "captions": "tutorials/registrar-objetivo.vtt?v=acf644f17720",
    "steps": [
      "Entra a la cuenta del cliente y, en Objetivos, pulsa Nuevo objetivo.",
      "En Vehículo, escribe el nombre o la ficha.",
      "Elige la marca.",
      "El modelo.",
      "Y el año.",
      "Escribe la placa. El chasis y el color son opcionales.",
      "Abre Instalación.",
      "Elige el técnico que hizo la instalación.",
      "Escribe el IMEI del GPS.",
      "El tipo de SIM card.",
      "Y su número.",
      "Elige el modelo de GPS.",
      "Indica dónde quedó instalado.",
      "Revisa las fechas de instalación y de expiración del servicio.",
      "Pulsa Guardar.",
      "El objetivo queda registrado en la cuenta del cliente. Cuando el GPS empiece a reportar, aparecerá en línea."
    ]
  },
  {
    "id": "suspender-objetivos",
    "title": "Suspender el servicio de un objetivo",
    "description": "Pausa temporalmente el servicio de uno o varios objetivos indicando el motivo.",
    "category": "Personal de Montao",
    "icon": "pi-pause-circle",
    "requires": {
      "employee": true,
      "privileges": [
        "devices.update"
      ]
    },
    "duration": "0:33",
    "poster": "tutorials/suspender-objetivos.jpg?v=6dd4403cf1c9",
    "captions": "tutorials/suspender-objetivos.vtt?v=fc749418dc3d",
    "steps": [
      "En los objetivos del cliente, marca los que vas a suspender.",
      "Pulsa Acciones.",
      "Elige Suspender.",
      "Elige el motivo de la suspensión.",
      "Describe el caso para dejar constancia.",
      "Pulsa Confirmar suspensión.",
      "El objetivo queda suspendido. Para reanudarlo, edítalo y cambia su estado a Activo."
    ]
  },
  {
    "id": "transferir-usuario-rama",
    "title": "Transferir un usuario y su rama",
    "description": "Mueve a un usuario, junto con sus subusuarios y objetivos, debajo de otra cuenta.",
    "category": "Personal de Montao",
    "icon": "pi-arrows-h",
    "requires": {
      "employee": true,
      "privileges": [
        "users.read",
        "users.update"
      ]
    },
    "duration": "0:27",
    "poster": "tutorials/transferir-usuario-rama.jpg?v=354aae546b1e",
    "captions": "tutorials/transferir-usuario-rama.vtt?v=374ed8f85e9c",
    "steps": [
      "En Usuarios, pulsa las flechas del usuario que vas a mover.",
      "Escribe el correo de la cuenta que lo recibirá.",
      "Pulsa Verificar cuenta.",
      "Revisa la cuenta encontrada y pulsa Transferir usuario. Se mueven también sus subusuarios y objetivos.",
      "El usuario deja de aparecer aquí y queda debajo de la nueva cuenta."
    ]
  }
];

// INVENTORY: 19 instructivo(s).
export const INVENTORY_TUTORIALS: readonly TutorialVideo[] = [
  {
    "id": "conoce-inventario",
    "title": "Conoce Inventario de Montao GPS",
    "description": "Cómo se organiza el inventario: paquetes y equipos, SIM cards, relays y cables, almacenes, conduces y modelos de GPS.",
    "category": "Recorrido",
    "icon": "pi-compass",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read"
      ]
    },
    "duration": "0:53",
    "poster": "tutorials/conoce-inventario.jpg?v=38979198a3c9",
    "captions": "tutorials/conoce-inventario.vtt?v=3ddc08a8ab00",
    "steps": [
      "Inventario controla los equipos que compras, guardas y envías. Arriba cambias entre equipos y paquetes, SIM cards, relays y cables.",
      "Cada compra entra como un paquete, con lo que se declaró en la factura y lo que ya recibiste.",
      "Con el buscador encuentras cualquier equipo por IMEI, número de SIM o ID SIM, en todos los almacenes.",
      "En Almacenes defines dónde está cada equipo: la oficina, una sucursal o un técnico.",
      "Los conduces registran cada traslado entre almacenes.",
      "Y las alertas te avisan cuando un GPS tiene una SIM que no está en el inventario.",
      "Si tienes una duda, pulsa ¿Qué hacer?",
      "Busca la tarea o elige una categoría y sigue el video paso a paso."
    ]
  },
  {
    "id": "asignar-equipo-cliente",
    "title": "Asignar un equipo a un cliente",
    "description": "Reserva un GPS del inventario para un cliente y crea su objetivo, antes de instalarlo.",
    "category": "Paquetes y equipos",
    "icon": "pi-send",
    "requires": {
      "employee": true,
      "privileges": [
        "inventory.update",
        "devices.create"
      ]
    },
    "duration": "0:33",
    "poster": "tutorials/asignar-equipo-cliente.jpg?v=7e68bf8d8346",
    "captions": "tutorials/asignar-equipo-cliente.vtt?v=8b9c70d47924",
    "steps": [
      "En el paquete, pulsa el avión de papel del equipo disponible.",
      "Elige Asignar al cliente para dejarlo reservado.",
      "Busca al cliente.",
      "Y selecciónalo.",
      "Indica la fecha de vencimiento del servicio.",
      "Pulsa Asignar y reservar.",
      "Se abre la cuenta del cliente con su objetivo nuevo, listo para completar los datos del vehículo. El equipo queda reservado en el inventario."
    ]
  },
  {
    "id": "buscar-equipo-inventario",
    "title": "Buscar un equipo en el inventario",
    "description": "Encuentra un GPS por IMEI, número o ID de SIM, y filtra por almacén o estado.",
    "category": "Paquetes y equipos",
    "icon": "pi-search",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read"
      ]
    },
    "duration": "0:24",
    "poster": "tutorials/buscar-equipo-inventario.jpg?v=0c75c7655b27",
    "captions": "tutorials/buscar-equipo-inventario.vtt?v=af3b1d91c44d",
    "steps": [
      "En Equipos y paquetes, escribe el IMEI, el número de la SIM o el ID SIM.",
      "Pulsa Buscar.",
      "Puedes filtrar por almacén o por estado: disponibles, reservados, instalados o en revisión.",
      "El resultado muestra dónde está el equipo, su estado y quién lo registró."
    ]
  },
  {
    "id": "dar-entrada-accesorios",
    "title": "Dar entrada a cables y relés",
    "description": "Registra los cables y relés recibidos en un paquete por cantidad y almacén.",
    "category": "Paquetes y equipos",
    "icon": "pi-link",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.create"
      ]
    },
    "duration": "0:19",
    "poster": "tutorials/dar-entrada-accesorios.jpg?v=b428d72cfebf",
    "captions": "tutorials/dar-entrada-accesorios.vtt?v=c46a99722394",
    "steps": [
      "En el paquete, pulsa Dar entrada en Cables.",
      "Confirma la cantidad recibida.",
      "Elige el almacén donde se guardan.",
      "Pulsa Registrar entrada.",
      "La línea de cables queda completa. Haz lo mismo con los relés."
    ]
  },
  {
    "id": "dar-entrada-equipos",
    "title": "Dar entrada a los GPS de un paquete",
    "description": "Registra cada GPS recibido con su IMEI, su modelo y el almacén donde queda.",
    "category": "Paquetes y equipos",
    "icon": "pi-download",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.create"
      ]
    },
    "duration": "0:43",
    "poster": "tutorials/dar-entrada-equipos.jpg?v=4e917e882550",
    "captions": "tutorials/dar-entrada-equipos.vtt?v=662a209480d0",
    "steps": [
      "Abre el paquete con Ver contenido. En Por dar entrada ves cuántos equipos faltan por registrar.",
      "Pulsa Dar entrada en Equipos GPS.",
      "Escribe o escanea el IMEI del GPS.",
      "Elige su modelo.",
      "Y el almacén donde queda guardado.",
      "Si ya tiene una SIM puesta, puedes vincularla aquí.",
      "Pulsa Guardar. El formulario queda listo para el siguiente GPS, así registras todo el paquete seguido.",
      "Cuando termines, pulsa Cancelar para cerrarlo.",
      "El equipo aparece en la lista del paquete y el contador de pendientes baja."
    ]
  },
  {
    "id": "editar-equipo-inventario",
    "title": "Editar un equipo o cambiarlo de almacén",
    "description": "Corrige los datos de un GPS, vincula su SIM o muévelo a otro almacén.",
    "category": "Paquetes y equipos",
    "icon": "pi-pencil",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.update"
      ]
    },
    "duration": "0:20",
    "poster": "tutorials/editar-equipo-inventario.jpg?v=fa1e808880f3",
    "captions": "tutorials/editar-equipo-inventario.vtt?v=4003045df393",
    "steps": [
      "En el paquete, pulsa el lápiz del equipo.",
      "Cambia lo que necesites, por ejemplo el almacén.",
      "Desde aquí también vinculas o cambias su SIM card.",
      "Pulsa Guardar.",
      "El equipo queda actualizado y conserva quién hizo el cambio."
    ]
  },
  {
    "id": "editar-paquete",
    "title": "Editar un paquete",
    "description": "Corrige el título, la fecha, el valor o la descripción de un paquete.",
    "category": "Paquetes y equipos",
    "icon": "pi-file-edit",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.update"
      ]
    },
    "duration": "0:20",
    "poster": "tutorials/editar-paquete.jpg?v=d224566b3e83",
    "captions": "tutorials/editar-paquete.vtt?v=2074ba6d366b",
    "steps": [
      "En Entradas de inventario, pulsa el lápiz del paquete.",
      "Cambia el dato que necesites, por ejemplo la descripción.",
      "Pulsa Guardar.",
      "El paquete se actualiza y queda registrado quién lo modificó."
    ]
  },
  {
    "id": "eliminar-restaurar-paquete",
    "title": "Eliminar y restaurar un paquete",
    "description": "Elimina un paquete registrado por error y recupéralo después con sus equipos y SIM.",
    "category": "Paquetes y equipos",
    "icon": "pi-history",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.update",
        "inventory.delete"
      ]
    },
    "duration": "0:27",
    "poster": "tutorials/eliminar-restaurar-paquete.jpg?v=aae879eb6fca",
    "captions": "tutorials/eliminar-restaurar-paquete.vtt?v=f4008d349eb9",
    "steps": [
      "Para eliminar un paquete, pulsa su papelera.",
      "Confirma la eliminación. El paquete y sus equipos salen del inventario.",
      "Si fue un error, abre Paquetes eliminados.",
      "Y pulsa Restaurar en el paquete.",
      "Confirma. Vuelve con sus GPS y SIM, sin duplicar registros ni reenviar facturas.",
      "El paquete está de nuevo en Entradas de inventario."
    ]
  },
  {
    "id": "crear-paquete",
    "title": "Registrar un paquete de compra",
    "description": "Crea el paquete de una compra con su fecha, su valor y una descripción, antes de dar entrada a los equipos.",
    "category": "Paquetes y equipos",
    "icon": "pi-box",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.create"
      ]
    },
    "duration": "0:32",
    "poster": "tutorials/crear-paquete.jpg?v=f64ecc7c6162",
    "captions": "tutorials/crear-paquete.vtt?v=ce964e2494b2",
    "steps": [
      "En Equipos y paquetes, pulsa Nuevo paquete.",
      "Escribe un título que identifique la compra.",
      "Indica el valor de la compra.",
      "Y una descripción opcional.",
      "Pulsa Guardar.",
      "El paquete aparece en Entradas de inventario. Ábrelo con Ver contenido para dar entrada a los equipos."
    ]
  },
  {
    "id": "buscar-simcards",
    "title": "Buscar SIM cards",
    "description": "Encuentra una SIM por número, ICCID o ID SIM, y filtra por almacén, estado o compañía.",
    "category": "SIM cards",
    "icon": "pi-search",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read"
      ]
    },
    "duration": "0:20",
    "poster": "tutorials/buscar-simcards.jpg?v=aff69b8f4ba5",
    "captions": "tutorials/buscar-simcards.vtt?v=bf6d7d9fe9c7",
    "steps": [
      "Abre la pestaña SIM cards.",
      "Escribe el número, el ICCID o el ID SIM.",
      "Pulsa Buscar.",
      "Con los filtros ves solo las de un almacén, las instaladas o disponibles, o las de una compañía."
    ]
  },
  {
    "id": "editar-simcard",
    "title": "Editar una SIM card",
    "description": "Corrige los datos de una SIM o cámbiala de almacén.",
    "category": "SIM cards",
    "icon": "pi-pencil",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.update"
      ]
    },
    "duration": "0:16",
    "poster": "tutorials/editar-simcard.jpg?v=4c5ded0ca4df",
    "captions": "tutorials/editar-simcard.vtt?v=425c16c2fa69",
    "steps": [
      "Abre la pestaña SIM cards.",
      "Pulsa el lápiz de la SIM.",
      "Cambia lo que necesites, por ejemplo el almacén.",
      "Pulsa Guardar. La SIM queda actualizada."
    ]
  },
  {
    "id": "registrar-simcard",
    "title": "Registrar una SIM card",
    "description": "Agrega una SIM al inventario con su número o ICCID, la compañía y el almacén.",
    "category": "SIM cards",
    "icon": "pi-credit-card",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.create"
      ]
    },
    "duration": "0:38",
    "poster": "tutorials/registrar-simcard.jpg?v=7429b1f07620",
    "captions": "tutorials/registrar-simcard.vtt?v=a4ad8579abc5",
    "steps": [
      "Abre la pestaña SIM cards.",
      "Pulsa Nueva SIM card.",
      "Escribe el número de teléfono o el ICCID.",
      "Elige la compañía proveedora.",
      "Agrega su ID SIM si lo tiene.",
      "Y el almacén donde queda.",
      "Pulsa Guardar. El formulario queda listo para la siguiente SIM.",
      "Cuando termines, pulsa Cancelar.",
      "La SIM queda disponible para vincularla a un GPS o enviarla en un conduce."
    ]
  },
  {
    "id": "sim-sin-registrar",
    "title": "Revisar GPS con SIM sin registrar",
    "description": "Encuentra los GPS del inventario que tienen una SIM que no está registrada y corrígelos.",
    "category": "SIM cards",
    "icon": "pi-exclamation-triangle",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read"
      ]
    },
    "duration": "0:22",
    "poster": "tutorials/sim-sin-registrar.jpg?v=a366d37ee2d2",
    "captions": "tutorials/sim-sin-registrar.vtt?v=639dffbd81cf",
    "steps": [
      "Pulsa SIM sin registrar. El número indica cuántos GPS requieren atención.",
      "Cada fila muestra el GPS, su SIM y el almacén.",
      "Pulsa Ver GPS para ir al equipo.",
      "Desde el equipo registras su SIM en el inventario o corriges el número. Luego la alerta desaparece."
    ]
  },
  {
    "id": "registrar-lote",
    "title": "Registrar un lote de relés o cables",
    "description": "Agrega relés o cables al inventario por cantidad, en el almacén donde se guardan.",
    "category": "Relay y cables",
    "icon": "pi-bolt",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.create"
      ]
    },
    "duration": "0:31",
    "poster": "tutorials/registrar-lote.jpg?v=070f76fe9541",
    "captions": "tutorials/registrar-lote.vtt?v=dc311299bc1a",
    "steps": [
      "Abre la pestaña Relay. Cables funciona igual.",
      "Pulsa Registrar lote.",
      "Escribe el nombre o la referencia del lote.",
      "La cantidad.",
      "Y el almacén donde queda.",
      "Pulsa Registrar lote.",
      "El lote aparece con su existencia por almacén. Desde aquí lo envías en un conduce."
    ]
  },
  {
    "id": "crear-almacen",
    "title": "Crear un almacén",
    "description": "Agrega un lugar donde se guardan equipos, como una sucursal o un técnico, con su existencia mínima.",
    "category": "Almacenes",
    "icon": "pi-building",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.create"
      ]
    },
    "duration": "0:38",
    "poster": "tutorials/crear-almacen.jpg?v=a9fcae04d23e",
    "captions": "tutorials/crear-almacen.vtt?v=fb9cc7a4e0b7",
    "steps": [
      "Pulsa Almacenes. Aquí ves la existencia de cada uno.",
      "Pulsa Nuevo almacén.",
      "Escribe el nombre.",
      "Una descripción.",
      "Y la cantidad mínima de equipos. Si baja de ese número, verás una alerta.",
      "Con Vincular usuario le das acceso a un técnico o encargado.",
      "Pulsa Guardar.",
      "El almacén aparece en la lista, listo para recibir equipos."
    ]
  },
  {
    "id": "cancelar-conduce",
    "title": "Cancelar un conduce",
    "description": "Anula un traslado y devuelve los artículos a su almacén de origen.",
    "category": "Conduces",
    "icon": "pi-times-circle",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.update"
      ]
    },
    "duration": "0:26",
    "poster": "tutorials/cancelar-conduce.jpg?v=9076e61e2604",
    "captions": "tutorials/cancelar-conduce.vtt?v=f8e9923c0e0e",
    "steps": [
      "Pulsa Conduces.",
      "Pulsa Cancelar conduce.",
      "El resumen muestra a qué almacén vuelve cada artículo.",
      "Escribe el motivo.",
      "Pulsa Confirmar cancelación.",
      "El conduce queda cancelado y los artículos regresan a su origen."
    ]
  },
  {
    "id": "imprimir-conduce",
    "title": "Consultar e imprimir un conduce",
    "description": "Revisa el detalle de un traslado e imprime el conduce o la ficha de envío.",
    "category": "Conduces",
    "icon": "pi-print",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read"
      ]
    },
    "duration": "0:29",
    "poster": "tutorials/imprimir-conduce.jpg?v=f4a8793928dc",
    "captions": "tutorials/imprimir-conduce.vtt?v=9d648ce491a5",
    "steps": [
      "Pulsa Conduces para ver el historial de traslados.",
      "Pulsa Ver detalles para revisar el destino y los artículos enviados.",
      "Aquí ves los GPS, las SIM y los lotes de este conduce.",
      "Cierra el detalle.",
      "Para imprimir, pulsa Imprimir en el conduce.",
      "Elige Imprimir conduce, el documento completo, o la ficha de envío con los datos de quien recibe."
    ]
  },
  {
    "id": "crear-conduce",
    "title": "Enviar equipos con un conduce",
    "description": "Traslada GPS, SIM, relés o cables a otro almacén y deja constancia del envío.",
    "category": "Conduces",
    "icon": "pi-send",
    "requires": {
      "employee": false,
      "privileges": [
        "inventory.read",
        "inventory.create"
      ]
    },
    "duration": "0:45",
    "poster": "tutorials/crear-conduce.jpg?v=19604d5b8510",
    "captions": "tutorials/crear-conduce.vtt?v=e882e7cfa1b1",
    "steps": [
      "Pulsa Conduces.",
      "Pulsa Nuevo conduce.",
      "Elige el almacén de destino.",
      "Escribe o escanea el IMEI de cada GPS.",
      "Y pulsa más para agregarlo.",
      "Haz lo mismo con las SIM cards.",
      "Pulsa más.",
      "Escribe los detalles del traslado.",
      "Pulsa Confirmar conduce.",
      "El conduce queda registrado y los artículos pasan al almacén de destino. Desde aquí puedes imprimirlo."
    ]
  },
  {
    "id": "crear-modelo-gps",
    "title": "Crear un modelo de GPS",
    "description": "Agrega un modelo nuevo tomando la configuración de un protocolo que ya funciona.",
    "category": "Modelos de GPS",
    "icon": "pi-cog",
    "requires": {
      "employee": false,
      "privileges": [
        "protocols.read",
        "protocols.create"
      ]
    },
    "duration": "0:27",
    "poster": "tutorials/crear-modelo-gps.jpg?v=0451128adcb8",
    "captions": "tutorials/crear-modelo-gps.vtt?v=62161e419c87",
    "steps": [
      "Pulsa Modelos de GPS.",
      "Pulsa Nuevo modelo.",
      "Escribe el nombre del modelo.",
      "Elige el protocolo base: el modelo usará su configuración y sus comandos.",
      "Pulsa Crear modelo.",
      "El modelo queda disponible al dar entrada a equipos y al registrar objetivos."
    ]
  }
];
