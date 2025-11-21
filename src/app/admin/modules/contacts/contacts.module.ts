import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PrimengModule } from '../../../shareds/libraries/primeng/primeng.module';
import { ContactsComponent } from './presentation/components/contacts/contacts.component';

@NgModule({
  declarations: [ContactsComponent],
  imports: [CommonModule, FormsModule, PrimengModule],
  exports: [ContactsComponent],
})
export class ContactsModule {}
