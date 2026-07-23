import React from "react";
import { useFocusEffect } from "expo-router";

interface RegisteredToolbarAction {
  id: string;
  content: React.ReactNode;
}

interface TestbedToolbarContextValue {
  action?: RegisteredToolbarAction;
  registerAction(id: string, content: React.ReactNode): () => void;
}

const TestbedToolbarContext = React.createContext<TestbedToolbarContextValue>({
  registerAction: () => () => undefined,
});

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
  const value = React.useMemo(
    () => ({ action, registerAction }),
    [action, registerAction],
  );

  return (
    <TestbedToolbarContext.Provider value={value}>
      {children}
    </TestbedToolbarContext.Provider>
  );
}

export function TestbedToolbarActionSlot() {
  const { action } = React.use(TestbedToolbarContext);
  return <>{action?.content}</>;
}

export function useTestbedToolbarAction(
  id: string,
  content: React.ReactNode,
): void {
  const { registerAction } = React.use(TestbedToolbarContext);
  useFocusEffect(
    React.useCallback(
      () => registerAction(id, content),
      [content, id, registerAction],
    ),
  );
}
