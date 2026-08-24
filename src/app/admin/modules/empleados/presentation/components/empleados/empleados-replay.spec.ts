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
});
