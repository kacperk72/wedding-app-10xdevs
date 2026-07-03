import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CateringCourse, CreateDishDto, LinkedDish } from '../../../../core/models/catering.model';
import { DishEditorDialog } from '../dish-editor-dialog/dish-editor-dialog';
import { DishRow } from '../dish-row/dish-row';

@Component({
  selector: 'app-course-section',
  imports: [DishRow, DishEditorDialog],
  templateUrl: './course-section.html',
  styleUrl: './course-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseSection {
  readonly course = input.required<CateringCourse>();
  readonly packageModifiable = input.required<boolean>();
  readonly pickedDishIds = input.required<Set<string>>();
  readonly pickChanged = output<{ course: CateringCourse; dish: LinkedDish; selected: boolean }>();
  readonly dishSaved = output<{ course: CateringCourse; dish: LinkedDish | null; dto: CreateDishDto }>();
  readonly dishUnlinked = output<{ course: CateringCourse; dish: LinkedDish }>();

  protected readonly editorOpen = signal(false);
  protected readonly editingDish = signal<LinkedDish | null>(null);

  protected readonly pickedCount = computed(
    () => this.course().dishes.filter((dish) => this.pickedDishIds().has(dish.dishId)).length,
  );

  protected readonly selectedName = computed(
    () => this.course().dishes.find((dish) => this.pickedDishIds().has(dish.dishId))?.name ?? null,
  );

  protected hint(course: CateringCourse): string {
    if (course.selectionMode === 'all_served') return 'Bez wyboru, podawane wszystkim';
    if (course.selectionMode === 'guest_picks') return `Opcje dla RSVP: ${this.pickedCount()} / ${course.choiceLimit}`;
    if (course.choiceLimit === 1) return 'Para wybiera 1 pozycję';
    return `Para wybiera ${this.pickedCount()} / ${course.choiceLimit}`;
  }

  protected controlType(course: CateringCourse): 'checkbox' | 'radio' | 'none' {
    if (course.selectionMode === 'all_served') return 'none';
    return course.selectionMode === 'couple_picks' && course.choiceLimit === 1 ? 'radio' : 'checkbox';
  }

  protected isDisabled(course: CateringCourse): boolean {
    return course.selectionMode === 'all_served' || !this.packageModifiable();
  }

  protected openAdd(): void {
    this.editingDish.set(null);
    this.editorOpen.set(true);
  }

  protected openEdit(dish: LinkedDish): void {
    this.editingDish.set(dish);
    this.editorOpen.set(true);
  }

  protected onSaved(dto: CreateDishDto): void {
    this.dishSaved.emit({ course: this.course(), dish: this.editingDish(), dto });
    this.editorOpen.set(false);
  }
}
