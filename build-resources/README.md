# Studio Monitor icon

Generated with the built-in imagegen tool, then resized and converted with macOS
sips/iconutil and the checked-in scripts/build-icons.mjs format encoder.

- icon.png: 1024 × 1024 RGBA master used by the UI and Electron window/Dock.
- icon.icns: native macOS application icon.
- icon.ico: Windows icon containing 16, 32, 48, 64, 128 and 256 pixel images.

Run `npm run build:icons` on macOS to regenerate the native formats from icon.png.
The generated formats are committed, so consumers and CI do not need an image API.

## Generation prompt

Use case: logo-brand. Create a polished production desktop application icon for Studio Monitor, a local command center coordinating teams of coding agents. One icon, square 1024x1024 composition. A near-black rounded-square tile, centered with generous transparent outer margin, premium restrained black-and-white software identity consistent with a monochrome interface. A bold white geometric abstract orchestration symbol: three precise interlocking layered paths arranged into a compact architectural S-shaped mark, subtly suggesting coordinated independent modules converging in a central hub. Clean flat vector-like geometry, carefully balanced negative space, exceptionally crisp edges, consistent thick bands, optically centered and clearly readable at 32x32 pixels. A slight soft tile shadow is acceptable, no shiny plastic or 3D effects. Make this feel like a finished professional Mac and Windows developer tool icon, distinctive rather than generic terminal brackets. Strict monochrome palette. No text, no letters rendered as typography, no numbers, no app mockup, no labels, no watermark, no surrounding scene, no comparison grid. Transparent outside the rounded-square tile.
