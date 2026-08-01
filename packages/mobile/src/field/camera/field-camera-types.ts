import type { SharedValue } from "react-native-reanimated";

import type { FieldPoint } from "../types";

export interface FieldViewportSize {
  readonly width: number;
  readonly height: number;
}

export interface FieldViewport {
  readonly centerXMeters: number;
  readonly centerYMeters: number;
  readonly metersPerPixel: number;
}

export interface FieldCameraBounds {
  readonly minXMeters: number;
  readonly maxXMeters: number;
  readonly minYMeters: number;
  readonly maxYMeters: number;
}

/** UI-thread camera values. Camera motion must not require a React render. */
export interface FieldCamera {
  readonly centerXMeters: SharedValue<number>;
  readonly centerYMeters: SharedValue<number>;
  readonly metersPerPixel: SharedValue<number>;
}

export interface FieldPanBaseline {
  readonly center: FieldPoint;
  readonly translationX: number;
  readonly translationY: number;
  readonly metersPerPixel: number;
}
