# A single permanent message log spans short-term and long-term memory

We needed a storage shape for Short-term Memory (raw, recently-injected
context) and Long-term Memory (compressed, searchable context). Rather than
two separate tables with a migration/deletion step between them, we use one
`messages` table that holds every message forever: Short-term Memory is a
live query over its uncompressed tail, and Long-term Memory is the same
rows once an embedding and Peak Emotion Intensity are attached. Raw text is
never deleted, even after Compression — it stays for debugging/audit
purposes, and because Compression only changes how a row is *used*, not
what's stored. This trades a small amount of always-on-disk raw text for a
simpler schema and no move/copy step between tiers.
