import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { formatPLN } from '../../core/format/currency.format';
import {
  CreateVendorDto,
  VENDOR_CATEGORY_LABELS,
  VENDOR_STATUS_LABELS,
  Vendor,
  VendorCategory,
  VendorStatus,
} from '../../core/models/vendor.model';
import { ToastService } from '../../core/services/toast.service';
import { VendorsService } from '../../core/services/vendors.service';
import { WeddingService } from '../../core/services/wedding.service';
import { PageHeader } from '../../shared/ui/page-header/page-header';

const CATEGORIES = Object.keys(VENDOR_CATEGORY_LABELS) as VendorCategory[];
const STATUSES = Object.keys(VENDOR_STATUS_LABELS) as VendorStatus[];

@Component({
  selector: 'app-vendors-page',
  imports: [FormsModule, PageHeader],
  templateUrl: './vendors.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorsPage implements OnInit {
  protected readonly vendorsService = inject(VendorsService);
  private readonly wedding = inject(WeddingService);
  private readonly toast = inject(ToastService);

  protected readonly categoryOptions = CATEGORIES.map((value) => ({
    value,
    label: VENDOR_CATEGORY_LABELS[value],
  }));
  protected readonly statusOptions = STATUSES.map((value) => ({
    value,
    label: VENDOR_STATUS_LABELS[value],
  }));

  protected readonly newVendor = signal<CreateVendorDto>({
    category: 'dj',
    companyName: '',
    status: 'rozwazany',
  });
  protected readonly editingVendorId = signal<string | null>(null);
  protected readonly editingVendor = signal<CreateVendorDto>({
    category: 'dj',
    companyName: '',
    status: 'rozwazany',
  });

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
      error: () => this.toast.error('Nie udalo sie pobrac wesela.'),
    });
  }

  protected addVendor(): void {
    const weddingId = this.requireWeddingId();
    const dto = this.cleanVendorDto(this.newVendor());
    if (!weddingId || !dto.companyName) return;

    this.vendorsService.create(weddingId, dto).subscribe({
      next: () => {
        this.newVendor.set({ category: 'dj', companyName: '', status: 'rozwazany' });
        this.refreshMissing(weddingId);
        this.toast.success('Kontrahent zostal dodany.');
      },
      error: () => this.toast.error('Nie udalo sie dodac kontrahenta.'),
    });
  }

  protected startEdit(vendor: Vendor): void {
    this.editingVendorId.set(vendor.id);
    this.editingVendor.set({
      category: vendor.category,
      companyName: vendor.companyName,
      contactPerson: vendor.contactPerson,
      phone: vendor.phone,
      email: vendor.email,
      status: vendor.status,
      contractAmount: vendor.contractAmount,
      notes: vendor.notes,
    });
  }

  protected saveVendor(id: string): void {
    const weddingId = this.requireWeddingId();
    const dto = this.cleanVendorDto(this.editingVendor());
    if (!weddingId || !dto.companyName) return;

    this.vendorsService.update(weddingId, id, dto).subscribe({
      next: () => {
        this.editingVendorId.set(null);
        this.refreshMissing(weddingId);
        this.toast.success('Kontrahent zostal zapisany.');
      },
      error: () => this.toast.error('Nie udalo sie zapisac kontrahenta.'),
    });
  }

  protected removeVendor(id: string): void {
    const weddingId = this.requireWeddingId();
    if (!weddingId) return;

    this.vendorsService.remove(weddingId, id).subscribe({
      next: () => {
        this.refreshMissing(weddingId);
        this.toast.success('Kontrahent zostal usuniety.');
      },
      error: () => this.toast.error('Nie udalo sie usunac kontrahenta.'),
    });
  }

  protected updateNewVendor(patch: Partial<CreateVendorDto>): void {
    this.newVendor.update((current) => ({ ...current, ...patch }));
  }

  protected updateEditingVendor(patch: Partial<CreateVendorDto>): void {
    this.editingVendor.update((current) => ({ ...current, ...patch }));
  }

  protected categoryLabel(category: VendorCategory): string {
    return VENDOR_CATEGORY_LABELS[category];
  }

  protected statusLabel(status: VendorStatus): string {
    return VENDOR_STATUS_LABELS[status];
  }

  protected statusClass(status: VendorStatus): string {
    return {
      spotkanie: 'badge--warning',
      zarezerwowany: 'badge--success',
      zaplacony: 'badge--info',
      wykonany: 'badge--success',
      rozwazany: 'badge--neutral',
    }[status];
  }

  protected money(value: number | null): string {
    return formatPLN(value);
  }

  private loadResources(weddingId: string): void {
    forkJoin([this.vendorsService.list(weddingId), this.vendorsService.missing(weddingId)]).subscribe({
      error: () => this.toast.error('Nie udalo sie pobrac kontrahentow.'),
    });
  }

  private refreshMissing(weddingId: string): void {
    this.vendorsService.missing(weddingId).subscribe({
      error: () => this.toast.error('Nie udalo sie odswiezyc brakujacych kategorii.'),
    });
  }

  private requireWeddingId(): string | null {
    const id = this.wedding.wedding()?.id ?? null;
    if (!id) this.toast.error('Najpierw skonfiguruj wesele.');
    return id;
  }

  private cleanVendorDto(dto: CreateVendorDto): CreateVendorDto {
    return {
      ...dto,
      companyName: dto.companyName.trim(),
      contactPerson: dto.contactPerson?.trim() || null,
      phone: dto.phone?.trim() || null,
      email: dto.email?.trim() || null,
      notes: dto.notes?.trim() || null,
      contractAmount: dto.contractAmount ?? null,
    };
  }
}
