import { isTransientManagerError, normalizeManagerError } from "./errors";
import type { PansManagerRepository } from "./PansManagerRepository";
import type {
  BatchItemStatus,
  PansBatchOperationItem,
  PansBatchOperationRecord,
} from "./types";

export interface PansBatchRunOptions<T> {
  id: string;
  type: string;
  deviceIds: string[];
  operation(deviceId: string): Promise<T>;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  onItemChange?(item: PansBatchOperationItem): void;
}

export interface PansBatchRunResult<T = unknown> {
  operation: PansBatchOperationRecord;
  items: PansBatchOperationItem[];
  successfulResults: { deviceId: string; result: T }[];
}

export class PansBatchOperationService {
  constructor(
    private readonly repository: PansManagerRepository,
    private readonly now: () => number = Date.now,
  ) {}

  async run<T>(
    options: PansBatchRunOptions<T>,
  ): Promise<PansBatchRunResult<T>> {
    const startedAt = this.now();
    let operation =
      (await this.repository.getBatchOperation(options.id)) ??
      ({
        id: options.id,
        type: options.type,
        status: "running",
        totalItems: options.deviceIds.length,
        completedItems: 0,
        startedAt,
        metadata: options.metadata,
      } satisfies PansBatchOperationRecord);
    operation = {
      ...operation,
      type: options.type,
      status: "running",
      totalItems: options.deviceIds.length,
      completedAt: undefined,
      metadata: operation.metadata ?? options.metadata,
    };
    await this.repository.saveBatchOperation(operation);

    const items = new Map(
      (await this.repository.listBatchItems(options.id)).map((item) => [
        item.deviceId,
        item,
      ]),
    );
    for (const [index, deviceId] of options.deviceIds.entries()) {
      if (!items.has(deviceId)) {
        const item: PansBatchOperationItem = {
          batchId: options.id,
          deviceId,
          index,
          status: "pending",
          attempts: 0,
        };
        items.set(deviceId, item);
        await this.repository.saveBatchItem(item);
        options.onItemChange?.(item);
      }
    }

    for (const deviceId of options.deviceIds) {
      if (options.signal?.aborted) break;
      const retained = items.get(deviceId)!;
      if (retained.status === "succeeded") continue;
      let item: PansBatchOperationItem = {
        ...retained,
        status: "connecting",
        startedAt: this.now(),
        completedAt: undefined,
        result: undefined,
        error: undefined,
      };
      await this.repository.saveBatchItem(item);
      options.onItemChange?.(item);

      const priorAttempts = retained.attempts;
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        item = await this.setItemStatus(
          item,
          "writing",
          { attempts: priorAttempts + attempt },
          options.onItemChange,
        );
        try {
          const result = await options.operation(deviceId);
          item = await this.setItemStatus(
            item,
            "verifying",
            { result },
            options.onItemChange,
          );
          item = {
            ...item,
            status: "succeeded",
            completedAt: this.now(),
            error: undefined,
          };
          break;
        } catch (error) {
          const normalized = normalizeManagerError(error, {
            deviceId,
            operation: options.type,
          });
          if (attempt === 1 && isTransientManagerError(normalized)) {
            item = await this.setItemStatus(
              item,
              "connecting",
              {},
              options.onItemChange,
            );
            continue;
          }
          item = {
            ...item,
            status: "failed",
            completedAt: this.now(),
            error: { code: normalized.code, message: normalized.message },
          };
          break;
        }
      }
      items.set(deviceId, item);
      await this.repository.saveBatchItem(item);
      options.onItemChange?.(item);
      operation = await this.saveProgress(operation, items);
    }

    const cancelled = options.signal?.aborted === true;
    if (cancelled) {
      for (const item of items.values()) {
        if (!isFinished(item)) {
          const skipped: PansBatchOperationItem = {
            ...item,
            status: "skipped",
            completedAt: this.now(),
            error: {
              code: "OPERATION_CANCELLED",
              message: "Skipped because the batch operation was cancelled.",
            },
          };
          items.set(item.deviceId, skipped);
          await this.repository.saveBatchItem(skipped);
          options.onItemChange?.(skipped);
        }
      }
    }

    operation = {
      ...operation,
      status: cancelled ? "cancelled" : "completed",
      completedItems: Array.from(items.values()).filter(isFinished).length,
      completedAt: this.now(),
    };
    await this.repository.saveBatchOperation(operation);
    const finalItems = Array.from(items.values()).sort(
      (left, right) => left.index - right.index,
    );
    return {
      operation,
      items: finalItems,
      successfulResults: finalItems
        .filter((item) => item.status === "succeeded")
        .map((item) => ({ deviceId: item.deviceId, result: item.result as T })),
    };
  }

  private async setItemStatus(
    item: PansBatchOperationItem,
    status: BatchItemStatus,
    patch: Partial<PansBatchOperationItem> = {},
    onItemChange?: (item: PansBatchOperationItem) => void,
  ): Promise<PansBatchOperationItem> {
    const next = { ...item, ...patch, status };
    await this.repository.saveBatchItem(next);
    onItemChange?.(next);
    return next;
  }

  private async saveProgress(
    operation: PansBatchOperationRecord,
    items: Map<string, PansBatchOperationItem>,
  ): Promise<PansBatchOperationRecord> {
    const next = {
      ...operation,
      completedItems: Array.from(items.values()).filter(isFinished).length,
    };
    await this.repository.saveBatchOperation(next);
    return next;
  }
}

function isFinished(item: PansBatchOperationItem): boolean {
  return (
    item.status === "succeeded" ||
    item.status === "failed" ||
    item.status === "skipped"
  );
}
