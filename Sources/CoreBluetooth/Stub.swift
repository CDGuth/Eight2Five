// ============================================================================
// ⚠️  SPM STUB - FOR SWIFT LSP ONLY - NOT USED IN PRODUCTION BUILDS  ⚠️
// ============================================================================
//
// This file provides stub types for CoreBluetooth to enable SourceKit-LSP
// (Swift Language Server) functionality in VS Code on non-macOS platforms.
//
// THE ACTUAL iOS BUILD:
// - Uses CocoaPods via the .podspec file
// - Links against the real CoreBluetooth.framework from the iOS SDK
// - This stub is completely ignored during EAS Build / Xcode compilation
//
// DO NOT rely on these stubs for actual Bluetooth functionality.
// They exist solely to satisfy the Swift compiler for editor tooling.
// ============================================================================

import Foundation

/// Stub for CBCentralManagerState - mirrors Apple's CoreBluetooth enum
public enum CBCentralManagerState: Int {
    case unknown = 0
    case resetting = 1
    case unsupported = 2
    case unauthorized = 3
    case poweredOff = 4
    case poweredOn = 5
}

/// Stub for CBManagerState (newer API name for the same enum)
public typealias CBManagerState = CBCentralManagerState
