import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { DigitalOceanAccountBilling, DigitalOceanBillingData, DigitalOceanBillingHistoryEntry } from '@core/interfaces/server.interface';
import { ServersService } from '@core/services/servers.service';

@Component({
  selector: 'app-server-costs',
  templateUrl: './server-costs.component.html',
  styleUrls: ['./server-costs.component.css'],
  standalone: false
})
export class ServerCostsComponent implements OnInit {

  billingData: DigitalOceanBillingData | null = null;
  loading = false;
  errorKey: string | null = null;
  selectedAccount = 'all';
  accountSummaries: DigitalOceanAccountBilling[] = [];
  globalDueDate: Date | null = null;
  rowsPerPage = 10;
  rowsPerPageOptions = [10, 25, 50];
  showHistory = false;

  get resolvedAccountLabel(): string {
    const accountSlug = this.billingData?.account || this.selectedAccount;
    return this.translateAccountSlug(accountSlug);
  }

  readonly accountOptions = [
    { value: 'all', labelKey: 'serverCosts.accounts.all' },
    { value: 'montao-admin', labelKey: 'serverCosts.accounts.montaoAdmin' },
    { value: 'montao-cloud', labelKey: 'serverCosts.accounts.montaoCloud' },
    { value: 'traccar-servers', labelKey: 'serverCosts.accounts.traccarServers' }
  ];

  readonly trackByHistory = (_index: number, item: DigitalOceanBillingHistoryEntry): string =>
    `${item.account || 'single'}-${item.invoice_uuid ?? item.invoice_id ?? `${item.date}-${item.description}`}`;

  constructor(
    private readonly serversService: ServersService,
    private readonly translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.loadBillingData();
  }

  onAccountChange(value: string | null): void {
    if (!value) {
      return;
    }
    this.selectedAccount = value;
    this.loadBillingData();
  }

  loadBillingData(): void {
    this.loading = true;
    this.errorKey = null;
    this.accountSummaries = [];
    this.globalDueDate = null;
    this.showHistory = false;

    const accountParam =
      this.selectedAccount === 'montao-admin' ? undefined : this.selectedAccount;

    this.serversService.getDigitalOceanBilling(accountParam).subscribe({
      next: (data) => {
        this.billingData = data;
        this.globalDueDate = this.resolveDueDate(
          data.billingHistory?.billing_history ?? []
        );
        this.accountSummaries = (data.accounts ?? []).map((account) => ({
          ...account,
          dueDate: this.resolveDueDate(
            account.billingHistory?.billing_history ?? []
          )
        }));
        this.loading = false;
      },
      error: (error) => {
        console.error('Failed to load DigitalOcean billing data', error);
        this.errorKey = 'serverCosts.errors.loadFailed';
        this.loading = false;
      }
    });
  }

  toNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) {
      return 0;
    }

    const numericValue = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(numericValue) ? 0 : numericValue;
  }

  get showAccountColumn(): boolean {
    return (this.billingData?.account || this.selectedAccount) === 'all';
  }

  get showPaginator(): boolean {
    return this.showAccountColumn;
  }

  translateAccountSlug(slug: string | undefined | null): string {
    if (!slug) {
      return this.translate.instant('serverCosts.accounts.unknown');
    }

    const option = this.accountOptions.find((account) => account.value === slug);
    return option ? this.translate.instant(option.labelKey) : slug;
  }

  toggleHistory(): void {
    this.showHistory = !this.showHistory;
  }

  private resolveDueDate(
    entries: DigitalOceanBillingHistoryEntry[] | undefined | null
  ): Date | null {
    if (!entries?.length) {
      return null;
    }

    const invoiceEntry =
      entries.find(
        (entry) => entry.type?.toLowerCase() === 'invoice'
      ) || entries[0];

    if (!invoiceEntry?.date) {
      return null;
    }

    const dueDate = new Date(invoiceEntry.date);
    return isNaN(dueDate.getTime()) ? null : dueDate;
  }
}
