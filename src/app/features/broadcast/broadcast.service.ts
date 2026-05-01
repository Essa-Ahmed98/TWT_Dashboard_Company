import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResult } from '../../core/models/api.models';
import { BroadcastRequest } from './broadcast.model';
import { UploadAudioResult, UploadImageResult } from '../chat/chat.model';

@Injectable({ providedIn: 'root' })
export class BroadcastService {
  private readonly http = inject(HttpClient);

  send(payload: BroadcastRequest): Observable<ApiResult<unknown>> {
    return this.http.post<ApiResult<unknown>>(`${environment.chatApiBase}/chat/api/broadcast/send`, payload);
  }

  uploadImage(file: File): Observable<ApiResult<UploadImageResult>> {
    const form = new FormData();
    form.append('imageFile', file);
    return this.http.post<ApiResult<UploadImageResult>>(
      `${environment.chatApiBase}/chat/upload-image`, form,
    );
  }

  uploadAudio(file: File): Observable<ApiResult<UploadAudioResult>> {
    const form = new FormData();
    form.append('audioFile', file);
    return this.http.post<ApiResult<UploadAudioResult>>(
      `${environment.chatApiBase}/chat/upload-audio`, form,
    );
  }
}
