import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import { SupervisorsService } from '../supervisors.service';
import { SupervisorDetailData, SupervisorTab, supervisorApiToDetailData } from './supervisor-detail.model';
import { SvPersonalTab } from './tabs/personal-tab/personal-tab';
import { SvPilgrimsTab } from './tabs/pilgrims-tab/pilgrims-tab';
import { SvRatingsTab } from './tabs/ratings-tab/ratings-tab';

@Component({
  selector: 'app-supervisor-detail',
  imports: [TranslateModule, SvPersonalTab, SvPilgrimsTab, SvRatingsTab],
  templateUrl: './supervisor-detail.html',
  styleUrl: './supervisor-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupervisorDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(SupervisorsService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  activeTab = signal<SupervisorTab>('personal');
  loading = signal(true);
  supervisor = signal<SupervisorDetailData | null>(null);

  tabs: { key: SupervisorTab; labelKey: string; icon: string }[] = [
    { key: 'personal', labelKey: 'SUPERVISOR_DETAIL.TABS.PERSONAL', icon: 'pi pi-user' },
    { key: 'pilgrims', labelKey: 'SUPERVISOR_DETAIL.TABS.PILGRIMS', icon: 'pi pi-users' },
    { key: 'ratings', labelKey: 'SUPERVISOR_DETAIL.TABS.RATINGS', icon: 'pi pi-star' },
  ];

  constructor() {
    this.route.paramMap
      .pipe(
        map(params => params.get('id')),
        distinctUntilChanged(),
        tap(() => {
          this.loading.set(true);
          this.supervisor.set(null);
        }),
        switchMap(id => {
          if (!id) {
            return of(null);
          }

          return this.service.getSupervisorById(id).pipe(
            map(response => (response.IsSuccess ? supervisorApiToDetailData(response.Data) : null)),
            catchError(() => of(null)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(data => {
        this.supervisor.set(data);
        this.loading.set(false);
      });
  }

  goBack(): void {
    this.router.navigate(['/supervisors']);
  }

  openChat(userId: string, displayName?: string): void {
    this.router.navigate(['/chat'], { queryParams: { userId }, state: { displayName } });
  }
}
