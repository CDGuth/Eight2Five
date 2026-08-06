import type { DrillRepository } from "@eight2five/mobile/drill";

import {
  DRILL_NAME_MAX_LENGTH,
  deleteDrillAndRefreshSettings,
  formatDrillCount,
  getDrillCardActionLabels,
  loadDrillList,
  validateDrillName,
} from "../drill-management";
import { getDrillTerms } from "@eight2five/mobile/drill";

describe("manual drill management", () => {
  test("loads deterministic drill rows with page counts and supports empty state", async () => {
    const repository = {
      listDrills: jest.fn(async () => [
        { id: "a", name: "First", createdAt: 1, updatedAt: 1 },
        { id: "b", name: "Second", createdAt: 2, updatedAt: 2 },
      ]),
      listPages: jest.fn(async (drillId: string) =>
        drillId === "a"
          ? [
              {
                id: "page-a",
                drillId,
                ordinal: 0,
                label: "1",
                countsFromPrevious: 0,
                position: { xMeters: 0, yMeters: 0 },
              },
            ]
          : [],
      ),
    } as unknown as DrillRepository;

    await expect(loadDrillList(repository)).resolves.toEqual([
      { drill: expect.objectContaining({ id: "a" }), pageCount: 1 },
      { drill: expect.objectContaining({ id: "b" }), pageCount: 0 },
    ]);
    expect(repository.listPages).toHaveBeenCalledWith("a");
    expect(repository.listPages).toHaveBeenCalledWith("b");

    repository.listDrills = jest.fn(async () => []);
    await expect(loadDrillList(repository)).resolves.toEqual([]);
  });

  test("validates names for properties editing", () => {
    expect(validateDrillName("   ")).toBe("Enter a drill name.");
    expect(validateDrillName("x".repeat(DRILL_NAME_MAX_LENGTH + 1))).toContain(
      String(DRILL_NAME_MAX_LENGTH),
    );
  });

  test("formats card counts using the selected terminology", () => {
    expect(formatDrillCount(1, getDrillTerms("sets"))).toBe("1 Set");
    expect(formatDrillCount(3, getDrillTerms("pages"))).toBe("3 Pages");
  });

  test("provides accessible labels for the three card actions", () => {
    expect(getDrillCardActionLabels("Finale")).toEqual({
      info: "Info for Finale",
      performer: "Select performer for Finale",
      activate: "Activate Finale",
      deactivate: "Deactivate Finale",
    });
  });

  test("deletes the drill before refreshing cleared selection pointers", async () => {
    const order: string[] = [];
    const repository = {
      deleteDrill: jest.fn(async () => {
        order.push("delete");
      }),
    } as unknown as DrillRepository;
    const reload = jest.fn(async () => {
      order.push("reload");
    });

    await deleteDrillAndRefreshSettings(repository, "active", reload);

    expect(repository.deleteDrill).toHaveBeenCalledWith("active");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["delete", "reload"]);
  });
});
