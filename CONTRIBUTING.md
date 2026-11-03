# Contributing

Use Node.js 24 or later and npm. Run `npm ci`, `npm test` and `npm run test:ui`
before submitting changes. The full test suite currently targets macOS/POSIX;
the Electron UI smoke test also runs on the Windows packaging runner.

Never add account profiles, session transcripts, OAuth caches, API keys, signing
certificates or project runtime data. Tests use temporary directories and mock
model execution; do not run real paid tasks as part of automated checks.

Preserve the pinned Donchitos snapshot and its license. Change the installer or
provider adapter for Studio-specific behavior. Describe expected behavior, checks
and platform limitations in pull requests. The current source license is LICENSE.
