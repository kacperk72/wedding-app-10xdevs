import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CateringCourse, CreateDishDto, LinkedDish } from '../../../../core/models/catering.model';
import { DishCard } from '../dish-card/dish-card';

@Component({
  selector: 'app-course-section',
  imports: [DishCard, FormsModule],
  templateUrl: './course-section.html',
  styleUrl: './course-section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseSection {
  readonly course = input.required<CateringCourse>();
  readonly packageModifiable = input.required<boolean>();
  readonly pickedDishIds = input.required<Set<string>>();
  readonly pickChanged = output<{ course: CateringCourse; dish: LinkedDish; selected: boolean }>();
  readonly customDish = output<{ course: CateringCourse; dto: CreateDishDto }>();

  protected readonly formOpen = signal(false);
  protected readonly customName = signal('');
  protected readonly customDescription = signal('');
  protected readonly customVegetarian = signal(true);
  protected readonly customVegan = signal(false);
  protected readonly customGlutenFree = signal(false);

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

  protected submitCustomDish(): void {
    const name = this.customName().trim();
    if (!name) return;
    this.customDish.emit({
      course: this.course(),
      dto: {
        name,
        description: this.customDescription().trim() || null,
        isVegetarian: this.customVegetarian(),
        isVegan: this.customVegan(),
        isGlutenFree: this.customGlutenFree(),
        allergens: [],
      },
    });
    this.customName.set('');
    this.customDescription.set('');
    this.customVegetarian.set(true);
    this.customVegan.set(false);
    this.customGlutenFree.set(false);
    this.formOpen.set(false);
  }
}
