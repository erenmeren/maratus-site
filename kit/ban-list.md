# Ban list: named AI-design tells

You are building or reviewing a page. The patterns below make a page read as AI-generated. Do not use them.
Ids are stable; `scripts/slopcheck.mjs` reports the same ids. A few ids have no automatic check and are judged by the critic.

How to apply this list:
- The user's pick, the brief's own words and a written reason in DESIGN.md override any line here. Write the reason down.
- Removing a tell by reaching for the next default is not a fix. Derive the replacement from the chosen references and the subject's world.
- Never repeat a look listed in `looks/looks-used.md` (concept, palette, faces, hero skeleton, chrome).
- Spend boldness in one place. Before finishing, remove one accessory.

## Palette and ground
- T01 Paper/cream ground. Fix: take the ground from a chosen reference's actual role, or use a plain neutral; never warm off-white by reflex.
- T02 Cream ground + serif or stock display face + terracotta/vermilion accent + mono labels. Fix: break the set. Replace the ground AND the accent family AND drop the mono labels; changing one part is not enough.
- T03 Near-black ground + acid green/lime (or mint) accent. Fix: build contrast with type, scale and real imagery; take the accent from the product or a reference.
- T04 Purple/indigo-to-blue gradient. Fix: solid fills from the palette roles in DESIGN.md.
- T05 Gradient-filled text. Fix: solid text colour; use size and weight for emphasis.
- T06 Glassmorphism, backdrop blur without layering. Fix: opaque surfaces; blur only where content really scrolls beneath a layer.
- T07 Decorative atmosphere: orbs, halos, bokeh, grid-line or stripe backgrounds. Fix: plain ground, or texture and photography of the subject's real material.
- T08 One-note or stock palette (single hue, beige/espresso, slate/navy). Fix: 4-6 named colours with roles; scan the CSS colours before finishing.

## Type
- T10 Monospace chrome: small mono labels and metadata. Fix: mono only for real code, ids or terminals; use tabular figures for numbers.
- T11 Tracked all-caps eyebrow above headings. Fix: delete it, or write the fact into the heading in sentence case.
- T12 Default or overused face: Inter, Roboto, Poppins, Montserrat; also Space Grotesk, Geist, Plus Jakarta Sans, Instrument Serif/Sans, Fraunces, Playfair, Bricolage Grotesque, DM Sans, JetBrains Mono, IBM Plex Mono. Fix: choose from the subject's vernacular or a reference; check the face log in `looks/looks-used.md`.
- T13 One accented headline word or phrase (colour, italic, highlight). Fix: one colour and style per headline; let the wording carry emphasis.
- T14 Flat type scale. Fix: a real scale with clear jumps in size and weight.
- T15 Tiny text. Fix: readable body and labels; nothing below 12px.
- T16 Low-contrast text. Fix: WCAG AA, 4.5:1 for text and 3:1 for large text and UI parts.

## Structure and template chrome
- T20 Decorative 01/02/03 on things that are not sequences. Fix: number only real steps or timelines; otherwise drop the numerals.
- T21 Template hero: centred headline, pill badge above, two buttons below. Fix: one composition built around the product or one fact; one primary action.
- T22 Broadsheet hairlines: thin rules, zero radius, newspaper columns on any subject. Fix: separate with space, scale or surface; use rules only where the content is tabular or editorial.
- T23 SaaS card kit: identical rounded cards in a row, cards in cards, one soft shadow. Fix: full-width bands, lists, tables; a card only for a repeated item or a framed tool.
- T24 Emoji or icon-in-a-tile feature rows. Fix: remove icons that do not speed recognition; show the artefact itself.
- T25 One radius on everything. Fix: tie radius to hierarchy; concentric nesting; square where the subject is square.
- T26 Monument stat strip. Fix: show a number only if it is real, sourced and has comparison context.
- T27 Label chrome: "A · B · C" strings, "name / 01" counters, "WORD — fragment", label bars. Fix: delete; put the fact in a sentence.
- T28 Arrow glued to every link. Fix: plain, specific link text.
- T29 Stock section order: hero, logos, features, stats, pricing, testimonials, CTA. Fix: write the page as a narrative for this content, one job per section.
- T33 Pill shape on every button and tag. Fix: one shape per role, taken from a reference.
- T34 Wrong surface: marketing hero on an app, admin or dashboard. Fix: see `references/dashboard.md`.

## Ornament
- T30 Hard offset shadow. Fix: no shadow, or one consistent elevation system.
- T31 Rotated stamp, sticker or badge. Fix: delete it, or state the fact in the caption text.
- T32 Dashed perforations, ticket edges, receipt tears. Fix: remove unless the user chose the print vernacular at G1; at most one direction may use it.

## Quality floor
- T40 Horizontal overflow at 390 px. Fix: no element wider than the viewport; test 375, 390, 768, 1440.
- T41 Missing states: no visible focus, small tap targets, skipped heading levels, broken without JS or with reduced motion. Fix: :focus-visible, 44 px targets, one h1, real fallbacks.

## Motion
- T50 Fade-and-slide-up on every section. Fix: one orchestrated moment; everything else still.
- T51 Endless decorative loops: marquees, pulsing dots, floating shapes. Fix: motion that responds to the user; pulse only for live data.

## Copy and proof
- T60 Filler words (seamless, effortless, unlock, elevate, supercharge, empower, world-class, next-generation). Fix: say what it does, for whom, with one hard fact.
- T61 Vague calls to action ("Get started", "Learn more"). Fix: a verb plus the object or outcome; the same verb carries through.
- T62 Fake proof: invented logos, reviews, counts, avatars. Fix: real proof or leave the section out; mark drafts as DRAFT.
- T63 Headline cadence: "Not X. Y.", rule-of-three lists, questions as headlines, "where X meets Y", exclamation marks. Fix: plain nouns and verbs.

## Imagery and process
- T70 Imagery that is not the subject: gradient blobs, SVG clip art, fake dashboards, stock people. Fix: the real product, place or data; otherwise design with type.
- T71 Generated media of product internals. Fix: real CAD renders only (`blender-render` skill); generated media for environment scenes only, labelled as concept.
- T80 Dashboard slop: KPI-card mosaics, donuts, gauges, axis-less sparklines, invented numbers. Fix: see `references/dashboard.md`.
- T90 Drift: fonts, colours, radii or sizes outside DESIGN.md. Fix: use tokens only; log deviations in build-notes.md.
- T91 Re-skin: the old page's skeleton with new colours. Fix: build from the content deck, not from the old index.html.

Copy rules T60-T63 and the widths in T40 are adapted in part from taste-skill (MIT).
