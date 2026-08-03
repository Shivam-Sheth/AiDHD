# Models

Drop `boeing-777-300.glb` here and it renders automatically — see
`src/lib/model-assets.ts`. Nothing else needs to change.

The Sketchfab listing for this model is view-only; the downloadable file is sold
on CGTrader. Export/convert to `.glb` (binary glTF), not `.gltf` + separate bins.

At 340k triangles the raw model is heavy for a web hero. Compress before
committing:

    npx gltf-transform optimize in.glb boeing-777-300.glb --compress draco

Verify it loads at /model-test.
