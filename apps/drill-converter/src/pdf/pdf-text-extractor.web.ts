import type { DocumentPickerAsset } from "expo-document-picker";
import type {
  ExtractedPdfPage,
  ExtractedPdfTextItem,
} from "@eight2five/drill-importers";

const PDFJS_VERSION = "6.2.108";
const PDFJS_MODULE_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

interface PdfJsTextItem {
  readonly str: string;
  readonly transform: readonly number[];
  readonly width?: number;
  readonly height?: number;
}

interface PdfJsTextContent {
  readonly items: readonly (PdfJsTextItem | Record<string, unknown>)[];
}

interface PdfJsPage {
  readonly view: readonly number[];
  getTextContent(): Promise<PdfJsTextContent>;
}

interface PdfJsDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
  destroy(): Promise<void>;
}

interface PdfJsModule {
  readonly GlobalWorkerOptions: { workerSrc: string };
  getDocument(source: { data: Uint8Array }): {
    readonly promise: Promise<PdfJsDocument>;
  };
}

let pdfJsPromise: Promise<PdfJsModule> | undefined;

/**
 * Load PDF.js only in the browser. The pinned library bundle is fetched from
 * jsDelivr, while the selected PDF bytes remain local to the user's browser.
 */
async function loadPdfJs(): Promise<PdfJsModule> {
  if (typeof window === "undefined") {
    throw new Error("PDF extraction is available only in the browser.");
  }
  if (!pdfJsPromise) {
    pdfJsPromise = (async () => {
      // Metro cannot statically bundle an https: ESM import. Using the native
      // browser importer keeps the converter package dependency-free while
      // still pinning PDF.js to an exact version.
      const importModule = new Function("url", "return import(url);") as (
        url: string,
      ) => Promise<PdfJsModule>;
      const pdfjs = await importModule(PDFJS_MODULE_URL);
      pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
      return pdfjs;
    })();
  }
  return await pdfJsPromise;
}

export async function extractPdfText(
  asset: DocumentPickerAsset,
): Promise<readonly ExtractedPdfPage[]> {
  const bytes = new Uint8Array(await readAssetBytes(asset));
  const pdfjs = await loadPdfJs();
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  try {
    const pages: ExtractedPdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const items = textContent.items
        .filter(isTextItem)
        .map(toExtractedTextItem)
        .filter((item) => item.text.trim().length > 0);
      pages.push({
        pageNumber,
        width: Math.abs((page.view[2] ?? 0) - (page.view[0] ?? 0)),
        height: Math.abs((page.view[3] ?? 0) - (page.view[1] ?? 0)),
        items,
      });
    }
    return pages;
  } finally {
    await document.destroy();
  }
}

export function getPdfJsVersion(): string {
  return PDFJS_VERSION;
}

async function readAssetBytes(
  asset: DocumentPickerAsset,
): Promise<ArrayBuffer> {
  if (asset.file) return await asset.file.arrayBuffer();
  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error(`Unable to read ${asset.name}: ${response.statusText}.`);
  }
  return await response.arrayBuffer();
}

function isTextItem(
  value: PdfJsTextItem | Record<string, unknown>,
): value is PdfJsTextItem {
  return (
    typeof (value as { str?: unknown }).str === "string" &&
    Array.isArray((value as { transform?: unknown }).transform)
  );
}

function toExtractedTextItem(item: PdfJsTextItem): ExtractedPdfTextItem {
  return {
    text: item.str,
    x: finiteCoordinate(item.transform[4]),
    y: finiteCoordinate(item.transform[5]),
    ...(typeof item.width === "number" && Number.isFinite(item.width)
      ? { width: item.width }
      : {}),
    ...(typeof item.height === "number" && Number.isFinite(item.height)
      ? { height: item.height }
      : {}),
  };
}

function finiteCoordinate(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
