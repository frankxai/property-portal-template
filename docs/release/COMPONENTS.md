# Component contracts

Keep the existing calm CSS transitions. Neither Motion nor GSAP has a demonstrated product job in the portal; avoid adding an animation runtime.

| Module | Contract |
| --- | --- |
| `components/PrincipalWorkspace.tsx` | Reuse the exported component and existing data model. Keep responsive rules, semantic controls and reduced-motion behavior. |
| `components/SiteNav.tsx` | Reuse the exported component and existing data model. Keep responsive rules, semantic controls and reduced-motion behavior. |
| `components/PropertyHero.tsx` | Reuse the exported component and existing data model. Keep responsive rules, semantic controls and reduced-motion behavior. |

Documented code remains the authority until a product-specific Figma component is mapped and rendered parity is reviewed. Test long labels, a 320px viewport, keyboard focus, empty/error states relevant to the route and the real primary action. Charts need textual/table equivalents; decorative layers stay out of the accessibility tree.
