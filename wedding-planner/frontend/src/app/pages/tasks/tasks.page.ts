import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { PageHeader } from '../../shared/ui/page-header/page-header';

interface TaskItem {
  id: number;
  title: string;
  due: string;
  category: string;
  auto: boolean;
  bucket: 'overdue' | 'thisWeek' | 'future';
  done: boolean;
}

@Component({
  selector: 'app-tasks-page',
  imports: [PageHeader],
  templateUrl: './tasks.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TasksPage {
  private readonly tasks = signal<TaskItem[]>([
    {
      id: 1,
      title: 'Potwierdzić repertuar z DJ-em',
      due: '20.05.2026',
      category: 'kontrahent',
      auto: true,
      bucket: 'overdue',
      done: false,
    },
    {
      id: 2,
      title: 'Zamknąć listę noclegów',
      due: '21.05.2026',
      category: 'goście',
      auto: false,
      bucket: 'overdue',
      done: false,
    },
    {
      id: 3,
      title: 'Wpłacić zaliczkę dla DJ-a',
      due: '28.05.2026',
      category: 'umowy',
      auto: true,
      bucket: 'thisWeek',
      done: false,
    },
    {
      id: 4,
      title: 'Wybrać dania główne w ofercie sali',
      due: '29.05.2026',
      category: 'catering',
      auto: false,
      bucket: 'thisWeek',
      done: false,
    },
    {
      id: 5,
      title: 'Przymiarka sukni',
      due: '10.06.2026',
      category: 'strój',
      auto: true,
      bucket: 'future',
      done: false,
    },
    {
      id: 6,
      title: 'Rozsadzenie gości przy stołach',
      due: '01.07.2026',
      category: 'goście',
      auto: true,
      bucket: 'future',
      done: false,
    },
  ]);

  protected readonly overdue = computed(() => this.activeTasks('overdue'));
  protected readonly thisWeek = computed(() => this.activeTasks('thisWeek'));
  protected readonly future = computed(() => this.activeTasks('future'));
  protected readonly completed = computed(() => this.tasks().filter((task) => task.done));

  protected toggleDone(id: number): void {
    this.tasks.update((tasks) =>
      tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
    );
  }

  private activeTasks(bucket: TaskItem['bucket']): TaskItem[] {
    return this.tasks().filter((task) => task.bucket === bucket && !task.done);
  }
}
