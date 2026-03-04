import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { TextInput } from "react-native";
import { InputRow } from "../components/InputRow";

describe("InputRow", () => {
  it("invokes onChange when text updates", () => {
    const onChange = jest.fn();
    const tree = TestRenderer.create(
      <InputRow label="Value" value="1" onChange={onChange} />,
    );

    const input = tree.root.findByType(TextInput);
    act(() => input.props.onChangeText("2"));

    expect(onChange).toHaveBeenCalledWith("2");
  });
});
