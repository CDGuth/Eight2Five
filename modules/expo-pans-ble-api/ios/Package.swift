// swift-tools-version: 5.9

import PackageDescription

let package = Package(
  name: "PansBleApiCore",
  platforms: [
    .macOS(.v13)
  ],
  products: [
    .library(name: "PansBleApiCore", targets: ["PansBleApiCore"])
  ],
  targets: [
    .target(
      name: "PansBleApiCore",
      path: "Sources/PansBleApiCore"
    ),
    .testTarget(
      name: "PansBleApiCoreTests",
      dependencies: ["PansBleApiCore"],
      path: "Tests/PansBleApiCoreTests"
    )
  ]
)
