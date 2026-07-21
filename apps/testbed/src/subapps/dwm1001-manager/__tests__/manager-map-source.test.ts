import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("manager map source architecture", () => {
  const root = resolve(__dirname, "..");
  const screen = readFileSync(
    resolve(root, "screens/manager-map-screen.tsx"),
    "utf8",
  );
  const modal = readFileSync(
    resolve(root, "components/manager-map-settings-modal.tsx"),
    "utf8",
  );
  const controller = readFileSync(
    resolve(root, "manager-map-controller.ts"),
    "utf8",
  );

  test("keeps the map full-flex and free from the legacy card layout", () => {
    expect(screen).toContain('testID="manager-map-screen"');
    expect(screen).toContain("style={{ flex: 1 }}");
    expect(screen).toContain("ButtonIcon as={Settings2}");
    expect(screen).not.toContain("SectionCard");
    expect(screen).not.toContain("ManagerScreen");
    expect(screen).not.toContain("420");
  });

  test("uses sparse position writes and has no automatic tracking effect", () => {
    expect(controller).toMatch(
      /applyDeviceConfiguration\([\s\S]*pendingAnchorEdit\.anchorId,[\s\S]*\{\s*position:/,
    );
    expect(controller).not.toMatch(
      /useEffect\([\s\S]{0,300}startDirectTracking/,
    );
    expect(modal).toContain("Start direct tracking");
    expect(controller).toContain("Proxy tracking is unavailable");
  });

  test("does not introduce hardcoded hexadecimal visual colors", () => {
    expect(`${screen}\n${modal}\n${controller}`).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(screen).toContain("background: theme.background");
    expect(screen).toContain("grid: theme.border");
    expect(screen).toContain("anchor: theme.accent");
    expect(screen).toContain("tag: theme.success");
    expect(screen).toContain("offline: theme.textSubtle");
    expect(screen).toContain("error: theme.danger");
    expect(screen).toContain("label: theme.text");
    expect(screen).toContain("edge: theme.textMuted");
  });
});
