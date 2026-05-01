import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { finalize } from 'rxjs';
import { MessageService } from 'primeng/api';

import { BroadcastService } from './broadcast.service';
import { MessageType, TargetType } from './broadcast.model';
import { CampaignApiItem, GroupApiItem } from '../campaigns/campaigns.model';
import { ApiResult } from '../../core/models/api.models';
import { AuthService } from '../../core/auth/services/auth';
import { CampaignsService } from '../campaigns/campaigns.service';
import { environment } from '../../../environments/environment';

const API_ERRORS: Record<string, string> = {
  'This username is already taken.': 'ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ ط£ظˆ ط±ظ‚ظ… ط§ظ„ظ‡ط§طھظپ ظ…ط³طھط®ط¯ظ… ط¨ط§ظ„ظپط¹ظ„',
};

@Component({
  selector: 'app-broadcast',
  imports: [],
  templateUrl: './broadcast.html',
  styleUrl: './broadcast.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Broadcast implements OnInit, OnDestroy {
  private readonly service = inject(BroadcastService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly campaignsService = inject(CampaignsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly toast = inject(MessageService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly TargetType = TargetType;

  readonly targetOptions = [
    { type: TargetType.Company, label: 'الشركة', icon: 'pi-building' },
    { type: TargetType.Campaign, label: 'حملة', icon: 'pi-map' },
    { type: TargetType.Group, label: 'مجموعة', icon: 'pi-users' },
  ];

  selectedTargetType = signal<TargetType>(TargetType.Company);

  campList = signal<CampaignApiItem[]>([]);
  campLoading = signal(false);
  showCampDrop = signal(false);
  selectedCampId = signal('');
  selectedCampName = signal('');

  grpList = signal<GroupApiItem[]>([]);
  grpLoading = signal(false);
  showGrpDrop = signal(false);
  selectedGroupId = signal('');
  selectedGrpName = signal('');

  content = signal('');
  submitting = signal(false);
  uploadingMedia = signal(false);
  submitError = signal<string | null>(null);

  isRecording = signal(false);
  recordingSeconds = signal(0);
  recordingBlob = signal<Blob | null>(null);
  recordingPreviewUrl = signal<string | null>(null);

  imagePreviewFile = signal<File | null>(null);
  imagePreviewUrl = signal<string | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private recordingInterval: ReturnType<typeof setInterval> | null = null;
  private discardOnStop = false;

  readonly recordingLabel = computed(() => {
    const s = this.recordingSeconds();
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
  });

  readonly needsCampaign = computed(() =>
    this.selectedTargetType() === TargetType.Campaign ||
    this.selectedTargetType() === TargetType.Group
  );

  readonly needsGroup = computed(() =>
    this.selectedTargetType() === TargetType.Group
  );

  readonly audienceLabel = computed(() => {
    const type = this.selectedTargetType();
    if (type === TargetType.Company) return 'جميع مستخدمي الشركة';
    const camp = this.selectedCampName();
    const grp = this.selectedGrpName();
    if (!camp) return '';
    return grp ? `${camp} • ${grp}` : camp;
  });

  readonly canSend = computed(() => {
    const hasContent = !!this.imagePreviewFile() || !!this.recordingBlob() || this.content().trim().length > 0;
    if (!hasContent) return false;

    const type = this.selectedTargetType();
    if (type === TargetType.Company) return true;
    if (type === TargetType.Campaign) return !!this.selectedCampId();
    if (type === TargetType.Group) return !!this.selectedCampId() && !!this.selectedGroupId();
    return false;
  });

  ngOnInit(): void {
    this.fetchCampaigns();
  }

  ngOnDestroy(): void {
    this.discardOnStop = true;
    this.stopRecording();
    this.discardAudioPreview();
    this.discardImagePreview();
  }

  setTargetType(type: TargetType): void {
    this.selectedTargetType.set(type);
    this.closeAllDrops();

    if (type !== TargetType.Campaign && type !== TargetType.Group) {
      this.selectedCampId.set('');
      this.selectedCampName.set('');
      this.selectedGroupId.set('');
      this.selectedGrpName.set('');
    }

    if (type !== TargetType.Group) {
      this.selectedGroupId.set('');
      this.selectedGrpName.set('');
    }
  }

  private fetchCampaigns(): void {
    const companyId = this.auth.currentUser()?.companyId;
    if (!companyId) return;

    this.campLoading.set(true);
    this.campaignsService.getAllCampaigns(companyId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(data => {
        this.campList.set(data);
        this.campLoading.set(false);
      });
  }

  toggleCampDrop(): void {
    if (this.showCampDrop()) {
      this.showCampDrop.set(false);
      return;
    }

    this.showGrpDrop.set(false);
    this.showCampDrop.set(true);
  }

  selectCamp(c: CampaignApiItem): void {
    this.selectedCampId.set(c.Id);
    this.selectedCampName.set(c.Name);
    this.selectedGroupId.set('');
    this.selectedGrpName.set('');
    this.grpList.set([]);
    this.showCampDrop.set(false);
  }

  clearCamp(): void {
    this.selectedCampId.set('');
    this.selectedCampName.set('');
    this.selectedGroupId.set('');
    this.selectedGrpName.set('');
    this.grpList.set([]);
  }

  private fetchGroups(campaignId: string): void {
    this.grpLoading.set(true);
    this.http
      .get<ApiResult<GroupApiItem[]>>(`${environment.apiBase}/Groups/all/${campaignId}`)
      .pipe(finalize(() => this.grpLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe(res => {
        if (res.IsSuccess) this.grpList.set(res.Data);
      });
  }

  toggleGrpDrop(): void {
    if (!this.selectedCampId()) return;

    if (this.showGrpDrop()) {
      this.showGrpDrop.set(false);
      return;
    }

    this.showCampDrop.set(false);
    this.showGrpDrop.set(true);
    if (this.grpList().length === 0) this.fetchGroups(this.selectedCampId());
  }

  selectGrp(g: GroupApiItem): void {
    this.selectedGroupId.set(g.Id);
    this.selectedGrpName.set(g.Name);
    this.showGrpDrop.set(false);
  }

  clearGrp(): void {
    this.selectedGroupId.set('');
    this.selectedGrpName.set('');
  }

  closeAllDrops(): void {
    this.showCampDrop.set(false);
    this.showGrpDrop.set(false);
  }

  onImageFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.discardImagePreview();
    this.content.set('');
    this.imagePreviewFile.set(file);
    this.imagePreviewUrl.set(URL.createObjectURL(file));
  }

  discardImagePreview(): void {
    const url = this.imagePreviewUrl();
    if (url) URL.revokeObjectURL(url);
    this.imagePreviewFile.set(null);
    this.imagePreviewUrl.set(null);
  }

  async toggleRecording(): Promise<void> {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    if (!this.isBrowser) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioChunks = [];
      this.content.set('');

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.audioChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());

        if (this.discardOnStop) {
          this.discardOnStop = false;
          this.audioChunks = [];
          return;
        }

        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.audioChunks = [];
        this.recordingBlob.set(blob);
        this.recordingPreviewUrl.set(URL.createObjectURL(blob));
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.recordingSeconds.set(0);
      this.recordingInterval = setInterval(() => this.recordingSeconds.update(s => s + 1), 1000);
    } catch {
      this.submitError.set('لم يتم السماح بالوصول للميكروفون');
    }
  }

  private stopRecording(): void {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }

    this.isRecording.set(false);
    this.mediaRecorder?.stop();
    this.mediaRecorder = null;
  }

  cancelRecording(): void {
    this.discardOnStop = true;
    this.stopRecording();
  }

  discardAudioPreview(): void {
    const url = this.recordingPreviewUrl();
    if (url) URL.revokeObjectURL(url);
    this.recordingBlob.set(null);
    this.recordingPreviewUrl.set(null);
  }

  send(): void {
    if (!this.canSend() || this.submitting() || this.uploadingMedia()) return;

    const imageFile = this.imagePreviewFile();
    const audioBlob = this.recordingBlob();

    if (imageFile) {
      this.sendWithImage(imageFile);
    } else if (audioBlob) {
      this.sendWithAudio(audioBlob);
    } else {
      this.sendText();
    }
  }

  private buildTarget(): { type: TargetType; id: string } {
    const type = this.selectedTargetType();

    switch (type) {
      case TargetType.Company:
        return { type, id: String(this.auth.currentUser()?.companyId ?? '') };
      case TargetType.Campaign:
        return { type, id: String(this.selectedCampId()) };
      case TargetType.Group:
        return { type, id: String(this.selectedGroupId()) };
      default:
        return { type: TargetType.Company, id: String(this.auth.currentUser()?.companyId ?? '') };
    }
  }

  private resolveApiErrorMessage(error?: ApiResult<unknown> | null): string {
    const rawMessage =
      error?.Error?.MessageKey ||
      error?.Error?.message ||
      error?.ValidationErrors?.[0]?.ErrorMessage;

    if (!rawMessage) return 'حدث خطأ أثناء إرسال الرسالة';
    return API_ERRORS[rawMessage] ?? rawMessage;
  }

  private sendText(): void {
    const { type, id } = this.buildTarget();
    this.submitting.set(true);
    this.submitError.set(null);

    this.service.send({
      Content: this.content().trim(),
      TargetType: type,
      TargetId: id,
      MessageType: MessageType.Text,
      ImageUrl: null,
      AudioUrl: null,
    }).pipe(finalize(() => this.submitting.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (res.IsSuccess) {
            this.content.set('');
            this.showSuccess();
          } else {
            this.showError(res);
          }
        },
        error: err => this.showError(err?.error as ApiResult<unknown> | undefined),
      });
  }

  private sendWithImage(file: File): void {
    const { type, id } = this.buildTarget();
    this.uploadingMedia.set(true);
    this.submitError.set(null);

    this.service.uploadImage(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.submitError.set(this.resolveApiErrorMessage(res));
            this.uploadingMedia.set(false);
            return;
          }

          this.discardImagePreview();
          this.service.send({
            Content: 'صورة',
            TargetType: type,
            TargetId: id,
            MessageType: MessageType.Image,
            ImageUrl: res.Data.ImageUrl,
            AudioUrl: null,
          }).pipe(finalize(() => this.uploadingMedia.set(false)), takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: r => {
                if (r.IsSuccess) {
                  this.content.set('');
                  this.showSuccess();
                } else {
                  this.showError(r);
                }
              },
              error: err => this.showError(err?.error as ApiResult<unknown> | undefined),
            });
        },
        error: err => {
          this.submitError.set(this.resolveApiErrorMessage(err?.error as ApiResult<unknown> | undefined));
          this.uploadingMedia.set(false);
        },
      });
  }

  private sendWithAudio(blob: Blob): void {
    const { type, id } = this.buildTarget();
    const file = new File([blob], `broadcast-${Date.now()}.webm`, { type: 'audio/webm' });
    this.uploadingMedia.set(true);
    this.submitError.set(null);
    this.discardAudioPreview();

    this.service.uploadAudio(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: res => {
          if (!res.IsSuccess) {
            this.submitError.set(this.resolveApiErrorMessage(res));
            this.uploadingMedia.set(false);
            return;
          }

          this.service.send({
            Content: 'صوتي',
            TargetType: type,
            TargetId: id,
            MessageType: MessageType.Audio,
            ImageUrl: null,
            AudioUrl: res.Data.AudioUrl,
          }).pipe(finalize(() => this.uploadingMedia.set(false)), takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: r => {
                if (r.IsSuccess) {
                  this.showSuccess();
                } else {
                  this.showError(r);
                }
              },
              error: err => this.submitError.set(this.resolveApiErrorMessage(err?.error as ApiResult<unknown> | undefined)),
            });
        },
        error: err => {
          this.submitError.set(this.resolveApiErrorMessage(err?.error as ApiResult<unknown> | undefined));
          this.uploadingMedia.set(false);
        },
      });
  }

  private showSuccess(): void {
    this.toast.add({
      severity: 'success',
      summary: 'تم الإرسال',
      detail: 'تم إرسال الرسالة الجماعية بنجاح',
    });
  }

  private showError(res?: ApiResult<unknown> | null): void {
    const msg = this.resolveApiErrorMessage(res);
    this.submitError.set(msg);
  }
}
