export interface DeviceCancellationReasonOption {
  label: string;
  value: string;
}

export const DEVICE_CANCELLATION_REASONS: readonly DeviceCancellationReasonOption[] = [
  { label: 'Vehículo vendido', value: 'vehicle_sold' },
  { label: 'Descontento con el servicio', value: 'service_dissatisfaction' },
  { label: 'Cliente saldó el préstamo', value: 'loan_paid_off' },
  { label: 'Renovación muy cara', value: 'renewal_too_expensive' },
  { label: 'Vehículo robado', value: 'vehicle_stolen' },
  { label: 'Vehículo en el taller', value: 'vehicle_in_shop' },
  { label: 'Cambio de Dispositivo', value: 'device_change' },
  { label: 'Cambio de Vehículo', value: 'vehicle_change' },
  { label: 'Dispositivo dañado', value: 'device_damaged' },
  { label: 'Sin razón específica', value: 'no_specific_reason' },
];

export function getDeviceCancellationReasonLabel(value?: string): string {
  const normalized = String(value || '').trim();
  return DEVICE_CANCELLATION_REASONS.find(reason => reason.value === normalized)?.label || normalized;
}
