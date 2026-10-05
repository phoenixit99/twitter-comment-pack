/**
 * JSON.parse that keeps long numeric IDs intact.
 *
 * X list/tweet IDs are larger than Number.MAX_SAFE_INTEGER, so an unquoted
 * ID in data/config.json (e.g. "listIds": [2104036545699434815]) silently
 * becomes 2104036545699434800 — a different list. Integer literals with 16+
 * digits are read as strings instead.
 */
const BIG_INT_LITERAL = /([:\[,]\s*)(-?\d{16,})(?=\s*[,\]\}])/g;

export function parseJsonSafe(text) {
  return JSON.parse(text.replace(BIG_INT_LITERAL, '$1"$2"'));
}
