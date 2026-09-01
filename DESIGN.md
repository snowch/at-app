# Autogenic Training app — design & provenance

## Voices
- **Teaching** (framework + per-exercise orientation): `af_heart` @ 0.75 — `tools/intro.py`.
- **Guided / timed** (practice tracks): `af_nicole` @ 0.85 — `tools/pp.py`.
- Both trim Kokoro padding and add a ~1.5s lead-in/tail; `<break time="Xs">` pauses are exact.

## The four-track fade (per exercise)
The one design piece carried intact from the source method: each exercise ships
**orientation** (hear once) → **guided session** (first days) → **timed cues**
(structure only, learner supplies the formulae) → **silent practice** (chime ·
silence · chime · close). The learner ends every stage practising unaided, which
is what makes the collapsed full sequence possible later. The silent-practice
track is shared across exercises.

## Data model (manifest.json)
- Framework items are `type: "orientation"`; the six exercises + neck/shoulders are `type: "exercise"`.
- Each exercise carries: `formula`, `week`, `prerequisites`, and where relevant `caution`, `skippable`, `note`.
- **Neck and shoulders is a suffix, not a rung** — modelled as its own item but conceptually it holds the tail of the sequence; later exercises insert ahead of it. (Session-builder logic to honour this comes with the sequence view.)
- Shared `progressionCriteria` (the four) render as a per-exercise checklist; `close` renders as the cancellation modal.

## Gating (app)
- Advance is learner-confirmed against the four criteria (a checklist that *teaches* the criteria), not a single "ready?" button.
- Minimum one week per exercise is stated; a soft reassess prompt at three weeks. (Time-tracking is a planned refinement; v1 gates on the criteria checklist.)
- Solar plexus is explicitly `skippable`. Exercise-specific cautions surface on the card and should re-appear at unlock of 3, 5, 6.

## The close is non-negotiable
Every guided/timed track ends with the cancellation; the silent-practice track ends with a spoken close reminder. The bedtime exception is stated in "The close".

**The one exception, in the app.** Each exercise (and the full session) offers a secondary "☾ To fall asleep — no close" button. It runs the *settled cumulative* pass (never the beginner drill), strips the trailing close (`stripClose`), and — because you're meant to be drifting off — does **not** raise the post-session log prompt. Every other start button ends with the close. The button carries an inline caution that it is for bed only.

## Practice log — the fifth step of the session
The taught session shape is *Position · Settle · Formula · Close · **Log***, and the welcome asks the learner to "keep a short log so you can see your progress." The app makes that real:
- **Prompt.** A guided session (short or full) ends by offering a 30-second log: *did the sensation come — on its own / partly / not yet* + an optional note. Manual "✎ Log a practice" on each exercise covers unaided sittings; a toolbar "✎ Log" opens the whole history (today's count toward 3×/day, and a day streak).
- **Feeds progression.** Progression criterion 3 is literally *"consistent in ~two-thirds of sessions over a week."* The log surfaces that evidence in the criteria block — *"came on its own in X of your last Y this week"* — so ticking is honest, not guessed.
- **Privacy.** Stored only in `localStorage` (`at-progress-v1.log`), never uploaded; entries are individually deletable. All user text is HTML-escaped on render.

## Scripting gotcha — no lone-word first segment
Kokoro hallucinates a phantom onset when the first `<break>`-delimited segment is a very short standalone utterance ("The close." → "in the close"; "Safety." → "a safety…"). Open every script with a **full phrase** ("The close of every session.", "Safety, and who should take extra care.") or the "Exercise N. Title." pattern, and STT-verify the opening before shipping.

## Content principle
Teaching text says *what to do* and *what people find* — never *what you will feel*. Promising a sensation guarantees striving, which is the one thing that blocks it.

## Provenance
Written from the method as documented across independent sources, not from any single author's presentation:
- Schultz's six-exercise structure (general clinical literature; his 1932 German work enters US public domain 2028).
- Luthe & Schultz clinical volumes — progression criteria, discharges, organ-specific work — all re-expressed in original wording.
- The 8–10 week course structure (British Autogenic Society and equivalents) — a training convention.
- Published clinical-trial protocols — session frequency, duration, repetition counts (reported as method).
- Freely usable government material — US DoD HPRC scripts and VA/VHA handouts state the standard formulae and timings.
- The neck-and-shoulders element and "I am at peace" closing formula, and the convention of introducing the former at the heartbeat stage and holding it at the tail — European/British teaching convention, not one author's arrangement.

The **formulae themselves are the technique** — short factual sentences identical across every source including the freely usable ones; the thing taught, not an author's expression, and unownable. All narration prose, sequencing, the criteria wording, troubleshooting order, and the app design are original to this project.

**Not legal advice.** The area to watch if this monetises is selection-and-arrangement (the specific ordering/grouping of otherwise-free facts); the arrangement here derives from the BAS course convention and the four-track fade model, not any single book's chapter structure.
