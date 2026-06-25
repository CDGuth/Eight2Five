import { useState } from "react";
import { Alert, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import * as Clipboard from "expo-clipboard";

export function useCaptureToClipboard() {
  const [isCapturing, setIsCapturing] = useState(false);

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
      Alert.alert("Success", "Image copied");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to copy");
    } finally {
      setIsCapturing(false);
    }
  };

  return { isCapturing, capture };
}
