import { Injectable, NgZone, OnDestroy, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Subscription } from 'rxjs';
import type { Room, LocalTrack, RemoteTrack } from 'livekit-client';
import { AuthService } from '../../../core/auth/services/auth';
import { ChatService } from '../chat.service';
import { CallPayload, CallStatus, CallType } from '../chat.model';

/** What the call screen shows */
export type CallPhase =
  | 'idle'
  | 'outgoing'    // I am calling, the other side is ringing
  | 'incoming'    // someone is calling me
  | 'connecting'  // answered, joining the LiveKit room
  | 'active'      // talking
  | 'ended';      // short "call ended" message before closing

/**
 * Voice / video calls in the dashboard (same calls as the mobile apps).
 * Signalling goes through the chat hub (StartCall / AcceptCall / ... and the Call* events);
 * the media goes through LiveKit (livekit-client) with a token from the Chat API.
 * One call at a time - the server refuses a second one (busy).
 */
@Injectable({ providedIn: 'root' })
export class CallService implements OnDestroy {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly phase      = signal<CallPhase>('idle');
  readonly call       = signal<CallPayload | null>(null);
  readonly error      = signal<string | null>(null);
  readonly endMessage = signal<string | null>(null);
  readonly micOn      = signal(true);
  readonly cameraOn   = signal(true);
  readonly seconds    = signal(0);
  readonly remoteVideo = signal<MediaStreamTrack | null>(null);
  readonly localVideo  = signal<MediaStreamTrack | null>(null);

  readonly isVideo = computed(() => this.call()?.CallType === CallType.Video);
  readonly otherName = computed(() => {
    const c = this.call();
    if (!c) return '';
    return c.CallerId === this.myId() ? c.CalleeName : c.CallerName;
  });
  readonly duration = computed(() => {
    const s = this.seconds();
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  });

  private room: Room | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  private ringtone: { stop: () => void } | null = null;
  private readonly subs = new Subscription();
  private started = false;

  /** Called once by the shell: listens for incoming calls on every page */
  init(): void {
    if (!this.isBrowser || this.started) return;
    this.started = true;
    this.chat.connect();

    this.subs.add(this.chat.incomingCall$.subscribe(call => {
      if (this.phase() !== 'idle' && this.phase() !== 'ended') return;   // server already marks us busy
      this.clearCloseTimer();
      this.call.set(call);
      this.error.set(null);
      this.phase.set('incoming');
      this.startRingtone();
    }));

    this.subs.add(this.chat.callEvent$.subscribe(({ event, call }) => {
      if (this.call()?.CallId !== call.CallId) return;
      this.call.set(call);
      switch (event) {
        case 'CallAccepted':
          // the caller joins the room when the callee answers
          if (call.CallerId === this.myId() && this.phase() === 'outgoing') void this.joinRoom();
          break;
        case 'CallAnsweredElsewhere':
          this.finish('تم الرد من جهاز آخر');
          break;
        case 'CallRejected':  this.finish('تم رفض المكالمة'); break;
        case 'CallCancelled': this.finish('تم إلغاء المكالمة'); break;
        case 'CallMissed':    this.finish('لم يتم الرد'); break;
        case 'CallEnded':     this.finish('انتهت المكالمة'); break;
      }
    }));
  }

  // ── Actions ────────────────────────────────────────────────────────

  async start(calleeId: string, callType: CallType): Promise<void> {
    if (this.phase() !== 'idle' && this.phase() !== 'ended') return;
    this.clearCloseTimer();
    this.error.set(null);
    this.cameraOn.set(callType === CallType.Video);
    this.micOn.set(true);

    const result = await this.chat.startCall(calleeId, callType).catch(() => null);
    if (!result || !result.Success || !result.Call) {
      this.call.set(null);
      this.phase.set('ended');
      this.endMessage.set(result?.ErrorMessage || 'تعذر بدء المكالمة');
      this.scheduleClose();
      return;
    }

    this.call.set(result.Call);
    if (result.Call.Status === CallStatus.Busy) {
      this.phase.set('ended');
      this.endMessage.set('الطرف الآخر في مكالمة أخرى');
      this.scheduleClose();
      return;
    }
    this.phase.set('outgoing');
    this.startRingtone(true);
  }

  async accept(): Promise<void> {
    const call = this.call();
    if (!call || this.phase() !== 'incoming') return;
    this.stopRingtone();
    this.cameraOn.set(call.CallType === CallType.Video);
    this.micOn.set(true);
    this.phase.set('connecting');

    const result = await this.chat.acceptCall(call.CallId).catch(() => null);
    if (!result?.Success) {
      this.finish(result?.ErrorMessage || 'تعذر الرد على المكالمة');
      return;
    }
    if (result.Call) this.call.set(result.Call);
    await this.joinRoom();
  }

  async reject(): Promise<void> {
    const call = this.call();
    if (!call) return;
    this.stopRingtone();
    await this.chat.rejectCall(call.CallId).catch(() => null);
    this.finish('تم رفض المكالمة');
  }

  /** Cancel while ringing, or hang up during the call */
  async hangUp(): Promise<void> {
    const call = this.call();
    if (!call) { this.reset(); return; }
    this.stopRingtone();
    await this.chat.endCall(call.CallId).catch(() => null);
    this.finish(this.phase() === 'outgoing' ? 'تم إلغاء المكالمة' : 'انتهت المكالمة');
  }

