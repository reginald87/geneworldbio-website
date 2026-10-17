const secretKey = () => process.env.TURNSTILE_SECRET_KEY || '';
const failOpen = () => /^(1|true|yes|on)$/i.test(String(process.env.TURNSTILE_FAIL_OPEN || ''));

export const turnstileConfigured = () => Boolean(secretKey());

export async function verifyTurnstile(token, remoteip) {
  const key = secretKey();
  if (!key) return { ok: true, skipped: true };
  if (!token || !String(token).trim()) return { ok: false, error: 'The bot check was not completed. Please try again.' };

  const payload = new URLSearchParams({ secret: key, response: String(token) });
  if (remoteip) payload.set('remoteip', String(remoteip));

  let response;
  try {
    response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: payload,
      signal: AbortSignal.timeout(6000),
    });
  } catch (error) {
    if (failOpen()) {
      console.warn(`Turnstile unreachable (${error.message}); allowing the submission because TURNSTILE_FAIL_OPEN is on.`);
      return { ok: true, degraded: true };
    }
    console.error(`Turnstile verification request failed: ${error.message}`);
    return { ok: false, error: 'We could not verify this submission. Please try again shortly.' };
  }

  if (!response.ok) {
    if (failOpen()) {
      console.warn(`Turnstile responded ${response.status}; allowing the submission because TURNSTILE_FAIL_OPEN is on.`);
      return { ok: true, degraded: true };
    }
    console.error(`Turnstile verification responded ${response.status}`);
    return { ok: false, error: 'We could not verify this submission. Please try again shortly.' };
  }

  const data = await response.json().catch(() => ({}));
  if (data.success !== true) {
    console.error(`Turnstile rejected the token: ${JSON.stringify(data['error-codes'] || [])}`);
    return { ok: false, error: 'The bot check failed. Please try again.' };
  }
  return { ok: true };
}
