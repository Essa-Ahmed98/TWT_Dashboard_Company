import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { PilgrimDetailData } from '../../pilgrim-detail.model';

@Component({
  selector: 'app-personal-tab',
  imports: [],
  templateUrl: './personal-tab.html',
  styleUrl: './personal-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalTab {
  pilgrim      = input.required<PilgrimDetailData>();
  isEditing    = input<boolean>(false);
  editData     = input<PilgrimDetailData | null>(null);
  fieldChanged = output<Partial<PilgrimDetailData>>();

  patchEmergency(field: 'name' | 'phone', value: string): void {
    const current = this.editData();
    if (!current) return;
    this.fieldChanged.emit({
      emergencyContact: { ...current.emergencyContact, [field]: value },
    });
  }
}
