import { Component, OnInit } from '@angular/core';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { PlansService } from '@core/services/plans.service';
import { ServersService } from '@core/services/servers.service';
import { Plan, CreatePlanDto, UpdatePlanDto, PlanPrice, PlanFeature, ApiPlanPrice, UIPlanPrice } from '@core/interfaces/plan.interface';
import { Server } from '@core/interfaces/server.interface';

@Component({
  selector: 'app-plans-settings',
  standalone: false,
  templateUrl: './plans-settings.component.html',
  styleUrl: './plans-settings.component.css'
})
export class PlansSettingsComponent implements OnInit {
  plans: Plan[] = [];
  servers: Server[] = [];
  selectedPlan: Plan | null = null;
  isEditing: boolean = false;
  loading: boolean = false;

  // Mapeado de valores numéricos a string para la UI
  periodMapping: Record<number, string> = {
    30: 'monthly',
    90: 'quarterly',
    365: 'yearly'
  };

  // Mapeado inverso para enviar al backend
  periodMappingReverse: Record<string, number> = {
    monthly: 30,
    quarterly: 90,
    yearly: 365
  };

  priceForm: UIPlanPrice = {
    id: '',
    amount: 0,
    payment_period: 'monthly'
  };

  featureForm: PlanFeature = {
    id: '',
    name: '',
    description: ''
  };

  planForm = {
    _id: '',
    plan_name: '',
    plan_description: '',
    server_id: '',
    prices: [] as UIPlanPrice[],
    plan_features: [] as PlanFeature[],
    recommended: false
  };

  availablePaymentPeriods = ['monthly', 'quarterly', 'yearly'];

  constructor(
    private plansService: PlansService,
    private serversService: ServersService,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.loadPlans();
    this.loadServers();
  }

  // Convertir el valor numérico del backend a string para la UI
  mapPeriodToString(period: number | string): string {
    if (typeof period === 'number') {
      return this.periodMapping[period] || 'monthly';
    }
    return period;
  }

  // Convertir valor string de la UI a número para el backend
  mapPeriodToNumber(period: string): number {
    return this.periodMappingReverse[period] || 30;
  }

  loadPlans() {
    this.loading = true;
    this.plansService.getAllPlans().subscribe({
      next: (plans: Plan[]) => {
        // Normalizar los períodos de pago para todos los planes cargados
        this.plans = plans.map(plan => {
          const validatedPrices = plan.prices.map(price => {
            return { 
              ...price, 
              payment_period: this.mapPeriodToString(price.payment_period)
            };
          }) as UIPlanPrice[];
          return { ...plan, prices: validatedPrices };
        });
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading plans:', error);
        this.showErrorMessage('error_loading');
        this.loading = false;
      }
    });
  }

  loadServers() {
    this.serversService.getAllServers().subscribe({
      next: (servers: Server[]) => {
        this.servers = servers;
      },
      error: (error) => {
        console.error('Error loading servers:', error);
      }
    });
  }

  onSubmit() {
    // Convertir los períodos de pago de string a números antes de enviar al backend
    const convertedPrices = this.planForm.prices.map(price => ({
      ...price,
      payment_period: this.mapPeriodToNumber(price.payment_period)
    })) as PlanPrice[];

    if (this.isEditing && this.planForm._id) {
      // Actualizar plan existente
      const updatePlanDto: UpdatePlanDto = {
        plan_name: this.planForm.plan_name,
        plan_description: this.planForm.plan_description,
        server_id: this.planForm.server_id,
        prices: convertedPrices,
        plan_features: this.planForm.plan_features,
        recommended: this.planForm.recommended
      };

      this.plansService.updatePlan(this.planForm._id, updatePlanDto).subscribe({
        next: (updatedPlan: Plan) => {
          // Convertir los períodos de pago recibidos a strings para la UI
          const uiPlan = {
            ...updatedPlan,
            prices: updatedPlan.prices.map(price => ({
              ...price,
              payment_period: this.mapPeriodToString(price.payment_period)
            })) as UIPlanPrice[]
          };
          
          const index = this.plans.findIndex(plan => plan._id === this.planForm._id);
          if (index !== -1) {
            this.plans[index] = uiPlan;
          }
          this.cancelEdit();
          this.showSuccessMessage('plan_updated', updatedPlan.plan_name);
        },
        error: (error) => {
          console.error('Error updating plan:', error);
          this.showErrorMessage('error_update');
        }
      });
    } else {
      // Crear nuevo plan
      const createPlanDto: CreatePlanDto = {
        plan_name: this.planForm.plan_name,
        plan_description: this.planForm.plan_description,
        server_id: this.planForm.server_id,
        prices: convertedPrices,
        plan_features: this.planForm.plan_features,
        recommended: this.planForm.recommended
      };

      this.plansService.createPlan(createPlanDto).subscribe({
        next: (createdPlan: Plan) => {
          // Convertir los períodos de pago recibidos a strings para la UI
          const uiPlan = {
            ...createdPlan,
            prices: createdPlan.prices.map(price => ({
              ...price,
              payment_period: this.mapPeriodToString(price.payment_period)
            })) as UIPlanPrice[]
          };
          
          this.plans.push(uiPlan);
          this.cancelEdit();
          this.showSuccessMessage('plan_created', createdPlan.plan_name);
        },
        error: (error) => {
          console.error('Error creating plan:', error);
          this.showErrorMessage('error_create');
        }
      });
    }
  }

