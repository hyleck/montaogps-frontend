import { Component, OnInit } from '@angular/core';
import { UserService } from '../../../../../../core/services/user.service';
import { MessageService } from 'primeng/api';
import { User } from '../../../../../../core/interfaces';
import { ProcessService } from '../../../../../../core/services/process.service';
import { PROCESS_TYPE_LABELS } from '../../../../processes/presentation/services/processes.service';

@Component({
  selector: 'app-empleados',
  templateUrl: './empleados.component.html',
  styleUrls: ['./empleados.component.css'],
  providers: [MessageService],
  standalone: false
})
export class EmpleadosComponent implements OnInit {

  empleados: User[] = [];
  loading: boolean = true;
  searchTerm: string = '';
  selectedEmpleado: User | null = null;
  displayModal: boolean = false;
  employeeStats: Map<string, any> = new Map();
  processTypeLabels = PROCESS_TYPE_LABELS;
  maxProcesses: number = 0;
  
  chartData: any;
  chartOptions: any;
  
  editingDepartment: boolean = false;
  tempDepartmentId: string = '';
  savingDepartment: boolean = false;

  departments: any[] = [
    { label: 'Administrativo', value: 'Administrativo' },
    { label: 'Cobros', value: 'Cobros' },
    { label: 'Gerencia', value: 'Gerencia' },
    { label: 'Operaciones', value: 'Operaciones' },
    { label: 'Recursos Humanos', value: 'RRHH' },
    { label: 'Soporte Técnico', value: 'Soporte' },
    { label: 'Técnicos (Instaladores)', value: 'Instaladores' },
    { label: 'Ventas', value: 'Ventas' }
  ];

  constructor(
    private userService: UserService,
    private messageService: MessageService,
    private processService: ProcessService
  ) { }

  ngOnInit(): void {
    this.loadEmpleados();
    this.loadStats();
    
    const documentStyle = getComputedStyle(document.documentElement);
    const textColor = documentStyle.getPropertyValue('--text-color') || '#495057';
    const textColorSecondary = documentStyle.getPropertyValue('--text-color-secondary') || '#6c757d';
    const surfaceBorder = documentStyle.getPropertyValue('--surface-border') || '#dfe7ef';

    this.chartOptions = {
        plugins: {
            legend: {
                display: false
            }
        },
        scales: {
            x: {
                ticks: {
                    color: textColorSecondary
                },
                grid: {
                    color: surfaceBorder,
                    drawBorder: false
                }
            },
            y: {
                beginAtZero: true,
                ticks: {
                    color: textColorSecondary,
                    stepSize: 1
                },
                grid: {
                    color: surfaceBorder,
                    drawBorder: false
                }
            }
        }
    };
  }

  loadStats(): void {
    this.processService.getStatsByCreator().subscribe({
      next: (res: any) => {
        if (res && res.statsByCreator) {
          let currentMax = 0;
          res.statsByCreator.forEach((stat: any) => {
            if (stat._id) {
              this.employeeStats.set(stat._id.toString(), stat);
              if (stat.totalProcesses > currentMax) {
                  currentMax = stat.totalProcesses;
              }
            }
          });
          this.maxProcesses = currentMax;
        }
      },
      error: (err) => {
        console.error('Error loading process stats', err);
      }
    });
  }

  loadEmpleados(): void {
    this.loading = true;
    this.userService.getEmployees().subscribe({
      next: (data) => {
        this.empleados = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar empleados:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudieron cargar los empleados' });
        this.loading = false;
      }
    });
  }

  get filteredEmpleados(): User[] {
    let result = this.empleados;
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(e => 
        (e.name && e.name.toLowerCase().includes(term)) ||
        (e.last_name && e.last_name.toLowerCase().includes(term)) ||
        (e.email && e.email.toLowerCase().includes(term)) ||
        (e.phone && e.phone.toString().includes(term))
      );
    }

