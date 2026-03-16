'use client';

import { Building2, DollarSign, Package, Truck, Users } from 'lucide-react';

import { UrlTabs, UrlTabsList, UrlTabsTrigger } from '@/shared/components/ui/url-tabs';

export type ClientDetailTab = 'general' | 'vehicles' | 'employees' | 'deliveries' | 'account';

interface Props {
  clientId: string;
  currentTab: ClientDetailTab;
  children: React.ReactNode;
}

export function _ClientDetailTabs({ clientId, currentTab, children }: Props) {
  return (
    <UrlTabs
      value={currentTab}
      paramName="tab"
      baseUrl={`/dashboard/company/commercial/clients/${clientId}`}
      className="w-full"
    >
      <UrlTabsList className="grid w-full grid-cols-5 h-auto sm:h-10">
        <UrlTabsTrigger
          value="general"
          className="flex items-center justify-center gap-2 py-2 sm:py-1.5"
        >
          <Building2 className="h-4 w-4" />
          <span className="hidden sm:inline">Información General</span>
          <span className="sm:hidden text-xs">General</span>
        </UrlTabsTrigger>
        <UrlTabsTrigger
          value="vehicles"
          className="flex items-center justify-center gap-2 py-2 sm:py-1.5"
        >
          <Truck className="h-4 w-4" />
          <span className="hidden sm:inline">Vehículos</span>
          <span className="sm:hidden text-xs">Vehículos</span>
        </UrlTabsTrigger>
        <UrlTabsTrigger
          value="employees"
          className="flex items-center justify-center gap-2 py-2 sm:py-1.5"
        >
          <Users className="h-4 w-4" />
          <span className="hidden sm:inline">Empleados</span>
          <span className="sm:hidden text-xs">Empleados</span>
        </UrlTabsTrigger>
        <UrlTabsTrigger
          value="deliveries"
          className="flex items-center justify-center gap-2 py-2 sm:py-1.5"
        >
          <Package className="h-4 w-4" />
          <span className="hidden sm:inline">Remitos</span>
          <span className="sm:hidden text-xs">Remitos</span>
        </UrlTabsTrigger>
        <UrlTabsTrigger
          value="account"
          className="flex items-center justify-center gap-2 py-2 sm:py-1.5"
        >
          <DollarSign className="h-4 w-4" />
          <span className="hidden sm:inline">Cuenta Corriente</span>
          <span className="sm:hidden text-xs">Cuenta</span>
        </UrlTabsTrigger>
      </UrlTabsList>

      {children}
    </UrlTabs>
  );
}
