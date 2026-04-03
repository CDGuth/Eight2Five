// Editor-only CoreBluetooth stubs used by SourceKit-LSP on non-macOS setups.
// Native iOS builds use the real CoreBluetooth.framework via Xcode/CocoaPods.
// Keep this file minimal and focused on type-checking support.

import Foundation

/// Minimal CBCentralManagerState shape for editor type-checking.
public enum CBCentralManagerState: Int {
    case unknown = 0
    case resetting = 1
    case unsupported = 2
    case unauthorized = 3
    case poweredOff = 4
    case poweredOn = 5
}

/// Newer API name alias in Apple frameworks.
public typealias CBManagerState = CBCentralManagerState
