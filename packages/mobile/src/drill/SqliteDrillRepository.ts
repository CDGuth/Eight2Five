import {
  formatSetName,
  type DrillGridPoint,
  type MeasureRange,
  type SetKind,
} from "@eight2five/drill-schema";
import type { SQLiteDatabase } from "expo-sqlite";

import { drillGridPointToFieldPoint } from "../field/marching";
import {
  APP_SETTINGS_TABLE,
  DRILLS_TABLE,
  DRILL_SETS_TABLE,
} from "../storage/mobileDatabase";
import { SqliteSettingsRepository } from "../settings/SqliteSettingsRepository";
import type { AppSettings } from "../settings/types";
import type { Drill, DrillSet } from "./types";

type SqlValue = string | number | null;
type Row = Record<string, SqlValue | undefined>;

export interface CreateDrillInput {
  readonly id?: string;
  readonly name: string;
  readonly createdAt?: number;
  readonly updatedAt?: number;
  readonly fieldPreset?: "football-nfhs";
}

export interface CreateDrillSetDetails {
  readonly id?: string;
  readonly number: number;
  readonly suffix?: string;
  readonly kind?: SetKind;
  readonly countsFromPrevious?: number;
  readonly measureRange?: MeasureRange;
  readonly position: DrillGridPoint;
  readonly facingDegrees?: number;
}

export interface CreateDrillSetInput extends CreateDrillSetDetails {
  readonly drillId: string;
}

export interface UpdateDrillSetInput {
  readonly number?: number;
  readonly suffix?: string | null;
  readonly kind?: SetKind;
  readonly countsFromPrevious?: number;
  readonly measureRange?: MeasureRange | null;
  readonly position?: DrillGridPoint;
  readonly facingDegrees?: number | null;
}

/** @deprecated Use CreateDrillSetDetails. */
export type CreateDrillPageDetails = CreateDrillSetDetails;
/** @deprecated Use CreateDrillSetInput. */
export type CreateDrillPageInput = CreateDrillSetInput;
/** @deprecated Use UpdateDrillSetInput. */
export type UpdateDrillPageInput = UpdateDrillSetInput;

export interface DrillRepositoryFactories {
  readonly idFactory?: () => string;
  readonly timeFactory?: () => number;
}

export interface DrillRepository {
  listDrills(): Promise<Drill[]>;
  getDrill(id: string): Promise<Drill | undefined>;
  createDrill(input: CreateDrillInput | string): Promise<Drill>;
  renameDrill(id: string, name: string, updatedAt?: number): Promise<Drill>;
  deleteDrill(id: string): Promise<void>;
  setActiveDrill(id: string | null): Promise<AppSettings>;

  listSets(drillId: string): Promise<DrillSet[]>;
  getSet(id: string): Promise<DrillSet | undefined>;
  createSet(input: CreateDrillSetInput): Promise<DrillSet>;
  updateSet(id: string, input: UpdateDrillSetInput): Promise<DrillSet>;
  deleteSet(id: string): Promise<void>;
  insertSet(
    drillId: string,
    ordinal: number,
    details: CreateDrillSetDetails,
  ): Promise<DrillSet>;
  reorderSets(
    drillId: string,
    orderedSetIds: readonly (string | { readonly id: string })[],
  ): Promise<DrillSet[]>;
  setSelectedDrillSet(id: string | null): Promise<AppSettings>;

  /** @deprecated Compatibility aliases; new callers should use set methods. */
  listPages(drillId: string): Promise<DrillSet[]>;
  getPage(id: string): Promise<DrillSet | undefined>;
  createPage(input: CreateDrillSetInput): Promise<DrillSet>;
  updatePage(id: string, input: UpdateDrillSetInput): Promise<DrillSet>;
  deletePage(id: string): Promise<void>;
  insertPage(
    drillId: string,
    ordinal: number,
    details: CreateDrillSetDetails,
  ): Promise<DrillSet>;
  reorderPages(
    drillId: string,
    orderedSetIds: readonly (string | { readonly id: string })[],
  ): Promise<DrillSet[]>;
  setSelectedDrillPage(id: string | null): Promise<AppSettings>;
}

