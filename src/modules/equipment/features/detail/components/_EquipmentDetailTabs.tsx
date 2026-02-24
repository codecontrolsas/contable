'use client';

import { Calculator, DollarSign, FileText, QrCode, Truck, Users } from 'lucide-react';

import {
  UrlTabs,
  UrlTabsList,
  UrlTabsTrigger,
} from '@/shared/components/ui/url-tabs';

export type EquipmentDetailTab = 'info' | 'contract' | 'assignment' | 'contractors' | 'documents' | 'depreciation' | 'qr';

interface Props {
  vehicleId: string;
  currentTab: EquipmentDetailTab;
  contractorCount: number;
  isActive: boolean;
  children: React.ReactNode;
}

export function _EquipmentDetailTabs({ vehicleId, currentTab, contractorCount, isActive, children }: Props) {
  return (
    <UrlTabs
      value={currentTab}
      paramName="tab"
      baseUrl={`/dashboard/equipment/${vehicleId}`}
      className="w-full"
    >
      {/* Mobile: 2 columnas, Desktop: 5-6 columnas según si está activo */}
      <UrlTabsList className={`grid w-full grid-cols-2 gap-1 h-auto sm:gap-0 sm:h-10 ${isActive ? 'sm:grid-cols-7' : 'sm:grid-cols-6'}`}>
        <UrlTabsTrigger value="info" className="flex items-center justify-center gap-2 py-2 sm:py-1.5">
          <Truck className="h-4 w-4" />
          <span className="hidden sm:inline">Información</span>
          <span className="sm:hidden text-xs">Info</span>
        </UrlTabsTrigger>
        <UrlTabsTrigger value="contract" className="flex items-center justify-center gap-2 py-2 sm:py-1.5">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Contrato</span>
          <span className="sm:hidden text-xs">Contrato</span>
        </UrlTabsTrigger>
        <UrlTabsTrigger value="assignment" className="flex items-center justify-center gap-2 py-2 sm:py-1.5">
          <DollarSign className="h-4 w-4" />
          <span className="hidden sm:inline">Asignación</span>
          <span className="sm:hidden text-xs">Asignación</span>
        </UrlTabsTrigger>
        <UrlTabsTrigger value="contractors" className="flex items-center justify-center gap-2 py-2 sm:py-1.5">
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Contratistas ({contractorCount})</span>
          <span className="sm:hidden text-xs">Contrat. ({contractorCount})</span>
        </UrlTabsTrigger>
        <UrlTabsTrigger value="documents" className="flex items-center justify-center gap-2 py-2 sm:py-1.5">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Documentos</span>
          <span className="sm:hidden text-xs">Docs</span>
        </UrlTabsTrigger>
        <UrlTabsTrigger value="depreciation" className="flex items-center justify-center gap-2 py-2 sm:py-1.5">
          <Calculator className="h-4 w-4" />
          <span className="hidden sm:inline">Depreciación</span>
          <span className="sm:hidden text-xs">Deprec.</span>
        </UrlTabsTrigger>
        {isActive && (
          <UrlTabsTrigger value="qr" className="flex items-center justify-center gap-2 py-2 sm:py-1.5">
            <QrCode className="h-4 w-4" />
            <span className="hidden sm:inline">QR</span>
            <span className="sm:hidden text-xs">QR</span>
          </UrlTabsTrigger>
        )}
      </UrlTabsList>

      {children}
    </UrlTabs>
  );
}
