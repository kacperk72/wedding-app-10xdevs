import { ChangeDetectionStrategy, Component, OnInit, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreateDishDto, LinkedDish } from '../../../../core/models/catering.model';

@Component({
  selector: 'app-dish-editor-dialog',
  imports: [FormsModule],
  templateUrl: './dish-editor-dialog.html',
  styleUrl: './dish-editor-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DishEditorDialog implements OnInit {
  readonly dish = input<LinkedDish | null>(null);
  readonly courseTitle = input<string>('');
  readonly saved = output<CreateDishDto>();
  readonly closed = output<void>();

  protected readonly name = signal('');
  protected readonly description = signal('');
  protected readonly isVegetarian = signal(false);
  protected readonly isVegan = signal(false);
  protected readonly isGlutenFree = signal(false);
  protected readonly allergensText = signal('');

  protected readonly isEdit = computed(() => this.dish() !== null);

  ngOnInit(): void {
    const dish = this.dish();
    if (!dish) return;
    this.name.set(dish.name);
    this.description.set(dish.description ?? '');
    this.isVegetarian.set(dish.isVegetarian);
    this.isVegan.set(dish.isVegan);
    this.isGlutenFree.set(dish.isGlutenFree);
    this.allergensText.set(dish.allergens.join(', '));
  }

  protected submit(): void {
    const name = this.name().trim();
    if (!name) return;
    const allergens = this.allergensText()
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    this.saved.emit({
      name,
      description: this.description().trim() || null,
      isVegetarian: this.isVegetarian(),
      isVegan: this.isVegan(),
      isGlutenFree: this.isGlutenFree(),
      allergens,
    });
  }
}