export type DrillRepositoryErrorCode =
  | "DRILL_NOT_FOUND"
  | "SET_NOT_FOUND"
  | "PAGE_NOT_FOUND"
  | "INVALID_INPUT"
  | "INVALID_SET_ORDER"
  | "INVALID_PAGE_ORDER"
  | "INVALID_SELECTION";

export class DrillRepositoryError extends Error {
  readonly code: DrillRepositoryErrorCode;

  constructor(code: DrillRepositoryErrorCode, message: string) {
    super(message);
    this.name = "DrillRepositoryError";
    this.code = code;
  }
}

export class SqliteDrillRepository implements DrillRepository {
  private readonly idFactory: () => string;
  private readonly timeFactory: () => number;
  private readonly settingsRepository: SqliteSettingsRepository;

  constructor(
    private readonly db: SQLiteDatabase,
    factories: DrillRepositoryFactories = {},
  ) {
    this.idFactory = factories.idFactory ?? defaultIdFactory;
    this.timeFactory = factories.timeFactory ?? (() => Date.now());
    this.settingsRepository = new SqliteSettingsRepository(db);
  }

  async listDrills(): Promise<Drill[]> {
    const rows = await this.db.getAllAsync<Row>(
      `SELECT id, name, field_preset, created_at, updated_at
       FROM ${DRILLS_TABLE}
       ORDER BY created_at ASC, id ASC`,
    );
    return rows.map(toDrill);
  }

  async getDrill(id: string): Promise<Drill | undefined> {
    const drillId = assertId(id, "Drill id");
    const row = await this.db.getFirstAsync<Row>(
      `SELECT id, name, field_preset, created_at, updated_at
       FROM ${DRILLS_TABLE}
       WHERE id = ?`,
      [drillId],
    );
    return row ? toDrill(row) : undefined;
  }

