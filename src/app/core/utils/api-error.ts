/**
 * Extracts user-facing messages from a failed API call.
 *
 * The backend returns every failure as a non-2xx response whose body is `Result<T>`
 * (`{ IsSuccess, Data, Error: { Code, MessageKey, Args }, ValidationErrors }`), and
 * `Error.MessageKey` already carries the localized text. Accepts either an
 * HttpErrorResponse (body in `err.error`) or the ApiResult itself.
 * Angular's generic "Http failure response ..." text is never returned.
 */
export function apiErrorMessages(err: unknown, fallback: string): string[] {
  const candidates = [asRecord(asRecord(err)?.['error']), asRecord(err)];

  for (const body of candidates) {
    if (!body) continue;
    const messages = messagesFromBody(body);
    if (messages.length) return messages;
  }

  return [fallback];
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  return apiErrorMessages(err, fallback).join('، ');
}

function messagesFromBody(body: Record<string, unknown>): string[] {
  const validation = body['ValidationErrors'] ?? body['validationErrors'];
  if (Array.isArray(validation)) {
    const messages = validation
      .map(item => {
        const record = asRecord(item);
        return text(record?.['ErrorMessage'] ?? record?.['errorMessage']);
      })
      .filter((message): message is string => !!message);
    if (messages.length) return messages;
  }

  const error = asRecord(body['Error'] ?? body['error']);
  const fromError =
    text(error?.['MessageKey'] ?? error?.['messageKey']) ??
    text(error?.['Message']) ??
    text(error?.['message']);
  if (fromError) return [fromError];

  // a plain string error body (only when it is not Angular's own HttpErrorResponse text)
  const plainError = text(body['error']);
  if (plainError) return [plainError];

  const message = text(body['message']) ?? text(body['Message']);
  if (message) return [message];

  return [];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('<') || trimmed.length > 500 || isAngularHttpMessage(trimmed)) return null;
  return trimmed;
}

function isAngularHttpMessage(message: string): boolean {
  return /^Http failure (response|during parsing)/i.test(message);
}
