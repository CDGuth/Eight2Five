import { SyntheticPansPositionNotificationSource } from "../testing/SyntheticPansPositionNotificationSource";

describe("SyntheticPansPositionNotificationSource", () => {
  test.each([
    [1, 60],
    [10, 600],
  ] as const)(
    "emits an ordered %d Hz stream for 60 simulated seconds",
    (rateHz, expectedCount) => {
      const source = new SyntheticPansPositionNotificationSource({ rateHz });
      const events: { sequence: number; emittedAtMs: number }[] = [];
      source.addListener(({ sequence, emittedAtMs }) => {
        events.push({ sequence, emittedAtMs });
      });

      expect(source.emitForDuration(60_000)).toBe(expectedCount);
      expect(events).toHaveLength(expectedCount);
      expect(events.map(({ sequence }) => sequence)).toEqual(
        Array.from({ length: expectedCount }, (_, index) => index),
      );
      expect(
        events.every(
          (event, index) =>
            index === 0 || event.emittedAtMs > events[index - 1].emittedAtMs,
        ),
      ).toBe(true);
    },
  );

  test("stops delivering after a listener is removed", () => {
    const source = new SyntheticPansPositionNotificationSource({ rateHz: 10 });
    const listener = jest.fn();
    const subscription = source.addListener(listener);

    source.emitNext();
    subscription.remove();
    source.emitNext();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(source.emittedCount).toBe(2);
  });
});
