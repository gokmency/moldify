# Moldify

Moldify is a local-first, dark-mode production studio for turning a 3D model
into a printable two-part mold. The MVP has no accounts, billing, cloud object
storage, or persistent project history. Model files are processed in the active
browser/server session and are not retained.

## What it does

- Uploads STL, OBJ, GLB, and 3MF files (millimeters are assumed).
- Computes bounds, manifold signals, orientation scores, undercut risk, trapped
  region risk, warnings, and deterministic mold recommendations.
- Displays the part, translucent mold halves, split plane, alignment pins,
  pour channel, vents, wireframe, and section preview in an interactive 3D view.
- Generates a two-part mold using `manifold-3d` (Node + WASM) boolean operations.
- Uses `three-mesh-bvh` for accelerated ray-based risk analysis.
- Exports separate `Upper Mold.stl` and `Lower Mold.stl` files.
- Stores mold preferences only in local browser storage.

## Local development

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

Unit tests cover parameter bounds, deterministic analysis, non-empty separate
STL outputs, and pin-dependent geometry. Route tests cover the demo analysis
contract and unsupported file rejection.

## Production

```bash
npm run build
npm start
```

The Next.js standalone output can also run in Docker:

```bash
docker build -t moldify .
docker run --rm -p 3000:3000 moldify
```

## Use

1. Drop an STL, OBJ, GLB, or 3MF file into the source panel, or load the demo.
2. Review bounds, watertight status, warnings, and demold risks.
3. Accept the recommended split direction and values, or tune the locked ranges.
4. Inspect mold, split, pin, channel, wireframe, and section layers.
5. Generate the mold.
6. Download the upper and lower STL files independently.

## Parameter ranges

| Setting | Range |
| --- | --- |
| Wall thickness | 3–20 mm |
| Clearance | 0.1–2 mm |
| Split direction | Auto / X / Y / Z |
| Pin count | 0–8 |
| Pin diameter | 2–12 mm |
| Pour diameter | 3–20 mm |
| Vent diameter | 0.5–5 mm |
| Draft angle | 0–8° |
| Shrink compensation | 0–5% |

## Supported format notes

- STL: binary and ASCII via Three.js `STLLoader`.
- OBJ: triangle meshes via Three.js `OBJLoader`.
- GLB: embedded binary glTF via Three.js `GLTFLoader`.
- 3MF: ZIP/XML vertex and triangle resources. The MVP does not yet apply all
  3MF production extensions, materials, component transforms, or build-item
  overrides.

## Known geometry limits

- Input units are always interpreted as millimeters.
- A successful boolean requires a closed, consistently oriented solid. The
  analyzer reports open/non-manifold edges, but severely damaged meshes should
  be repaired in a mesh tool before generation.
- Self-intersections, zero-area faces, nested shells, extreme coordinates, and
  very dense models may fail or take longer.
- Auto orientation is deterministic geometry scoring, not an LLM call.
- Draft angle is analyzed and recorded in the MVP settings; full per-face draft
  deformation is a future geometry pass.
- The 50 MB upload ceiling protects the local-first session from memory spikes.

The repository includes `public/demo-part.stl` plus a richer procedural demo
used by the application and geometry tests.

