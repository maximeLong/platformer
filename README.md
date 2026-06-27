# Platformer

A browser-based 3D platformer built with [Three.js](https://threejs.org/) — a port of Kenney's Starter-Kit-3D-Platformer. Everything lives in a single `index.html` with `models/*.glb` assets; no build step.

## Launch

It must be served over HTTP (not opened as a `file://`) so the ES module imports and GLB fetches work:

```sh
python3 -m http.server 8765
```

Then open http://localhost:8765 in your browser.
