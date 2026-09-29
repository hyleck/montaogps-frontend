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
});
