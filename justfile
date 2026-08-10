set shell := ["bash", "-uc"]

# Dev mode with auto-reload
dev:
    bun run dev

# Build for production
build:
    bun run build

# Build + zip for Chrome Web Store
build-release:
    bun run build:release

# Type check
type-check:
    bunx tsc --noEmit

# Submit to Chrome Web Store (requires 1Password CLI)
submit: build-release
    op run -- bash scripts/submit.sh

# Clean build artifacts
clean:
    rm -rf .output
    rm -rf .wxt
