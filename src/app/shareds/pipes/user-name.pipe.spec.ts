import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { formatUserName } from 'src/app/core/utils/user-name.util';
import { UserNamePipe } from './user-name.pipe';

@Component({
  standalone: true,
  imports: [FormsModule, UserNamePipe],
  template: '<strong>{{ user.name | userName }}</strong><input [(ngModel)]="user.name">',
})
class UserNameHost {
  user = { name: 'JOSÉ ÁNGEL PÉREZ' };
}

describe('UserNamePipe', () => {
  it('formats uppercase, lowercase and mixed names, including accents and compound names', () => {
    expect(formatUserName('JOSÉ ÁNGEL NÚÑEZ')).toBe('José Ángel Núñez');
    expect(formatUserName('maría de la cruz')).toBe('María De La Cruz');
    expect(formatUserName("jean-pierre d’ávila o'NEILL")).toBe("Jean-Pierre D’Ávila O'Neill");
    expect(formatUserName('  fRaNkElY García  ')).toBe('Frankely García');
  });

  it('preserves email, account identifiers and phone fallbacks', () => {
    expect(formatUserName('Soporte.GPS@Montao.NET')).toBe('Soporte.GPS@Montao.NET');
    expect(formatUserName('MARÍA <User@Montao.NET>')).toBe('María <User@Montao.NET>');
    expect(formatUserName('507F1F77BCF86CD799439011')).toBe('507F1F77BCF86CD799439011');
    expect(formatUserName('+1 (809) 555-0100')).toBe('+1 (809) 555-0100');
    expect(formatUserName(null)).toBe('');
    expect(formatUserName(undefined)).toBe('');
  });

  it('formats the rendered label while retaining the original editable value', async () => {
    await TestBed.configureTestingModule({ imports: [UserNameHost] }).compileComponents();
    const fixture = TestBed.createComponent(UserNameHost);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('strong').textContent).toBe('José Ángel Pérez');
    expect(fixture.nativeElement.querySelector('input').value).toBe('JOSÉ ÁNGEL PÉREZ');
    expect(fixture.componentInstance.user.name).toBe('JOSÉ ÁNGEL PÉREZ');
  });
});
