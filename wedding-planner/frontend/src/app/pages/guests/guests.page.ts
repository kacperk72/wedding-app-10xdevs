import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { Icon } from '../../shared/ui/icon/icon';

type RsvpStatus = 'confirmed' | 'pending' | 'declined';
type Diet = 'pending' | 'standard' | 'vege' | 'vegan' | 'gluten_free';

interface Guest {
  id: number;
  name: string;
  relation: string;
  rsvp: RsvpStatus;
  diet: Diet;
  table: string;
}

interface GroupedGuests {
  relation: string;
  guests: Guest[];
}

interface NewGuestForm {
  firstName: string;
  lastName: string;
  relation: string;
  diet: Diet;
}

@Component({
  selector: 'app-guests-page',
  imports: [FormsModule, Icon, PageHeader],
  templateUrl: './guests.page.html',
  styleUrl: './guests.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestsPage {
  protected readonly relations = [
    'Rodzina Panny Młodej',
    'Rodzina Pana Młodego',
    'Znajomi',
    'Praca',
  ];

  protected readonly dietOptions: { value: Diet; label: string }[] = [
    { value: 'pending', label: 'nie wybrano' },
    { value: 'standard', label: 'standard' },
    { value: 'vege', label: 'wege' },
    { value: 'vegan', label: 'wegan' },
    { value: 'gluten_free', label: 'bez glutenu' },
  ];

  protected readonly rsvpOptions: { value: RsvpStatus; label: string }[] = [
    { value: 'confirmed', label: 'potwierdzony' },
    { value: 'pending', label: 'oczekuje' },
    { value: 'declined', label: 'odmowa' },
  ];

  protected readonly query = signal('');
  protected readonly rsvpFilter = signal<RsvpStatus | 'all'>('all');
  protected readonly dietFilter = signal<Diet | 'all'>('all');
  protected readonly relationFilter = signal<string>('all');
  protected readonly isAddDialogOpen = signal(false);
  protected readonly newGuest = signal<NewGuestForm>({
    firstName: '',
    lastName: '',
    relation: this.relations[0],
    diet: 'standard',
  });

  private readonly guests = signal<Guest[]>([
    {
      id: 1,
      name: 'Anna Kowalska',
      relation: 'Rodzina Panny Młodej',
      rsvp: 'confirmed',
      diet: 'vege',
      table: 'Stół 1',
    },
    {
      id: 2,
      name: 'Marek Kowalski',
      relation: 'Rodzina Panny Młodej',
      rsvp: 'pending',
      diet: 'standard',
      table: '—',
    },
    {
      id: 3,
      name: 'Zofia Zielińska',
      relation: 'Rodzina Panny Młodej',
      rsvp: 'confirmed',
      diet: 'gluten_free',
      table: 'Stół 2',
    },
    {
      id: 4,
      name: 'Piotr Nowak',
      relation: 'Rodzina Pana Młodego',
      rsvp: 'confirmed',
      diet: 'standard',
      table: 'Stół 3',
    },
    {
      id: 5,
      name: 'Maja Nowak',
      relation: 'Rodzina Pana Młodego',
      rsvp: 'declined',
      diet: 'pending',
      table: '—',
    },
    {
      id: 6,
      name: 'Julia Wójcik',
      relation: 'Znajomi',
      rsvp: 'pending',
      diet: 'vegan',
      table: '—',
    },
    {
      id: 7,
      name: 'Adam Lis',
      relation: 'Znajomi',
      rsvp: 'confirmed',
      diet: 'standard',
      table: 'Stół 4',
    },
  ]);

  protected readonly aggregates = computed(() => {
    const guests = this.guests();
    return [
      ['Zaproszonych', guests.length.toString()],
      ['Potwierdzonych', guests.filter((guest) => guest.rsvp === 'confirmed').length.toString()],
      ['Oczekuje', guests.filter((guest) => guest.rsvp === 'pending').length.toString()],
      ['Odmów', guests.filter((guest) => guest.rsvp === 'declined').length.toString()],
      [
        'Wege',
        guests.filter((guest) => guest.diet === 'vege' || guest.diet === 'vegan').length.toString(),
      ],
      ['Dzieci', '1'],
      ['Bez dania', guests.filter((guest) => guest.diet === 'pending').length.toString()],
    ];
  });

  protected readonly filteredGroups = computed<GroupedGuests[]>(() => {
    const query = this.query().trim().toLowerCase();
    const rsvp = this.rsvpFilter();
    const diet = this.dietFilter();
    const relation = this.relationFilter();

    const filtered = this.guests().filter((guest) => {
      const matchesQuery = !query || guest.name.toLowerCase().includes(query);
      const matchesRsvp = rsvp === 'all' || guest.rsvp === rsvp;
      const matchesDiet = diet === 'all' || guest.diet === diet;
      const matchesRelation = relation === 'all' || guest.relation === relation;
      return matchesQuery && matchesRsvp && matchesDiet && matchesRelation;
    });

    return this.relations
      .map((groupRelation) => ({
        relation: groupRelation,
        guests: filtered.filter((guest) => guest.relation === groupRelation),
      }))
      .filter((group) => group.guests.length > 0);
  });

  protected updateNewGuest(patch: Partial<NewGuestForm>): void {
    this.newGuest.update((current) => ({ ...current, ...patch }));
  }

  protected setQuery(value: string): void {
    this.query.set(value);
  }

  protected setRsvpFilter(value: string): void {
    this.rsvpFilter.set(this.isRsvpStatus(value) ? value : 'all');
  }

  protected setDietFilter(value: string): void {
    this.dietFilter.set(this.isDiet(value) ? value : 'all');
  }

  protected setRelationFilter(value: string): void {
    this.relationFilter.set(this.relations.includes(value) ? value : 'all');
  }

  protected setNewGuestRelation(value: string): void {
    this.updateNewGuest({ relation: this.relations.includes(value) ? value : this.relations[0] });
  }

  protected setNewGuestDiet(value: string): void {
    this.updateNewGuest({ diet: this.isDiet(value) ? value : 'standard' });
  }

  protected addGuest(): void {
    const form = this.newGuest();
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    if (!firstName || !lastName) return;

    this.guests.update((guests) => [
      ...guests,
      {
        id: Date.now(),
        name: `${firstName} ${lastName}`,
        relation: form.relation,
        rsvp: 'pending',
        diet: form.diet,
        table: '—',
      },
    ]);
    this.newGuest.set({
      firstName: '',
      lastName: '',
      relation: this.relations[0],
      diet: 'standard',
    });
    this.isAddDialogOpen.set(false);
  }

  protected rsvpLabel(status: RsvpStatus): string {
    return {
      confirmed: 'potwierdzony',
      pending: 'oczekuje',
      declined: 'odmowa',
    }[status];
  }

  protected rsvpClass(status: RsvpStatus): string {
    return {
      confirmed: 'badge--success',
      pending: 'badge--warning',
      declined: 'badge--danger',
    }[status];
  }

  protected dietLabel(diet: Diet): string {
    return this.dietOptions.find((option) => option.value === diet)?.label ?? diet;
  }

  private isRsvpStatus(value: string): value is RsvpStatus {
    return value === 'confirmed' || value === 'pending' || value === 'declined';
  }

  private isDiet(value: string): value is Diet {
    return (
      value === 'pending' ||
      value === 'standard' ||
      value === 'vege' ||
      value === 'vegan' ||
      value === 'gluten_free'
    );
  }
}
