# 05 — Growth strategy for Mode E (posts + replies)

Written after 3 weeks of Mode E on a crypto account with low impressions.

## Why the account isn't growing

What the code was doing, and the fix for each:

| Problem | Effect | Fix |
|---|---|---|
| Every post rewrote the **most-liked tweet** from the same 2 lists, and the same tweet could be picked in several slots | Followers of those lists had already seen the news. Nothing new, so X had no reason to push it | `rankSourceTweets`: only tweets from the last 24h, each one used once |
| Every post used **one template**: shock hook, under 200 chars, forced "ae nghĩ sao?" question | 10 posts a day that look the same. X and readers treat them as bait, so people scroll past (low dwell time) | 5 formats that rotate: `hot_take`, `question`, `mini_list`, `explain_simple`, `personal_story`. The same format never runs twice in a row |
| `modeE.topics` was **never read** (`topic: ''`) | The config did nothing | Topics are now injected through `{{TOPIC}}` |
| Only one niche (crypto/finance), in Vietnamese | Small audience that already has many competing accounts | New **content pillars**, e.g. `crypto` + `ai_tech` |
| 10 posts a day on a small account | Each post gets tested on the same small set of followers. Weak posts drag down the account's average | Post 5–6 times a day and make each post better |
| 1 reply an hour to the **newest** tweet in any list, no matter how big the account | Replies are how small accounts get discovered, but generic replies on small tweets reach nobody | See "Replies" below |

## 1. Content pillars (now in code)

In `data/config.json`, add these under `modeE`:

```json
"pillars": [
  {
    "name": "crypto",
    "weight": 60,
    "listIds": ["2093176214320206077"],
    "topics": ["Bitcoin on-chain", "Ethereum Layer 2", "Solana DeFi", "Crypto thị trường vĩ mô"],
    "promptFile": "prompts/post_original.txt"
  },
  {
    "name": "ai_tech",
    "weight": 40,
    "listIds": ["<your AI/tech list id>"],
    "topics": ["Tool AI mới", "Demo AI agent", "AI tạo ảnh/video", "Mẹo dùng ChatGPT/Claude/Gemini cho công việc", "AI x Crypto"],
    "promptFile": "prompts/post_ai_tech.txt"
  }
],
"reuseSourceMedia": true
```

- A slot can pin a pillar with `"pillar": "ai_tech"`. Slots without a pin choose a pillar at random, using `weight`.
- `2098053144278352258` is currently a Mode E research list. If it's AI/tech, use it for `ai_tech`. If it isn't, create a private X list of 30–60 accounts that post **AI demos and product launches**: official AI lab and tool accounts, plus creators who post screen-recorded demos. The quality of the list decides the quality of the posts.
- Keep **one identity**: "Robert, a finance/crypto guy who tests AI tools every day". Both prompts use this persona. Followers you get from AI posts will then also accept the crypto posts.
- Optional: set `modeE.formats` (or `formats` on one pillar) to override the default formats. Each format has the fields `{name, weight, requireQuestion, instruction}`.

### Suggested schedule (6 slots instead of 10, Vietnam time)

```json
"slots": [
  { "name": "morning_breakdown", "start": "07:00", "end": "08:30", "pillar": "crypto" },
  { "name": "morning_update",    "start": "09:00", "end": "10:30", "pillar": "ai_tech" },
  { "name": "midday_news",       "start": "11:30", "end": "12:30" },
  { "name": "evening_alpha",     "start": "17:00", "end": "18:30", "pillar": "ai_tech" },
  { "name": "night_question",    "start": "20:30", "end": "22:00" },
  { "name": "midnight_degen",    "start": "22:30", "end": "23:30", "pillar": "crypto" }
]
```

Vietnamese users are most active 11:30–13:00 and 20:00–23:00. Posting at 00:00–01:00 mostly reaches nobody.

## 2. Replies (the biggest lever for a small account)

On a small account, most new followers come from **replies under big accounts**, not from your own posts.

