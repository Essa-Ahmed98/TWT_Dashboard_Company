import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { CallService } from './call.service';

/**
 * Call screen shown above every page of the dashboard (placed in the shell):
 * incoming call (answer / decline), outgoing call (ringing / cancel) and the call itself
 * (video, mute, camera, hang up, duration).
 */
@Component({
  selector: 'app-call-overlay',
  templateUrl: './call-overlay.html',
  styleUrl: './call-overlay.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallOverlay {
  protected readonly calls = inject(CallService);

  private readonly remoteEl = viewChild<ElementRef<HTMLVideoElement>>('remoteVideo');
  private readonly localEl  = viewChild<ElementRef<HTMLVideoElement>>('localVideo');

  constructor() {
    this.calls.init();

    // attach the LiveKit video tracks to the <video> elements
    effect(() => attach(this.remoteEl()?.nativeElement, this.calls.remoteVideo()));
    effect(() => attach(this.localEl()?.nativeElement, this.calls.localVideo()));
  }
}

function attach(el: HTMLVideoElement | undefined, track: MediaStreamTrack | null): void {
  if (!el) return;
  if (!track) { el.srcObject = null; return; }
  const current = el.srcObject as MediaStream | null;
  if (current?.getTracks()[0] === track) return;
  el.srcObject = new MediaStream([track]);
  void el.play().catch(() => undefined);
}
