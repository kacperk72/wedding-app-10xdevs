import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  CateringAddon,
  CateringCourse,
  CateringDish,
  CateringPackage,
  CreateDishDto,
  FreezeContractDto,
  LinkedDish,
} from '../../core/models/catering.model';
import { CateringService } from '../../core/services/catering.service';
import { GuestsService } from '../../core/services/guests.service';
import { ToastService } from '../../core/services/toast.service';
import { VendorsService } from '../../core/services/vendors.service';
import { WeddingService } from '../../core/services/wedding.service';
import { formatPLN } from '../../core/format/currency.format';
import { Icon } from '../../shared/ui/icon/icon';
import { PageHeader } from '../../shared/ui/page-header/page-header';
import { AddonsList } from './components/addons-list/addons-list';
import { CourseSection } from './components/course-section/course-section';
import { FreezeContractDialog } from './components/freeze-contract-dialog/freeze-contract-dialog';
import { OfferEditor } from './components/offer-editor/offer-editor';
import { PackageTabs } from './components/package-tabs/package-tabs';
import { PriceSummary } from './components/price-summary/price-summary';

@Component({
  selector: 'app-catering-page',
  imports: [
    AddonsList,
    CourseSection,
    FreezeContractDialog,
    FormsModule,
    Icon,
    OfferEditor,
    PackageTabs,
    PageHeader,
    PriceSummary,
  ],
  templateUrl: './catering.page.html',
  styleUrl: './catering.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CateringPage implements OnInit {
  protected readonly catering = inject(CateringService);
  protected readonly vendors = inject(VendorsService);
  private readonly guests = inject(GuestsService);
  private readonly wedding = inject(WeddingService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly isOfferDialogOpen = signal(false);
  protected readonly isEditorOpen = signal(false);
  protected readonly isFreezeDialogOpen = signal(false);
  protected readonly newOfferName = signal('Pałac Polanka 2026');
  protected readonly selectedVendorId = signal<string | null>(null);

  protected readonly activeOffer = this.catering.activeOffer;
  protected readonly selection = this.catering.selection;
  protected readonly price = this.catering.priceBreakdown;

  protected readonly activePackage = computed<CateringPackage | null>(() => {
    const offer = this.activeOffer();
    if (!offer?.packages?.length) return null;
    const selectedPackageId = this.selection()?.packageId;
    return (
      offer.packages.find((pkg) => pkg.id === selectedPackageId) ??
      offer.packages.find((pkg) => this.isGoldPackage(pkg.name)) ??
      offer.packages[0]
    );
  });

  protected readonly pickedDishIds = computed(
    () => new Set((this.selection()?.dishPicks ?? []).map((pick) => pick.dishId)),
  );

  protected readonly guestCount = computed(() => this.selection()?.guestCountEstimate ?? 100);

  ngOnInit(): void {
    const weddingId = this.wedding.wedding()?.id;
    if (weddingId) {
      this.loadResources(weddingId);
      return;
    }

    this.wedding.loadCurrent().subscribe({
      next: (wedding) => {
        if (wedding) {
          this.loadResources(wedding.id);
          return;
        }
        this.toast.error('Najpierw skonfiguruj wesele.');
      },
      error: () => this.toast.error('Nie udało się pobrać wesela.'),
    });
  }

  protected createPresetOffer(): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.catering
      .createOffer(weddingId, {
        name: this.newOfferName().trim() || 'Pałac Polanka 2026',
        vendorId: this.selectedVendorId(),
        preset: 'palac-polanka-2026',
      })
      .subscribe({
        next: (offer) => {
          this.isOfferDialogOpen.set(false);
          this.catering.loadOffer(weddingId, offer.id).subscribe({
            next: (fullOffer) => {
              const gold = fullOffer.packages?.find((pkg) => this.isGoldPackage(pkg.name)) ?? fullOffer.packages?.[0];
              if (gold) this.selectPackage(gold, false);
            },
          });
          this.toast.success('Oferta Pałacu Polanka została załadowana.');
        },
        error: () => this.toast.error('Nie udało się załadować presetu.'),
      });
  }

  protected createEmptyOffer(): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.catering
      .createOffer(weddingId, {
        name: this.newOfferName().trim() || 'Nowa oferta',
        vendorId: this.selectedVendorId(),
      })
      .subscribe({
        next: () => {
          this.isOfferDialogOpen.set(false);
          this.toast.success('Oferta została dodana.');
        },
        error: () => this.toast.error('Nie udało się dodać oferty.'),
      });
  }

  protected configureOffer(offerId: string): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.catering.loadOffer(weddingId, offerId).subscribe({
      next: (offer) => {
        const selected = this.selection()?.packageId;
        const pkg =
          offer.packages?.find((item) => item.id === selected) ??
          offer.packages?.find((item) => this.isGoldPackage(item.name)) ??
          offer.packages?.[0];
        if (pkg) this.selectPackage(pkg, false);
      },
      error: () => this.toast.error('Nie udało się pobrać oferty.'),
    });
  }

  protected selectPackage(pkg: CateringPackage, ask = true): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    const current = this.selection();
    if (ask && current && current.packageId !== pkg.id) {
      const confirmed = window.confirm('Twoje wybory dla bieżącego pakietu zostaną usunięte. Kontynuować?');
      if (!confirmed) return;
    }
    this.catering
      .upsertSelection(weddingId, pkg.id, current?.guestCountEstimate ?? this.defaultGuestCount(), current?.notes)
      .subscribe({
        error: () => this.toast.error('Nie udało się zmienić pakietu.'),
      });
  }

  protected setGuestCount(value: string | number): void {
    const pkg = this.activePackage();
    const weddingId = this.requireWeddingId();
    if (!pkg || !weddingId) return;
    const count = Math.max(0, Math.round(Number(value) || 0));
    this.catering.upsertSelection(weddingId, pkg.id, count, this.selection()?.notes).subscribe({
      error: () => this.toast.error('Nie udało się zapisać liczby gości.'),
    });
  }

  protected onPickChanged(event: { course: CateringCourse; dish: LinkedDish; selected: boolean }): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;

    if (!event.selected) {
      this.catering.removeDishPick(weddingId, event.course.id, event.dish.dishId).subscribe({
        error: () => this.toast.error('Nie udało się usunąć wyboru.'),
      });
      return;
    }

    const existingInCourse = (this.selection()?.dishPicks ?? []).filter(
      (pick) => pick.courseId === event.course.id,
    );
    if (event.course.selectionMode === 'couple_picks' && event.course.choiceLimit === 1) {
      for (const pick of existingInCourse) {
        if (pick.dishId !== event.dish.dishId) {
          this.catering.removeDishPick(weddingId, event.course.id, pick.dishId).subscribe();
        }
      }
    }

    this.catering.addDishPick(weddingId, event.course.id, event.dish.dishId).subscribe({
      error: () => this.toast.warning('Limit wyboru dla tej sekcji został osiągnięty.'),
    });
  }

  protected onDishSaved(event: { course: CateringCourse; dish: LinkedDish | null; dto: CreateDishDto }): void {
    const weddingId = this.requireWeddingId();
    const offer = this.activeOffer();
    if (!weddingId || !offer) return;

    if (event.dish) {
      this.catering.updateDish(weddingId, offer.id, event.dish.dishId, event.dto).subscribe({
        next: () => this.toast.success('Danie zostało zaktualizowane.'),
        error: () => this.toast.error('Nie udało się zaktualizować dania.'),
      });
      return;
    }

    this.catering.createDish(weddingId, offer.id, event.dto).subscribe({
      next: (dish) => {
        this.catering.linkDishToCourse(weddingId, offer.id, event.course.id, dish.dishId).subscribe({
          next: () => this.toast.success('Własne danie zostało dodane do kursu.'),
          error: () => this.toast.error('Danie dodane, ale nie udało się podpiąć go do kursu.'),
        });
      },
      error: () => this.toast.error('Nie udało się dodać własnego dania.'),
    });
  }

  protected unlinkDish(event: { course: CateringCourse; dish: LinkedDish }): void {
    const weddingId = this.requireWeddingId();
    const offer = this.activeOffer();
    if (!weddingId || !offer) return;
    this.catering.unlinkDishFromCourse(weddingId, offer.id, event.course.id, event.dish.dishId).subscribe({
      next: () => this.toast.success('Danie usunięto z sekcji.'),
      error: () => this.toast.error('Nie udało się usunąć dania z sekcji.'),
    });
  }

  protected setAddon(addon: CateringAddon, quantity: number): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.catering.setAddonPick(weddingId, addon.id, Math.max(1, quantity)).subscribe({
      error: () => this.toast.error('Nie udało się zapisać dodatku.'),
    });
  }

  protected removeAddon(addon: CateringAddon): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.catering.removeAddonPick(weddingId, addon.id).subscribe({
      error: () => this.toast.error('Nie udało się usunąć dodatku.'),
    });
  }

  protected syncMealOptions(): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.catering.syncMealOptions(weddingId).subscribe({
      next: (result) => this.toast.success(`Utworzono ${result.created} opcji dań dla gości.`),
      error: () => this.toast.error('Nie udało się zsynchronizować RSVP.'),
    });
  }

  protected freezeContract(dto: FreezeContractDto): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;
    this.catering.freezeIntoContract(weddingId, dto).subscribe({
      next: () => {
        this.isFreezeDialogOpen.set(false);
        this.toast.success('Umowa została utworzona.');
        this.router.navigate(['/app/umowy']);
      },
      error: () => this.toast.error('Nie udało się utworzyć umowy.'),
    });
  }

  protected printSelection(): void {
    window.print();
  }

  protected coursePicks(courseId: string): { id: string; name: string }[] {
    const picks = this.selection()?.dishPicks ?? [];
    return picks.filter((pick) => pick.courseId === courseId).map((pick) => ({ id: pick.dishId, name: pick.dishName ?? '' }));
  }

  protected updatePackagePrice(event: { pkg: CateringPackage; pricePerPerson: number }): void {
    const weddingId = this.requireWeddingId();
    const offer = this.activeOffer();
    if (!weddingId || !offer) return;
    this.catering.updatePackage(weddingId, offer.id, event.pkg.id, { pricePerPerson: event.pricePerPerson }).subscribe({
      next: () => this.catering.loadPrice(weddingId).subscribe(),
      error: () => this.toast.error('Nie udało się zapisać ceny pakietu.'),
    });
  }

  protected updateAddonPrice(event: { addon: CateringAddon; price: number }): void {
    const weddingId = this.requireWeddingId();
    const offer = this.activeOffer();
    if (!weddingId || !offer) return;
    this.catering.updateAddon(weddingId, offer.id, event.addon.id, { price: event.price }).subscribe({
      next: () => this.catering.loadPrice(weddingId).subscribe(),
      error: () => this.toast.error('Nie udało się zapisać ceny dodatku.'),
    });
  }

  protected removeDish(dish: CateringDish): void {
    const weddingId = this.requireWeddingId();
    const offer = this.activeOffer();
    if (!weddingId || !offer) return;
    this.catering.deleteDish(weddingId, offer.id, dish.dishId).subscribe({
      error: () => this.toast.error('Nie udało się usunąć dania.'),
    });
  }

  protected money(value: number | null | undefined): string {
    return formatPLN(value ?? 0);
  }

  private loadResources(weddingId: string): void {
    forkJoin([
      this.catering.loadOffers(weddingId),
      this.catering.loadSelection(weddingId),
      this.vendors.list(weddingId),
      this.guests.loadAggregates(weddingId),
    ]).subscribe({
      next: ([offers, selection]) => {
        const offerId = offers[0]?.id;
        if (offerId && selection) {
          this.catering.loadOffer(weddingId, offerId).subscribe({
            next: (offer) => {
              const pkg = selection
                ? offer.packages?.find((item) => item.id === selection.packageId)
                : null;
              if (pkg) this.selectPackage(pkg, false);
            },
          });
        }
      },
      error: () => this.toast.error('Nie udało się pobrać danych cateringu.'),
    });
  }

  private defaultGuestCount(): number {
    return this.guests.aggregates().confirmed || 100;
  }

  private isGoldPackage(name: string): boolean {
    return name.localeCompare('Złoty', 'pl', { sensitivity: 'base' }) === 0;
  }

  private requireWeddingId(): string | null {
    const id = this.wedding.wedding()?.id ?? null;
    if (!id) this.toast.error('Najpierw skonfiguruj wesele.');
    return id;
  }
}
