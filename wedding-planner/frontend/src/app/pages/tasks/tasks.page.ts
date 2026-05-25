import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CreateTaskDto,
  Task,
  TaskCategory,
  TasksService,
} from '../../core/services/tasks.service';
import { ToastService } from '../../core/services/toast.service';
import { WeddingService } from '../../core/services/wedding.service';
import { formatDDMMYYYY } from '../../core/format/date.format';
import { Icon } from '../../shared/ui/icon/icon';
import { PageHeader } from '../../shared/ui/page-header/page-header';

type TaskSectionId = 'overdue' | 'thisWeek' | 'future' | 'completed';

interface TaskSection {
  id: TaskSectionId;
  title: string;
  tone: string;
  countClass: string;
  emptyText: string;
  tasks: Task[];
}

const CATEGORY_LABELS: Record<TaskCategory, string> = {
  stroj: 'Strój',
  kontrahent: 'Kontrahent',
  goscie: 'Goście',
  formalnosci: 'Formalności',
  inne: 'Inne',
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value: value as TaskCategory,
  label,
}));

@Component({
  selector: 'app-tasks-page',
  imports: [FormsModule, Icon, PageHeader],
  templateUrl: './tasks.page.html',
  styleUrl: './tasks.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPage implements OnInit {
  private readonly tasksService = inject(TasksService);
  private readonly weddingService = inject(WeddingService);
  private readonly toast = inject(ToastService);

  protected readonly categoryOptions = CATEGORY_OPTIONS;
  protected readonly isAddDialogOpen = signal(false);
  protected readonly collapsedSections = signal<Record<TaskSectionId, boolean>>({
    overdue: false,
    thisWeek: false,
    future: false,
    completed: true,
  });
  protected readonly newTask = signal<CreateTaskDto>({
    title: '',
    category: 'inne',
    dueDate: '',
    description: '',
  });

  protected readonly sections = computed<TaskSection[]>(() => [
    {
      id: 'overdue',
      title: 'Opóźnione',
      tone: 'kanban-section--danger',
      countClass: 'badge--danger',
      emptyText: 'Nie ma opóźnionych spraw.',
      tasks: this.tasksService.overdueTasks(),
    },
    {
      id: 'thisWeek',
      title: 'W tym tygodniu',
      tone: 'kanban-section--warning',
      countClass: 'badge--warning',
      emptyText: 'Nic na ten tydzień - pora odetchnąć.',
      tasks: this.tasksService.thisWeekTasks(),
    },
    {
      id: 'future',
      title: 'W przyszłości',
      tone: 'kanban-section--future',
      countClass: 'badge--info',
      emptyText: 'Brak przyszłych zadań.',
      tasks: this.tasksService.futureTasks(),
    },
    {
      id: 'completed',
      title: 'Zrobione',
      tone: 'kanban-section--done',
      countClass: 'badge--success',
      emptyText: 'Jeszcze nic nie jest odhaczone.',
      tasks: this.tasksService.completedTasks(),
    },
  ]);

  ngOnInit(): void {
    const weddingId = this.weddingService.wedding()?.id;
    if (weddingId) {
      this.loadTasks(weddingId);
      return;
    }

    this.weddingService.loadCurrent().subscribe({
      next: (wedding) => {
        if (wedding) {
          this.loadTasks(wedding.id);
          return;
        }
        this.toast.error('Najpierw skonfiguruj wesele.');
      },
      error: () => this.toast.error('Nie udało się pobrać wesela.'),
    });
  }

  protected toggleSection(id: TaskSectionId): void {
    this.collapsedSections.update((sections) => ({ ...sections, [id]: !sections[id] }));
  }

  protected isCollapsed(id: TaskSectionId): boolean {
    return this.collapsedSections()[id];
  }

  protected updateNewTask(patch: Partial<CreateTaskDto>): void {
    this.newTask.update((current) => ({ ...current, ...patch }));
  }

  protected setNewTaskCategory(value: string): void {
    this.updateNewTask({ category: this.isTaskCategory(value) ? value : 'inne' });
  }

  protected addTask(): void {
    const weddingId = this.requireWeddingId();
    const form = this.newTask();
    const title = form.title.trim();
    if (!weddingId || !title || !form.dueDate) return;

    this.tasksService
      .createTask(weddingId, {
        title,
        category: form.category,
        dueDate: form.dueDate,
        description: form.description?.trim() || null,
      })
      .subscribe({
        next: () => {
          this.newTask.set({ title: '', category: 'inne', dueDate: '', description: '' });
          this.isAddDialogOpen.set(false);
          this.toast.success('Zadanie zostało dodane.');
        },
        error: () => this.toast.error('Nie udało się dodać zadania.'),
      });
  }

  protected toggleDone(task: Task, done: boolean): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;

    this.tasksService.updateTask(weddingId, task.id, { done }).subscribe({
      error: () => this.toast.error('Nie udało się zapisać zadania.'),
    });
  }

  protected removeTask(task: Task): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;

    const message = task.isAuto
      ? 'Usunąć automatyczne zadanie? Wróci po kliknięciu „Regeneruj auto”.'
      : 'Usunąć to zadanie?';
    if (!window.confirm(message)) return;

    this.tasksService.removeTask(weddingId, task.id).subscribe({
      next: () => this.toast.success('Zadanie zostało usunięte.'),
      error: () => this.toast.error('Nie udało się usunąć zadania.'),
    });
  }

  protected regenerateAuto(): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    if (!window.confirm('Dosiać brakujące zadania automatyczne z szablonów?')) return;

    this.tasksService.regenerateAuto(weddingId).subscribe({
      next: (result) => this.toast.success(`Dodano ${result.created} brakujących zadań.`),
      error: () => this.toast.error('Nie udało się zregenerować zadań.'),
    });
  }

  protected categoryLabel(category: TaskCategory): string {
    return CATEGORY_LABELS[category];
  }

  protected categoryClass(category: TaskCategory): string {
    return {
      stroj: 'badge--info',
      kontrahent: 'badge--warning',
      goscie: 'badge--success',
      formalnosci: 'badge--danger',
      inne: 'badge--neutral',
    }[category];
  }

  protected formatDate(value: string): string {
    return formatDDMMYYYY(value);
  }

  private loadTasks(weddingId: string): void {
    this.tasksService.loadTasks(weddingId).subscribe({
      error: () => this.toast.error('Nie udało się pobrać zadań.'),
    });
  }

  private requireWeddingId(): string | null {
    const id = this.weddingService.wedding()?.id ?? null;
    if (!id) this.toast.error('Najpierw skonfiguruj wesele.');
    return id;
  }

  private isTaskCategory(value: string): value is TaskCategory {
    return value in CATEGORY_LABELS;
  }
}
