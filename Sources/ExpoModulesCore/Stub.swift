// Editor-only ExpoModulesCore stubs for SourceKit-LSP on non-macOS platforms.
// Real iOS builds use the actual ExpoModulesCore dependency from CocoaPods.
// These definitions are intentionally lightweight and not runtime-accurate.

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
