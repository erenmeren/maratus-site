# Maratus site: design and build notes

Direction C, "Two sides of the counter", raised to a live 3D page. Pink is the customer's side, oxblood is yours.

## Tokens (css/base.css)
| Role | Value |
|---|---|
| Customer's side: hero, how, close | pink `#f6b8c1` |
| Places, receipts, technical text | blush `#fdeef0` |
| Loyalty, off the Dock | rose `#ef98a6` |
| Offers, who connects it | tangerine `#f58a58` |
| Menus | peach `#ffd1a8` |
| Your side, tickets, footer | oxblood `#4a0c1f`, text `#fde3e7` / `#eebac3` |
| Text | ink `#3a0816`, second `#6d2a3c` |
| Code panels (developers page) | night `#26040f`, text `#fde3e7` / `#c790a0`, strings tangerine, keywords rose, placeholders pink |
| Mark | orange `#d9552b` (the Dock's ends) |

Type: Gabarito, one family. Display 800, tracking -0.03 to -0.055em, line height .8 to .94. Body 20px. Nothing under 13px.
Mono only for request code. Radius by role: 34/28 pictures, 20 buttons, 14 table rows.

Gabarito is self-hosted (`assets/fonts/`, SIL OFL) and preloaded by all pages. A size-adjusted Avenir Next stands in while it loads.

## How the page works
- `html.live` is set before first paint when motion is allowed, WebGL 2 exists and the window is at least 480 px tall. Without it the
  page is the stills version: normal flow and stills of the same model, all in option 1 (Retro); the colour list there changes nothing and says so. Pause switches between the two in place.
- `.stage` is one fixed canvas (z 1). Every pinned section has a `bk` layer behind it (z 0: ground, giant words, photos) and an `ft`
  layer in front (z 2: text). That is where the depth comes from. Sections overlap by one screen, so the next ground wipes
  up behind a device that stays where it is. Scrolling is native; only reading `scrollY`, eased over about 100 ms.
- `js/home.js` holds the choreography: keys anchored to a section and a progress in it, each a bag of numbers (`POSE` in
  `js/stage.js`). `js/screens.js` draws the device screens and the phone. Both read in order of the page.
- The hero pose is fitted to the headline's real size, and the poster uses the same numbers.
- Nothing renders while nothing changes, while the tab is hidden, or while the connect section covers the stage.

## Places
`data/venues.json`. Swap a photo by changing `src` and `small`, then set `edge`, `stand`, `focus`, `zoom` (explained in the file).
`still` is the device alone for the stills version. Five places; keep the set tight. The text list in index.html is what visitors without JavaScript see; keep it equal.

## The model
`assets/3d/maratus.glb`, 522 kB, Draco, from `cad-src` by `tools/export_glb.py`; `assets/3d/props.glb`, 136 kB, by
`tools/export_props.py` (holder and USB-C plug: examples, not CAD; loaded after the first picture). AO is baked twice (Core on the Dock,
Core away) and mixed by how far the Core has moved; the ground shadow likewise. The steel post and the phone are drawn in stage.js.
Studio light is generated in code, no HDR file.

- **On and off the Dock there is one path**, `liftAt(lf)` in stage.js: bolt drawn back, 9 mm straight out of the Dock's face (off the
  3 mm bolt and the 1.4 mm pins), then 80 mm up along the face's 20 degree lean. Keys only move `lf`; the Core may turn or go elsewhere
  only while `lf` is 1. The spring pins are compressed while it is seated and come out as it leaves. On the technical page `route()`
  in tech.js keeps the same rule, and the picture fades where a straight move would pass through something.
- `tools/collide.mjs` proves it: triangle against triangle on the live meshes, over the whole scroll range. Run it after touching a key.
- Off the Dock the Core is placed with `freeAt(x, y, z)`. Holder and post stand still; the Core goes to them.
- `mag` (0 to 1) opens round windows over the two magnets in the Core's back and draws the rings. An explanation, not a hole.
- The name is printed on the glass, under the screen, with the hardware's own letters: `js/mark-data.js`, written by `tools/mark.py` from the
  lens drawing (`maratus-core-lens.dxf`, layer `mark`: Noto Sans Bold as outlines, 18.82 x 3.09 mm, its middle 5.84 mm above the lens's bottom
  edge). No font file is used. A flat, unlit decal, so it keeps its exact colour. The Peek logo stays in nav, footer and on the device's screen.
  Nothing is engraved on the underside.
- Case colours (`COLOURS` in stage.js): the eight pairs of `ref/maratus-dock-tile-colours.pdf`, in its order, names and hex values. Body
  colour on Core and Dock, base-plate colour on the Dock's ends (our Dock has no base plate), wordmark colour on the glass. Two differ from
  the sheet (owner, round 9): 4 is yellow and grey, 5 is blue and grey; their whole Dock is Retro grey (`dock`), and 5 has a grey wordmark. The hex values
  are the materials' own colours; light and shade come on top. The same values are in css/base.css (`.sw`): change both. The picker
  changes four materials on the model and nothing else on the page. Proposals; none is decided. Pins stay 20.
