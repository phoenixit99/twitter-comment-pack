/**
 * Minimal Telegram alert sender.
 */
export async function sendAlert(token, chatId, text) {
  if (!token || !chatId) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      // swallow
    }
  } catch {
    // swallow — never crash on telegram errors
  }
}

/**
 * Call a Telegram Bot API method and return `result`. Throws on failure
 * (unlike sendAlert) — used by the Mode E approval loop.
 */
export async function telegramCall(token, method, body = {}) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(`Telegram ${method} failed: ${json.description || res.status}`);
  return json.result;
}
