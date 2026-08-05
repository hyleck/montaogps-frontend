export type AlertEngine =
  | 'speed'
  | 'perimeter'
  | 'ignition'
  | 'movement'
  | 'connection';

export type AlertPresetCategory =
  | 'security'
  | 'family'
  | 'daily'
  | 'business'
  | 'maintenance';

export type AlertPresetAvailability = 'ready' | 'analysis' | 'sensor';

export interface AlertPresetCard {
  key: string;
  name: string;
  description: string;
  category: AlertPresetCategory;
  icon: string;
  tone: 'red' | 'orange' | 'purple' | 'blue' | 'green' | 'cyan';
  engine?: AlertEngine;
  availability: AlertPresetAvailability;
  badge?: string;
  featured?: boolean;
  requiresIgnition?: boolean;
  usesSchedule?: boolean;
  scheduleStart?: string;
  scheduleEnd?: string;
  defaultSpeed?: number;
  perimeterTrigger?: 'enter' | 'exit';
  defaultRadius?: number;
  defaultMessage?: string;
}

export const ALERT_PRESET_CATEGORIES: Array<{
  key: 'all' | AlertPresetCategory;
  label: string;
  icon: string;
}> = [
  { key: 'all', label: 'Todas', icon: 'pi pi-th-large' },
  { key: 'security', label: 'Proteger mi vehículo', icon: 'pi pi-shield' },
  { key: 'family', label: 'Familia y lugares', icon: 'pi pi-home' },
  { key: 'daily', label: 'Uso diario y viajes', icon: 'pi pi-car' },
  { key: 'business', label: 'Negocio y flotilla', icon: 'pi pi-briefcase' },
  { key: 'maintenance', label: 'Mantenimiento', icon: 'pi pi-wrench' },
];

