import React from "react";
import { useFocusEffect } from "expo-router";

interface RegisteredToolbarAction {
  id: string;
  content: React.ReactNode;
}

interface TestbedToolbarRegistrationContextValue {
  registerAction(id: string, content: React.ReactNode): () => void;
}

const TestbedToolbarRegistrationContext =
  React.createContext<TestbedToolbarRegistrationContextValue>({
    registerAction: () => () => undefined,
  });
const TestbedToolbarActionContext = React.createContext<
  RegisteredToolbarAction | undefined
>(undefined);

export function TestbedToolbarActionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [action, setAction] = React.useState<RegisteredToolbarAction>();
  const registerAction = React.useCallback(
    (id: string, content: React.ReactNode) => {
      setAction({ id, content });
      return () => {
        setAction((current) => (current?.id === id ? undefined : current));
      };
    },
    [],
  );
  const registrationValue = React.useMemo(
    () => ({ registerAction }),
    [registerAction],
  );

  return (
    <TestbedToolbarRegistrationContext.Provider value={registrationValue}>
      <TestbedToolbarActionContext.Provider value={action}>
        {children}
      </TestbedToolbarActionContext.Provider>
    </TestbedToolbarRegistrationContext.Provider>
  );
}

export function TestbedToolbarActionSlot() {
  const action = React.use(TestbedToolbarActionContext);
  return <>{action?.content}</>;
}

export function useTestbedToolbarAction(
  id: string,
  content: React.ReactNode,
): void {
  const { registerAction } = React.use(TestbedToolbarRegistrationContext);
  useFocusEffect(
    React.useCallback(
      () => registerAction(id, content),
      [content, id, registerAction],
    ),
  );
}
