'use client';

import Link from 'next/link';
import { ArrowRight, Palette } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { THEME_LABELS, type ThemeName } from '@/shared/utils/pdf-themes';

interface TemplateSummary {
  documentType: string;
  theme: string;
  primaryColor: string | null;
  updatedAt: string | null;
  label: string;
}

interface Props {
  templates: TemplateSummary[];
}

function templateHref(documentType: string): string {
  return `/dashboard/company/documents/templates/${documentType.toLowerCase().replace(/_/g, '-')}`;
}

export function _TemplatesGrid({ templates }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => {
        const themeLabel = THEME_LABELS[t.theme as ThemeName] ?? t.theme;
        const accent = t.primaryColor ?? (t.theme === 'MODERN' ? '#1e40af' : '#000000');
        const isCustomized = !!t.updatedAt;

        return (
          <Link key={t.documentType} href={templateHref(t.documentType)}>
            <Card className="cursor-pointer transition-colors hover:border-primary">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{t.label}</CardTitle>
                  <Palette className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardDescription className="text-xs uppercase tracking-wide">
                  {t.documentType.replace(/_/g, ' ')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Mini preview del header */}
                <div
                  className="rounded-md border p-3"
                  style={{ borderColor: accent }}
                >
                  <div
                    className="text-xs font-semibold uppercase"
                    style={{ color: accent }}
                  >
                    HEADER
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Empresa · CUIT · Dirección
                  </div>
                  <div
                    className="mt-2 border-t"
                    style={{ borderColor: accent, opacity: 0.4 }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full border"
                      style={{ backgroundColor: accent }}
                    />
                    <span className="text-muted-foreground">{themeLabel}</span>
                  </div>
                  {isCustomized ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Personalizado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">
                      Default
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-end text-xs text-primary">
                  Configurar
                  <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}