  async createDrill(inputOrName: CreateDrillInput | string): Promise<Drill> {
    const input: CreateDrillInput =
      typeof inputOrName === "string" ? { name: inputOrName } : inputOrName;
    const name = assertText(input.name, "Drill name");
    const createdAt = assertTimestamp(
      input.createdAt ?? this.timeFactory(),
      "Drill createdAt",
    );
    const updatedAt = assertTimestamp(
      input.updatedAt ?? createdAt,
      "Drill updatedAt",
    );
    const id = assertId(input.id ?? this.idFactory(), "Drill id");
    const fieldPreset = input.fieldPreset ?? "football-nfhs";
    if (fieldPreset !== "football-nfhs") {
      throw invalidInput(
        "The mobile MVP currently supports the NFHS field preset.",
      );
    }

    await this.db.runAsync(
      `INSERT INTO ${DRILLS_TABLE}
       (id, name, field_preset, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, fieldPreset, createdAt, updatedAt],
    );
    return requireValue(await this.getDrill(id), "drill", id);
  }

  async renameDrill(
    idValue: string,
    name: string,
    updatedAt?: number,
  ): Promise<Drill> {
    const id = assertId(idValue, "Drill id");
    const nextName = assertText(name, "Drill name");
    const nextUpdatedAt = assertTimestamp(
      updatedAt ?? this.timeFactory(),
      "Drill updatedAt",
    );
    await this.requireDrill(id);
    await this.db.runAsync(
      `UPDATE ${DRILLS_TABLE} SET name = ?, updated_at = ? WHERE id = ?`,
      [nextName, nextUpdatedAt, id],
    );
    return requireValue(await this.getDrill(id), "drill", id);
  }

  async deleteDrill(id: string): Promise<void> {
    const drillId = assertId(id, "Drill id");
    await this.db.runAsync(`DELETE FROM ${DRILLS_TABLE} WHERE id = ?`, [
      drillId,
    ]);
  }

  async setActiveDrill(id: string | null): Promise<AppSettings> {
    const activeDrillId = nullableId(id, "Active drill id");
    await this.db.withTransactionAsync(async () => {
      if (activeDrillId !== null) await this.requireDrill(activeDrillId);
      await this.ensureSettingsRow();
      const current = await this.db.getFirstAsync<{
        active_drill_id: SqlValue | undefined;
      }>(
        `SELECT active_drill_id FROM ${APP_SETTINGS_TABLE} WHERE singleton_id = ?`,
        [1],
      );
      const currentActive = nullableIdFromSql(current?.active_drill_id);
      await this.db.runAsync(
        `UPDATE ${APP_SETTINGS_TABLE}
         SET active_drill_id = ?,
             selected_drill_page_id = CASE
               WHEN active_drill_id IS ? THEN selected_drill_page_id
               ELSE NULL
             END
         WHERE singleton_id = ?`,
        [activeDrillId, activeDrillId, 1],
      );
      if (currentActive !== activeDrillId && activeDrillId === null) {
        await this.db.runAsync(
          `UPDATE ${APP_SETTINGS_TABLE}
           SET selected_drill_page_id = NULL WHERE singleton_id = ?`,
          [1],
        );
      }
    });
    return await this.settingsRepository.load();
  }

  async listSets(drillId: string): Promise<DrillSet[]> {
    const parentId = assertId(drillId, "Drill id");
    const rows = await this.db.getAllAsync<Row>(
      `${SET_SELECT} WHERE drill_id = ? ORDER BY ordinal ASC, id ASC`,
      [parentId],
    );
    return rows.map(toSet);
  }

  async getSet(id: string): Promise<DrillSet | undefined> {
    const setId = assertId(id, "Drill set id");
    const row = await this.db.getFirstAsync<Row>(`${SET_SELECT} WHERE id = ?`, [
      setId,
    ]);
    return row ? toSet(row) : undefined;
  }

  async createSet(input: CreateDrillSetInput): Promise<DrillSet> {
    const normalized = normalizeCreateSet(input);
    const createdId = assertId(
      normalized.id ?? this.idFactory(),
      "Drill set id",
    );
    await this.db.withTransactionAsync(async () => {
      await this.requireDrill(normalized.drillId);
      const count = await this.setCount(normalized.drillId);
      if (count === 0 && normalized.countsFromPrevious !== 0) {
        throw invalidInput(
          "The first set must have zero counts from previous.",
        );
      }
      await this.insertSetRow({ ...normalized, id: createdId, ordinal: count });
      await this.validateSetStructure(normalized.drillId);
    });
    return requireValue(await this.getSet(createdId), "drill set", createdId);
  }

  async updateSet(
    idValue: string,
    changes: UpdateDrillSetInput,
  ): Promise<DrillSet> {
    const id = assertId(idValue, "Drill set id");
    const current = await this.getSet(id);
    if (!current) throw setNotFound(id);

    const next = normalizeExistingSet(current, changes);
    if (next.ordinal === 0 && next.countsFromPrevious !== 0) {
      throw invalidInput("The first set must have zero counts from previous.");
    }

    await this.db.withTransactionAsync(async () => {
      await this.updateSetRow(next);
      await this.validateSetStructure(current.drillId);
    });
    return requireValue(await this.getSet(id), "drill set", id);
  }

  async deleteSet(idValue: string): Promise<void> {
    const id = assertId(idValue, "Drill set id");
    await this.db.withTransactionAsync(async () => {
      const set = await this.getSet(id);
      if (!set) return;
      await this.db.runAsync(`DELETE FROM ${DRILL_SETS_TABLE} WHERE id = ?`, [
        id,
      ]);
      await this.db.runAsync(
        `UPDATE ${DRILL_SETS_TABLE}
         SET ordinal = ordinal - 1
         WHERE drill_id = ? AND ordinal > ?`,
        [set.drillId, set.ordinal],
      );
      const nextFirst = await this.db.getFirstAsync<{ id: string }>(
        `SELECT id FROM ${DRILL_SETS_TABLE}
         WHERE drill_id = ? ORDER BY ordinal ASC LIMIT 1`,
        [set.drillId],
      );
      if (nextFirst) {
        await this.db.runAsync(
          `UPDATE ${DRILL_SETS_TABLE}
           SET counts_from_previous = 0 WHERE id = ?`,
          [nextFirst.id],
        );
      }
      await this.validateSetStructure(set.drillId);
    });
  }

  async insertSet(
    drillId: string,
    ordinalValue: number,
    details: CreateDrillSetDetails,
  ): Promise<DrillSet> {
    const normalized = normalizeCreateSet({ ...details, drillId });
    const ordinal = assertOrdinal(ordinalValue, "Set ordinal");
    const id = assertId(normalized.id ?? this.idFactory(), "Drill set id");
    await this.db.withTransactionAsync(async () => {
      await this.requireDrill(normalized.drillId);
      const count = await this.setCount(normalized.drillId);
      if (ordinal > count) {
        throw invalidInput(
          `Set ordinal must be between 0 and ${count} when inserting.`,
        );
      }
      if (ordinal === 0 && normalized.countsFromPrevious !== 0) {
        throw invalidInput(
          "The first set must have zero counts from previous.",
        );
      }
      if (count > 0)
        await this.shiftSetsForInsertion(normalized.drillId, count, ordinal);
      await this.insertSetRow({ ...normalized, id, ordinal });
      await this.validateSetStructure(normalized.drillId);
    });
    return requireValue(await this.getSet(id), "drill set", id);
  }

  async reorderSets(
    drillId: string,
    orderedSetIds: readonly (string | { readonly id: string })[],
  ): Promise<DrillSet[]> {
    const parentId = assertId(drillId, "Drill id");
    const ids = orderedSetIds.map((value) =>
      assertId(typeof value === "string" ? value : value.id, "Drill set id"),
    );
    if (new Set(ids).size !== ids.length) {
      throw new DrillRepositoryError(
        "INVALID_SET_ORDER",
        "A set may appear only once in a reorder operation.",
      );
    }

    await this.db.withTransactionAsync(async () => {
      const rows = await this.db.getAllAsync<{ id: string }>(
        `SELECT id FROM ${DRILL_SETS_TABLE}
         WHERE drill_id = ? ORDER BY ordinal ASC, id ASC`,
        [parentId],
      );
      const existingIds = rows.map((row) => row.id);
      if (
        existingIds.length !== ids.length ||
        existingIds.some((id) => !ids.includes(id))
      ) {
        throw new DrillRepositoryError(
          "INVALID_SET_ORDER",
          "A reorder must contain every set in the drill exactly once.",
        );
      }
      if (ids.length > 0) {
        const offset = ids.length + 1;
        await this.db.runAsync(
          `UPDATE ${DRILL_SETS_TABLE} SET ordinal = ordinal + ? WHERE drill_id = ?`,
          [offset, parentId],
        );
        for (const [ordinal, setId] of ids.entries()) {
          await this.db.runAsync(
            `UPDATE ${DRILL_SETS_TABLE} SET ordinal = ? WHERE id = ? AND drill_id = ?`,
            [ordinal, setId, parentId],
          );
        }
        await this.db.runAsync(
          `UPDATE ${DRILL_SETS_TABLE} SET counts_from_previous = 0
           WHERE drill_id = ? AND ordinal = 0`,
          [parentId],
        );
      }
      await this.validateSetStructure(parentId);
    });
    return await this.listSets(parentId);
  }

  async setSelectedDrillSet(id: string | null): Promise<AppSettings> {
    const selectedSetId = nullableId(id, "Selected drill set id");
    await this.db.withTransactionAsync(async () => {
      await this.ensureSettingsRow();
      const settings = await this.db.getFirstAsync<{
        active_drill_id: SqlValue | undefined;
      }>(
        `SELECT active_drill_id FROM ${APP_SETTINGS_TABLE} WHERE singleton_id = ?`,
        [1],
      );
      const activeDrillId = nullableIdFromSql(settings?.active_drill_id);
      if (selectedSetId === null) {
        await this.db.runAsync(
          `UPDATE ${APP_SETTINGS_TABLE} SET selected_drill_page_id = NULL WHERE singleton_id = ?`,
          [1],
        );
        return;
      }
      if (activeDrillId === null) {
        throw new DrillRepositoryError(
          "INVALID_SELECTION",
          "A drill set cannot be selected without an active drill.",
        );
      }
      const set = await this.db.getFirstAsync<{ drill_id: string }>(
        `SELECT drill_id FROM ${DRILL_SETS_TABLE} WHERE id = ?`,
        [selectedSetId],
      );
      if (!set || set.drill_id !== activeDrillId) {
        throw new DrillRepositoryError(
          "INVALID_SELECTION",
          "The selected set must belong to the active drill.",
        );
      }
      await this.db.runAsync(
        `UPDATE ${APP_SETTINGS_TABLE} SET selected_drill_page_id = ? WHERE singleton_id = ?`,
        [selectedSetId, 1],
      );
    });
    return await this.settingsRepository.load();
  }

  // Compatibility aliases.
  listPages(drillId: string) {
    return this.listSets(drillId);
  }
  getPage(id: string) {
    return this.getSet(id);
  }
  createPage(input: CreateDrillSetInput) {
    return this.createSet(input);
  }
  updatePage(id: string, input: UpdateDrillSetInput) {
    return this.updateSet(id, input);
  }
  deletePage(id: string) {
    return this.deleteSet(id);
  }
  insertPage(drillId: string, ordinal: number, details: CreateDrillSetDetails) {
    return this.insertSet(drillId, ordinal, details);
  }
  reorderPages(
    drillId: string,
    orderedSetIds: readonly (string | { readonly id: string })[],
  ) {
    return this.reorderSets(drillId, orderedSetIds);
  }
  setSelectedDrillPage(id: string | null) {
    return this.setSelectedDrillSet(id);
  }

  private async requireDrill(id: string): Promise<Drill> {
    const drill = await this.getDrill(id);
    if (!drill) throw drillNotFound(id);
    return drill;
  }

  private async setCount(drillId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{
      set_count: SqlValue | undefined;
    }>(
      `SELECT COUNT(*) AS set_count FROM ${DRILL_SETS_TABLE} WHERE drill_id = ?`,
      [drillId],
    );
    const count = Number(row?.set_count ?? 0);
    if (!Number.isInteger(count) || count < 0) {
      throw invalidInput("The persisted set count is invalid.");
    }
    return count;
  }

  private async insertSetRow(
    set: NormalizedCreateSet & { id: string; ordinal: number },
  ) {
    const physical = drillGridPointToFieldPoint(set.position);
    const label = formatSetName(set);
    await this.db.runAsync(
      `INSERT INTO ${DRILL_SETS_TABLE}
       (id, drill_id, ordinal, set_number, set_suffix, set_kind,
        counts_from_previous, measure_start, measure_end,
        x_steps, y_steps, facing_degrees, label, x_meters, y_meters)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        set.id,
        set.drillId,
        set.ordinal,
        set.number,
        set.suffix ?? null,
        set.kind,
        set.countsFromPrevious,
        set.measureRange?.start ?? null,
        set.measureRange?.end ?? null,
        set.position.xSteps,
        set.position.ySteps,
        set.facingDegrees ?? null,
        label,
        physical.xMeters,
        physical.yMeters,
      ],
    );
  }

  private async updateSetRow(set: DrillSet): Promise<void> {
    const physical = drillGridPointToFieldPoint(set.position);
    await this.db.runAsync(
      `UPDATE ${DRILL_SETS_TABLE}
       SET set_number = ?, set_suffix = ?, set_kind = ?, counts_from_previous = ?,
           measure_start = ?, measure_end = ?, x_steps = ?, y_steps = ?,
           facing_degrees = ?, label = ?, x_meters = ?, y_meters = ?
       WHERE id = ?`,
      [
        set.number,
        set.suffix ?? null,
        set.kind,
        set.countsFromPrevious,
        set.measureRange?.start ?? null,
        set.measureRange?.end ?? null,
        set.position.xSteps,
        set.position.ySteps,
        set.facingDegrees ?? null,
        formatSetName(set),
        physical.xMeters,
        physical.yMeters,
        set.id,
      ],
    );
  }

  private async shiftSetsForInsertion(
    drillId: string,
    count: number,
    insertionOrdinal: number,
  ): Promise<void> {
    const offset = count + 1;
    await this.db.runAsync(
      `UPDATE ${DRILL_SETS_TABLE} SET ordinal = ordinal + ? WHERE drill_id = ?`,
      [offset, drillId],
    );
    await this.db.runAsync(
      `UPDATE ${DRILL_SETS_TABLE}
       SET ordinal = CASE
         WHEN ordinal >= ? THEN ordinal - ? + 1
         ELSE ordinal - ?
       END
       WHERE drill_id = ?`,
      [offset + insertionOrdinal, offset, offset, drillId],
    );
  }

  private async validateSetStructure(drillId: string): Promise<void> {
    const sets = await this.listSets(drillId);
    const primaryNumbers = new Set<number>();
    const identities = new Set<string>();
    for (const [index, set] of sets.entries()) {
      if (set.ordinal !== index) {
        throw invalidInput(
          "Persisted set ordinals must be contiguous from zero.",
        );
      }
      if (index === 0 && set.countsFromPrevious !== 0) {
        throw invalidInput(
          "The first set must have zero counts from previous.",
        );
      }
      const identity = `${set.number}|${set.suffix ?? ""}`;
      if (identities.has(identity)) {
        throw invalidInput(
          `Set ${formatSetName(set)} already exists in this drill.`,
        );
      }
      identities.add(identity);
      if (set.kind === "set") {
        if (primaryNumbers.has(set.number)) {
          throw invalidInput(`Primary set ${set.number} may appear only once.`);
        }
        primaryNumbers.add(set.number);
      }
    }
    for (const set of sets) {
      if (set.kind === "subset" && !primaryNumbers.has(set.number)) {
        throw invalidInput(
          `Subset ${formatSetName(set)} requires primary set ${set.number}.`,
        );
      }
    }
  }

  private async ensureSettingsRow(): Promise<void> {
    await this.db.runAsync(
      `INSERT OR IGNORE INTO ${APP_SETTINGS_TABLE} (singleton_id) VALUES (?)`,
      [1],
    );
  }
}

