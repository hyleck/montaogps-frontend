import { PopupBuilder } from './map-popup.helper';

describe('Map popup device labels', () => {
  it('formats the initial popup title and vehicle type', () => {
    const html = PopupBuilder.buildPopupHtml({
      title: 'MTAG-A Toyota', vehicleType: 'MTAG-A', speedKmh: 0, status: 'online',
    });
    expect(html).toContain('MLock Toyota');
    expect(html).not.toContain('MTAG-A');
  });

  it('keeps the alias during live title updates without changing the source', () => {
    const popup = document.createElement('div');
    popup.innerHTML = '<div class="popup-title">MLock Toyota <span>(GPS)</span></div>';
    const updates = { title: 'MTAG-A Toyota negro' };
    PopupBuilder.updatePopupElementsDirectly(popup, updates);
    expect(popup.textContent).toBe('MLock Toyota negro(GPS)');
    expect(updates.title).toBe('MTAG-A Toyota negro');
  });
});
