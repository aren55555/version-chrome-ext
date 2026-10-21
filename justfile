set shell := ["bash", "-uc"]

# Dev mode with auto-reload
dev:
    bun --bun run dev

# Build for production
build:
    bun --bun run build

# Build + zip for Chrome Web Store
build-release:
    bun --bun run build:release

# Type check
type-check:
    bunx --bun tsc --noEmit

# Submit to Chrome Web Store (requires 1Password CLI)
submit: build-release
    op run -- bash scripts/submit.sh

# Clean build artifacts
clean:
    rm -rf .output
    rm -rf .wxt
