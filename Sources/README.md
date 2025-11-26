# SPM Stubs - For Swift LSP Only

**These files are NOT used in production builds.**

## Purpose

This directory contains stub implementations that exist solely to enable [SourceKit-LSP](https://github.com/apple/sourcekit-lsp) (the Swift Language Server) to provide intellisense, go-to-definition, and other editor features in VS Code when developing on non-macOS platforms (e.g., Linux, Windows with WSL).

## How the Actual Build Works

The real iOS build process:

1. **EAS Build** (or local Xcode) triggers the native iOS compilation
2. **CocoaPods** resolves dependencies defined in `modules/expo-kbeaconpro/ios/ExpoKBeaconPro.podspec`
3. The real libraries are linked:
   - `ExpoModulesCore` - from the Expo SDK
   - `kbeaconlib2` - from CocoaPods (KKM's beacon library)
   - `CoreBluetooth.framework` - from the iOS SDK

**This `Sources/` directory and `Package.swift` are completely ignored during the actual build.**

## What's in Each Stub

| Directory | Stubs For | Real Source |
|-----------|-----------|-------------|
| `CoreBluetooth/` | Apple's CoreBluetooth framework | iOS SDK |
| `ExpoModulesCore/` | Expo's native module API | `expo` npm package |
| `kbeaconlib2/` | KKM's beacon library | CocoaPods |

## When to Update Stubs

If you add new APIs from these libraries to `ExpoKBeaconProModule.swift` and the LSP shows errors:

1. Add the minimal type/function signature to the appropriate stub
2. Keep implementations empty or returning dummy values
3. The stub only needs to satisfy the Swift compiler's type checker

## On macOS

If you're developing on macOS with Xcode installed, you may not need these stubs at all since SourceKit-LSP can use the real iOS SDK. You could potentially remove `Package.swift` and this `Sources/` directory, but keeping them doesn't hurt and enables cross-platform development.

## Files Safe to Delete

If you don't need Swift LSP support, you can safely delete:
- `Package.swift`
- `Sources/` (this entire directory)
- `.swift-version`
- `.build/` (SPM build cache)

The iOS build will continue to work via CocoaPods.
