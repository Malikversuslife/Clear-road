# Satellite imagery setup

The default OpenFreeMap map remains keyless. Satellite is optional and the header switch is hidden until NEXT_PUBLIC_MAPTILER_KEY is configured.

1. Create a MapTiler Cloud account and choose a plan appropriate for the app's usage.
2. Create a browser API key and restrict its allowed origins to https://clear-road-zeta.vercel.app (and localhost for local testing if needed).
3. Set NEXT_PUBLIC_MAPTILER_KEY in Vercel's Production environment variables. This is intentionally a browser-visible, domain-restricted key; never use an administrative credential.
4. Redeploy: Next.js embeds NEXT_PUBLIC values at build time.
5. Verify real imagery loads, provider credits and the linked logo remain visible, and switching back preserves the camera, selected reports, report draft, and location marker.

Implementation uses MapTiler satellite-v2 TileJSON so tile URLs, coverage and provider attribution are supplied by the provider. The required linked MapTiler logo is included for free accounts. Existing OpenFreeMap/OpenStreetMap credits remain visible for the vector roads and labels.

Satellite requests are made only after selection. Imagery failures restore Map mode and show a dismissible message. Camera and report state are never reset by switching; location remains explicit and ephemeral. Imagery is labelled as not live.

Documentation:

- https://docs.maptiler.com/cloud/api/tiles/
- https://docs.maptiler.com/guides/map-design/attribution/add-attribution/

Verification used an intercepted local image fixture, not real satellite imagery. A production MapTiler key is still required for the final provider check.
