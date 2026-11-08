# English Learning & Pronunciation — technical baseline

## What is implemented now

Phase 1–2 is a usable offline vertical slice: create a deck and Basic English→Vietnamese card, store it locally in SQLite/WAL, review due cards, rate Again/Hard/Good/Easy, and persist a FSRS-7 state plus immutable review history. The UI deliberately treats `meaning_en_vi` as one learning objective; pronunciation will receive a separate state and must never update this state.

The application contains no synthetic dictionary record, score, audio, or paid API. The pronunciation screen is intentionally not exposed yet: a button that claims to assess pronunciation without a validated model would be misleading.

## Architecture

```
React Native presentation
        │ (no database / inference on UI thread)
Application services: Cards | Review | Dictionary | Audio cache | Recording | Assessment
        │
Domain: FSRS scheduler | objective boundaries | audio-cache keys | score confidence gates
        │
SQLite + file cache                  Native development build
        │                                      │
dictionary / card data          audio engine / recorder / sherpa-onnx / ONNX Runtime
```

Use a development build, not Expo Go, from Phase 3 onward. It is required for a maintained native speech bridge. All model files are opt-in downloads, verified with SHA-256, versioned in `model_registry`, and never initialized while opening Home.

### Data design

Already migrated: `decks`, `cards`, `fsrs_states`, `review_logs`, and `user_settings`; due-card and review-history indexes are present. The Phase 3 migration adds `dictionary_entries`, `pronunciations`, `audio_assets`, and `cache_metadata`. Phase 4 adds immutable `pronunciation_attempts` and `pronunciation_scores`. The unique scheduler key is `(card_id, objective)`, so the five planned objectives can schedule independently.

Use an append-only review log. A backup is one SQLite snapshot plus `audio/`, `recordings/`, a JSON manifest containing schema/model versions and checksums, and attribution notices. Restore validates the manifest before replacing data.

## Technology and license decision log

| Component | Decision | License / distribution position | Mobile suitability |
|---|---|---|---|
| React Native + Expo development build | Use | MIT (verify exact release notices in build) | Android/iOS; native modules supported |
| expo-sqlite | Use | Expo package license must be captured in notices | Local, fast indexed reads; WAL |
| `ts-fsrs` / FSRS-7 | Use for scheduling | Confirm package notice at lockfile pin | Pure TS; records desired retention, learning/relearning steps and review log |
| sherpa-onnx | Candidate native speech runtime | Apache-2.0 for runtime; model files are **not** covered by this | Android/iOS, offline ASR/TTS/VAD; React Native bridge exists |
| Kokoro-82M exact release | Candidate primary TTS only after artifact audit | Model card reports Apache-2.0, but selected voices and tokenizer assets must be recorded separately | Good quality but 82M model makes it an optional download, not base bundle |
| Piper current engine | Do not embed in proprietary build by default | Current maintained engine is GPL-3.0; individual voices vary | Technically viable but requires a GPL compliance decision |
| eSpeak NG | Do not embed in proprietary build by default | GPL-3.0-or-later | Retain only if source-distribution obligations are accepted; otherwise use a permissively licensed fallback chosen after audit |
| CMUdict | Use as US pronunciation seed | Commercial use unrestricted; requested acknowledgement | US ARPAbet only, not UK IPA/audio; transform with documented conversion and preserve source |
| Wiktionary dump | Optional, not base data | CC BY-SA 4.0/GFDL | Requires attribution and share-alike workflow; do not mix blindly into a proprietary dictionary database |

The recommendation is sherpa-onnx as the runtime and a separately version-pinned, Apache-compatible Kokoro artifact for optional TTS downloads. This is a recommendation, not approval to ship a voice: the release gate must save each artifact's URL, SHA-256, size, voice locale/accent, model/voice/data licence and required attribution in `THIRD_PARTY_NOTICES`.

## Instant-audio contract (Phase 3)

1. Local DB lookup returns word/IPA/audio metadata immediately.
2. An in-memory LRU keyed by `normalized-word:accent:voice:model-version` returns a ready player first.
3. A persistent audio file cache is opened next; the audio engine is pre-warmed after opening a word and preloads the next two cards.
4. Cache misses enqueue background synthesis/download, never block the speaker press. Generated TTS is labelled “TTS”, not native recording.
5. A single audio engine owns playback; eviction is size-bounded and never removes user recordings.

Measure tap-to-first-sample at the native audio callback. Target: cached file <100 ms on a declared reference device; preloaded on-device TTS <300 ms where benchmarked. These are acceptance targets, not universal promises.

## Pronunciation assessment (Phase 4)

ASR text agreement is only a guardrail, not a pronunciation score. Pipeline: permission → PCM/WAV record → VAD/silence trim → level check → target-constrained phoneme/CTC alignment → confidence calibration → structured feedback. If target phonemes, alignment, recording quality, or confidence is insufficient, return **“Chưa đủ độ tin cậy để đánh giá”**, not a numeric score.

Start with recording/replay and clearly labelled transcript confidence. Do not expose phoneme, stress or overall scores until a held-out Vietnamese-learner evaluation set confirms correlation and error rates. Keep raw audio local; upload is opt-in and absent from the core architecture.

## Delivery phases and exit gates

| Phase | Scope | Exit gate |
|---|---|---|
| 1 | Deck/card CRUD, tags, migrations, export/import | CRUD survives restart; database migration/backup tests |
| 2 | FSRS-7 review and stats | Regression fixture checks all grades, steps, relearning, desired retention and restore |
| 3 | Offline dictionary and instant UK/US audio | Asset licence manifest; cache and cold/warm latency benchmarks on Android + iOS |
| 4 | Recording and calibrated assessment | Consent flow; device matrix; documented confidence/rejection behaviour |
| 5 | Cloze, reverse, typed, image occlusion, templates | Each card type creates actual independent objective state |
| 6 | Release optimization | startup/RAM/CPU/battery measurements; offline airplane-mode, backup/restore and security tests |

## Verified sources

- [ts-fsrs scheduler documentation](https://open-spaced-repetition.github.io/ts-fsrs/guide/scheduler/default-scheduler) documents FSRS-7 defaults, retention and learning/relearning options.
- [sherpa-onnx repository](https://github.com/k2-fsa/sherpa-onnx) documents its Apache-2.0 runtime, offline capabilities and Android/iOS support.
- [CMUdict repository](https://github.com/cmusphinx/cmudict) states unrestricted research/commercial use and requests acknowledgement.
- [Kokoro model card](https://huggingface.co/hexgrad/Kokoro-82M) is the release-level source to recheck before selecting a model/voice artifact.
- [eSpeak NG repository](https://github.com/espeak-ng/espeak-ng) and [current Piper project](https://github.com/OHF-Voice/piper1-gpl) require GPL review; neither should be casually embedded.
- [Wiktionary copyright policy](https://en.wiktionary.org/wiki/Wiktionary:Copyrights) explains CC BY-SA/GFDL obligations.