const SET_SELECT = `SELECT id, drill_id, ordinal, set_number, set_suffix, set_kind,
  counts_from_previous, measure_start, measure_end, x_steps, y_steps, facing_degrees
  FROM ${DRILL_SETS_TABLE}`;

interface NormalizedCreateSet {
  readonly id?: string;
  readonly drillId: string;
  readonly number: number;
  readonly suffix?: string;
  readonly kind: SetKind;
  readonly countsFromPrevious: number;
  readonly measureRange?: MeasureRange;
  readonly position: DrillGridPoint;
  readonly facingDegrees?: number;
}

function normalizeCreateSet(input: CreateDrillSetInput): NormalizedCreateSet {
  const kind = input.kind ?? (input.suffix ? "subset" : "set");
  const suffix = normalizeSuffix(input.suffix, kind);
  return {
    ...(input.id === undefined
      ? {}
      : { id: assertId(input.id, "Drill set id") }),
    drillId: assertId(input.drillId, "Drill id"),
    number: assertNonNegativeInteger(input.number, "Set number"),
    ...(suffix === undefined ? {} : { suffix }),
    kind,
    countsFromPrevious: assertNonNegativeInteger(
      input.countsFromPrevious ?? 0,
      "countsFromPrevious",
    ),
    ...(input.measureRange === undefined
      ? {}
      : { measureRange: assertMeasureRange(input.measureRange) }),
    position: assertGridPoint(input.position),
    ...(input.facingDegrees === undefined
      ? {}
      : { facingDegrees: assertFacing(input.facingDegrees) }),
  };
}

