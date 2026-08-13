export interface InstallationLocationOption {
  label: string;
  value: string;
  custom?: boolean;
}

export const DEFAULT_INSTALLATION_LOCATIONS: InstallationLocationOption[] = [
  { label: 'Bajo el tablero', value: 'bajo_tablero' },
  { label: 'En el maletero', value: 'maletero' },
  { label: 'Bajo el asiento del conductor', value: 'asiento_conductor' },
  { label: 'Asiento del chofer', value: 'asiento_chofer' },
  { label: 'En el compartimento del motor', value: 'compartimento_motor' },
  { label: 'En el panel de instrumentos', value: 'panel_instrumentos' },
  { label: 'Debajo del volante', value: 'debajo_volante' },
  { label: 'En la parte trasera del vehículo', value: 'parte_trasera' },
  { label: 'Luz del techo', value: 'luz_techo' },
  { label: 'Luz trasera', value: 'luz_trasera' },
  { label: 'Debajo del asiento del pasajero', value: 'asiento_pasajero' },
  { label: 'Caja de fusibles', value: 'caja_fusibles' },
  { label: 'Debajo del asiento trasero', value: 'asiento_trasero' },
  { label: 'En la guantera del pasajero', value: 'guantera_pasajero' },
  { label: 'En el radio', value: 'radio' },
  { label: 'El buche', value: 'buche' },
  { label: 'Lateral izquierdo', value: 'lateral_izquierdo' },
  { label: 'El millero', value: 'millero' },
  { label: 'El chasis', value: 'chasis' },
  { label: 'Otro', value: 'otro' },
];
