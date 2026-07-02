import React, { useCallback } from "react";
import {
  Toast,
  ToastDescription,
  ToastTitle,
  useToast,
} from "@eight2five/ui/toast";

type TestbedToastAction = "success" | "error" | "info" | "warning" | "muted";

interface ShowTestbedToastOptions {
  title: string;
  description?: string;
  action?: TestbedToastAction;
}

export function useTestbedToast() {
  const toast = useToast();

  return useCallback(
    ({ title, description, action = "info" }: ShowTestbedToastOptions) => {
      toast.show({
        placement: "top",
        render: ({ id }: { id: string }) => (
          <Toast nativeID={id} action={action} variant="solid">
            <ToastTitle size="sm">{title}</ToastTitle>
            {description ? (
              <ToastDescription size="xs">{description}</ToastDescription>
            ) : null}
          </Toast>
        ),
      });
    },
    [toast],
  );
}
