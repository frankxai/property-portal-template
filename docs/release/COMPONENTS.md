# Component contracts

The existing documentation and running routes are the component catalogue. `/` is the German sample investment workspace; `/admin/sign-in` exposes the locked deployment boundary. Property/renter routes remain a separate sample workflow.

| Module | Inputs and behavior | Release contract |
| --- | --- | --- |
| `components/PrincipalWorkspace.tsx` | Session-local sample assets, investment assumptions, stress scenarios, decision queue and model import/export. Model files are validated by `packSchema`; malformed, oversized or incompatible packs are rejected. | Retain fictional/model labels and German language scope. Assumption edits reset evidence status. Preserve schema limits and model-derived calculations. Exporting a model does not persist it to a tenant database. |
| `components/SiteNav.tsx` | Reads pathname; hides itself on `/` because the workspace owns its navigation. Other routes expose Property, Renter portal, Support, Owner, Workbench and native Operations details. | Use named links and the native keyboard-operable disclosure. At phone widths, wrap controls inside the viewport and preserve focus. |
| `components/PropertyHero.tsx` | `property: PropertyProfile`; reads the first configured unit, public area, description, image and status. | Supply a nonempty unit list. Inquiry and renter-portal links remain sample navigation. The exterior image has descriptive alt text and unresolved third-party rights; replace/clear it before commercial listing. |

`app/principal.css` `.pw` and `app/globals.css` `:root` are the two existing token scopes. Regenerate projections after source edits. Keep the portal's calm CSS transitions; there is no demonstrated need for Motion or GSAP here.

The portfolio table deliberately scrolls horizontally on phones. Its positioned wrapper contains absolutely positioned screen-reader labels; moving those labels to the viewport creates document overflow. Test the page at 320px while retaining table access and accessible column labels.

Browser checks cover `/` and `/admin/sign-in` at 1280, 390 and 320px, automated WCAG rules, keyboard focus, page errors and reduced-motion stability. Six decoded-pixel baselines detect rendered changes. Existing validation and identity policy/token/schema checks remain separate from real-provider integration verification. Listing approval and production identity setup remain explicit gates.

Product-specific Figma nodes remain unmapped in `release/component-map.json`; the inspected portfolio reference is not template parity evidence.
