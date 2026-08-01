import type { SQLiteDatabase } from "expo-sqlite";
import { assertFiniteFieldPoint, type FieldPoint } from "../field/types";
import {
  APP_SETTINGS_TABLE,
  DRILL_PAGES_TABLE,
  DRILLS_TABLE,
} from "../storage/mobileDatabase";
import { SqliteSettingsRepository } from "../settings/SqliteSettingsRepository";
import type { AppSettings } from "../settings/types";
import type { Drill, DrillPage } from "./types";

type SqlValue = string | number | null;
type Row = Record<string, SqlValue | undefined>;

export interface CreateDrillInput {
  readonly id?: string;
  readonly name: string;
  readonly createdAt?: number;
  readonly updatedAt?: number;
}

export interface CreateDrillPageDetails {
  readonly id?: string;
  readonly label: string;
  readonly countsFromPrevious?: number;
  readonly position: FieldPoint;
}

export interface CreateDrillPageInput extends CreateDrillPageDetails {
  readonly drillId: string;
}

export interface UpdateDrillPageInput {
  readonly label?: string;
  readonly countsFromPrevious?: number;
  readonly position?: FieldPoint;
}

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

  listPages(drillId: string): Promise<DrillPage[]>;
  getPage(id: string): Promise<DrillPage | undefined>;
  createPage(input: CreateDrillPageInput): Promise<DrillPage>;
  updatePage(id: string, input: UpdateDrillPageInput): Promise<DrillPage>;
  deletePage(id: string): Promise<void>;
  insertPage(
    drillId: string,
    ordinal: number,
    details: CreateDrillPageDetails,
  ): Promise<DrillPage>;
  reorderPages(
    drillId: string,
    orderedPageIds: readonly (string | { readonly id: string })[],
  ): Promise<DrillPage[]>;
  setSelectedDrillPage(id: string | null): Promise<AppSettings>;
}

export type DrillRepositoryErrorCode =
  | "DRILL_NOT_FOUND"
  | "PAGE_NOT_FOUND"
  | "INVALID_INPUT"
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

