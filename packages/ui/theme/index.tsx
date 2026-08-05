import { Montserrat_400Regular } from '@expo-google-fonts/montserrat/400Regular';
import { Montserrat_500Medium } from '@expo-google-fonts/montserrat/500Medium';
import { Montserrat_600SemiBold } from '@expo-google-fonts/montserrat/600SemiBold';
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold';
import { SourceSans3_400Regular } from '@expo-google-fonts/source-sans-3/400Regular';
import { SourceSans3_500Medium } from '@expo-google-fonts/source-sans-3/500Medium';
import { SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3/600SemiBold';
import { SourceSans3_700Bold } from '@expo-google-fonts/source-sans-3/700Bold';
import { COLOR_PRESETS } from '@eight2five/drill-schema';
import { useFonts } from 'expo-font';
import React from 'react';
import { useColorScheme, type ColorSchemeName } from 'react-native';

export const eight2FiveDrillColors = COLOR_PRESETS;

export const eight2FiveBaseColors = {
  blue: eight2FiveDrillColors.blue,
  blueSecondary: '#3264BE',
  white: '#FFFFFF',
  black: '#000000',
  icon: '#1E1E1E',
  danger: '#C83C3C',
  warning: '#C8BA3C',
  warningSecondary: '#B9AB2D',
  safe: '#43C83C',
  safeSecondary: '#34B92D',
} as const;

export const eight2FiveLightColors = {
  ...eight2FiveBaseColors,
  dark: '#1E1E1E',
  light: '#FFFFFF',
  primary: '#A5A5A5',
  secondary: '#DADADA',
  tertiary: '#F3F3F3',
  dangerSecondary: '#B92D2D',
} as const;

export const eight2FiveDarkColors = {
  ...eight2FiveBaseColors,
  dark: '#131313',
  light: '#4C4C4C',
  primary: '#333333',
  secondary: '#242424',
  tertiary: '#1E1E1E',
  dangerSecondary: '#B42828',
} as const;

export const eight2FiveFontSizes = {
  xxxs: 6,
  xxs: 8,
  xs: 10,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const eight2FiveRadii = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const eight2FiveSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const eight2FiveFonts = {
  style: 'Montserrat_400Regular',
  utility: 'SourceSans3_400Regular',
  styleRegular: 'Montserrat_400Regular',
  styleMedium: 'Montserrat_500Medium',
  styleSemibold: 'Montserrat_600SemiBold',
  styleBold: 'Montserrat_700Bold',
  utilityRegular: 'SourceSans3_400Regular',
  utilityMedium: 'SourceSans3_500Medium',
  utilitySemibold: 'SourceSans3_600SemiBold',
  utilityBold: 'SourceSans3_700Bold',
} as const;

export const eight2FiveThemes = {
  light: {
    raw: eight2FiveLightColors,
    background: eight2FiveLightColors.light,
    surface: eight2FiveLightColors.tertiary,
    surfaceRaised: eight2FiveLightColors.white,
    surfaceStrong: eight2FiveLightColors.secondary,
    text: eight2FiveLightColors.dark,
    textMuted: 'rgba(30, 30, 30, 0.64)',
    textSubtle: 'rgba(30, 30, 30, 0.46)',
    icon: eight2FiveLightColors.icon,
    border: eight2FiveLightColors.secondary,
    accent: eight2FiveLightColors.blue,
    accentPressed: eight2FiveLightColors.blueSecondary,
    accentSoft: 'rgba(60, 110, 200, 0.12)',
    danger: eight2FiveLightColors.danger,
    dangerSoft: 'rgba(200, 60, 60, 0.12)',
    warning: eight2FiveLightColors.warning,
    warningSoft: 'rgba(200, 186, 60, 0.14)',
    success: eight2FiveLightColors.safe,
    successSoft: 'rgba(67, 200, 60, 0.12)',
    shadow: 'rgba(30, 30, 30, 0.10)',
    shadowStrong: 'rgba(30, 30, 30, 0.16)',
  },
  dark: {
    raw: eight2FiveDarkColors,
    background: eight2FiveDarkColors.dark,
    surface: eight2FiveDarkColors.tertiary,
    surfaceRaised: eight2FiveDarkColors.secondary,
    surfaceStrong: eight2FiveDarkColors.primary,
    text: eight2FiveDarkColors.white,
    textMuted: 'rgba(255, 255, 255, 0.68)',
    textSubtle: 'rgba(255, 255, 255, 0.46)',
    icon: eight2FiveDarkColors.white,
    border: eight2FiveDarkColors.primary,
    accent: eight2FiveDarkColors.blue,
    accentPressed: eight2FiveDarkColors.blueSecondary,
    accentSoft: 'rgba(60, 110, 200, 0.20)',
    danger: eight2FiveDarkColors.danger,
    dangerSoft: 'rgba(200, 60, 60, 0.18)',
    warning: eight2FiveDarkColors.warning,
    warningSoft: 'rgba(200, 186, 60, 0.18)',
    success: eight2FiveDarkColors.safe,
    successSoft: 'rgba(67, 200, 60, 0.16)',
    shadow: 'rgba(0, 0, 0, 0.34)',
    shadowStrong: 'rgba(0, 0, 0, 0.48)',
  },
} as const;

export type Eight2FiveThemeName = keyof typeof eight2FiveThemes;
export type Eight2FiveTheme = (typeof eight2FiveThemes)[Eight2FiveThemeName];
export type Eight2FiveThemeMode = Eight2FiveThemeName | 'system';

const Eight2FiveThemeNameContext = React.createContext<
  Eight2FiveThemeName | undefined
>(undefined);

export function resolveEight2FiveThemeName(
  mode: Eight2FiveThemeMode,
  systemColorScheme: ColorSchemeName | null | undefined
): Eight2FiveThemeName {
  if (mode !== 'system') return mode;
  return systemColorScheme === 'dark' ? 'dark' : 'light';
}

export function Eight2FiveThemeProvider({
  mode,
  children,
}: {
  mode: Eight2FiveThemeMode;
  children: React.ReactNode;
}) {
  const systemColorScheme = useColorScheme();
  const themeName = resolveEight2FiveThemeName(mode, systemColorScheme);

  return (
    <Eight2FiveThemeNameContext.Provider value={themeName}>
      {children}
    </Eight2FiveThemeNameContext.Provider>
  );
}

export function useEight2FiveThemeName(): Eight2FiveThemeName {
  const providedThemeName = React.useContext(Eight2FiveThemeNameContext);
  const systemColorScheme = useColorScheme();
  return (
    providedThemeName ??
    resolveEight2FiveThemeName('system', systemColorScheme)
  );
}

export function useEight2FiveTheme(): Eight2FiveTheme {
  return eight2FiveThemes[useEight2FiveThemeName()];
}

export function useEight2FiveFonts(): [boolean, Error | null] {
  return useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    SourceSans3_400Regular,
    SourceSans3_500Medium,
    SourceSans3_600SemiBold,
    SourceSans3_700Bold,
  });
}
