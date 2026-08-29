import { ProcessesComponent } from './processes.component';

describe('ProcessesComponent structured detail', () => {
  const component = Object.create(ProcessesComponent.prototype) as ProcessesComponent;

  it('renders an automatic activation as metrics, step cards and timeline events', () => {
    const changes = (component as any).buildChangeRows(
      {},
      {
        lastProcess: {
          completed: true,
          cancelled: false,
          run_id: 'activation-run-1',
          startedAt: '2026-08-28T20:00:40.169Z',
          heartbeatAt: '2026-08-28T20:01:26.100Z',
          steps: [
            {
              label: 'Validar SIM',
              icon: 'pi-id-card',
              description: 'Verificar estado de la SIM card',
              status: 'success',
            },
          ],
          logs: [
            {
              message: 'Proceso de activación iniciado',
              type: 'info',
              time: '2026-08-28T20:00:40.169Z',
            },
          ],
        },
      },
    );

    const detail = changes[0];
    expect(detail.isStructured).toBeTrue();
    expect(detail.after).toBe('1 paso · 1 evento');
    expect(detail.after).not.toContain('{');
    expect(detail.afterStructured.metrics.map((metric: any) => metric.label))
      .toEqual(['Completado', 'Cancelado', 'Inicio', 'Última actividad', 'ID de ejecución']);
    expect(detail.afterStructured.steps[0]).toEqual(jasmine.objectContaining({
      label: 'Validar SIM',
      icon: 'pi pi-id-card',
      status: 'Completado',
      tone: 'success',
    }));
    expect(detail.afterStructured.events[0]).toEqual(jasmine.objectContaining({
      message: 'Proceso de activación iniciado',
      tone: 'info',
    }));
  });

  it('also recognizes structured data stored as a JSON string', () => {
    const changes = (component as any).buildChangeRows(
      {},
      { activation_status: JSON.stringify({ provider: 'twilio', enabled: true }) },
    );

    expect(changes[0].isStructured).toBeTrue();
    expect(changes[0].afterStructured.fields).toEqual([
      jasmine.objectContaining({ label: 'Proveedor', value: 'twilio' }),
      jasmine.objectContaining({ label: 'Habilitado', value: 'Sí', tone: 'success' }),
    ]);
  });

  it('keeps ordinary scalar changes in the compact before-and-after comparison', () => {
    const changes = (component as any).buildChangeRows(
      { status: 'pending' },
      { status: 'completed' },
    );

    expect(changes[0]).toEqual(jasmine.objectContaining({
      label: 'Estado',
      before: 'Pendiente',
      after: 'Completado',
      isStructured: false,
    }));
  });

  it('formats scalar process dates instead of exposing ISO timestamps', () => {
    const changes = (component as any).buildChangeRows(
      {},
      { processDate: '2026-08-28T20:01:30.166Z' },
    );

    expect(changes[0].after).toContain('28 ago');
    expect(changes[0].after).not.toContain('T20:01:30.166Z');
  });
});