/**
 * SQLite-backed drill storage. All values crossing this boundary are
 * validated before they are bound to SQL, and every multi-row ordinal change
 * is enclosed in one SQLite transaction.
 *
 * As with the settings repository, ordinary parameterized `runAsync` is used
 * instead of hand-managed prepared statements. Expo SQLite prepares,
 * executes, and finalizes each parameterized run for us.
 */
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
      `SELECT id, name, created_at, updated_at
       FROM ${DRILLS_TABLE}
       ORDER BY created_at ASC, id ASC`,
    );
    return rows.map(toDrill);
  }

  async getDrill(id: string): Promise<Drill | undefined> {
    const drillId = assertId(id, "Drill id");
    const row = await this.db.getFirstAsync<Row>(
      `SELECT id, name, created_at, updated_at
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
    const generatedAt = this.timeFactory();
    const created = assertTimestamp(
      input.createdAt ?? generatedAt,
      "Drill createdAt",
    );
    const updated = assertTimestamp(
      input.updatedAt ?? created,
      "Drill updatedAt",
    );
    const id = assertId(input.id ?? this.idFactory(), "Drill id");

    await this.db.runAsync(
      `INSERT INTO ${DRILLS_TABLE}
       (id, name, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      [id, name, created, updated],
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
      `UPDATE ${DRILLS_TABLE}
       SET name = ?, updated_at = ?
       WHERE id = ?`,
      [nextName, nextUpdatedAt, id],
    );
    return requireValue(await this.getDrill(id), "drill", id);
  }

  async deleteDrill(id: string): Promise<void> {
    const drillId = assertId(id, "Drill id");
    await this.db.withTransactionAsync(async () => {
      // Foreign keys clear app_settings pointers and cascade drill pages.
      await this.db.runAsync(`DELETE FROM ${DRILLS_TABLE} WHERE id = ?`, [
        drillId,
      ]);
    });
  }

  async setActiveDrill(id: string | null): Promise<AppSettings> {
    const activeDrillId = nullableId(id, "Active drill id");
    await this.db.withTransactionAsync(async () => {
      if (activeDrillId !== null) await this.requireDrill(activeDrillId);
      await this.ensureSettingsRow();
      const current = await this.db.getFirstAsync<{
        active_drill_id: SqlValue | undefined;
      }>(
        `SELECT active_drill_id
         FROM ${APP_SETTINGS_TABLE}
         WHERE singleton_id = ?`,
        [1],
      );
      const currentActive = nullableIdFromSql(current?.active_drill_id);
      if (currentActive === activeDrillId && activeDrillId !== null) {
        await this.db.runAsync(
          `UPDATE ${APP_SETTINGS_TABLE}
           SET active_drill_id = ?
           WHERE singleton_id = ?`,
          [activeDrillId, 1],
        );
        return;
      }
      // Changing the active drill, including clearing it, clears the page
      // selection in the same transaction as the active pointer update.
      await this.db.runAsync(
        `UPDATE ${APP_SETTINGS_TABLE}
         SET active_drill_id = ?, selected_drill_page_id = NULL
         WHERE singleton_id = ?`,
        [activeDrillId, 1],
      );
    });
    return await this.settingsRepository.load();
  }

  async listPages(drillId: string): Promise<DrillPage[]> {
    const parentId = assertId(drillId, "Drill id");
    const rows = await this.db.getAllAsync<Row>(
      `SELECT id, drill_id, ordinal, label, counts_from_previous,
              x_meters, y_meters
       FROM ${DRILL_PAGES_TABLE}
       WHERE drill_id = ?
       ORDER BY ordinal ASC, id ASC`,
      [parentId],
    );
    return rows.map(toPage);
  }

  async getPage(id: string): Promise<DrillPage | undefined> {
    const pageId = assertId(id, "Drill page id");
    const row = await this.db.getFirstAsync<Row>(
      `SELECT id, drill_id, ordinal, label, counts_from_previous,
              x_meters, y_meters
       FROM ${DRILL_PAGES_TABLE}
       WHERE id = ?`,
      [pageId],
    );
    return row ? toPage(row) : undefined;
  }

  async createPage(input: CreateDrillPageInput): Promise<DrillPage> {
    const normalized = normalizePage(input);
    const createdId = assertId(
      normalized.id ?? this.idFactory(),
      "Drill page id",
    );

    await this.db.withTransactionAsync(async () => {
      await this.requireDrill(normalized.drillId);
      const count = await this.pageCount(normalized.drillId);
      await this.insertPageRow({
        ...normalized,
        id: createdId,
        ordinal: count,
      });
    });
    return requireValue(await this.getPage(createdId), "drill page", createdId);
  }

  async updatePage(
    pageId: string,
    changes: UpdateDrillPageInput,
  ): Promise<DrillPage> {
    const id = assertId(pageId, "Drill page id");
    const current = await this.getPage(id);
    if (!current) throw pageNotFound(id);

    const assignments: string[] = [];
    const params: (string | number | null)[] = [];
    if (changes.label !== undefined) {
      assignments.push("label = ?");
      params.push(assertText(changes.label, "Drill page label"));
    }
    if (changes.countsFromPrevious !== undefined) {
      assignments.push("counts_from_previous = ?");
      params.push(
        assertCount(changes.countsFromPrevious, "countsFromPrevious"),
      );
    }
    if (changes.position !== undefined) {
      const position = assertPosition(changes.position);
      assignments.push("x_meters = ?", "y_meters = ?");
      params.push(position.xMeters, position.yMeters);
    }
    if (!assignments.length) return current;

    params.push(id);
    await this.db.runAsync(
      `UPDATE ${DRILL_PAGES_TABLE}
       SET ${assignments.join(", ")}
       WHERE id = ?`,
      params,
    );
    return requireValue(await this.getPage(id), "drill page", id);
  }

  async deletePage(id: string): Promise<void> {
    const pageId = assertId(id, "Drill page id");
    await this.db.withTransactionAsync(async () => {
      const page = await this.getPage(pageId);
      if (!page) return;
      await this.db.runAsync(`DELETE FROM ${DRILL_PAGES_TABLE} WHERE id = ?`, [
        pageId,
      ]);
      // The deleted ordinal is now a gap; moving higher ordinals down cannot
      // collide with the rows that remain.
      await this.db.runAsync(
        `UPDATE ${DRILL_PAGES_TABLE}
         SET ordinal = ordinal - 1
         WHERE drill_id = ? AND ordinal > ?`,
        [page.drillId, page.ordinal],
      );
    });
  }

  async insertPage(
    drillId: string,
    ordinalValue: number,
    details: CreateDrillPageDetails,
  ): Promise<DrillPage> {
    const input: CreateDrillPageInput = { ...details, drillId };
    const normalized = normalizePage(input);
    const ordinal = assertOrdinal(ordinalValue, "Page ordinal");
    const id = assertId(normalized.id ?? this.idFactory(), "Drill page id");

    await this.db.withTransactionAsync(async () => {
      await this.requireDrill(normalized.drillId);
      const count = await this.pageCount(normalized.drillId);
      if (ordinal > count) {
        throw new RangeError(
          `Page ordinal must be between 0 and ${count} when inserting.`,
        );
      }
      if (count > 0)
        await this.shiftPagesForInsertion(normalized.drillId, count, ordinal);
      await this.insertPageRow({ ...normalized, id, ordinal });
    });
    return requireValue(await this.getPage(id), "drill page", id);
  }

  async reorderPages(
    drillId: string,
    orderedPageIds: readonly (string | { readonly id: string })[],
  ): Promise<DrillPage[]> {
    const parentId = assertId(drillId, "Drill id");
    const ids = orderedPageIds.map((value) =>
      assertId(typeof value === "string" ? value : value.id, "Drill page id"),
    );
    if (new Set(ids).size !== ids.length) {
      throw new DrillRepositoryError(
        "INVALID_PAGE_ORDER",
        "A page may appear only once in a reorder operation.",
      );
    }

    await this.db.withTransactionAsync(async () => {
      const rows = await this.db.getAllAsync<{ id: string }>(
        `SELECT id
         FROM ${DRILL_PAGES_TABLE}
         WHERE drill_id = ?
         ORDER BY ordinal ASC, id ASC`,
        [parentId],
      );
      const existingIds = rows.map((row) => row.id);
      if (
        existingIds.length !== ids.length ||
        existingIds.some((id) => !ids.includes(id))
      ) {
        throw new DrillRepositoryError(
          "INVALID_PAGE_ORDER",
          "A reorder must contain every page in the drill exactly once.",
        );
      }

      if (ids.length > 0) {
        const offset = ids.length + 1;
        await this.db.runAsync(
          `UPDATE ${DRILL_PAGES_TABLE}
           SET ordinal = ordinal + ?
           WHERE drill_id = ?`,
          [offset, parentId],
        );
        for (const [ordinal, pageId] of ids.entries()) {
          await this.db.runAsync(
            `UPDATE ${DRILL_PAGES_TABLE}
             SET ordinal = ?
             WHERE id = ? AND drill_id = ?`,
            [ordinal, pageId, parentId],
          );
        }
      }
    });
    return await this.listPages(parentId);
  }

  async setSelectedDrillPage(id: string | null): Promise<AppSettings> {
    const selectedPageId = nullableId(id, "Selected drill page id");
    await this.db.withTransactionAsync(async () => {
      await this.ensureSettingsRow();
      const settings = await this.db.getFirstAsync<{
        active_drill_id: SqlValue | undefined;
      }>(
        `SELECT active_drill_id
         FROM ${APP_SETTINGS_TABLE}
         WHERE singleton_id = ?`,
        [1],
      );
      const activeDrillId = nullableIdFromSql(settings?.active_drill_id);
      if (selectedPageId === null) {
        await this.db.runAsync(
          `UPDATE ${APP_SETTINGS_TABLE}
           SET selected_drill_page_id = NULL
           WHERE singleton_id = ?`,
          [1],
        );
        return;
      }
      if (activeDrillId === null) {
        throw new DrillRepositoryError(
          "INVALID_SELECTION",
          "A drill page cannot be selected without an active drill.",
        );
      }
      const page = await this.db.getFirstAsync<{ drill_id: string }>(
        `SELECT drill_id
         FROM ${DRILL_PAGES_TABLE}
         WHERE id = ?`,
        [selectedPageId],
      );
      if (!page || page.drill_id !== activeDrillId) {
        throw new DrillRepositoryError(
          "INVALID_SELECTION",
          "The selected page must belong to the active drill.",
        );
      }
      await this.db.runAsync(
        `UPDATE ${APP_SETTINGS_TABLE}
         SET selected_drill_page_id = ?
         WHERE singleton_id = ?`,
        [selectedPageId, 1],
      );
    });
    return await this.settingsRepository.load();
  }

  private async requireDrill(id: string): Promise<Drill> {
    const drill = await this.getDrill(id);
    if (!drill) throw drillNotFound(id);
    return drill;
  }

  private async pageCount(drillId: string): Promise<number> {
    const row = await this.db.getFirstAsync<{
      page_count: SqlValue | undefined;
    }>(
      `SELECT COUNT(*) AS page_count
       FROM ${DRILL_PAGES_TABLE}
       WHERE drill_id = ?`,
      [drillId],
    );
    const count = Number(row?.page_count ?? 0);
    if (!Number.isInteger(count) || count < 0) {
      throw new DrillRepositoryError(
        "INVALID_INPUT",
        "The persisted page count is invalid.",
      );
    }
    return count;
  }

  private async insertPageRow(page: {
    readonly id: string;
    readonly drillId: string;
    readonly ordinal: number;
    readonly label: string;
    readonly countsFromPrevious: number;
    readonly position: FieldPoint;
  }): Promise<string> {
    await this.db.runAsync(
      `INSERT INTO ${DRILL_PAGES_TABLE}
       (id, drill_id, ordinal, label, counts_from_previous, x_meters, y_meters)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        page.id,
        page.drillId,
        page.ordinal,
        page.label,
        page.countsFromPrevious,
        page.position.xMeters,
        page.position.yMeters,
      ],
    );
    return page.id;
  }

  private async shiftPagesForInsertion(
    drillId: string,
    count: number,
    insertionOrdinal: number,
  ): Promise<void> {
    const offset = count + 1;
    await this.db.runAsync(
      `UPDATE ${DRILL_PAGES_TABLE}
       SET ordinal = ordinal + ?
       WHERE drill_id = ?`,
      [offset, drillId],
    );
    // The temporary offset prevents SQLite's unique (drill_id, ordinal)
    // constraint from observing an intermediate collision.
    await this.db.runAsync(
      `UPDATE ${DRILL_PAGES_TABLE}
       SET ordinal = CASE
         WHEN ordinal >= ? THEN ordinal - ? + 1
         ELSE ordinal - ?
       END
       WHERE drill_id = ?`,
      [offset + insertionOrdinal, offset, offset, drillId],
    );
  }

  private async ensureSettingsRow(): Promise<void> {
    await this.db.runAsync(
      `INSERT OR IGNORE INTO ${APP_SETTINGS_TABLE} (singleton_id)
       VALUES (?)`,
      [1],
    );
  }
}

function normalizePage(input: CreateDrillPageInput): {
  readonly id?: string;
  readonly drillId: string;
  readonly label: string;
  readonly countsFromPrevious: number;
  readonly position: FieldPoint;
} {
  return {
    ...(input.id === undefined
      ? {}
      : { id: assertId(input.id, "Drill page id") }),
    drillId: assertId(input.drillId, "Drill id"),
    label: assertText(input.label, "Drill page label"),
    countsFromPrevious: assertCount(
      input.countsFromPrevious ?? 0,
      "countsFromPrevious",
    ),
    position: assertPosition(input.position),
  };
}

function assertPosition(position: FieldPoint): FieldPoint {
  assertFiniteFieldPoint(position, "Drill page position");
  return { xMeters: position.xMeters, yMeters: position.yMeters };
}

function assertText(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DrillRepositoryError(
      "INVALID_INPUT",
      `${name} must be a non-empty string.`,
    );
  }
  return value.trim();
}

function assertId(value: unknown, name: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new DrillRepositoryError(
      "INVALID_INPUT",
      `${name} must be a non-empty string.`,
    );
  }
  return value.trim();
}

function nullableId(value: string | null, name: string): string | null {
  if (value === null) return null;
  return assertId(value, name);
}

function assertTimestamp(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new DrillRepositoryError(
      "INVALID_INPUT",
      `${name} must be a finite number.`,
    );
  }
  return value;
}

function assertCount(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new DrillRepositoryError(
      "INVALID_INPUT",
      `${name} must be a finite non-negative number.`,
    );
  }
  return value;
}

function assertOrdinal(value: unknown, name: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new DrillRepositoryError(
      "INVALID_INPUT",
      `${name} must be a non-negative integer.`,
    );
  }
  return value;
}

function nullableIdFromSql(value: SqlValue | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toDrill(row: Row): Drill {
  return {
    id: rowText(row.id, "drill id"),
    name: rowText(row.name, "drill name"),
    createdAt: rowNumber(row.created_at, "drill created_at"),
    updatedAt: rowNumber(row.updated_at, "drill updated_at"),
  };
}

function toPage(row: Row): DrillPage {
  const xMeters = rowNumber(row.x_meters, "drill page x_meters");
  const yMeters = rowNumber(row.y_meters, "drill page y_meters");
  return {
    id: rowText(row.id, "drill page id"),
    drillId: rowText(row.drill_id, "drill page drill_id"),
    ordinal: rowNumber(row.ordinal, "drill page ordinal"),
    label: rowText(row.label, "drill page label"),
    countsFromPrevious: rowNumber(
      row.counts_from_previous,
      "drill page counts_from_previous",
    ),
    position: { xMeters, yMeters },
  };
}

function rowText(value: SqlValue | undefined, name: string): string {
  if (typeof value !== "string") {
    throw new MobileRowError(`${name} is not a string.`);
  }
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

function drillNotFound(id: string): DrillRepositoryError {
  return new DrillRepositoryError(
    "DRILL_NOT_FOUND",
    `Drill ${id} was not found.`,
  );
}

function pageNotFound(id: string): DrillRepositoryError {
  return new DrillRepositoryError(
    "PAGE_NOT_FOUND",
    `Drill page ${id} was not found.`,
  );
}

function defaultIdFactory(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  return `mobile-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 12)}`;
}