  editPlan(plan: Plan) {
    this.selectedPlan = plan;
    // Asegurarse de que todos los períodos de pago se muestren correctamente
    const uiPrices = plan.prices.map(price => {
      return {
        ...price,
        payment_period: this.mapPeriodToString(price.payment_period)
      };
    }) as UIPlanPrice[];

    this.planForm = {
      _id: plan._id,
      plan_name: plan.plan_name,
      plan_description: plan.plan_description,
      server_id: plan.server_id,
      prices: [...uiPrices],
      plan_features: [...plan.plan_features],
      recommended: plan.recommended
    };
    this.isEditing = true;
  }

  deletePlan(plan: Plan) {
    const message = this.translate.instant('settings.plans.messages.confirm_delete').replace('{name}', plan.plan_name);
    this.confirmationService.confirm({
      message: message,
      header: this.translate.instant('settings.plans.messages.confirm_delete_header'),
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: this.translate.instant('settings.plans.messages.yes_delete'),
      rejectLabel: this.translate.instant('settings.plans.messages.no_cancel'),
      accept: () => {
        this.plansService.deletePlan(plan._id).subscribe({
          next: () => {
            const index = this.plans.findIndex(p => p._id === plan._id);
            if (index !== -1) {
              this.plans.splice(index, 1);
            }
            this.showSuccessMessage('plan_deleted', plan.plan_name);
          },
          error: (error) => {
            console.error('Error deleting plan:', error);
            this.showErrorMessage('error_delete');
          }
        });
      }
    });
  }

  addPrice() {
    if (this.priceForm.amount > 0) {
      // Generar un ID único para el precio
      this.priceForm.id = 'price_' + new Date().getTime();
      this.planForm.prices.push({...this.priceForm});
      this.priceForm = {
        id: '',
        amount: 0,
        payment_period: 'monthly'
      };
    } else {
      this.showErrorMessage('invalid_price');
    }
  }

  removePrice(index: number) {
    this.planForm.prices.splice(index, 1);
  }

  addFeature() {
    if (this.featureForm.name.trim()) {
      // Generar un ID único para la característica
      this.featureForm.id = 'feature_' + new Date().getTime();
      this.planForm.plan_features.push({...this.featureForm});
      this.featureForm = {
        id: '',
        name: '',
        description: ''
      };
    } else {
      this.showErrorMessage('invalid_feature');
    }
  }

  removeFeature(index: number) {
    this.planForm.plan_features.splice(index, 1);
  }

  cancelEdit() {
    this.selectedPlan = null;
    this.isEditing = false;
    this.planForm = {
      _id: '',
      plan_name: '',
      plan_description: '',
      server_id: '',
      prices: [],
      plan_features: [],
      recommended: false
    };
    this.resetFeatureForm();
    this.resetPriceForm();
  }

  resetFeatureForm() {
    this.featureForm = {
      id: '',
      name: '',
      description: ''
    };
  }

  resetPriceForm() {
    this.priceForm = {
      id: '',
      amount: 0,
      payment_period: 'monthly'
    };
  }

  getServerName(serverId: string): string {
    const server = this.servers.find(s => s._id === serverId);
    return server ? server.name : 'Unknown Server';
  }

  getPaymentPeriodLabel(period: string): string {
    return this.translate.instant(`settings.plans.${period}`);
  }

  private showSuccessMessage(key: string, name: string) {
    const summary = this.translate.instant(`settings.plans.messages.${key}`);
    const detail = this.translate.instant(`settings.plans.messages.${key}_detail`).replace('{name}', name);
    
    this.messageService.add({
      severity: 'success',
      summary: summary,
      detail: detail
    });
  }

  private showErrorMessage(key: string) {
    this.messageService.add({
      severity: 'error',
      summary: this.translate.instant('settings.plans.messages.error'),
      detail: this.translate.instant(`settings.plans.messages.${key}`)
    });
  }
}
