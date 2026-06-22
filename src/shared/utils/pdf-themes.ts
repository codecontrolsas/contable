/**
 * Temas visuales para templates de PDF.
 *
 * 3 temas predefinidos. El usuario puede override el color primario
 * por template (campo `primaryColor` en DocumentTemplate).
 */

export type ThemeName = 'CLASSIC' | 'MODERN' | 'MINIMAL';

export interface ThemeConfig {
  /** Color principal de acento (líneas, bordes, títulos destacados) */
  primaryColor: string;
  /** Color de fondo del header (solo theme MODERN) */
  headerBg: string;
  /** Color del texto del header (sobre headerBg) */
  headerTextColor: string;
  /** Color de las líneas divisorias */
  borderColor: string;
  /** Color de texto de los títulos de sección */
  sectionTitleColor: string;
  /** Estilo de la línea del header: 'solid' (default) o 'double' */
  headerStyle: 'solid' | 'double';
  /** Ancho de la línea del header en puntos */
  headerBorderWidth: number;
}

const DEFAULT_PRIMARY_COLOR = '#1e40af'; // azul

export const THEME_PRESETS: Record<ThemeName, ThemeConfig> = {
  CLASSIC: {
    primaryColor: '#000000',
    headerBg: '#ffffff',
    headerTextColor: '#000000',
    borderColor: '#000000',
    sectionTitleColor: '#000000',
    headerStyle: 'solid',
    headerBorderWidth: 2,
  },
  MODERN: {
    primaryColor: DEFAULT_PRIMARY_COLOR,
    headerBg: '#f1f5f9', // slate-100
    headerTextColor: '#0f172a', // slate-900
    borderColor: '#cbd5e1', // slate-300
    sectionTitleColor: DEFAULT_PRIMARY_COLOR,
    headerStyle: 'solid',
    headerBorderWidth: 1,
  },
  MINIMAL: {
    primaryColor: '#64748b', // slate-500
    headerBg: '#ffffff',
    headerTextColor: '#0f172a',
    borderColor: '#e2e8f0', // slate-200
    sectionTitleColor: '#64748b',
    headerStyle: 'solid',
    headerBorderWidth: 1,
  },
};

/**
 * Devuelve la config final del theme, con override opcional del color primario.
 * Si `primaryColor` viene en el override, se aplica a `primaryColor` y `sectionTitleColor`
 * (los demás colores se mantienen del theme base).
 */
export function resolveThemeConfig(
  theme: ThemeName,
  primaryColorOverride?: string | null
): ThemeConfig {
  const base = THEME_PRESETS[theme] ?? THEME_PRESETS.CLASSIC;
  if (!primaryColorOverride) return base;
  return {
    ...base,
    primaryColor: primaryColorOverride,
    sectionTitleColor: primaryColorOverride,
  };
}

/**
 * Subconjunto de la config de template que afecta el render del PDF.
 * Compartido por los data-mappers (no es server-only, a diferencia de
 * DocumentTemplateConfig en document-template.ts).
 */
export interface PdfTemplateConfig {
  themeConfig: ThemeConfig;
  headerText?: string | null;
  footerText?: string | null;
  notesDefault?: string | null;
  showIssuer?: boolean;
  showReceiver?: boolean;
  showNotes?: boolean;
  showWithholdings?: boolean;
  showCae?: boolean;
}

/** Theme por defecto (CLASSIC) para cuando no se pasa config. */
export const FALLBACK_THEME_CONFIG: ThemeConfig = THEME_PRESETS.CLASSIC;

export const THEME_LABELS: Record<ThemeName, string> = {
  CLASSIC: 'Clásico',
  MODERN: 'Moderno',
  MINIMAL: 'Minimalista',
};

export const THEME_DESCRIPTIONS: Record<ThemeName, string> = {
  CLASSIC: 'Negro y grises, líneas marcadas. Aspecto tradicional de comprobante.',
  MODERN: 'Color de acento y fondo en el header. Aspecto corporativo actual.',
  MINIMAL: 'Espacios amplios y líneas suaves. Aspecto limpio y moderno.',
};