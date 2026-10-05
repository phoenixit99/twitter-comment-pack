/**
 * Quality gate — auto-check original posts before publishing.
 * Rejects posts that don't meet crypto VN content standards.
 */

const URL_REGEX = /https?:\/\/\S+/i;
const HASHTAG_REGEX = /#\w+/g;
const QUESTION_REGEX = /\?/;
// Format names the model sometimes copies from the format instruction ("HOT TAKE: ...")
const FORMAT_LABEL_REGEX = /^[\s\p{Extended_Pictographic}*_#]*(hot\s*take|mini\s*list|câu hỏi thảo luận|giải thích dễ hiểu|trải nghiệm cá nhân)\s*[:：\-–—]/iu;

/**
 * @param {string} content — the post content to check
 * @param {string[]} recentOpenings — up to 5 recent opening sentences
 * @param {{ requireQuestion?: boolean }} [opts] — formats like hot takes or lists don't need a question
 * @returns {{ pass: boolean, reasons: string[] }}
 */
export function checkDraft(content, recentOpenings = [], opts = {}) {
  const { requireQuestion = true } = opts;
  const reasons = [];

  // Length check (Premium account so no 280 char limit)
  const len = content.length;
  if (len < 40) reasons.push(`Quá ngắn: ${len} ký tự (tối thiểu 40)`);

  // URL check
  if (URL_REGEX.test(content)) {
    reasons.push('Chứa URL — bài gốc không được có link');
  }

  // Hashtag check (max 3)
  const hashtags = content.match(HASHTAG_REGEX) || [];
  if (hashtags.length > 3) {
    reasons.push(`Quá nhiều hashtag: ${hashtags.length} (tối đa 3)`);
  }

  // Format label check
  if (FORMAT_LABEL_REGEX.test(content)) {
    reasons.push('Mở đầu bằng nhãn định dạng (vd "HOT TAKE:") — phải viết thẳng nội dung');
  }

  // Question check
  if (requireQuestion && !QUESTION_REGEX.test(content)) {
    reasons.push('Không có câu hỏi — bài gốc phải kết bằng câu hỏi');
  }

  // Duplicate opening check
  if (recentOpenings.length > 0) {
    const opening = getOpening(content);
    for (const prev of recentOpenings) {
      if (opening && prev && normalize(opening) === normalize(prev)) {
        reasons.push(`Trùng câu mở đầu với bài gần đây: "${prev.slice(0, 40)}..."`);
        break;
      }
    }
  }

  return { pass: reasons.length === 0, reasons };
}

/**
 * Extract the opening sentence (first line or first sentence).
 */
function getOpening(text) {
  const firstLine = text.split('\n')[0].trim();
  // Also try splitting by period/question
  const firstSentence = firstLine.split(/[.?!]/)[0].trim();
  return firstSentence || firstLine;
}

/**
 * Normalize text for comparison (lowercase, strip emoji, trim).
 */
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}


