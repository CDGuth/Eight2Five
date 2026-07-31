import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { Text } from "react-native";
import { AnimatedHeight } from "@eight2five/ui/components/accordion";

describe("AnimatedHeight lazy content", () => {
  beforeEach(() => jest.useFakeTimers());

  test("mounts on expansion and unmounts only after the collapse duration", async () => {
    const mounted = jest.fn();
    const unmounted = jest.fn();
    let tree!: TestRenderer.ReactTestRenderer;

    function Content() {
      React.useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return <Text testID="lazy-accordion-content">Advanced content</Text>;
    }

    await act(async () => {
      tree = TestRenderer.create(
        <AnimatedHeight isExpanded={false} duration={200}>
          <Content />
        </AnimatedHeight>,
      );
    });
    expect(hasContent(tree)).toBe(false);
    expect(mounted).not.toHaveBeenCalled();

    await act(async () => {
      tree.update(
        <AnimatedHeight isExpanded duration={200}>
          <Content />
        </AnimatedHeight>,
      );
    });
    expect(hasContent(tree)).toBe(true);
    expect(mounted).toHaveBeenCalledTimes(1);

    await act(async () => {
      tree.update(
        <AnimatedHeight isExpanded={false} duration={200}>
          <Content />
        </AnimatedHeight>,
      );
    });
    expect(hasContent(tree)).toBe(true);

    act(() => jest.advanceTimersByTime(199));
    expect(unmounted).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(hasContent(tree)).toBe(false);
    expect(unmounted).toHaveBeenCalledTimes(1);

    await act(async () => tree.unmount());
  });
});

function hasContent(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAllByType("Text" as never)
    .some((node) => node.props.children === "Advanced content");
}
