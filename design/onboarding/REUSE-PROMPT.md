# Reusable prompt — refresh an onboarding guide with real screenshots

Copy everything below the line into a fresh agent session, filling in the
`<<...>>` placeholders first. It reproduces the workflow used on the hackX 11.0
evaluation portal.

Two things make this go well: the agent audits the codebase before trusting the
copy, and it never deletes an existing asset without asking.

---

## Task

Refresh the onboarding guide in this project. The existing slide imagery is stale
— it shows an older build of the product — and the copy needs to match what the
portal actually does today.

**Inputs:**

- Screenshots: `<<ABSOLUTE PATH TO SCREENSHOT FOLDER>>`
- Onboarding component: `<<PATH, e.g. components/onboarding-modal.tsx>>`
- Existing slide assets: `<<PATH, e.g. public/onboarding/>>`
- Copy file (if one exists): `<<PATH, e.g. content.md>>`

**Slide content:**

```
<<PASTE THE EYEBROW / HEADING / BODY FOR EACH SLIDE>>
```

**Image mapping** (which screenshot belongs to which slide):

```
<<e.g.
Welcome                  – keep the existing onboard1.gif
Dashboard                – dashboard.png
My Assignments           – my-assignments.jpeg
Security                 – keep the existing onboard7.gif
>>
```

## Hard rules

1. **Do not delete or overwrite any existing asset.** Not the old GIFs, not
   anything in the assets folder. If something looks obsolete, say so and ask.
   Adding new files alongside the old ones is always the right default.
2. **Work on a branch, not `main`.** Create one before your first commit.
3. Run `git status` before any command that could discard uncommitted work, and
   leave changes you did not make unstaged — the working tree may hold someone
   else's work in progress.
4. Ask before making a decision that is expensive to undo or that the brief does
   not settle. Batch the questions; don't drip-feed them.

## Step 1 — Audit before you write anything

Do this first, and report what you find before building.

- Open every supplied screenshot. Record its real dimensions and, more
  importantly, **what it actually shows** — filenames lie. Flag any that are
  truncated, contain a different screen than the name implies, or duplicate
  another.
- **Verify each slide's copy against the code.** For every feature the copy
  mentions — a table, a toggle, a filter, a panel — grep for it. Products drift,
  and onboarding copy is usually the last thing updated. Use `git log` to confirm
  when something was removed. Report any slide describing a feature that no
  longer exists; do not silently drop or silently keep it.
- Check whether the copy is duplicated anywhere (a `content.md` or similar) that
  needs to stay in sync.
- Look at how the current slide images are rendered: the container's aspect
  ratio, and whether it uses `object-cover` or `object-contain`. This drives
  everything in step 3.
- Note the visual language of any asset being kept (backdrop colour, framing).
  Sample the exact background colour from the image rather than guessing.

## Step 2 — Ask before building

Get answers to these before generating anything:

- **Where each screenshot goes**, if the mapping is ambiguous or if you have more
  screenshots than slides. Show what each image actually contains when you ask.
- **The backdrop treatment.** If any existing asset is being reused, the new
  frames should almost certainly match its backdrop, or the deck will look like
  two different decks stapled together. Say so explicitly.
- **Cropping.** Tight crops make the UI legible at small sizes; full screenshots
  preserve context but render smaller. Ask which they want, and make it a
  one-line change either way.
- **Anything from step 1 that contradicts the brief.**

## Step 3 — Build a repeatable pipeline, not one-off images

Do not hand-edit images. Create:

- `design/onboarding/raw/` — copies of the supplied screenshots, renamed
  semantically. Never work from the originals in place.
- `design/onboarding/shots.json` — the frame spec: canvas size, background,
  margin, corner radius, shadow, and a per-slide entry with `source`, a `crop`
  of `[x, y, w, h]` or `null`, and a short `note` on what the shot shows.
  Slides reusing an existing asset get a `passthrough` key instead.
- `scripts/build_onboarding_frames.py` — reads the spec, crops, scales to fit
  inside the margins, applies rounded corners, a soft drop shadow and a hairline
  border, and writes one file per slide. `passthrough` slides are reported but
  left untouched. Support `--only <key>` for rebuilding a single slide.

Requires Pillow. A working reference implementation lives at
`<<PATH TO THIS REPO>>/scripts/build_onboarding_frames.py` — adapt it rather than
starting from scratch.

The point is that retuning a crop is a JSON edit plus one command, not a redo.

### The cropping trap

If the image container uses `object-cover` and its aspect ratio differs from your
frames, **the browser will crop your frames** — in a narrow portrait panel this
can silently slice ~28% off both sides of every screenshot.

The clean fix, when every slide shares one backdrop colour: paint the container
that same colour and switch to `object-contain`. Nothing is ever cropped and the
letterboxing is invisible because the colours match. Otherwise keep the frame
content inside a safe zone that survives the crop.

Whichever you choose, state it explicitly and leave a comment in the component.

## Step 4 — Wire up the component

- Give each slide an explicit `image` field. Do not derive the path from the slide
  index (`slide${n}.webp`) — slides get reordered, added and removed, and index-
  derived paths break silently.
- Keep the existing broken-image fallback working, and make sure its text still
  makes sense.
- If slide count changed, check anything derived from it — progress dots, step
  counters, "last slide" branches.

## Step 5 — Keep the copy file in sync

If a `content.md` (or equivalent) exists, **keep the old copy as a labelled
archive and add the new version below it**, unless told otherwise. Note in it:
which asset each slide uses, what changed versus the archived version, and any
slide whose copy describes a feature you flagged in step 1.

## Step 6 — Make it previewable

The reviewer needs to click through the real thing.

- Find or create a route that renders the guide in isolation without writing to
  the database.
- **Check the auth middleware** — a preview route will usually be redirected to
  the login page. Exempt it, gated on `process.env.NODE_ENV !== "production"` so
  it can never be reached on a deployed build.
- Verify with `curl` that the route returns 200 and that every slide asset
  returns 200 with a non-zero size. Confirm the rendered HTML contains the new
  copy and the right number of progress dots.
- Give the reviewer the exact URL.

## Step 7 — Verify, then commit

- Typecheck and build must both pass.
- Confirm every pre-existing asset is still present.
- Commit to the branch with a message that states the slide-to-image mapping,
  any behavioural change (such as `object-cover` → `object-contain`) and why,
  and explicitly confirms nothing was removed.
- Show the reviewer the generated frames and the preview URL. Call out any
  tradeoff you made and the one-line change that reverses it.