- `shots/colours.jpg` (A, as on the site), `colours-mono.jpg` (B, the whole Dock in the Core's colour; not on the site) and
  `colours-compare.jpg` (1, 4, 5 and 8, A above B): the live model, one angle. `case-*` in `tools/snaps.mjs`, put together by `tools/sheets.mjs`.
- `tools/lab.html` renders one pose (developer tool, do not deploy). `tools/snaps.mjs` uses it for posters and stills.
- `tools/qr.mjs` writes `js/qr-data.js`.

## Docks page (`docks/`, js/docks.js, css/docks.css)
Three candidates for the lens body, none chosen: BAR, TILE, MONO. One scale, one angle, one line (`dockPose` in stage.js), so they can be compared.
- Models: `assets/3d/dock-{bar,tile,mono}.glb` (191, 203 and 219 kB, Draco), from maratus-hardware/mechanical/dock-lens-* by `tools/export_docks.py`,
  with AO and ground picture of their own. BAR is the home page's Dock. What a seated Core hides (pins, pads, magnets, boards, lock) is left out.
  Core place: from scene.json, checked on the Core's vertices (0.000 mm off). The port drawer is the same part in all three; USB-C and RJ45 move with it.
- One WebGL renderer draws all three (`new Stage(null, { share })`) and is copied into each section's 2D canvas. A model loads when its section is within
  two thirds of a screen. One slow turn when first seen, then drag or Front / Side / Back; nothing renders while nothing changes.
- Second colour: BAR's end caps, TILE's base plate, MONO's port plate (the drawer) and base plate. MONO's scene.json has one colour; the second is ours.
  Yellow and blue: the whole Dock is Retro grey, as on the home page. Each Dock has its own picker (shared CSS in base.css, colours by `--pick-*`).
- Facts come from design-spec.md section 13 (entries of 2026-11-18 to 21), sizes from scene.json, MONO's 3 mm chin and 8 mm edges from the same section.
  `size[1]` in scene.json counts from the frame's origin: measured on the meshes BAR is 60.8 mm deep (61.4 given) and TILE 88.5 (88.6 given).
- The studio's glass reflection is strongest near yaw -38 to -44, so the resting angle is -29. The key light is steeper here, so the shadow stays in the frame.
- `tools/collide.mjs --url .../site/docks/ --dock KEY --steps 1` checks the seated Core against its Dock.
- Stills version: front and back still of each Dock in Retro, no pickers.

## Developers page (`developers/`, js/dev.js, css/dev.css)
Linear is the reference for structure and restraint only: the product as the hero, dense reference tables, fine rules, slow motion. Ground, type, nav and
footer are this site's: pink is the customer's side, oxblood and night are yours.
- Every endpoint, scope, status, error and example comes from `openapi.json` in maratus-admin, with its wording. API terms keep the spec's spelling
  ("organization"). Left out on purpose: everything about money, quotas and trial triggers. `device_not_subscribed` uses the spec's example message.
- Hero: one real request types itself (each line is complete in the HTML; a `clip-path` in `ch` reveals it), the response appears, the live device changes
  from idle to `code`. Screen `code` (js/screens.js) shows the QR of `https://example.com/receipt/8812`, the spec's example link (key `dev` in qr-data.js).
  Once, then only on "Send it again". Pose `HERO` in dev.js and `DEV` in tools/snaps.mjs are the same numbers; `dev-idle.webp` is the poster, `dev-code.webp` the still.
- `Stage.load({ props: false })`: the home page's model without holder and cable.
- Path: one pinned window, one picture. `CAM` in dev.js is the camera along the counter (progress, x, y, zoom); slips of code stand in front and move
  more, the word and the phone picture wipe in. Without `live` it is four steps with stills.
- Pins: `PIN` in dev.js lists what is set after each call; colours, broken lines and `affectedDevices` are computed from device > store > organization.
  DELETE on a device or store resets it to inherit; on the organization it clears. Two stores with three devices give the spec's own 6, 3 and 1.
- Illustrations: `assets/dev/*.webp` from `ai/dev/d01, d02, d04, d05` by `tools/scenes.mjs`. The generator's invented screens are replaced by the site's own
  (device, phone, laptop); the laptop's name, the cards' and the door's lettering are painted out; the night scene's left is darkened for text.
  Each is labelled "Illustration". They load after the 3D is up or on the first scroll.
- Reasons for deviations: rules and monospace are in the brief, and only on tables and code. The numbered-looking rail is a real sequence.

## Pricing page (`pricing/`, css/price.css)
No amounts, no tiers, no script. Facts from owner-answers.md and the other pages. `still-apart.webp` (tools/snaps.mjs): Core and Dock, both lent.
One movement, a scroll-driven CSS animation on the picture, off with reduced motion.

## Navigation
Eight links and the button need 1190 px; below that the Menu. Header and footer are equal on all five pages: change all of them.

External links (docs.maratus.co, console, api, GitHub) open in a new tab: `target="_blank" rel="noopener"`. mailto: does not.


## Positioning
Maratus is the bridge. Section 2 is split in the two ground colours of the system: oxblood is your business, pink is your customer, and
the device stands on the seam. Receipts, offers, loyalty, tickets and menus are examples; the sixth panel says so.

## Reasons for deviations
- Numerals 1 to 3 in "How it works": a real sequence.
- The header hides while scrolling down, so it never crosses the device. It returns on scrolling up, with a solid ground.
- On phones the text of "off the Dock" stands on a solid rose field, so the steel post and the cable end behind it.
- The holder, post and cable carry the caption "examples"; the case colours say that they are proposals.
- The technical page's spec rows share one radius: they are one table.

## Not for deployment
`tools/`, `shots/`, `DESIGN.md`, `assets/fonts/README.txt`.
