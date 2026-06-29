import React from "react";
import { act } from "react-test-renderer";
import { InputRow } from "../components/InputRow";
import { renderWithAct } from "../../../testUtils/renderWithAct";

describe("InputRow", () => {
  it("invokes onChange when text updates", () => {
    const onChange = jest.fn();
    const tree = renderWithAct(
      <InputRow label="Value" value="1" onChange={onChange} />,
    );

    const input = tree.root.findByProps({ testID: "input-row-field" });
    act(() => input.props.onChangeText("2"));

    expect(onChange).toHaveBeenCalledWith("2");
  });
});
