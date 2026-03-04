// swift-tools-version: 5.10
// ============================================================================
// ⚠️  SPM SCAFFOLDING - FOR SWIFT LSP ONLY - NOT USED IN PRODUCTION BUILDS  ⚠️
// ============================================================================
//
// This Package.swift exists solely to enable SourceKit-LSP (Swift Language
// Server) functionality in VS Code and other editors on non-macOS platforms.
//
// THE ACTUAL iOS BUILD:
// - Uses CocoaPods via modules/expo-kbeaconpro/ios/ExpoKBeaconPro.podspec
// - Is built by EAS Build / Xcode, which ignores this Package.swift entirely
// - Links against real iOS SDK frameworks (CoreBluetooth, etc.)
//
// The stub targets below (ExpoModulesCore, kbeaconlib2, CoreBluetooth) provide
// minimal type definitions so the LSP can parse and provide intellisense for
// ExpoKBeaconProModule.swift without access to the actual CocoaPods libraries.
//
// DO NOT add real logic to the stubs - they are type scaffolding only.
// ============================================================================

import PackageDescription

let package = Package(
  name: "OptimizationTestWorkspace",
  platforms: [
    .iOS(.v13)
  ],
  products: [
    .library(name: "ExpoKBeaconProPackage", targets: ["ExpoKBeaconProModule"])
  ],
  targets: [
    // Stub for Apple's CoreBluetooth framework (unavailable on Linux)
    .target(
      name: "CoreBluetooth",
      path: "Sources/CoreBluetooth"
    ),
    // Stub for Expo's ExpoModulesCore CocoaPod
    .target(
      name: "ExpoModulesCore",
      path: "Sources/ExpoModulesCore"
    ),
    // Stub for KKM's kbeaconlib2 CocoaPod
    .target(
      name: "kbeaconlib2",
      dependencies: ["CoreBluetooth"],
      path: "Sources/kbeaconlib2"
    ),
    // The actual module source - references stubs for LSP, real libs at build time
    .target(
      name: "ExpoKBeaconProModule",
      dependencies: ["ExpoModulesCore", "kbeaconlib2", "CoreBluetooth"],
      path: "modules/expo-kbeaconpro/ios",
      sources: ["ExpoKBeaconProModule.swift"],
      resources: [
        .copy("ExpoKBeaconPro.podspec")
      ]
    )
  ]
)
