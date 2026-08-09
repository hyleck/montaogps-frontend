import { TestBed } from '@angular/core/testing';
import { DialogOverlayCleanupService } from './dialog-overlay-cleanup.service';

describe('DialogOverlayCleanupService', () => {
  let service: DialogOverlayCleanupService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DialogOverlayCleanupService);
    document.querySelectorAll('.p-dialog-mask').forEach(mask => mask.remove());
    document.body.classList.remove('p-overflow-hidden');
  });

  afterEach(() => {
    service.ngOnDestroy();
    document.querySelectorAll('.p-dialog-mask').forEach(mask => mask.remove());
    document.body.classList.remove('p-overflow-hidden');
  });

  it('removes an orphaned mask and restores body interaction', () => {
    const mask = document.createElement('div');
    mask.className = 'p-dialog-mask';
    document.body.appendChild(mask);
    document.body.classList.add('p-overflow-hidden');

    service.cleanupNow();

    expect(document.body.contains(mask)).toBeFalse();
    expect(document.body.classList.contains('p-overflow-hidden')).toBeFalse();
  });

  it('never removes a mask that still contains an active dialog', () => {
    const mask = document.createElement('div');
    mask.className = 'p-dialog-mask';
    const dialog = document.createElement('div');
    dialog.className = 'p-dialog';
    mask.appendChild(dialog);
    document.body.appendChild(mask);
    document.body.classList.add('p-overflow-hidden');

    service.cleanupNow();

    expect(document.body.contains(mask)).toBeTrue();
    expect(document.body.classList.contains('p-overflow-hidden')).toBeTrue();
  });

  it('observes and clears masks left empty after a modal closes', async () => {
    service.start();
    const mask = document.createElement('div');
    mask.className = 'p-dialog-mask';
    const dialog = document.createElement('div');
    dialog.className = 'p-dialog';
    mask.appendChild(dialog);
    document.body.appendChild(mask);
    document.body.classList.add('p-overflow-hidden');

    dialog.remove();
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(document.body.contains(mask)).toBeFalse();
    expect(document.body.classList.contains('p-overflow-hidden')).toBeFalse();
  });
});
