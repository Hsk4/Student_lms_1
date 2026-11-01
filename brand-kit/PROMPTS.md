# Fastly LMS: prompts

Three kinds: a prompt for a design tool (Framer, v0, Figma AI), prompts for an image generator, and a prompt for exploring logo variations. All share one visual language so the pieces match.

## Visual language (paste this first in any tool)

```
Brand: Fastly, a school learning platform for students, parents and teachers in Pakistan.
Idea: the mehrab (pointed prayer-niche arch) with a small eight-point gold star at its tip.
Colours only: navy ink #0A2540, cobalt blue #1E4DB7, pale blue tint #EAF1FF, firoza teal #0B7F8F (sparingly),
warm gold #F4B942 (only for the star, one call to action per screen, and tiny highlights), white.
Type: Fraunces Bold for headlines (tight tracking), Inter for everything else.
Shapes: pointed arches, 12 to 24 px rounded cards, 1.5 px borders instead of shadows.
Pattern: faint jaali lattice (eight-point stars) in white at 14% on navy, or cobalt at 16% on tint.
Forbidden: gradients, glassmorphism, neon, purple, pink, orange, rainbow chips, stock-photo smiles, clip-art.
Mood: calm, confident, a little ceremonial. Modern, not "Indian sweets shop". Pakistani, not generic edtech.
```

## 1. Web landing page prompt (Framer / v0)

```
Design a landing page for "Fastly", a single-school learning platform. Desktop 1440 wide, fully responsive to 390.

Use the visual language above.

Sections, in order:
1. Hero on navy #0A2540 with a faint jaali pattern. Left: small pill "For [SCHOOL NAME]", headline in Fraunces Bold
   "One school. Everyone in the loop.", one sentence of support copy, a gold primary button "Create an account",
   an outlined button "I already have one", and a line "A parent or guardian? Link with a code".
   Right: a layered pointed-arch illustration (navy, cobalt, pale blue) containing a sun, three rising bars and an open book,
   with three floating white cards over it: "Homework due", "Fee voucher Rs 12,000 Paid", "Attendance this month".
2. "Three doors into one school": three cards (Students, Parents, Teachers), each with an arch-shaped icon tile,
   two lines of copy and one button. Under them a pale blue notice: "Nobody picks their own role."
3. "Ask once. The school office does the rest": three numbered steps (numbers inside small pointed arches) beside a white
   card that shows a waiting illustration and a three-step status tracker.
4. A product peek: a browser frame containing the student dashboard with a navy sidebar, three stat tiles,
   a "Due soon" list with status chips and a fees card.
5. Six feature cards with line icons in arch tiles: homework and grades, attendance, fees in rupees,
   a view for parents, meetings with teachers, support desk.
6. "Join with a code from your child": navy section, four short steps and a white card with eight code boxes.
7. Boards chips (Sindh Board, Aga Khan Board, Federal Board, Cambridge O and A Level), a cobalt closing banner and a navy footer.

Rules: no stock photos, no lorem ipsum, 48 px minimum touch height on buttons, 4.5:1 text contrast, one gold button per screen.
```

## 2. Mobile app prompt (Capacitor Android app)

```
Design four phone screens (390 x 844) for the Fastly school app. Use the visual language above.

1. Splash: navy with jaali pattern, white arch-and-F mark with a gold star, the word "fastly" in Fraunces Bold, a three-dot loader.
2. Welcome: top 45% navy with the arch illustration; a white sheet with 30 px rounded top corners holding
   "Welcome. Who are you?" and three tappable rows (student, parent, teacher) each with an arch icon tile,
   then a cobalt "I already have an account" button.
3. Student home: navy header with the mark, a notification bell with a gold dot, "Good morning, Hira" in Fraunces,
   a white "Next class" card overlapping the header, a "Due soon" list with status chips, a fees card
   "Rs 12,000 Unpaid", two teacher chips, and a five-item bottom tab bar (Home, Courses, Work, Fees, More)
   where the active tab sits in a pale blue pill.
4. Waiting for approval: white with a faint pattern, the hourglass-in-arch illustration,
   "Your request is with the school office", a three-step tracker and a "Check again" outline button.

Rules: thumb-reachable actions, 48 px minimum touch height, no fake status bar, safe-area padding at the bottom.
```

## 3. Image-generation prompts

I could not make photographs here, so these are written for Midjourney, Firefly, Ideogram or similar.
Generate at the stated ratio, then crop into an arch mask (`border-radius: 50% 50% 0 0 / 30% 30% 0 0` or the arch SVG as a CSS mask).

Shared style line (append to each):
`editorial photography, natural window light, soft shallow depth of field, colour grade leaning cool blue and white with a touch of warm gold, calm, uncluttered, no text, no logos, no watermark`

| Use | Ratio | Prompt |
|---|---|---|
| Hero photo (optional, replaces illustration) | 4:5 | A Pakistani schoolgirl in a white uniform with a navy cardigan studying at a wooden desk by a tall arched window, open notebook, morning light, seen from slightly behind her shoulder, face turned away or softly out of focus |
| Teacher | 4:5 | A Pakistani teacher in her thirties explaining something at a green chalkboard to a small class, only partly in frame, warm classroom, hands visible, shalwar kameez in muted blue, no direct eye contact with camera |
| Parent and child | 4:5 | A father and his teenage daughter at a kitchen table looking together at a phone, a cup of chai, evening lamplight, backs and profiles only |
| Classroom detail | 16:9 | Close-up of school desks in a bright Pakistani classroom, notebooks, a blue pencil case, sunlight crossing the floor in the shape of a pointed arch |
| Texture 1 | 1:1 | Abstract jaali lattice carved in pale blue-white marble, shallow relief, raking light, seamless-looking, very subtle contrast |
| Texture 2 | 1:1 | Ajrak-inspired block print in two tones, indigo and white only, small repeating geometric flowers, flat lay on cotton |

Negative prompt (if supported): `text, letters, logo, watermark, neon, purple, pink, orange, cartoon, 3d render, plastic skin, extra fingers, stock photo smile, cluttered`

Tip: ask for faces turned away or soft. It avoids uncanny faces and avoids using a real person's likeness without a release.

## 4. Logo exploration prompt

The shipped mark is already drawn (see `logo/`). Use this only to explore alternatives.

```
Vector logo mark for "Fastly", a school app. A pointed mehrab arch drawn as a thick open stroke in cobalt #1E4DB7,
with a bold sans-serif letter F inside it in navy #0A2540, and a small eight-point gold star #F4B942 sitting in the gap at the
arch's tip. Flat, geometric, symmetrical, works at 16 px, white background, no gradient, no shadow, no text other than the F.
Give me six variations: (1) rounder arch, (2) F merged into the arch's left side, (3) star replaced by a crescent,
(4) arch built from two overlapping strokes, (5) filled arch with the F knocked out, (6) minimal outline only.
```

## Usage notes

- One gold button per screen. Gold text on white fails contrast; use gold only on navy or cobalt, or as a shape.
- Photos always go inside an arch mask or a 20 px rounded rectangle. Never full-bleed rectangles with sharp corners.
- Keep sample numbers in mockups labelled as samples; do not publish them as real results.
