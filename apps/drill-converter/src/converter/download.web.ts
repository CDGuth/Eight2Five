export function downloadTextFile(
  contents: string,
  fileName: string,
  mimeType = "application/json;charset=utf-8",
): void {
  if (typeof window === "undefined") {
    throw new Error("Downloads are available only in the browser.");
  }
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    window.document.body.appendChild(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    URL.revokeObjectURL(url);
  }
}
