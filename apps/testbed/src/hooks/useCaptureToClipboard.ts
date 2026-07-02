import { useState } from "react";
import { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Clipboard from "expo-clipboard";

import { useTestbedToast } from "./useTestbedToast";

export function useCaptureToClipboard() {
  const [isCapturing, setIsCapturing] = useState(false);
  const showToast = useTestbedToast();

  const capture = async (
    ref: React.RefObject<View | null>,
    options?: { format?: "png"; quality?: number },
  ) => {
    try {
      setIsCapturing(true);
      await new Promise((r) => setTimeout(r, 100));
      const base64 = await captureRef(ref, {
        format: "png",
        quality: 0.8,
        result: "base64",
        ...options,
      });
      await Clipboard.setImageAsync(base64);
      showToast({
        title: "Copied",
        description: "Image copied to clipboard",
        action: "success",
      });
    } catch (e) {
      console.error(e);
      showToast({
        title: "Error",
        description: "Failed to copy image",
        action: "error",
      });
    } finally {
      setIsCapturing(false);
    }
  };

  return { isCapturing, capture };
}