    return [...result].sort((a, b) => {
      const perfA = this.getEmployeeProcessCount(a._id);
      const perfB = this.getEmployeeProcessCount(b._id);
      return perfB - perfA;
    });
  }

  showCurriculum(empleado: User): void {
    this.selectedEmpleado = empleado;
    this.editingDepartment = false;
    this.tempDepartmentId = empleado.department_id || '';
    this.displayModal = true;
    
    // Load timeline graph data
    this.chartData = null; // Clear previous
    this.processService.getTimelineByCreator(empleado._id).subscribe({
      next: (timeline: any[]) => {
          // Preparamos últimos 30 días, completando los días vacíos
          const labels: string[] = [];
          const data: number[] = [];
          
          const today = new Date();
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(today.getDate() - 30);
          
          let currentDate = new Date(thirtyDaysAgo);
          // Helper para normalizar la fecha
          const getFormattedDate = (date: Date) => {
             const y = date.getFullYear();
             const m = String(date.getMonth() + 1).padStart(2, '0');
             const d = String(date.getDate()).padStart(2, '0');
             return `${y}-${m}-${d}`;
          };
          
          // Llenamos el array de fechas (labels) y datos iniciales (0)
          while (currentDate <= today) {
             const dStr = getFormattedDate(currentDate);
             labels.push(dStr);
             
             // Buscamos si en la base de datos hay algo para esa fecha
             const found = (timeline || []).find(t => t._id === dStr);
             data.push(found ? found.count : 0);
             
             currentDate.setDate(currentDate.getDate() + 1);
          }
          
          // Formateamos para que la gráfica solo muestre Mes/Día (ej. 01/15)
          const shortLabels = labels.map(l => {
              const [, m, d] = l.split('-');
              return `${d}/${m}`;
          });

          this.chartData = {
              labels: shortLabels,
              datasets: [
                  {
                      label: 'Procesos completados',
                      data: data,
                      fill: true,
                      borderColor: '#105378', // Un azul corporativo
                      backgroundColor: 'rgba(16, 83, 120, 0.2)', // El mismo con transparencia
                      tension: 0.4
                  }
              ]
          };
      },
      error: (err) => console.error("Error al obtener grafico timeline", err)
    });
  }

  toggleEditDepartment(): void {
    if (!this.selectedEmpleado) return;
    this.editingDepartment = !this.editingDepartment;
    if (this.editingDepartment) {
      this.tempDepartmentId = this.selectedEmpleado.department_id || '';
    }
  }

  saveDepartment(): void {
    if (!this.selectedEmpleado) return;
    this.savingDepartment = true;
    this.userService.update(this.selectedEmpleado._id, { department_id: this.tempDepartmentId }).subscribe({
      next: (updatedUser: User) => {
        if (this.selectedEmpleado) {
          this.selectedEmpleado.department_id = this.tempDepartmentId;
        }

        // Encontrar y actualizar en la lista principal
        const index = this.empleados.findIndex(e => e._id === this.selectedEmpleado?._id);
        if (index !== -1) {
          this.empleados[index].department_id = this.tempDepartmentId;
        }

        this.editingDepartment = false;
        this.savingDepartment = false;
        this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Departamento asignado correctamente' });
      },
      error: (err) => {
        console.error('Error al actualizar el departamento:', err);
        this.savingDepartment = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'No se pudo actualizar el departamento' });
      }
    });
  }

  getEmployeeProcessCount(id: string): number {
    const stat = this.employeeStats.get(id);
    return stat ? stat.totalProcesses : 0;
  }

  getEmployeeProcessBreakdown(id: string): any[] {
    const stat = this.employeeStats.get(id);
    return stat ? stat.processesByType || [] : [];
  }

  getEmployeePerformance(id: string): number {
    if (this.maxProcesses === 0) return 0;
    const count = this.getEmployeeProcessCount(id);
    return Math.round((count / this.maxProcesses) * 100);
  }

}