function normalizeExistingSet(
  current: DrillSet,
  changes: UpdateDrillSetInput,
): DrillSet {
  const kind = changes.kind ?? current.kind;
  const rawSuffix =
    changes.suffix === undefined
      ? current.suffix
      : (changes.suffix ?? undefined);
  const suffix = normalizeSuffix(rawSuffix, kind);
  const measureRange =
    changes.measureRange === undefined
      ? current.measureRange
      : changes.measureRange === null
        ? undefined
        : assertMeasureRange(changes.measureRange);
  const facingDegrees =
    changes.facingDegrees === undefined
      ? current.facingDegrees
      : changes.facingDegrees === null
        ? undefined
        : assertFacing(changes.facingDegrees);
  return {
    ...current,
    number:
      changes.number === undefined
        ? current.number
        : assertNonNegativeInteger(changes.number, "Set number"),
    kind,
    ...(suffix === undefined ? { suffix: undefined } : { suffix }),
    countsFromPrevious:
      changes.countsFromPrevious === undefined
        ? current.countsFromPrevious
        : assertNonNegativeInteger(
            changes.countsFromPrevious,
            "countsFromPrevious",
          ),
    ...(measureRange === undefined
      ? { measureRange: undefined }
      : { measureRange }),
    position:
      changes.position === undefined
        ? current.position
        : assertGridPoint(changes.position),
    ...(facingDegrees === undefined
      ? { facingDegrees: undefined }
      : { facingDegrees }),
  };
}

