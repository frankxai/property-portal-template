# Dependency release review · 2026-09-13

GitHub CI on d47773e217d4678d90126e3e15bc80f77f792b38 correctly blocked release at its existing moderate-or-higher audit gate. The inherited lock contained eight reported vulnerable packages, including a critical Next.js advisory. The audit threshold was preserved.

Updated Next.js to 16.3.5, sharp to 0.35.4 and PostCSS to 8.5.23. Regenerated the lock using npm's compatible audit fixes, which also updated fast-uri, hono, ip-address, nanoid and qs. The resulting audit reported zero vulnerabilities on the review date. React, the MCP SDK, the authentication package and application behavior were not changed by this dependency correction.

Primary advisory references:

- [Next.js image optimization advisory](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4): patched 16.x line starts at 16.3.3.
- [sharp / libheif advisory](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c): patched version 0.35.4.
- [PostCSS source-map advisory](https://github.com/advisories/GHSA-r28c-9q8g-f849): dependency override moved to 8.5.23.

The release requires the same content, type, build, protocol and authentication checks on the updated lock. Deployment and CI receipts belong to the pull request so the recorded source commit remains unambiguous.
