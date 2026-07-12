import React from "react";
import { Card } from "@eight2five/ui/card";
import { Heading } from "@eight2five/ui/heading";
import { Text } from "@eight2five/ui/text";
import { VStack } from "@eight2five/ui/vstack";

import { SubappRouteLayout } from "../../../src/subapps/SubappRouteLayout";

export default function Dwm1001ManagerDashboardRoute() {
  return (
    <SubappRouteLayout subappId="dwm1001-manager">
      <VStack space="lg">
        <Card className="border border-border bg-card p-4">
          <Heading size="md" className="text-foreground">
            Manager setup
          </Heading>
          <Text className="mt-2 text-muted-foreground">
            Bluetooth discovery starts only after you explicitly request it. A
            custom development build is required for DWM1001 hardware access.
          </Text>
        </Card>
      </VStack>
    </SubappRouteLayout>
  );
}