function normalizeSuffix(
  value: string | undefined,
  kind: SetKind,
): string | undefined {
  if (kind === "set") {
    if (value !== undefined && value.trim().length > 0) {
      throw invalidInput("Primary sets cannot have a suffix.");
    }
    return undefined;
  }
  if (typeof value !== "string" || !/^(?:[A-Z]|\.[0-9]+)$/.test(value.trim())) {
    throw invalidInput(
      "A subset suffix must be one capital letter or a decimal such as .5.",
    );
  }
  return value.trim();
}

function assertGridPoint(position: DrillGridPoint): DrillGridPoint {
  if (
    !position ||
    !Number.isFinite(position.xSteps) ||
    !Number.isFinite(position.ySteps)
  ) {
    throw invalidInput(
      "Drill set position must contain finite xSteps and ySteps.",
    );
  }
  return { xSteps: position.xSteps, ySteps: position.ySteps };
}

function assertMeasureRange(value: MeasureRange): MeasureRange {
  const start = assertNonNegativeInteger(value.start, "Measure start");
  const end = assertNonNegativeInteger(value.end, "Measure end");
  if (end < start)
    throw invalidInput("Measure end must be at or after measure start.");
  return { start, end };
}

function assertFacing(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value >= 360) {
    throw invalidInput("Facing must be at least 0 and less than 360 degrees.");
  }
  return value;
}

