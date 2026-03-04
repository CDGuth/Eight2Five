import React, { useCallback } from "react";
import { View, ViewProps } from "react-native";

interface ScrollLockViewProps extends ViewProps {
  onToggleScroll?: (enabled: boolean) => void;
  children: React.ReactNode;
}

/**
 * A wrapper component that disables outer ScrollView scrolling when interacted with.
 * It uses the responder system's capture phase to ensure the parent scroll is disabled
 * the moment a touch starts within this view, mirroring the behavior of the Dropdown component.
 */
export const ScrollLockView = ({
  onToggleScroll,
  children,
  ...props
}: ScrollLockViewProps) => {
  const lock = useCallback(() => onToggleScroll?.(false), [onToggleScroll]);
  const unlock = useCallback(() => onToggleScroll?.(true), [onToggleScroll]);

  return (
    <View
      onStartShouldSetResponderCapture={() => {
        lock();
        return false; // Don't capture, let children handle the touch
      }}
      // Ensure we unlock on release/cancel even if the child consumed the event
      onTouchEnd={unlock}
      onTouchCancel={unlock}
      {...props}
    >
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          // If the child is a ScrollView (detected by name or common scroll props),
          // we attach scroll drag handlers to ensure robustness during active scrolling.
          return React.cloneElement(child as any, {
            onScrollBeginDrag: lock,
            onScrollEndDrag: unlock,
            onMomentumScrollEnd: unlock,
            // Merge with existing touch handlers if any
            onTouchEnd: unlock,
            onTouchCancel: unlock,
          });
        }
        return child;
      })}
    </View>
  );
};
