// swift-tools-version: 5.10

// Note: This SwiftPM manifest is for editor tooling (SourceKit-LSP) in non-macOS
// environments. Targets under Sources/ are stubs only and are not used by the
// production iOS build, which resolves real dependencies via CocoaPods.

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
