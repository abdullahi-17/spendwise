# SpendWise app design plan

Status: approved and implemented locally, 2026-11-16. Browser checks and remaining manual verification are recorded in verification.md. Scope is the existing browser demo and its portfolio presentation. Accounts, saved history, shopping-app detection and the production mobile app remain outside this build.

## Design direction

Keep the existing navy, blue, white and pale background. Use a calm, readable interface focused on one decision at a time. The app experience should be easy to try; architecture and engineering evidence should be available alongside it without interrupting the reflection.

## Layout changes

| Area | Current | Proposed |
| --- | --- | --- |
| Demo entry | Large heading, flow-preview button and separate section before the app | Compact heading, one-line sample disclosure and the working app visible earlier |
| App container | Phone frame, decorative notch and dot-only progress | Responsive app card; retain the phone frame for case-study mockups, remove the fake notch from interactive use |
| Mobile navigation | Full portfolio navigation precedes demo | Compact brand and accessible disclosure for project navigation, keeping the demo close to the top |
| Screen structure | Different vertical arrangements and flexible empty space | Consistent header/progress, prompt, choices, navigation and exit placement; allow content to grow with text zoom |
| Design explanation | Long explanation and implementation metadata beside the app | Short screen explanation on desktop; a collapsible explanation below the app on mobile |
| Engineering evidence | Mostly on App Configuration page | A compact section below the demo linking to architecture and explaining tested delivery, fallback and pending hosted evidence |
| Initial actions | Skip reflection and Exit reflection lead to the same result | One clearly labelled exit control; retain contextual Skip camera / Skip pause / Skip reflection text |

Use a single column on small screens. On desktop, give the app the main column and explanations a narrower secondary column. Keep reading widths controlled and avoid fixed card heights that clip enlarged text or translated copy.

## UX changes

1. Start with the sample item and a clear Start reflection action. Explain briefly that no purchase or retailer cart is connected.
2. Keep all three questions, one per screen, with native radio controls and explicit Continue. Add Back and preserve selected answers. If urgency changes, recalculate whether the optional pause belongs in the remaining flow.
3. Replace dot-only progress with readable stage names and Question 1 of 3 on question screens. Optional steps should not make a percentage jump unexpectedly.
4. Keep the camera optional. Rename the step Optional mirror and explain the local preview before requesting access. Offer Use camera and Skip camera. No repeated prompt after denial; stop tracks on navigation and late permission responses.
5. Keep the ten-second pause skippable. Show a short grounding prompt and announce completion once, rather than announcing each second.
6. Keep the written reason optional with a visible label and 140-character limit. Explain that it stays in the current page and is cleared on restart. Preserve it when moving back within the same reflection.
7. Present the three outcomes with comparable button size, type and emphasis. Do not visually reward delaying a purchase over continuing shopping. Preserve an explicit simulated-action explanation.
8. Show a simple decision summary and Start another reflection. Do not introduce a confidence score, psychological measurement, reminder promise or history claim.
9. Keep API loading feedback brief. A failed request must still show the local insight. Put endpoint status, latency and request details in the engineering explanation, outside the decision controls.

## Colour and typography

Retain the palette; standardise its use instead of introducing a new theme.

| Role | Colour | Use |
| --- | --- | --- |
| Page background | #F5F7FB | Overall canvas |
| Card surface | #FFFFFF | App and explanation surfaces |
| Headings | #172B49 | Titles and strong text |
| Body text | #4C5D75 | Explanations and secondary content |
| Primary action | #2455BE | Start and Continue |
| Hover | #173E92 | Primary action hover |
| Selected surface | #EAF0FC | Selected answers with visible radio state |
| Decorative border | #B4C6E8 | Card separators; not the sole control boundary |
| Focus/control border | #2455BE | Visible focus and meaningful control boundaries |

Keep Arial/Helvetica and the existing system-font fallback. Use approximately 16px body text, 24–28px app titles and 14px supporting labels. Use an 8px spacing rhythm, consistent 12px control corners and at least 44px touch areas. The outer portfolio heading can be larger, but should not dominate the interactive app.

Do not use green/red to label purchase decisions. Identify selection and errors with text or symbols as well as colour. Measure text and component contrast on actual rendered states before calling the design accessible.

## Implementation order

1. Adjust the page hierarchy, responsive app card and mobile navigation.
2. Standardise typography, spacing and colour tokens used by the demo.
3. Add Back with answer/reason preservation and readable progress.
4. Equalise outcome presentation and refine camera/pause/exit wording.
5. Move engineering details below or beside the flow and update case-study screenshots.
6. Extend browser regression tests for navigation, changed urgency, retained input, keyboard focus and zoom. Perform visual and real screen-reader checks separately.

## Acceptance checks

- [x] Start reflection is easy to locate at desktop and mobile sizes.
- [x] Every question supports Back without losing answers.
- [x] Changing an urgency answer correctly adds or removes the optional pause.
- [x] All three decisions have comparable visual emphasis.
- [x] Camera, pause and written reason remain optional.
- [x] Keyboard focus follows the active screen and does not disappear.
- [x] At 320px width and enlarged text, controls remain readable and reachable.
- [ ] Text, selected states, focus indicators and control boundaries pass measured contrast checks.
- [ ] Real VoiceOver or NVDA checks confirm labels, transitions, insight and pause announcements.
- [x] The portfolio clearly separates locally verified results from pending cloud evidence.

The user approved implementation after reviewing this plan. The existing pre-commit gate remains pending. No commit, publication or new cloud deployment is claimed.

## Local implementation screenshots

These screenshots show the browser demo, not a deployed mobile product:

- [Desktop entry](images/demo-desktop.png)
- [Mobile entry](images/demo-mobile.png)
- [Decision screen with equally styled outcomes](images/demo-decision.png)

Representative rendered contrast and enlarged-text checks passed. A complete manual contrast audit, full browser zoom review and real screen-reader announcements remain separate checks.

## Navigation preference update

The user requested an open sidebar after reviewing the portfolio audit. Navigation now stays expanded on all pages: fixed at the left on desktop and fully visible above the content on narrow screens. The app-step explanation remains a separate optional disclosure.

## Phone proportions update

The user requested shorter, realistic phone frames. UX wireframes and interface studies now use the iPhone 17 outer width-to-height ratio, 71.5:149.6, scaled to a maximum width of 240px. Longer content scrolls inside focusable, labelled screen regions. Apple source: https://www.apple.com/iphone-17/specs/. Desktop/mobile sizing and the portfolio suite passed (19 checks). [Updated studies](images/ux-phone-proportions.png).

## Interactive demo enclosure

The user requested the same phone enclosure for the live browser demo. It now reuses the UX handset frame and iPhone 17 proportions, with a focusable scrolling screen, decorative status bar, and home indicator. Explanations remain outside the phone. The complete 44-test browser suite passed after this update.