export const ALERT_PRESETS: AlertPresetCard[] = [
  // Seguridad
  { key: 'night-mode', name: 'Modo nocturno', description: 'Avisa si el vehículo sale de la zona de tu casa durante la noche.', category: 'security', icon: 'pi pi-moon', tone: 'purple', engine: 'perimeter', availability: 'ready', badge: 'Recomendada', featured: true, usesSchedule: true, scheduleStart: '22:00', scheduleEnd: '06:00', perimeterTrigger: 'exit', defaultRadius: 150, defaultMessage: 'El vehículo salió de la zona segura durante el horario nocturno.' },
  { key: 'parking-guard', name: 'Guardia de estacionamiento', description: 'Te avisa cuando un vehículo estacionado comienza a moverse.', category: 'security', icon: 'pi pi-lock', tone: 'red', engine: 'movement', availability: 'ready', badge: '1 toque', featured: true, defaultMessage: 'El vehículo estacionado comenzó a moverse.' },
  { key: 'possible-towing', name: 'Posible remolque', description: 'Detecta desplazamiento con el motor apagado.', category: 'security', icon: 'pi pi-truck', tone: 'orange', availability: 'analysis', requiresIgnition: true },
  { key: 'valet-mode', name: 'Modo valet', description: 'Controla radio, velocidad y duración mientras otra persona usa el vehículo.', category: 'security', icon: 'pi pi-key', tone: 'purple', availability: 'analysis', featured: true },
  { key: 'unauthorized-use', name: 'Vehículo usado sin permiso', description: 'Avisa si se enciende o se mueve fuera del horario permitido.', category: 'security', icon: 'pi pi-ban', tone: 'red', engine: 'ignition', availability: 'ready', requiresIgnition: true, usesSchedule: true, scheduleStart: '19:00', scheduleEnd: '08:00', defaultMessage: 'El vehículo fue encendido fuera del horario permitido.' },
  { key: 'late-night-ignition', name: 'Encendido de madrugada', description: 'Avisa si el motor se enciende entre las 11 p. m. y las 6 a. m.', category: 'security', icon: 'pi pi-power-off', tone: 'purple', engine: 'ignition', availability: 'ready', requiresIgnition: true, usesSchedule: true, scheduleStart: '23:00', scheduleEnd: '06:00', defaultMessage: 'El motor se encendió durante la madrugada.' },
  { key: 'left-safe-zone', name: 'Salió de zona segura', description: 'Avisa al abandonar una ubicación que tú consideras segura.', category: 'security', icon: 'pi pi-sign-out', tone: 'red', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'exit', defaultRadius: 200, defaultMessage: 'El vehículo salió de la zona segura.' },
  { key: 'entered-danger-zone', name: 'Entró en zona peligrosa', description: 'Avisa al entrar a una ubicación marcada como peligrosa.', category: 'security', icon: 'pi pi-exclamation-triangle', tone: 'orange', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'enter', defaultRadius: 300, defaultMessage: 'El vehículo entró en una zona marcada como peligrosa.' },
  { key: 'gps-disconnected', name: 'GPS desconectado', description: 'Avisa cuando el dispositivo pasa a estar fuera de línea.', category: 'security', icon: 'pi pi-wifi', tone: 'red', engine: 'connection', availability: 'ready', featured: true, defaultMessage: 'El GPS perdió la conexión.' },
  { key: 'gps-tampering', name: 'GPS posiblemente manipulado', description: 'Relaciona cambios del motor con una pérdida repentina de conexión.', category: 'security', icon: 'pi pi-shield', tone: 'red', availability: 'analysis' },
  { key: 'suspicious-signal', name: 'Señal sospechosa', description: 'Detecta pérdida o degradación anormal de señal mientras se conduce.', category: 'security', icon: 'pi pi-chart-line', tone: 'orange', availability: 'analysis' },
  { key: 'battery-disconnected', name: 'Batería desconectada', description: 'Avisa cuando el GPS reporta una pérdida de alimentación externa.', category: 'security', icon: 'pi pi-bolt', tone: 'red', availability: 'sensor' },

  // Familia y lugares
  { key: 'arrived-home', name: 'Llegó a casa', description: 'Avisa automáticamente cuando el vehículo entra a la zona de tu casa.', category: 'family', icon: 'pi pi-home', tone: 'green', engine: 'perimeter', availability: 'ready', featured: true, perimeterTrigger: 'enter', defaultRadius: 150, defaultMessage: 'El vehículo llegó a casa.' },
  { key: 'left-home', name: 'Salió de casa', description: 'Avisa cuando el vehículo abandona la zona de tu casa.', category: 'family', icon: 'pi pi-sign-out', tone: 'blue', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'exit', defaultRadius: 150, defaultMessage: 'El vehículo salió de casa.' },
  { key: 'arrived-work', name: 'Llegó al trabajo', description: 'Avisa al entrar a la ubicación del trabajo.', category: 'family', icon: 'pi pi-building', tone: 'blue', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'enter', defaultRadius: 180, defaultMessage: 'El vehículo llegó al trabajo.' },
  { key: 'young-driver', name: 'Conductor joven', description: 'Supervisa una velocidad prudente durante el horario que elijas.', category: 'family', icon: 'pi pi-users', tone: 'orange', engine: 'speed', availability: 'ready', badge: 'Popular', featured: true, usesSchedule: true, scheduleStart: '20:00', scheduleEnd: '06:00', defaultSpeed: 90, defaultMessage: 'El conductor joven superó la velocidad configurada.' },
  { key: 'no-night-driving', name: 'No conducir de noche', description: 'Avisa si el vehículo comienza a moverse durante el horario nocturno.', category: 'family', icon: 'pi pi-moon', tone: 'purple', engine: 'movement', availability: 'ready', usesSchedule: true, scheduleStart: '22:00', scheduleEnd: '06:00', defaultMessage: 'El vehículo comenzó a moverse durante el horario restringido.' },
  { key: 'family-speed', name: 'Velocidad familiar', description: 'Crea un límite de velocidad sencillo para el uso familiar.', category: 'family', icon: 'pi pi-gauge', tone: 'orange', engine: 'speed', availability: 'ready', defaultSpeed: 100, defaultMessage: 'El vehículo superó la velocidad familiar configurada.' },
  { key: 'arrived-destination', name: 'Llegó a su destino', description: 'Avisa cuando el vehículo entra al destino elegido.', category: 'family', icon: 'pi pi-flag', tone: 'green', engine: 'perimeter', availability: 'ready', featured: true, perimeterTrigger: 'enter', defaultRadius: 180, defaultMessage: 'El vehículo llegó a su destino.' },
  { key: 'late-arrival', name: 'No llegó a tiempo', description: 'Avisa si el vehículo no llega al destino antes de la hora esperada.', category: 'family', icon: 'pi pi-clock', tone: 'red', availability: 'analysis' },
  { key: 'too-far-away', name: 'Se alejó demasiado', description: 'Avisa cuando se supera la distancia permitida desde un punto principal.', category: 'family', icon: 'pi pi-compass', tone: 'orange', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'exit', defaultRadius: 1000, defaultMessage: 'El vehículo se alejó del área permitida.' },
  { key: 'returned-home', name: 'Regresó a casa', description: 'Avisa al volver a casa después de un recorrido.', category: 'family', icon: 'pi pi-replay', tone: 'green', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'enter', defaultRadius: 150, defaultMessage: 'El vehículo regresó a casa.' },

  // Uso diario y viajes
  { key: 'vehicle-moving', name: 'Vehículo en movimiento', description: 'Avisa cuando el vehículo comienza a moverse.', category: 'daily', icon: 'pi pi-car', tone: 'cyan', engine: 'movement', availability: 'ready', defaultMessage: 'El vehículo comenzó a moverse.' },
  { key: 'engine-on', name: 'Motor encendido', description: 'Avisa en el momento en que se enciende el motor.', category: 'daily', icon: 'pi pi-power-off', tone: 'green', engine: 'ignition', availability: 'ready', requiresIgnition: true, defaultMessage: 'El motor se encendió.' },
  { key: 'engine-on-too-long', name: 'Motor encendido demasiado tiempo', description: 'Detecta el motor encendido sin movimiento durante demasiado tiempo.', category: 'daily', icon: 'pi pi-stopwatch', tone: 'orange', availability: 'analysis', requiresIgnition: true, featured: true },
  { key: 'long-stop', name: 'Parada prolongada', description: 'Avisa cuando el vehículo permanece detenido más del tiempo permitido.', category: 'daily', icon: 'pi pi-pause-circle', tone: 'orange', availability: 'analysis' },
  { key: 'unused-vehicle', name: 'Vehículo no utilizado', description: 'Avisa si pasan varios días sin movimiento ni encendido.', category: 'daily', icon: 'pi pi-calendar-times', tone: 'blue', availability: 'analysis' },
  { key: 'unexpected-departure', name: 'Salida inesperada', description: 'Avisa cuando el vehículo sale de un lugar habitual.', category: 'daily', icon: 'pi pi-directions', tone: 'red', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'exit', defaultRadius: 180, defaultMessage: 'El vehículo salió inesperadamente de la ubicación habitual.' },
  { key: 'unknown-parking', name: 'Estacionó en lugar desconocido', description: 'Detecta si el vehículo termina un viaje fuera de tus lugares habituales.', category: 'daily', icon: 'pi pi-question-circle', tone: 'purple', availability: 'analysis' },
  { key: 'returned-parking', name: 'Regresó al estacionamiento', description: 'Avisa cuando el vehículo vuelve al estacionamiento habitual.', category: 'daily', icon: 'pi pi-warehouse', tone: 'green', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'enter', defaultRadius: 150, defaultMessage: 'El vehículo regresó al estacionamiento.' },
  { key: 'temporary-speed', name: 'Exceso de velocidad temporal', description: 'Aplica un límite de velocidad durante un viaje o período específico.', category: 'daily', icon: 'pi pi-gauge', tone: 'orange', availability: 'analysis' },
  { key: 'trip-started', name: 'Viaje iniciado', description: 'Avisa cuando comienza un nuevo recorrido.', category: 'daily', icon: 'pi pi-play-circle', tone: 'cyan', engine: 'movement', availability: 'ready', defaultMessage: 'El vehículo inició un viaje.' },
  { key: 'trip-ended', name: 'Viaje finalizado', description: 'Avisa cuando el motor se apaga al finalizar un recorrido.', category: 'daily', icon: 'pi pi-stop-circle', tone: 'blue', engine: 'ignition', availability: 'ready', requiresIgnition: true, defaultMessage: 'El vehículo finalizó el viaje y apagó el motor.' },

  // Negocio y flotilla
  { key: 'workday-start', name: 'Inicio de jornada', description: 'Registra el primer movimiento del vehículo en el día.', category: 'business', icon: 'pi pi-sun', tone: 'green', engine: 'movement', availability: 'ready', defaultMessage: 'La unidad inició su jornada.' },
  { key: 'workday-late', name: 'Jornada iniciada tarde', description: 'Avisa si no hubo movimiento antes de la hora esperada.', category: 'business', icon: 'pi pi-clock', tone: 'red', availability: 'analysis' },
  { key: 'after-hours-use', name: 'Uso fuera de horario', description: 'Avisa si una unidad comienza a moverse fuera de la jornada laboral.', category: 'business', icon: 'pi pi-calendar-minus', tone: 'red', engine: 'movement', availability: 'ready', featured: true, usesSchedule: true, scheduleStart: '18:00', scheduleEnd: '08:00', defaultMessage: 'La unidad está siendo utilizada fuera del horario laboral.' },
  { key: 'left-base', name: 'Salió de la base', description: 'Avisa cuando una unidad abandona la base de la empresa.', category: 'business', icon: 'pi pi-sign-out', tone: 'blue', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'exit', defaultRadius: 250, defaultMessage: 'La unidad salió de la base.' },
  { key: 'returned-base', name: 'Regresó a la base', description: 'Avisa cuando una unidad vuelve a la base.', category: 'business', icon: 'pi pi-sign-in', tone: 'green', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'enter', defaultRadius: 250, defaultMessage: 'La unidad regresó a la base.' },
  { key: 'visit-completed', name: 'Visita completada', description: 'Avisa al llegar a la ubicación de un cliente.', category: 'business', icon: 'pi pi-check-circle', tone: 'green', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'enter', defaultRadius: 150, defaultMessage: 'La unidad llegó a la ubicación del cliente.' },
  { key: 'unauthorized-stop', name: 'Parada no autorizada', description: 'Detecta detenciones prolongadas fuera de zonas permitidas.', category: 'business', icon: 'pi pi-ban', tone: 'red', availability: 'analysis' },
  { key: 'route-abandoned', name: 'Ruta abandonada', description: 'Avisa cuando una unidad se aleja de la ruta planificada.', category: 'business', icon: 'pi pi-map', tone: 'red', availability: 'analysis' },
  { key: 'destination-skipped', name: 'Destino omitido', description: 'Avisa cuando una parada requerida no fue visitada.', category: 'business', icon: 'pi pi-times-circle', tone: 'orange', availability: 'analysis' },
  { key: 'outside-sector', name: 'Vehículo fuera de su sector', description: 'Avisa al salir del área de trabajo asignada.', category: 'business', icon: 'pi pi-globe', tone: 'orange', engine: 'perimeter', availability: 'ready', perimeterTrigger: 'exit', defaultRadius: 2000, defaultMessage: 'La unidad salió de su sector asignado.' },
  { key: 'too-long-client', name: 'Demasiado tiempo en un cliente', description: 'Detecta permanencia excesiva dentro de la ubicación del cliente.', category: 'business', icon: 'pi pi-hourglass', tone: 'orange', availability: 'analysis' },
  { key: 'offline-working', name: 'Unidad fuera de línea trabajando', description: 'Avisa si el GPS pierde conexión durante el horario laboral.', category: 'business', icon: 'pi pi-wifi', tone: 'red', engine: 'connection', availability: 'ready', usesSchedule: true, scheduleStart: '08:00', scheduleEnd: '18:00', defaultMessage: 'La unidad perdió conexión durante el horario laboral.' },
  { key: 'fleet-not-returned', name: 'Flota sin regresar', description: 'Avisa si una unidad no vuelve a la base antes de la hora límite.', category: 'business', icon: 'pi pi-exclamation-circle', tone: 'red', availability: 'analysis' },

  // Mantenimiento y conducción avanzada
  { key: 'hard-braking', name: 'Frenado brusco', description: 'Detecta una desaceleración fuerte reportada por el GPS.', category: 'maintenance', icon: 'pi pi-angle-double-down', tone: 'red', availability: 'sensor' },
  { key: 'hard-acceleration', name: 'Aceleración brusca', description: 'Detecta una aceleración repentina.', category: 'maintenance', icon: 'pi pi-angle-double-up', tone: 'orange', availability: 'sensor' },
  { key: 'dangerous-turn', name: 'Giro peligroso', description: 'Detecta fuerzas laterales anormales durante un giro.', category: 'maintenance', icon: 'pi pi-replay', tone: 'red', availability: 'sensor' },
  { key: 'possible-crash', name: 'Posible accidente', description: 'Combina eventos de impacto, frenado y detención repentina.', category: 'maintenance', icon: 'pi pi-exclamation-triangle', tone: 'red', availability: 'sensor' },
  { key: 'high-rpm', name: 'Exceso de revoluciones', description: 'Avisa cuando el motor supera las RPM permitidas.', category: 'maintenance', icon: 'pi pi-gauge', tone: 'orange', availability: 'sensor' },
  { key: 'engine-temperature', name: 'Temperatura alta del motor', description: 'Avisa si el sensor reporta sobrecalentamiento.', category: 'maintenance', icon: 'pi pi-sun', tone: 'red', availability: 'sensor' },
  { key: 'low-fuel', name: 'Combustible bajo', description: 'Avisa cuando el nivel de combustible cae por debajo del mínimo.', category: 'maintenance', icon: 'pi pi-chart-bar', tone: 'orange', availability: 'sensor' },
  { key: 'fuel-drop', name: 'Pérdida repentina de combustible', description: 'Detecta una caída anormal del nivel de combustible.', category: 'maintenance', icon: 'pi pi-arrow-down', tone: 'red', availability: 'sensor' },
  { key: 'mileage-service', name: 'Mantenimiento próximo por kilometraje', description: 'Avisa antes de alcanzar el kilometraje de servicio.', category: 'maintenance', icon: 'pi pi-wrench', tone: 'blue', availability: 'analysis' },
  { key: 'engine-hours-service', name: 'Mantenimiento por horas de motor', description: 'Programa mantenimiento según las horas reales de uso.', category: 'maintenance', icon: 'pi pi-clock', tone: 'blue', availability: 'sensor' },
  { key: 'low-main-battery', name: 'Batería principal baja', description: 'Avisa al detectar voltaje bajo en la batería del vehículo.', category: 'maintenance', icon: 'pi pi-bolt', tone: 'orange', availability: 'sensor' },
  { key: 'physical-gps-disconnect', name: 'Desconexión física del GPS', description: 'Distingue una pérdida de alimentación de una caída de señal.', category: 'maintenance', icon: 'pi pi-link', tone: 'red', availability: 'sensor' },
  { key: 'device-or-sim-change', name: 'Cambio inesperado de dispositivo o SIM', description: 'Avisa cuando cambia la identidad reportada por el equipo.', category: 'maintenance', icon: 'pi pi-sync', tone: 'purple', availability: 'analysis' },
];
