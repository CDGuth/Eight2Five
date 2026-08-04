import type { DrillRepository } from "@eight2five/mobile/drill";

import {
  DRILL_NAME_MAX_LENGTH,
  createNamedDrill,
  deleteDrillAndRefreshSettings,
  loadDrillList,
  renameNamedDrill,
  validateDrillName,
} from "../drill-management";

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

  test("trims and validates names for create and rename", async () => {
    const created = { id: "new", name: "Show", createdAt: 1, updatedAt: 1 };
    const repository = {
      createDrill: jest.fn(async () => created),
      renameDrill: jest.fn(async () => ({ ...created, name: "Finale" })),
    } as unknown as DrillRepository;

    await expect(createNamedDrill(repository, "  Show  ")).resolves.toBe(
      created,
    );
    expect(repository.createDrill).toHaveBeenCalledWith({
      name: "Show",
      fieldPreset: "football-nfhs",
    });
    await renameNamedDrill(repository, "new", "  Finale ");
    expect(repository.renameDrill).toHaveBeenCalledWith("new", "Finale");

    expect(validateDrillName("   ")).toBe("Enter a drill name.");
    expect(validateDrillName("x".repeat(DRILL_NAME_MAX_LENGTH + 1))).toContain(
      String(DRILL_NAME_MAX_LENGTH),
    );
    await expect(createNamedDrill(repository, " ")).rejects.toThrow(
      "Enter a drill name",
    );
  });

  test("uses the selected default field preset for a new manual drill", async () => {
    const created = {
      id: "new",
      name: "College Show",
      fieldPreset: "football-ncaa" as const,
      createdAt: 1,
      updatedAt: 1,
    };
    const repository = {
      createDrill: jest.fn(async () => created),
    } as unknown as DrillRepository;

    await expect(
      createNamedDrill(repository, "College Show", "football-ncaa"),
    ).resolves.toBe(created);
    expect(repository.createDrill).toHaveBeenCalledWith({
      name: "College Show",
      fieldPreset: "football-ncaa",
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
