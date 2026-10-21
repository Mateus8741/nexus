# Instaladores do Nexus Desktop

Coloque aqui os instaladores gerados por `apps/desktop` (`bun run --filter @nexus/desktop dist`):

- `Nexus-Setup-0.1.0.exe` (Windows)
- `Nexus-0.1.0-arm64.dmg` (macOS Apple Silicon)
- `Nexus-0.1.0-x64.dmg` (macOS Intel)

Os binários são ignorados pelo git. Em produção, prefira hospedá-los num storage/CDN e apontar
`NEXT_PUBLIC_NEXUS_DOWNLOAD_BASE_URL` para ele.
