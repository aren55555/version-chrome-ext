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

# Submit to Chrome Web Store
submit: build-release
    bun run submit

# Clean build artifacts
clean:
    rm -rf .output
    rm -rf .wxt
