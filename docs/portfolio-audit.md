# SpendWise portfolio audit

Date: 2026-11-16. Scope: the SpendWise introduction, research, UX, app-configuration and legacy case-study pages in this repository. The separate personal portfolio repository and live AWS account were not changed or audited.

## Findings and fixes

| Finding | Change made | Verification |
| --- | --- | --- |
| Introduction presented future mobile features as the current product | Lead with the working browser demo and cloud engineering project; add Browser demo, Cloud configuration and Mobile concept status cards | Content assertions and desktop/mobile review |
| Market figures and competitor absolutes lacked verified sources | Remove $816B, approximately 28%, 84%, and claims that no competing tool exists; describe the actual engineering scope instead | Public-page text checks |
| Precise survey percentages lacked a dataset, sample size and dates | Remove public percentage charts; retain research questions labelled as proposed work | Content assertions; instruments anchor and questions remain present |
| Persona details and research themes read as verified interviews | Label personas as illustrative scenarios; replace unsupported interview conclusions with questions to validate | Heading/content checks |
| Earlier reconstructed study chart could be mistaken for current measured results | Retain it with explicit unverified historical attribution and missing-source requirements; separate it from functional tests | Source review |
| Behavioural theory was stated as proof that this app changes spending | Use two linked primary theory sources; label application to SpendWise as a design interpretation or hypothesis | References checked during audit; no effectiveness claim |
| UX page still described scoring and unequal decisions | Document the implemented browser flow, neutral summary and equal outcome emphasis; identify mobile accounts/history as planned | Content checks and visual review |
| Static insight mockup still emphasised saving over continuing | Use matching presentation for the three decisions | Visual/source review |
| Long mobile navigation appeared before page content | Add native responsive disclosure on the four portfolio pages; keep desktop navigation expanded | Keyboard disclosure tests at 320/375px and desktop checks |
| Mobile section links could leave focus in hidden navigation | Collapse the menu after selecting a section and focus its destination | Keyboard section-jump regression test |
| Persona headings skipped from level 2 to level 4 | Make each persona name a level-3 heading | Heading-order regression test |
| Fixed compact mockup frames clipped content at enlarged text | Use responsive galleries and content-driven card height; increase label size and keep mockup navigation in normal flow | Regression test initially found 16 clipped mockups; no clipping after fix |
| CI/CD and invalidation descriptions no longer matched workflows | Describe PR/push/manual checks, artifact packaging, public-byte verification and viewer-facing invalidation paths; document GetInvalidation update | Compared directly with workflow and role source |
| Earlier hosting/IAM observations read as fresh live evidence | Label them historical and unverified in this audit; distinguish templates from live role configuration | Source/content review |
| Entry actions animated in after a delay | Remove the CTA entry animation; retain reduced-motion handling across the portfolio | Visual review |

## Verification results

- Full Playwright suite: **40 passed** (23 demo/design checks and 17 portfolio checks).
- Python: **80 passed**, with six passing subtests.
- Portfolio pages checked at 1440px, 375px and 320px: no page errors or failed local asset requests in the browser checks; no horizontal page overflow observed.
- Local links, section IDs, heading order and the legacy case-study redirect passed browser checks.
- Mockup content fits its cards with doubled root text size. This is an enlarged-text test, not full browser zoom.
- Shared-style changes were checked against the full demo regression suite.
- Desktop/mobile screenshots were captured and inspected locally. No hosted content or live AWS state was verified.

The initial audit tests reproduced the absent mobile disclosure, unclear implementation status and clipped mockups before the fixes. An editing mistake temporarily removed the questionnaire section; it was restored before the passing link/heading checks. The final page retains ten proposed survey questions and eight interview questions.

## Evidence boundaries and remaining work

- Original survey data, sample sizes, recruitment details and dates are required before restoring numerical findings. Removed percentages are not treated as research evidence.
- The seven-row historical chart is retained only as an explicitly unverified reconstruction. Obtain the original source and calculation definitions before presenting it as a measured result.
- Real VoiceOver/NVDA announcements, full browser zoom, and physical camera behaviour remain manual checks.
- Only local navigation/assets were tested comprehensively. This is not a full availability audit of every external destination.
- Live API integration, deployment permissions, hosted CI/CD, notification delivery, budgets and rollback still need cloud evidence.
- No commits, push, publication or cloud resource changes were performed during this audit.

## Primary research references consulted

- [BJ Fogg: Fogg Behavior Model](https://www.behaviormodel.org/) — motivation, ability and a prompt; application to this app is explicitly a hypothesis.
- [Self-Determination Theory: theory overview](https://selfdeterminationtheory.org/the-theory/) — autonomy, competence and relatedness; clear choices and exit are the project's design interpretation.

## Final local previews

- [Desktop introduction](images/portfolio-introduction.png)
- [Mobile introduction](images/portfolio-introduction-mobile.png)

## Navigation preference update

The user subsequently requested an open sidebar. Collapsible project menus were replaced with always-visible navigation on every page. The latest portfolio regression tests expect visible links at every tested width and retain section-target focus without closing navigation.
