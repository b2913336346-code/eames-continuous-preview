# Three.js vendor build

`three.min.js` bundles the named exports used by the Eames spatial renderer from Three.js 0.187.0. The upstream MIT license is included in this directory. The static site loads the bundled engine locally through the spatial runtime.

The bundle was produced with esbuild 0.28.2 using ESM output, bundling, minification and inline legal comments. Its entry point re-exports the Three.js symbols referenced by `geometry.js` and `renderer.js` from the package's `build/three.module.js`.

[Three.js 0.187.0 source](https://github.com/mrdoob/three.js/tree/r187)
