# ZeroNT Update Distribution

Public update-distribution files for ZeroNT OS.

## Beta x86_64

- Manifest: `beta/x86_64/manifest.json`
- Package: `beta/x86_64/zeront-v1.2.0.pkg`
- Public verification key: `beta/x86_64/public-key.hex`

The signing private key is intentionally not stored in this repository.

Security note: the current beta package is signed by the development key used by the ZeroNT v1.2 prototype. Do not treat this beta channel as a production trust root. Rotate to an offline-generated production Ed25519 key before opening the stable channel.
