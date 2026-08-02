import type {
  DrillDocument,
  DrillGridPoint,
  MeasureRange,
  SetKind,
} from "@eight2five/drill-schema";

export interface ExtractedPdfTextItem {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
}

export interface ExtractedPdfPage {
  readonly pageNumber: number;
  readonly width: number;
  readonly height: number;
  readonly items: readonly ExtractedPdfTextItem[];
}

export interface ParsedSetIdentity {
  readonly number: number;
  readonly suffix?: string;
  readonly kind: SetKind;
}

export interface ParsedCoordinateRow {
  readonly set: ParsedSetIdentity;
  readonly countsFromPrevious: number;
  readonly measureRange?: MeasureRange;
  readonly position: DrillGridPoint;
  readonly rawText: string;
}

export interface ParsedCoordinateSheet {
  readonly pageNumber: number;
  readonly sheetIndex: number;
  readonly performerName?: string;
  readonly sourceSymbol: string;
  readonly sourceLabel?: string;
  readonly sourceId?: string;
  readonly displayLabel: string;
  readonly showTitle?: string;
  readonly rows: readonly ParsedCoordinateRow[];
}

export type ImportDiagnosticSeverity = "warning" | "error";

export interface ImportDiagnostic {
  readonly severity: ImportDiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly pageNumber?: number;
  readonly sheetIndex?: number;
  readonly rowText?: string;
}

export interface CoordinateSheetImportOptions {
  readonly title: string;
  readonly fileName?: string;
  readonly createdAt: string;
}

export interface CoordinateSheetImportResult {
  readonly document?: DrillDocument;
  readonly sheets: readonly ParsedCoordinateSheet[];
  readonly diagnostics: readonly ImportDiagnostic[];
}
