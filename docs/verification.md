# Verification evidence

Build date: 2026-11-16. Results below are from this local build, not a hosted release.

## Observed checks

| Check | Observed result | Scope and limits |
| --- | --- | --- |
| Python tests | 80 passed; six subtests passed | API, answer combinations, rule parity, release integrity, rollback provenance, public-byte comparison |
| Python coverage | 85.59% overall; Lambda 100% | Python 3.14.6 locally; deployment targets Python 3.12, which CI is configured to test |
| Playwright | 40 passed in Chromium after the design update and portfolio audit | All outcomes, Back with retained answers/reason, urgency changes, restart, keyboard-only completion, native radios, reduced motion, responsive disclosures, 320px width with enlarged text, camera denial/delayed grant, API fallback, request privacy, portfolio links/headings and mockup containment |
| JavaScript syntax | Passed | demo.js, demo-config.js, navigation.js |
| CloudFormation | Passed with only W3002 excluded | API, budget and OIDC templates; W3002 is expected for local Code: lambda/ before packaging |
| Workflow files | YAML parsed | Not a hosted GitHub Actions run or proof of cloud permissions |
| Dependency lock | npm ci completed; audit reported zero vulnerabilities | Three browser-test packages installed; this is not a complete security audit |
| Visual review | Desktop 1440px and mobile 375px screenshots inspected | Local redesigned demo stages; no overflow in the 320px enlarged-text checks |
| Rendered contrast | Representative text and primary controls met 4.5:1; answer boundaries met 3:1 | Computed colours checked for initial and selected states; keyboard focus outline checked; not a whole-site accessibility audit |
| Code/security review | No blocking finding after fixes | Strict inputs, text rendering, camera/API lifecycle, scoped writes and rollback provenance |

TDD evidence:

- Seven initial browser cases failed because the placeholder page lacked the demo controls. Implementation made them pass; the suite expanded to 23 passing cases after the design update.
- Backend contract tests produced 14 failures and 55 passes before validation changes, then passed after implementation.
- New release/delivery tests initially failed because those capabilities did not exist. Eight tests now pass as part of the Python suite.
- Review exposed false success for a missing/empty live-check directory. A regression test reproduced both failures and passed after the guard was added.

Design regression evidence:

- The new Back test failed because the control did not exist, then passed with retained answers and written text.
- The Skip-written-reflection test exposed retained text; the fix clears the field before navigation.
- The keyboard camera-denial test exposed lost focus; the fix focuses Skip camera and adds a polite live region. This verifies DOM focus/live-region setup, not real screen-reader announcements.
- A 320px test with doubled root text exposed a 9px overflow. Constraining the grid track and allowing answer text to wrap made it pass.
- Enlarged-text testing changes root font size; it is distinct from full browser zoom.

No commits were made for these checkpoints: the invoked orchestration workflow requires separate pre-commit confirmation. No deployment or live AWS changes were made during this build.

## Requirements and evidence mapping

| Approved milestone | Prepared implementation | Evidence still needed |
| --- | --- | --- |
| Working demo | Interactive page and browser tests | Real screen reader and physical camera testing |
| Serverless API | Validated Python handler, API template and configurable client | Live API, CORS and browser-to-Lambda result |
| Infrastructure as code | Backend, alarm, budget and deployment-role templates | Reviewed change set and successful deployment |
| CI/CD | PR checks, artifact deployment and OIDC | Hosted successful run and failing-test deployment block |
| Operations | Bounded logs, throttling, alarms and optional budget | Metric visibility, confirmed SNS delivery and budget configuration |
| Recovery | Guarded artifact rollback, integrity/provenance tests | Hosted A → B → A recovery drill |
| Portfolio presentation | Updated App Configuration page and README diagram | Publish updated pages after review |

## Remaining screenshot checklist

Capture temporary results before replacing a release or cleaning up cloud resources. Redact account IDs, email addresses and any unrelated personal information where appropriate. Never include credentials.

- [x] Local demo screenshots on desktop and mobile showing the sample-purchase label and usable controls: see images/demo-desktop.png and images/demo-mobile.png. Capture the hosted version separately after release.
- [ ] Completed reflection showing a neutral outcome and restart control.
- [ ] Browser Network panel showing the live insight request, only three answer fields, HTTP 200 and the JSON insight.
- [ ] Blocked API request alongside a working local insight fallback.
- [ ] API request with an unsupported answer returning HTTP 400.
- [ ] Successful CloudFormation stack and outputs after execution of the reviewed change set.
- [ ] Successful GitHub Actions run showing tests before deployment and the final public-byte comparison.
- [ ] Deliberately failing test on a temporary branch/PR showing deployment did not run; do not break production to collect this evidence.
- [ ] CloudWatch request metrics and the three configured alarms after sample traffic.
- [ ] Confirmed SNS subscription and a clearly labelled synthetic test notification, if email notifications are enabled.
- [ ] Budget configuration showing actual/forecast thresholds and the chosen monthly amount; no claim of notification receipt unless observed.
- [ ] Release B content, successful rollback to release A, and public-byte verification with the source/rollback run IDs.

Record real screen-reader announcements separately: question legends, answer choices, focus after transitions, loaded insights, pause completion and outcomes. Automated browser tests do not prove those announcements. Test the optional camera on actual hardware and confirm the camera indicator turns off after exit/navigation.

## Before publication

Apply and verify the role-policy addition for `cloudfront:GetInvalidation`. Confirm existing bucket, distribution, region and OIDC trust. Review new AWS resource costs and change sets. Configure a real API URL only after its deployment and CORS checks. Keep all unverified hosted results labelled pending.

Suggested commit after review: `feat: build SpendWise demo and cloud delivery workflow`.

## Portfolio audit

The remaining portfolio pages were audited and corrected after the demo design build. See [the findings and fixes](portfolio-audit.md) for content/evidence changes, navigation improvements, responsive mockup fixes and the 17 additional portfolio checks.

Latest targeted verification: the 19 portfolio checks passed after changing the static UX phones to iPhone 17 proportions. This supersedes the earlier content-driven handset height; long screen content now scrolls within focusable, labelled regions.

Latest complete browser run: 44 checks passed after enclosing the demo in the same phone frame as the UX studies. Desktop/mobile dimensions, keyboard interaction and 320px enlarged text passed. Preview images were refreshed.
