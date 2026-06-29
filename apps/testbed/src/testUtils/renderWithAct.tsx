import React from "react";
import TestRenderer, { act } from "react-test-renderer";

export function renderWithAct(element: React.ReactElement) {
  let tree: TestRenderer.ReactTestRenderer | undefined;

  act(() => {
    tree = TestRenderer.create(element);
  });

  if (!tree) {
    throw new Error("Failed to render test tree");
  }

  return tree;
}
