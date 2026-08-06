import React from "react";
import { Stack } from "expo-router";

import { ConverterScreen } from "../src/converter-screen";

export default function IndexRoute() {
  return (
    <>
      <Stack.Screen options={{ title: "Drill Converter" }} />
      <ConverterScreen />
    </>
  );
}