- **Better replies, not more replies.** A generic AI reply ("hay quá ae") gets hidden under "Show more replies" and trains X to rank your account lower. Keep `commentsPerHour` at 1–2, but point `modeA.listIds` at big accounts (50k+ followers) in crypto **and** AI, whose readers overlap with your audience.
- **Reply fast.** A reply in the first 15–30 minutes of a big tweet gets most of the views. The list crawler already sorts by newest.
- **Every day, do 10–15 replies by hand** under the biggest crypto/AI accounts: add a number, a counter-point, or your own experience. Nothing automated beats this.
- **Answer everyone who replies to your posts** within the first hour. X weights "author replied to a reply" heavily. Mode E now does this automatically (reply-back, below). Still check the conversations by hand once a day.

### Reply-back (automatic)

Turn it on under `modeE` in `data/config.json`:

```json
"replyBack": {
  "enabled": true,
  "ownUsername": "RobertNguyen_99",
  "pollMinutes": 10,
  "lookbackHours": 24,
  "maxPerHour": 8,
  "maxPerPost": 10,
  "maxPerAuthorPerPost": 2,
  "likeReplies": true
}
```

- Every `pollMinutes` it searches `to:<ownUsername>` and keeps only replies to **your own Mode E posts** from the last `lookbackHours`, plus replies to its own earlier answers, so a conversation can go 2 turns per person (`maxPerAuthorPerPost`).
- Real comments get a like and an AI answer (`prompts/reply_back.txt`, same Robert persona, same language as the commenter). Very short ones (emoji, "gm") only get a like. Links and promo spam ("check my profile", t.me, …) are ignored.
- It is **not** paused after a new post, because the first hour is when answering matters most.
- Hourly cap: `maxPerHour`. Replies above the cap wait for the next cycle.
- The table `replied_back` in `data/store.db` remembers everything it handled, so a restart never answers twice.
- Only posts made by Mode E (in `data/post-history.json`) are covered. Posts you write by hand are not answered.

## 3. Post quality checklist

- The first line is the whole post for most readers. Open with a number, a take that goes against the crowd, or a "did you know".
- Use **your own media** where you can: a chart you annotated, a screenshot or screen recording of an AI tool **you tried**. Re-uploading someone else's image (`reuseSourceMedia: true`) is quick but gets less reach than original media. Set it to `false` once you have your own.
- Once a week, write one **thread by hand**, e.g. "7 AI tools I used this week to trade/work faster". Pin the best one.
- Keep links out of the main post (already enforced). Put the link in a reply if you need one.

## 4. About "girl" content

- **Don't** run a fake girl persona or post AI-generated "girl" photos to get clicks. X treats undisclosed synthetic people as inauthentic behaviour and can lock the account. It also attracts followers who never engage with crypto or AI posts, so your engagement rate and reach drop for everything else.
- **What works and fits the AI pillar:** demos of AI image and video tools (portraits, fashion, "what this model can do now"), **clearly labelled as AI**, with the tool name and a short how-to. Or bring in a **real** female co-host or creator who posts in her own name, and reply to or quote each other.

## 5. Measure, then cut

`data/post-history.json` now records `pillar`, `format`, `topic` and `sourceTweetId` for each post. After about 2 weeks, compare impressions and engagement in X Analytics for each pillar and format:

- Raise the `weight` of the pillar that wins, and remove formats that are below average.
- Targets for a healthy small account: engagement rate above 2%, and 1 or more posts a week at 5–10× your normal impressions (that's the post to copy).

## 6. Profile basics (one-time)

- The bio says in one line what people get: e.g. "Crypto + AI tools cho người Việt • Test tool AI mỗi ngày • Không shill".
- The pinned post is the best-performing thread.
- Use a real-looking, consistent avatar and name, and a banner that states the niche.

## Next features worth building

1. ~~Reply-back loop~~ — done, see "Reply-back (automatic)".
2. **Metrics sync**: fetch views and likes for each `tweetId` in post-history, so pillar and format weights can tune themselves automatically.
3. **Bigger-account targeting for replies**: prefer tweets from high-follower authors that are under 30 minutes old.
