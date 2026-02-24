'use client';

import { Button } from '@/shared/components/ui/button';
import { FileText, Book, BookOpen, Scale, TrendingUp, AlertTriangle, RotateCcw, ArrowLeftRight, Calculator, CalendarRange } from 'lucide-react';

export type ReportType =
  | 'trial-balance'
  | 'journal-book'
  | 'general-ledger'
  | 'balance-sheet'
  | 'income-statement'
  | 'entries-without-documents'
  | 'reversal-log'
  | 'document-traceability'
  | 'fixed-assets'
  | 'period-depreciations';

interface ReportsSelectorProps {
  selectedReport: ReportType;
  onSelect: (report: ReportType) => void;
}

const financialReports = [
  {
    id: 'trial-balance' as const,
    name: 'Balance de Sumas y Saldos',
    description: 'Muestra los saldos de todas las cuentas',
    icon: FileText,
  },
  {
    id: 'balance-sheet' as const,
    name: 'Balance General',
    description: 'Estado de situación patrimonial',
    icon: Scale,
  },
  {
    id: 'income-statement' as const,
    name: 'Estado de Resultados',
    description: 'Ingresos, gastos y resultado del período',
    icon: TrendingUp,
  },
  {
    id: 'journal-book' as const,
    name: 'Libro Diario',
    description: 'Muestra todos los asientos contables',
    icon: Book,
  },
  {
    id: 'general-ledger' as const,
    name: 'Libro Mayor',
    description: 'Muestra los movimientos por cuenta',
    icon: BookOpen,
  },
];

const fixedAssetReports = [
  {
    id: 'fixed-assets' as const,
    name: 'Registro de Bienes de Uso',
    description: 'Listado de activos fijos con valores y depreciación',
    icon: Calculator,
  },
  {
    id: 'period-depreciations' as const,
    name: 'Depreciaciones del Período',
    description: 'Detalle de depreciaciones contabilizadas por período',
    icon: CalendarRange,
  },
];

const auditReports = [
  {
    id: 'entries-without-documents' as const,
    name: 'Asientos sin Respaldo',
    description: 'Asientos sin documento comercial vinculado',
    icon: AlertTriangle,
  },
  {
    id: 'reversal-log' as const,
    name: 'Registro de Reversiones',
    description: 'Historial de asientos anulados',
    icon: RotateCcw,
  },
  {
    id: 'document-traceability' as const,
    name: 'Trazabilidad Doc-Asiento',
    description: 'Cruce entre documentos y asientos contables',
    icon: ArrowLeftRight,
  },
];

export function _ReportsSelector({ selectedReport, onSelect }: ReportsSelectorProps) {
  const renderReportButton = (report: (typeof financialReports)[number] | (typeof fixedAssetReports)[number] | (typeof auditReports)[number]) => {
    const Icon = report.icon;
    return (
      <Button
        key={report.id}
        variant={selectedReport === report.id ? 'default' : 'outline'}
        className="flex h-auto flex-col items-center gap-2 p-6"
        onClick={() => onSelect(report.id)}
      >
        <Icon className="h-6 w-6" />
        <div className="text-center">
          <div className="font-medium">{report.name}</div>
          <div className="text-sm text-muted-foreground">
            {report.description}
          </div>
        </div>
      </Button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {financialReports.map(renderReportButton)}
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Bienes de Uso</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {fixedAssetReports.map(renderReportButton)}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Auditoría</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {auditReports.map(renderReportButton)}
        </div>
      </div>
    </div>
  );
}