  async toggleMic(): Promise<void> {
    if (!this.room) return;
    const on = !this.micOn();
    await this.room.localParticipant.setMicrophoneEnabled(on);
    this.micOn.set(on);
  }

  async toggleCamera(): Promise<void> {
    if (!this.room) return;
    const on = !this.cameraOn();
    await this.room.localParticipant.setCameraEnabled(on);
    this.cameraOn.set(on);
    this.refreshLocalVideo();
  }

  close(): void {
    if (this.phase() === 'ended') this.reset();
  }

  // ── LiveKit ────────────────────────────────────────────────────────

  private async joinRoom(): Promise<void> {
    const call = this.call();
    if (!call) return;
    this.phase.set('connecting');

    try {
      const res = await firstValueFrom(this.chat.getCallToken(call.CallId));
      if (!res.IsSuccess || !res.Data) throw new Error('no token');

      const { Room, RoomEvent, Track } = await import('livekit-client');
      const room = new Room({ adaptiveStream: true, dynacast: true });
      this.room = room;

      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => this.zone.run(() => {
          if (track.kind === Track.Kind.Video) this.remoteVideo.set(track.mediaStreamTrack);
          if (track.kind === Track.Kind.Audio) this.playRemoteAudio(track);
        }))
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => this.zone.run(() => {
          if (track.kind === Track.Kind.Video) this.remoteVideo.set(null);
          track.detach().forEach(el => el.remove());
        }))
        .on(RoomEvent.Disconnected, () => this.zone.run(() => {
          if (this.phase() === 'active' || this.phase() === 'connecting') void this.hangUp();
        }));

      await room.connect(res.Data.Url, res.Data.Token);
      await room.localParticipant.setMicrophoneEnabled(true);
      if (call.CallType === CallType.Video) await room.localParticipant.setCameraEnabled(true);
      this.refreshLocalVideo();

      this.zone.run(() => {
        this.phase.set('active');
        this.startTimer();
      });
    } catch (err) {
      console.error('[Call] could not join the room', err);
      this.error.set('تعذر الاتصال بخدمة المكالمات (تأكد من إذن المايك / الكاميرا)');
      await this.chat.endCall(call.CallId).catch(() => null);
      this.finish('تعذر إتمام المكالمة');
    }
  }

  private refreshLocalVideo(): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pub: any = this.room?.localParticipant.getTrackPublications().find((p: any) => p.kind === 'video');
    const track: LocalTrack | undefined = pub?.track;
    this.localVideo.set(this.cameraOn() && track ? track.mediaStreamTrack : null);
  }

  private playRemoteAudio(track: RemoteTrack): void {
    const el = track.attach();
    el.style.display = 'none';
    el.setAttribute('data-lk-call', '1');
    document.body.appendChild(el);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private finish(message: string): void {
    this.stopRingtone();
    this.stopTimer();
    void this.leaveRoom();
    this.endMessage.set(message);
    this.phase.set('ended');
    this.scheduleClose();
  }

  private scheduleClose(): void {
    this.clearCloseTimer();
    this.closeTimer = setTimeout(() => this.zone.run(() => this.reset()), 2500);
  }

  private clearCloseTimer(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = null;
  }

  private reset(): void {
    this.clearCloseTimer();
    this.stopRingtone();
    this.stopTimer();
    void this.leaveRoom();
    this.call.set(null);
    this.phase.set('idle');
    this.error.set(null);
    this.endMessage.set(null);
    this.seconds.set(0);
  }

  private async leaveRoom(): Promise<void> {
    const room = this.room;
    this.room = null;
    this.remoteVideo.set(null);
    this.localVideo.set(null);
    document.querySelectorAll('audio[data-lk-call]').forEach(el => el.remove());
    if (room) await room.disconnect().catch(() => undefined);
  }

  private startTimer(): void {
    this.stopTimer();
    const answeredAt = this.call()?.AnsweredAt ? new Date(this.call()!.AnsweredAt!).getTime() : Date.now();
    this.timer = setInterval(() => this.zone.run(() =>
      this.seconds.set(Math.max(0, Math.floor((Date.now() - answeredAt) / 1000)))), 1000);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Simple ringtone with WebAudio (no sound file needed) */
  private startRingtone(outgoing = false): void {
    this.stopRingtone();
    try {
      const ctx = new AudioContext();
      let stopped = false;
      const beep = () => {
        if (stopped) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = outgoing ? 425 : 520;
        gain.gain.value = 0.08;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + (outgoing ? 1 : 0.4));
      };
      beep();
      const id = setInterval(beep, outgoing ? 3000 : 1200);
      this.ringtone = { stop: () => { stopped = true; clearInterval(id); void ctx.close(); } };
    } catch {
      this.ringtone = null;   // the browser blocks audio before any click - the screen still shows the call
    }
  }

  private stopRingtone(): void {
    this.ringtone?.stop();
    this.ringtone = null;
  }

  private myId(): string | undefined {
    return this.auth.currentUser()?.userId;
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
    this.reset();
  }
}
