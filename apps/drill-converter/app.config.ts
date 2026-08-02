import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Eight2Five Drill Converter",
  slug: "eight2five-drill-converter",
  version: "0.0.0",
  platforms: ["web"],
  userInterfaceStyle: "automatic",
  web: {
    bundler: "metro",
    output: "static",
  },
  plugins: ["expo-router"],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
