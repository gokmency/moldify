<div align="center">

# Moldify

**Turn a 3D model into a printable two-part mold — entirely in your browser.**

Local-first mold analysis, setup, preview, generation, and STL export for makers and technical designers.

[Open Moldify](https://moldify-henna.vercel.app) · [View on GitHub](https://github.com/gokmency/moldify)

[![Quality](https://github.com/gokmency/moldify/actions/workflows/quality.yml/badge.svg)](https://github.com/gokmency/moldify/actions/workflows/quality.yml)

</div>

## Overview

Moldify is a local-first public beta for converting STL, OBJ, GLB, and 3MF models into printable two-part molds.

Model parsing, geometry analysis, mold generation, and STL export run directly in the browser using Web Workers and WebAssembly. Uploaded geometry is not sent to a server or stored in the cloud.

No account, subscription, project history, or external geometry service is required.

> Moldify is an engineering preparation tool. Always verify generated dimensions, clearances, parting surfaces, and printability before manufacturing.

## Features

- Import STL, OBJ, GLB, and 3MF models.
- Analyze dimensions, triangle count, mesh quality, and watertightness.
- Estimate undercut and trapped-region risks.
- Recommend a deterministic split direction and mold setup.
- Preview the model and mold in an interactive 3D workspace.
- Toggle mold halves, split plane, pins, channels, wireframe, and section view.
- Use fit, isometric, top, and reset camera controls.
- Configure wall thickness, clearance, draft, shrink compensation, and split direction.
- Add alignment pins, a pour channel, and vent channels.
- Generate mold geometry without blocking the interface.
- Cancel and retry generation jobs.
- Detect when generated files become stale after parameter changes.
- Download separate `Upper Mold.stl` and `Lower Mold.stl` files.
- Keep mold preferences in local browser storage.

## Local-first by design

Moldify processes model data on the user's device.

- Uploaded geometry remains in browser memory.
- Mold generation runs inside a browser Worker.
- Geometry is not uploaded to Moldify or Vercel.
- There are no server-side geometry API routes.
- Mold preferences are stored only in local browser storage.
- Reloading the page clears the active model and generated files.
- Anonymous Vercel Analytics and Speed Insights receive page and performance information only.
- File names, geometry, and mold parameters are never included in analytics events.

## How it works

```text
3D model
   │
   ▼
Browser Worker
   ├── Parse and validate
   ├── Normalize coordinates
   ├── Analyze geometry
   └── Recommend mold setup
   │
   ▼
Interactive 3D preview
   │
   ▼
manifold-3d WASM generation
   ├── Mold box
   ├── Model cavity
   ├── Split halves
   ├── Alignment pins
   ├── Pour channel
   └── Vent channels
   │
   ▼
Upper Mold.stl + Lower Mold.stl
```

## Using Moldify

1. Open [Moldify](https://moldify-henna.vercel.app).
2. Upload an STL, OBJ, GLB, or 3MF file, or begin with the demo model.
3. Review model dimensions, mesh quality, warnings, and demold risks.
4. Apply the recommended setup or adjust the parameters manually.
5. Inspect the mold using the layer and camera controls.
6. Select **Generate mold**.
7. Download the upper and lower STL files.
8. Validate both files in your slicer or CAD software before printing.

All imported dimensions are interpreted as millimeters.

## Supported formats

| Format | Support |
| --- | --- |
| STL | Binary and ASCII STL through Three.js `STLLoader` |
| OBJ | Triangle meshes through Three.js `OBJLoader` |
| GLB | Embedded binary glTF through Three.js `GLTFLoader` |
| 3MF | ZIP/XML vertex and triangle mesh resources |

The current 3MF parser focuses on core mesh geometry. Advanced materials, production extensions, component transforms, and build-item overrides are not yet fully supported.

## Mold parameters

| Setting | Range |
| --- | ---: |
| Wall thickness | 3–20 mm |
| Model clearance | 0.1–2 mm |
| Split direction | Auto / X / Y / Z |
| Alignment pins | 0–8 |
| Pin diameter | 2–12 mm |
| Pour channel diameter | 3–20 mm |
| Vent diameter | 0.5–5 mm |
| Draft angle | 0–8° |
| Shrink compensation | 0–5% |

Parameter limits are enforced in both the interface and geometry pipeline.

## Geometry engine

Moldify combines several browser-compatible geometry tools:

- [`manifold-3d`](https://github.com/elalish/manifold) for WebAssembly boolean operations and solid geometry.
- [`three`](https://threejs.org/) for mesh representation, parsing, rendering, and STL export.
- [`@react-three/fiber`](https://docs.pmnd.rs/react-three-fiber) and [`@react-three/drei`](https://github.com/pmndrs/drei) for the interactive 3D workspace.
- [`three-mesh-bvh`](https://github.com/gkjohnson/three-mesh-bvh) for accelerated ray-based geometry analysis.
- [`JSZip`](https://stuk.github.io/jszip/) for browser-side 3MF extraction.

Analysis and recommendations are deterministic geometry calculations. Moldify does not use an LLM to evaluate uploaded models.

## Technical stack

- Next.js 15 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui and Radix UI
- React Three Fiber and Drei
- Web Workers
- WebAssembly
- Vitest
- Playwright
- Docker
- Vercel

## Local development

### Requirements

- Node.js 24
- npm

### Setup

```bash
git clone https://github.com/gokmency/moldify.git
cd moldify
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No environment variables or external services are required.

## Available commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Turbopack development server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Check TypeScript without emitting files |
| `npm run test` | Run Vitest unit tests |
| `npm run test:e2e` | Run Playwright browser tests |
| `npm run build` | Create the production standalone build |
| `npm start` | Start the standalone production server |

Run the complete verification suite with:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## Testing

Unit tests cover:

- Parameter limits and clamping
- Supported file parsers
- File and triangle limits
- Invalid and malformed geometry
- Deterministic analysis results
- Browser capability detection
- Mold generation
- Separate non-empty STL exports
- Pin-dependent geometry output
- Worker cancellation and retry behavior

Playwright covers:

- Demo analysis and generation
- STL, OBJ, GLB, and 3MF uploads
- Long file-name layout behavior
- Recommended setup application
- Stale output detection
- Camera and layer controls
- Generation cancellation and retry
- Upper and lower STL downloads
- Desktop and mobile layouts
- Browser console and runtime errors
- Local-first behavior without `/api/*` geometry requests
- Critical accessibility checks

## Production build

```bash
npm run build
npm start
```

The application uses Next.js standalone output.

## Docker

Build and run the production container:

```bash
docker build -t moldify .
docker run --rm -p 3000:3000 moldify
```

Open [http://localhost:3000](http://localhost:3000).

## Deploying to Vercel

Moldify is ready for Vercel Git deployments and requires no environment variables.

1. Import [`gokmency/moldify`](https://github.com/gokmency/moldify) into Vercel.
2. Keep the framework preset as **Next.js**.
3. Keep the root directory as `.`.
4. Deploy.

The repository declares Node.js 24 and includes the production build configuration. Pushes to `main` can create production deployments, while pull requests and other branches can create preview deployments.

## Processing limits

To prevent excessive browser memory usage, Moldify enforces the following limits:

| Resource | Limit |
| --- | ---: |
| Uploaded file | 50 MB |
| Mesh triangles | 1,000,000 |
| Extracted 3MF model XML | 25 MB |

Models containing invalid coordinates, missing triangles, extreme dimensions, or malformed resources are rejected with an explanatory error.

## Known limitations

- All input units are interpreted as millimeters.
- Reliable boolean generation requires a closed and consistently oriented solid.
- Open edges and non-manifold signals are reported, but severely damaged meshes should be repaired before use.
- Self-intersections, zero-area faces, nested shells, and disconnected geometry may produce invalid results.
- Very dense or multi-shell models can take longer to analyze and generate.
- Complex models may exceed the available memory of mobile browsers.
- Draft angle is currently analyzed and stored as a mold parameter; full per-face draft deformation remains future work.
- Advanced 3MF component and production-extension support is incomplete.
- Moldify does not replace engineering validation or test printing.

## Browser requirements

Moldify requires:

- WebGL
- WebAssembly
- Web Workers
- Blob-based browser downloads

Use a recent version of Chrome, Edge, Firefox, or Safari. Desktop browsers provide the full production workflow; mobile browsers are primarily intended for inspection and basic setup.

## Roadmap

Potential post-beta improvements include:

- Per-face draft deformation
- Visual mesh repair guidance
- Problem-region highlighting
- Advanced 3MF component transforms
- Large-model geometry optimization
- Manual unit and scale controls
- Undo and reusable mold presets
- Additional split-plane controls
- Optional project history and sharing

Accounts, billing, and cloud project storage will only be considered after the local-first workflow has been validated with users.

## Demo geometry

The repository includes:

- `public/demo-part.stl`
- A richer procedural demo used by the studio and geometry tests

These assets provide a quick way to explore the workflow without uploading a personal model.

---

<div align="center">

Built for makers who want a faster path from a 3D part to a printable mold.

[Try Moldify](https://moldify-henna.vercel.app)

</div>
