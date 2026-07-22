# Source/produce avatar image set

Type: task
Status: resolved

Blocked by: 12

## Question

Using the bucket list defined in
[ticket 12](12-avatar-emotion-bucketing.md), source or produce the actual
image asset for each bucket, per character. This is manual/creative work
(commissioning art, generating and hand-picking images, or drawing them)
rather than a decision — it just needs to happen before the avatar feature
can be implemented. Record where the resulting assets live (directory
structure, file naming convention matching the bucket list) as the answer.

## Answer

Produced a **default** (fallback) 24-image set — not per-character art;
per-character sets can follow the same convention later when a character
is given custom art.

**Directory**: `assets/avatars/default/`

**Naming convention**: `{primary}-{tier}-{nuance}.png`, one file per
ticket 12 bucket, e.g. `joy-low-serenity.png`,
`anticipation-high-vigilance.png`. Primary and tier match the runtime
bucket-selection coordinates exactly (so code can construct the filename
directly from `{dominantEmotion}-{tier}`), and the nuance segment carries
Plutchik's name for readability in a file listing. All 24 nuance words are
globally unique, so a lookup by nuance alone also works if ever needed.

**Source**: each image is a single standard Unicode emoji rendered from
the system `Noto Color Emoji` font at its native bitmap-strike resolution
(109px), then upscaled to 512×512 PNG (Lanczos resampling) — satisfies
"upscaled emojis stored as png files" without needing external asset
downloads. Emoji chosen per bucket:

| Bucket | Emoji | Bucket | Emoji |
|---|---|---|---|
| joy-low-serenity | 😌 | sadness-low-pensiveness | 😔 |
| joy-mid-joy | 😃 | sadness-mid-sadness | 😢 |
| joy-high-ecstasy | 🤩 | sadness-high-grief | 😭 |
| trust-low-acceptance | 🙂 | disgust-low-boredom | 😑 |
| trust-mid-trust | 🥰 | disgust-mid-disgust | 🤢 |
| trust-high-admiration | 😍 | disgust-high-loathing | 🤮 |
| fear-low-apprehension | 😟 | anger-low-annoyance | 😒 |
| fear-mid-fear | 😨 | anger-mid-anger | 😠 |
| fear-high-terror | 😱 | anger-high-rage | 🤬 |
| surprise-low-distraction | 😯 | anticipation-low-interest | 🧐 |
| surprise-mid-surprise | 😲 | anticipation-mid-anticipation | 🤞 |
| surprise-high-amazement | 🤯 | anticipation-high-vigilance | 👀 |

This is a placeholder/default set, good enough to unblock the avatar
feature's plumbing (bucket → file lookup, SSE avatar-state push per
ticket 07) end-to-end before any bespoke per-character art is
commissioned.
