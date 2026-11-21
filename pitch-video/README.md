# kaikei pitch video

A 77-second Remotion video (1920×1080, 30 fps) with an original soundtrack. It is standalone, with its own dependencies, and is excluded from the app's typecheck and lint.

```bash
cd pitch-video
npm install
npm run studio      # live preview and editing
npm run render      # out/kaikei-pitch-en.mp4
npm run render:es   # out/kaikei-pitch-es.mp4
npm run music       # regenerate public/music.wav
```

- **Music:** `scripts/make-music.mjs` synthesizes it from code (100 BPM, A minor), so it is license-free. One bar is 72 frames, and every scene starts on a bar line (`TIMELINE` in `src/theme.ts`). The beat drops when the pipeline scene starts.
- **Copy:** `src/copy.ts` holds the English and Spanish text. The facts come from `fixtures/grupo-ag/` (answer key, rate table) and the severities from `docs/MANIFESTO.md` §4.3. The video shows no consolidated total. The fingerprints and run numbers in the "Reproducible" scene are illustrative.
- **Brand:** the logo paths come from `components/brand.tsx`, and the fonts (Excon, Synonym) are copied from `app/fonts/`.