function assertText(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidInput(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function assertId(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidInput(`${name} must be a non-empty string.`);
  }
  return value.trim();
}

function nullableId(value: string | null, name: string): string | null {
  if (value === null) return null;
  return assertId(value, name);
}

function assertTimestamp(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw invalidInput(`${name} must be a finite number.`);
  }
  return value;
}

function assertNonNegativeInteger(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalidInput(`${name} must be a non-negative integer.`);
  }
  return value;
}

function assertOrdinal(value: unknown, name: string): number {
  return assertNonNegativeInteger(value, name);
}

function nullableIdFromSql(value: SqlValue | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toDrill(row: Row): Drill {
  const fieldPreset = rowText(row.field_preset, "drill field_preset");
  if (fieldPreset !== "football-nfhs") {
    throw new MobileRowError(`Unsupported mobile field preset ${fieldPreset}.`);
  }
  return {
    id: rowText(row.id, "drill id"),
    name: rowText(row.name, "drill name"),
    fieldPreset,
    createdAt: rowNumber(row.created_at, "drill created_at"),
    updatedAt: rowNumber(row.updated_at, "drill updated_at"),
  };
}

function toSet(row: Row): DrillSet {
  const kind = rowText(row.set_kind, "drill set kind");
  if (kind !== "set" && kind !== "subset") {
    throw new MobileRowError(`Invalid drill set kind ${kind}.`);
  }
  const suffixValue = row.set_suffix;
  const suffix = typeof suffixValue === "string" ? suffixValue : undefined;
  const measureStart = rowNullableNumber(row.measure_start, "measure_start");
  const measureEnd = rowNullableNumber(row.measure_end, "measure_end");
  const facingDegrees = rowNullableNumber(row.facing_degrees, "facing_degrees");
  return {
    id: rowText(row.id, "drill set id"),
    drillId: rowText(row.drill_id, "drill set drill_id"),
    ordinal: rowInteger(row.ordinal, "drill set ordinal"),
    number: rowInteger(row.set_number, "drill set number"),
    ...(suffix === undefined ? {} : { suffix }),
    kind,
    countsFromPrevious: rowInteger(
      row.counts_from_previous,
      "drill set counts_from_previous",
    ),
    ...(measureStart === null || measureEnd === null
      ? {}
      : { measureRange: { start: measureStart, end: measureEnd } }),
    position: {
      xSteps: rowNumber(row.x_steps, "drill set x_steps"),
      ySteps: rowNumber(row.y_steps, "drill set y_steps"),
    },
    ...(facingDegrees === null ? {} : { facingDegrees }),
  };
}

function rowText(value: SqlValue | undefined, name: string): string {
  if (typeof value !== "string")
    throw new MobileRowError(`${name} is not a string.`);
  return value;
}

function rowNumber(value: SqlValue | undefined, name: string): number {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(number)) throw new MobileRowError(`${name} is invalid.`);
  return number;
}

function rowInteger(value: SqlValue | undefined, name: string): number {
  const number = rowNumber(value, name);
  if (!Number.isSafeInteger(number))
    throw new MobileRowError(`${name} is not an integer.`);
  return number;
}

function rowNullableNumber(
  value: SqlValue | undefined,
  name: string,
): number | null {
  if (value === null || value === undefined) return null;
  return rowNumber(value, name);
}

class MobileRowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MobileRowError";
  }
}

function requireValue<T>(value: T | undefined, entity: string, id: string): T {
  if (value !== undefined) return value;
  throw new MobileRowError(`The persisted ${entity} ${id} could not be read.`);
}

function invalidInput(message: string): DrillRepositoryError {
  return new DrillRepositoryError("INVALID_INPUT", message);
}

function drillNotFound(id: string): DrillRepositoryError {
  return new DrillRepositoryError(
    "DRILL_NOT_FOUND",
    `Drill ${id} was not found.`,
  );
}

function setNotFound(id: string): DrillRepositoryError {
  return new DrillRepositoryError(
    "SET_NOT_FOUND",
    `Drill set ${id} was not found.`,
  );
}

function defaultIdFactory(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `mobile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
