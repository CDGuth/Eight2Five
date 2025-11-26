// ============================================================================
// ⚠️  SPM STUB - FOR SWIFT LSP ONLY - NOT USED IN PRODUCTION BUILDS  ⚠️
// ============================================================================
//
// This file provides stub types for ExpoModulesCore to enable SourceKit-LSP
// (Swift Language Server) functionality in VS Code on non-macOS platforms.
//
// THE ACTUAL iOS BUILD:
// - Uses CocoaPods: `s.dependency 'ExpoModulesCore'` in the .podspec
// - Links against the real ExpoModulesCore from the expo package
// - This stub is completely ignored during EAS Build / Xcode compilation
//
// These stubs mirror the public API surface of ExpoModulesCore but contain no
// real implementation. DO NOT rely on them for actual Expo module functionality.
// ============================================================================

import Foundation

// MARK: - Module base class

open class Module {
  public init() {}
  public func sendEvent(_ name: String, _ payload: [String: Any?]) {}
}

// MARK: - Module Definition DSL

public struct ModuleDefinition {
  public init() {}
}

// Component protocol for DSL elements
public protocol ModuleDefinitionComponent {}

extension ModuleDefinition: ModuleDefinitionComponent {}

// Result builder for module definition DSL
@resultBuilder
public struct ModuleDefinitionBuilder {
  public static func buildBlock(_ components: ModuleDefinitionComponent...) -> ModuleDefinition {
    ModuleDefinition()
  }
}

// MARK: - DSL Functions (free functions used in definition() body)

@discardableResult
public func Name(_ name: String) -> ModuleDefinitionComponent {
  return ModuleDefinition()
}

@discardableResult
public func Events(_ names: String...) -> ModuleDefinitionComponent {
  return ModuleDefinition()
}

@discardableResult
public func OnCreate(_ closure: @escaping () -> Void) -> ModuleDefinitionComponent {
  return ModuleDefinition()
}

@discardableResult
public func Function(_ name: String, _ closure: @escaping () -> Void) -> ModuleDefinitionComponent {
  return ModuleDefinition()
}

@discardableResult
public func Function<R>(_ name: String, _ closure: @escaping () -> R) -> ModuleDefinitionComponent {
  return ModuleDefinition()
}

@discardableResult
public func AsyncFunction(_ name: String, _ closure: @escaping () -> Void) -> ModuleDefinitionComponent {
  return ModuleDefinition()
}

@discardableResult
public func AsyncFunction<A>(_ name: String, _ closure: @escaping (A) -> Void) -> ModuleDefinitionComponent {
  return ModuleDefinition()
}

@discardableResult
public func AsyncFunction<A, B>(_ name: String, _ closure: @escaping (A, B) -> Void) -> ModuleDefinitionComponent {
  return ModuleDefinition()
}

@discardableResult
public func AsyncFunction<A, B, C>(_ name: String, _ closure: @escaping (A, B, C) -> Void) -> ModuleDefinitionComponent {
  return ModuleDefinition()
}

// MARK: - Promise

public final class Promise {
  public init() {}
  public func resolve(_ value: Any?) {}
  public func reject(_ code: String, _ message: String) {}
}
