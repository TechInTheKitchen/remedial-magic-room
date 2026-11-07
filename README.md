# Remedial Magic — Rooms

Standalone, buildless GitHub Pages companion. All work stays here; the source vault is untouched.

## Preview and hosting

The running preview is http://127.0.0.1:4173. Use any static web server in this directory. For GitHub Pages create a separate repository on main and choose Settings → Pages → GitHub Actions; the included workflow deploys it. Relative asset paths support repository subpaths. No custom domain is copied.

## Connections

The public Metered key is in assets/config.js. Never add a secret key. Create a room and share its invitation. Each connection uses one bundled offer and one answer, plus service responses. No polling, subscriptions or automatic signaling retries. Players close signaling once their WebRTC channel opens; the GM keeps signaling available for arrivals. Character updates and Faculty Suspicion use reliable WebRTC only. Slow ICE gathering uses available candidates after 12 seconds. TURN may relay data when direct connections fail.

## Student records

Based on the Prisms Student Handbook: name/address, specialty school/color, knack, outstanding business, level 1–5, draw values, ten Composure marks with Dazed at zero, shield, expedition, component counts by color and Own/Loan/Found/Extra, computed totals, half-pouch warning, notes and debrief. Faculty Suspicion is a GM-controlled 0–6 shared track. Rules consequences are manual; editing Suspicion to six does not automatically apply consequences or reset it.

## Saving and recovery

Edits and received state save immediately to localStorage. Each tab has its own stable character ID in sessionStorage, surviving refresh. A previous snapshot is retained under the same save key with `-previous`. Local saves are browser storage, not immutable archival storage: clearing site data or private browsing can remove them. Export JSON regularly for portable backups.

After refresh click Open saved table to inspect the saved table offline, or create/join to resume online. The GM restores its table on Create room. A GM refresh changes its Metered peer ID: generate a new invitation. Players retain character IDs across refresh and rejoin their existing record; the GM's existing record is authoritative. New tabs have independent identities for local testing. Open saved table can recover the most recently saved table when returning in a new tab. Export/import transfers records across browsers/devices. Browser copies use the same origin; localhost and GitHub Pages have separate storage.

Export JSON saves versioned table data. Import validates structure and bounds before asking to replace the table. Players must leave their live room before importing. Imports by the GM synchronize the replacement table. Old version-1 composure backups with valid 0–10 values are supported. Exported saves contain character data, no Metered key or connection credentials.

## Limits

Trusted-group prototype: invitation holders can join; no approval queue, signed identities, host migration, or automatic reconnect. Up to 12 live peers per GM. Stale peer cleanup and full reconnect UX remain future work. Notes and record fields are shared with the entire table. Changes commit when a field is confirmed or loses focus. Use JSON backups before large edits.

## Attribution

Broken-wand favicon, palette and theme-button styling copied from the Remedial Magic site. Original hosting-template license retained in TEMPLATE-LICENSE. Handbook used as the student-record reference.

## GM/player separation (latest)

Create GM room creates no character. The GM sees a read-only party tracker: student name, Composure, specialty school/color, level, outstanding business. Players see and edit only their own full sheet. GM saves use a separate storage key from student saves. A detected save prompts Load before creating/joining or opening saved data; declining starts fresh. Version-3 exports record GM/player role. Legacy JSON table imports into a GM room omit the legacy host character when its ID is available. Two live connections claiming the same student ID are rejected to prevent duplicate tabs from overwriting a character. Separate browser profiles can simulate separate students. Previously open tabs must all refresh to use the new protocol/UI.

## 3D dice

Three.js 0.180.0 and cannon-es 0.20.0 are pinned local browser modules under assets/vendor. Original MIT notices are in licenses/ and THIRD-PARTY-NOTICES.md; they ship with the Pages artifact. No npm/build is required to run the vendored app. The libraries load lazily on the first animated roll (about 2.35 MB uncompressed), then browser module caching reuses them during the visit. Textures are generated with canvas; no dice images or remote CDNs are requested.

Dice collide in a local physics world. The settled upward face supplies the result; tilted dice are automatically tossed again, up to three attempts. Timeout, unavailable WebGL, and reduced-motion preferences use the existing random-face fallback. Only final dice data is saved/shared, with no animation-frame networking. GPU resources are disposed after each roll. The 3D tray is transient; the persistent result is shown as compact dice and a text summary. Browser QA verified a complete five-die physical roll and saved results; six-face orientation and cocked-die checks also pass.


## Custom domain and QR invitations

Production domain: https://remedialmagicroom.the-kitchen.dev . CNAME is included in the Pages artifact. In repository Settings → Pages set the custom domain to remedialmagicroom.the-kitchen.dev and enable Enforce HTTPS when available. At your DNS provider add CNAME host `remedialmagicroom` targeting `techinthekitchen.github.io` (no repository path). The app keeps relative assets and uses its current origin for invitation links, so both the custom domain and GitHub Pages URL work. Localhost previews deliberately keep localhost links and warn that phones cannot join them.

The GM's Show join QR code button encodes the same invitation as Copy invitation link, using the local MIT-licensed qrcode-generator 1.4.4. No link is sent to a QR service and opening the QR dialog sends no signaling messages. A new GM session requires a new QR code.
