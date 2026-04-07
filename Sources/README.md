# SwiftPM stubs for editor tooling

This folder exists to keep Swift language features working in VS Code when you are not on macOS (for example Linux or WSL).

These files are **editor stubs only**. They are not used by iOS production builds.

## Why this exists

SourceKit-LSP needs resolvable Swift symbols to provide completion, diagnostics, and go-to-definition. On non-macOS environments, the real iOS SDK and CocoaPods frameworks are not available, so these lightweight stubs fill that gap.

## What the real iOS build uses

Native iOS builds (EAS Build or local Xcode) use CocoaPods via `modules/expo-kbeaconpro/ios/ExpoKBeaconPro.podspec`.

The linked libraries come from real sources:
- `CoreBluetooth.framework` from the iOS SDK
- `ExpoModulesCore` from Expo
- `kbeaconlib2` from CocoaPods

`Sources/` and `Package.swift` are not part of that build path.

## Stub mapping

| Directory | Represents | Real source |
|---|---|---|
| `CoreBluetooth/` | Apple CoreBluetooth types | iOS SDK |
| `ExpoModulesCore/` | Expo native module APIs | Expo package |
| `kbeaconlib2/` | KKM beacon APIs | CocoaPods |

## When to edit these files

If you use a new API in `ExpoKBeaconProModule.swift` and SourceKit-LSP reports missing symbols:

1. Add the minimum type/signature needed to type-check.
2. Keep behavior empty or mock-like.
3. Do not treat stub behavior as real runtime behavior.

## Optional cleanup

If you do not need Swift LSP support in this repo, you can remove:
- `Package.swift`
- `Sources/`
- `.swift-version`
- `.build/`

The iOS app will still build through CocoaPods.
