import { Box } from "@eight2five/ui/components/box";
import { useEight2FiveTheme } from "@eight2five/ui/theme";

export default function ManagerMapRoute() {
  const theme = useEight2FiveTheme();

  return (
    <Box className="flex-1" style={{ backgroundColor: theme.background }} />
  );
}
