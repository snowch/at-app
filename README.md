# at-app

A drip-released audio programme and PWA teaching **Autogenic Training** — the six
standard exercises, one at a time, until you can reach deep calm on command,
**unaided**. Built in the same mould as [nidra-app](https://github.com/snowch/nidra-app):
narration rendered with Kokoro TTS, a data-driven journey, offline support.

**🌐 Live:** <https://snowch.github.io/at-app/>

## Repository layout
```
index.html      the PWA (app.css, app.js, sw.js, manifest.webmanifest, icons/)
content/        narration scripts (.txt, with <break time="Xs"/> pauses)
audio/          narration — .m4a (web) + .wav (source)
tools/          render pipeline (intro.py = teaching voice, pp.py = guided voice)
manifest.json   the data-driven programme (formulae, weeks, cautions, criteria)
DESIGN.md       build template and provenance
```

## The programme
Five framework teachings (welcome · passive concentration · the session · the
close · safety), then the six standard exercises + neck-and-shoulders, each with
the **four-track fade** — orientation (hear once) → guided session → timed cues
→ silent practice — so you end every stage practising it unaided.

| # | Exercise | Formula | Week |
|---|---|---|---|
| 10 | Heaviness | *My right arm is heavy* | 1 |
| 20 | Warmth | *My right arm is warm* | 3 |
| 30 | Heartbeat | *My heartbeat is calm and regular* | 5 |
| 35 | Neck & shoulders | *My neck and shoulders are heavy* | 5 |
| 40 | Breathing | *It breathes me* | 6 |
| 50 | Solar plexus | *My solar plexus is warm* | 7 |
| 60 | Cool forehead | *My forehead is pleasantly cool* | 8 |

Each exercise carries its **progression criteria** (advance only when the
sensation arises without effort, promptly, consistently, and without straining),
its **prerequisites**, and any **medical caution**. A first-run **safety gate**
routes the absolute-caution conditions toward a therapist rather than the app.

## Rendering audio
```
pip install -r requirements.txt
python tools/intro.py content/at_00_welcome.txt          # teaching → Heart @ 0.75
python tools/pp.py    content/at_10_heaviness_guided.txt  # guided   → Nicole @ 0.85
```

## Licence
© 2026 Chris Snow. All rights reserved. Content proprietary; see `LICENSE`.
Tooling: kokoro-mlx (MIT), Kokoro-82M model (Apache-2.0). See DESIGN.md for the
method provenance — the AT *formulae* are field-standard technique, not authored
prose; all explanation, sequencing, and app design are original.
