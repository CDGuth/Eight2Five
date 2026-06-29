import React from "react";

import {
  TestbedLayout,
  type TestbedLayoutProps,
} from "../components/TestbedLayout";
import { getSubappById, type SubappId } from ".";

interface SubappRouteLayoutProps {
  subappId: SubappId;
  children: React.ReactNode;
  contentMode?: TestbedLayoutProps["contentMode"];
}

export function SubappRouteLayout({
  subappId,
  children,
  contentMode,
}: SubappRouteLayoutProps) {
  const subapp = getSubappById(subappId);

  return (
    <TestbedLayout
      title={subapp.title}
      subtitle={subapp.description}
      contentMode={contentMode}
    >
      {children}
    </TestbedLayout>
  );
}
