import { EmpleadosComponent } from './empleados.component';

describe('EmpleadosComponent live replay', () => {
  const buildComponent = () => {
    const component = Object.create(
      EmpleadosComponent.prototype,
    ) as EmpleadosComponent;
    const replayer = {
      pause: jasmine.createSpy('pause'),
      play: jasmine.createSpy('play'),
      getCurrentTime: jasmine.createSpy('getCurrentTime').and.returnValue(0),
    };

    Object.assign(component as any, {
      replayMode: 'live',
      replayPlaying: false,
      replayStartedAt: 9_000,
      replayer,
    });

    return { component, replayer };
  };

  it('rebuilds historical events before following the live session', () => {
    const { component, replayer } = buildComponent();
    spyOn(Date, 'now').and.returnValue(20_000);

    component.toggleReplayPlayback();

    expect(replayer.play).toHaveBeenCalledOnceWith(10_000);
    expect(component.replayPlaying).toBeTrue();
  });

  it('seeks to the present using replay time instead of rrweb startLive', () => {
    const { component, replayer } = buildComponent();
    spyOn(Date, 'now').and.returnValue(25_000);

    component.goToLive();

    expect(replayer.play).toHaveBeenCalledOnceWith(15_000);
    expect(component.replayPlaying).toBeTrue();
  });

  it('pauses a live replay through the regular player state', () => {
    const { component, replayer } = buildComponent();
    component.replayPlaying = true;

    component.toggleReplayPlayback();

    expect(replayer.pause).toHaveBeenCalledTimes(1);
    expect(component.replayPlaying).toBeFalse();
  });

  it('identifies and labels a selected mobile session', () => {
    const { component } = buildComponent();
    Object.assign(component, {
      selectedReplaySessionId: 'mobile-session',
      replaySessions: [
        {
          session_id: 'mobile-session',
          platform: 'mobile',
          route: '/instalaciones',
          page_title: 'Instalaciones',
          first_event_at: '2026-08-26T12:00:00.000Z',
          last_event_at: '2026-08-26T12:05:00.000Z',
          event_count: 25,
          chunk_count: 2,
        },
      ],
    });

    expect(component.getReplayPlatform()).toBe('mobile');
    expect(component.formatReplaySession(component.replaySessions[0]))
      .toContain('Teléfono');
  });

  it('limits the selected time range to the bounds of its session', () => {
    const { component } = buildComponent();
    const session = {
      session_id: 'session-1',
      platform: 'desktop' as const,
      route: null,
      page_title: null,
      first_event_at: '2026-08-26T12:00:00.000Z',
      last_event_at: '2026-08-26T13:00:00.000Z',
      event_count: 25,
      chunk_count: 2,
    };
    Object.assign(component as any, {
      replaySessions: [session],
      selectedReplaySessionId: session.session_id,
      replayRangeStart: (component as any).toDateTimeLocalInput('2026-08-26T11:45:00Z'),
      replayRangeEnd: (component as any).toDateTimeLocalInput('2026-08-26T13:30:00Z'),
      replayActivities: [],
      allReplayActivities: [],
      allReplayConsoleLogs: [],
      messageService: { add: jasmine.createSpy('add') },
    });

    expect(component.applyReplayRange(false)).toBeTrue();
    expect((component as any).replayRangeStart).toBe(
      (component as any).toDateTimeLocalInput(session.first_event_at),
    );
    expect((component as any).replayRangeEnd).toBe(
      (component as any).toDateTimeLocalInput(session.last_event_at),
    );
  });

  it('keeps viewport metadata and adopted CSS with the checkpoint used for a history range', () => {
    const { component } = buildComponent();
    const start = Date.parse('2026-08-28T15:00:00Z');
    Object.assign(component, {
      replayMode: 'last_hour',
      replayRangeStart: new Date(start).toISOString(),
      replayRangeEnd: new Date(start + 10_000).toISOString(),
    });
    const events = [
      { type: 4, timestamp: start - 60_000, data: { width: 1024, height: 768 } },
      { type: 2, timestamp: start - 60_000 },
      { type: 4, timestamp: start - 1_000, data: { width: 390, height: 844 } },
      { type: 2, timestamp: start - 1_000 },
      { type: 3, timestamp: start - 990, data: { source: 15, styleIds: [1] } },
      { type: 3, timestamp: start + 3_000, data: { source: 0 } },
      { type: 3, timestamp: start + 12_000, data: { source: 0 } },
    ];
    expect((component as any).getEventsForSelectedRange(events)).toEqual(events.slice(2, 6));
    expect((component as any).replayRangePlaybackOffset).toBe(1_000);
  });

  it('does not alter live events or drop legacy snapshots that lack metadata', () => {
    const { component } = buildComponent();
    const start = Date.parse('2026-08-28T15:00:00Z');
    const events = [{ type: 2, timestamp: start - 1_000 }, { type: 3, timestamp: start + 1_000 }];
    expect((component as any).getEventsForSelectedRange(events)).toBe(events);
    Object.assign(component, {
      replayMode: 'last_hour', replayRangeStart: new Date(start).toISOString(), replayRangeEnd: new Date(start + 2_000).toISOString(),
    });
    expect((component as any).getEventsForSelectedRange(events)).toEqual(events);
  });
});
