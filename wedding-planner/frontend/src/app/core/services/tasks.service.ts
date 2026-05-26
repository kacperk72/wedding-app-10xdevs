import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, tap } from 'rxjs';
import { apiUrl } from '../http/api-url';

export type TaskCategory = 'stroj' | 'kontrahent' | 'goscie' | 'formalnosci' | 'inne';

export interface Task {
  id: string;
  weddingId: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  dueDate: string;
  done: boolean;
  doneAt: string | null;
}

export interface CreateTaskDto {
  title: string;
  category: TaskCategory;
  dueDate: string;
  description?: string | null;
}

export type UpdateTaskDto = Partial<CreateTaskDto> & {
  done?: boolean;
};

const MS_PER_DAY = 86_400_000;

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly http = inject(HttpClient);

  private readonly _tasks = signal<Task[]>([]);
  readonly tasks = this._tasks.asReadonly();

  readonly overdueTasks = computed(() =>
    this.activeTasks().filter((task) => this.daysFromToday(task.dueDate) < 0),
  );

  readonly thisWeekTasks = computed(() =>
    this.activeTasks().filter((task) => {
      const days = this.daysFromToday(task.dueDate);
      return days >= 0 && days <= 7;
    }),
  );

  readonly futureTasks = computed(() =>
    this.activeTasks().filter((task) => this.daysFromToday(task.dueDate) > 7),
  );

  readonly completedTasks = computed(() =>
    this._tasks()
      .filter((task) => task.done)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  );

  loadTasks(weddingId: string): Observable<Task[]> {
    return forkJoin([
      this.http.get<Task[]>(apiUrl(`/weddings/${weddingId}/tasks`)),
      this.http.get<Task[]>(apiUrl(`/weddings/${weddingId}/tasks?done=true`)),
    ]).pipe(
      map(([active, completed]) => this.sortTasks([...active, ...completed])),
      tap((tasks) => this._tasks.set(tasks)),
    );
  }

  createTask(weddingId: string, dto: CreateTaskDto): Observable<Task> {
    return this.http.post<Task>(apiUrl(`/weddings/${weddingId}/tasks`), dto).pipe(
      tap((created) => {
        this._tasks.update((tasks) => this.sortTasks([...tasks, created]));
      }),
    );
  }

  updateTask(weddingId: string, id: string, patch: UpdateTaskDto): Observable<Task> {
    return this.http.patch<Task>(apiUrl(`/weddings/${weddingId}/tasks/${id}`), patch).pipe(
      tap((updated) => {
        this._tasks.update((tasks) => this.sortTasks(tasks.map((task) => (task.id === id ? updated : task))));
      }),
    );
  }

  removeTask(weddingId: string, id: string): Observable<void> {
    return this.http.delete<void>(apiUrl(`/weddings/${weddingId}/tasks/${id}`)).pipe(
      tap(() => {
        this._tasks.update((tasks) => tasks.filter((task) => task.id !== id));
      }),
    );
  }

  private activeTasks(): Task[] {
    return this._tasks()
      .filter((task) => !task.done)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }

  private daysFromToday(input: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${input}T00:00:00`);
    due.setHours(0, 0, 0, 0);
    return Math.floor((due.getTime() - today.getTime()) / MS_PER_DAY);
  }

  private sortTasks(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }
}
