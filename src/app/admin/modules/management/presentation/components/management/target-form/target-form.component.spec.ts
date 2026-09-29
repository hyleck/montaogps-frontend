import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SMOKE_IMPORTS, SMOKE_PROVIDERS, SMOKE_SCHEMAS } from 'src/testing/component-smoke.testing';
import { TargetFormModule } from './target-form.module';

import { TargetFormComponent } from './target-form.component';

describe('TargetFormComponent', () => {
  let component: TargetFormComponent;
  let fixture: ComponentFixture<TargetFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Se usa el módulo real: declara el componente con su directiva de etiquetas y sus componentes.
      imports: [TargetFormModule, ...SMOKE_IMPORTS],
      providers: SMOKE_PROVIDERS,
      schemas: SMOKE_SCHEMAS,
    })
    .compileComponents();

    fixture = TestBed.createComponent(TargetFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links GPS coordinates in the SMS terminal inside Management as well as its commands dialog', () => {
    component.showSmsSection = true;
    component.currentUserAffiliationTypeId = 'empleado';
    component.target.sim_company = 'global-m';
    component.activeTabIndex = 2;
    const reply = 'lat:18.4861 lon:-69.9312';
    component.smsMessages = [
      { type: 'received', content: reply, timestamp: new Date() },
      { type: 'sent', content: reply, timestamp: new Date() },
      { type: 'received', content: 'Sin señal GPS', timestamp: new Date() },
    ];
    fixture.detectChanges();
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('.terminal-body .chat-map-link');
    expect(links.length).toBe(1);
    expect(new URL(links[0].href).searchParams.get('query')).toBe('18.4861,-69.9312');
    expect(links[0].target).toBe('_blank');
    expect(links[0].rel).toBe('noopener noreferrer');
    expect(fixture.nativeElement.querySelector('.terminal-body .chat-text').textContent).toContain(reply);
    expect(component.smsMessages[0].content).toBe(reply);
  });

  it('renders only the process allowed by the Incosis renewal method and disables stale choices', () => {
    component.target._id = '507f1f77bcf86cd799439042';
    component.currentUserAffiliationTypeId = 'empleado'; component.activeTabIndex = 2;
    component.gpsRenewalMethod = 'cash'; fixture.detectChanges();
    const options = () => Array.from(fixture.nativeElement.querySelectorAll('#process_type option') as NodeListOf<HTMLOptionElement>).map(option => option.value);
    expect(options()).toContain('cash_renewal'); expect(options()).not.toContain('renewal');
    expect(fixture.nativeElement.textContent).toContain('Renovar ( Facturación al contado )');
    component.gpsRenewalMethod = 'credit'; component.processForm.type = 'cash_renewal'; fixture.detectChanges();
    expect(options()).toContain('renewal'); expect(options()).not.toContain('cash_renewal');
    expect((fixture.nativeElement.querySelector('.add-process-container button') as HTMLButtonElement).disabled).toBeTrue();
    component.gpsRenewalMethod = null; component.incosisClientProfileError = 'Método no disponible'; fixture.detectChanges();
    expect(options()).not.toContain('renewal'); expect(options()).not.toContain('cash_renewal');
    expect(fixture.nativeElement.textContent).toContain('Método no disponible');
    component.processForm.type = 'installation'; fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('.add-process-container button') as HTMLButtonElement).disabled).toBeFalse();
  });
});
