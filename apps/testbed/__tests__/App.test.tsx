import React from "react";
import TestRenderer from "react-test-renderer";
import App from "../App";

describe("App (testbed)", () => {
  it("renders the legacy shim as null", () => {
    const tree = TestRenderer.create(<App />);
    expect(tree.toJSON()).toBeNull();
  });
});
