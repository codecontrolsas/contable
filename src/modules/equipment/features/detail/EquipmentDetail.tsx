import moment from 'moment';
import { notFound } from 'next/navigation';

import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { UrlTabsContent } from '@/shared/components/ui/url-tabs';
import { Users } from 'lucide-react';

import {
  costTypeLabels,
  currencySymbols,
  getLabel,
  vehicleTitularityTypeLabels,
} from '@/shared/utils/mappers';
import { getVehicleById, getVehicleDocumentStatusInfo } from './actions.server';
import { _EquipmentHeader } from './components/_EquipmentHeader';
import { _EquipmentDetailTabs, type EquipmentDetailTab } from './components/_EquipmentDetailTabs';
import { _EquipmentQR } from './components/_EquipmentQR';
import { EquipmentDocumentsList } from '@/modules/documents/features/equipment-documents/list';
import { _DepreciationTab } from '@/modules/equipment/features/depreciation/components/_DepreciationTab';

interface Props {
  id: string;
  tab?: EquipmentDetailTab;
}

function InfoField({
  label,
  value,
  fallback = 'No especificado',
}: {
  label: string;
  value: string | null | undefined;
  fallback?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || fallback}</p>
    </div>
  );
}

export async function EquipmentDetail({ id, tab = 'info' }: Props) {
  let vehicle;
  let statusInfo;

  try {
    [vehicle, statusInfo] = await Promise.all([
      getVehicleById(id),
      getVehicleDocumentStatusInfo(id),
    ]);
  } catch {
    notFound();
  }

  return (
    <PermissionGuard module="equipment" action="view" redirect>
      <div className="space-y-6">
        {/* Header with status tooltip */}
        <_EquipmentHeader vehicle={vehicle} statusInfo={statusInfo} />

      {/* Tabs */}
      <_EquipmentDetailTabs
        vehicleId={id}
        currentTab={tab}
        contractorCount={vehicle.contractorAllocations.length}
        isActive={vehicle.isActive}
      >
        {/* Tab: Información */}
        <UrlTabsContent value="info" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Clasificación</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InfoField label="Clasificación" value={vehicle.typeOfVehicle?.name} />
              <InfoField label="Tipo de Equipo" value={vehicle.type?.name} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identificación</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InfoField label="N° Interno" value={vehicle.internNumber} />
              <InfoField label="Dominio/Patente" value={vehicle.domain} />
              <InfoField label="Chasis" value={vehicle.chassis} />
              <InfoField label="Motor" value={vehicle.engine} />
              <InfoField label="Serie" value={vehicle.serie} />
              <InfoField label="Año" value={vehicle.year} />
              <InfoField
                label="Kilometraje"
                value={vehicle.kilometer ? `${vehicle.kilometer} km` : null}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Marca y Modelo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <InfoField label="Marca" value={vehicle.brand?.name} />
              <InfoField label="Modelo" value={vehicle.model?.name} />
            </CardContent>
          </Card>

          {!vehicle.isActive && vehicle.terminationDate && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Información de Baja</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoField
                  label="Fecha de Baja"
                  value={moment(vehicle.terminationDate).format('DD/MM/YYYY')}
                />
                <InfoField
                  label="Motivo"
                  value={
                    vehicle.terminationReason
                      ? getLabel(vehicle.terminationReason, {
                          SALE: 'Venta',
                          TOTAL_LOSS: 'Destrucción Total',
                          RETURN: 'Devolución',
                          OTHER: 'Otro',
                        })
                      : null
                  }
                />
              </CardContent>
            </Card>
          )}
        </UrlTabsContent>

        {/* Tab: Contrato */}
        <UrlTabsContent value="contract" className="space-y-4 mt-4">
          {/* Titularidad */}
          <Card>
            <CardHeader>
              <CardTitle>Titularidad</CardTitle>
              <CardDescription>Tipo de propiedad del equipo</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InfoField
                label="Tipo de Titularidad"
                value={
                  vehicle.titularityType
                    ? getLabel(vehicle.titularityType, vehicleTitularityTypeLabels)
                    : null
                }
              />
              {vehicle.owner && (
                <>
                  <InfoField label="Titular" value={vehicle.owner.name} />
                  <InfoField label="CUIT Titular" value={vehicle.owner.cuit} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Datos de contrato (solo si no es OWNED) */}
          {vehicle.titularityType && vehicle.titularityType !== 'OWNED' && (
            <Card>
              <CardHeader>
                <CardTitle>Datos del Contrato</CardTitle>
                <CardDescription>Información del contrato de {getLabel(vehicle.titularityType, vehicleTitularityTypeLabels).toLowerCase()}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <InfoField label="N° de Contrato" value={vehicle.contractNumber} />
                <InfoField
                  label="Fecha Inicio"
                  value={
                    vehicle.contractStartDate
                      ? moment(vehicle.contractStartDate).format('DD/MM/YYYY')
                      : null
                  }
                />
                <InfoField
                  label="Fecha Vencimiento"
                  value={
                    vehicle.contractExpirationDate
                      ? moment(vehicle.contractExpirationDate).format('DD/MM/YYYY')
                      : null
                  }
                />
                <InfoField
                  label="Moneda"
                  value={vehicle.currency ? getLabel(vehicle.currency, currencySymbols) : null}
                />
                <InfoField
                  label="Valor Mensual"
                  value={
                    vehicle.monthlyPrice
                      ? `${vehicle.currency ? currencySymbols[vehicle.currency] : '$'} ${Number(vehicle.monthlyPrice).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                      : null
                  }
                />
              </CardContent>
            </Card>
          )}

          {/* Valor del equipo (siempre visible) */}
          <Card>
            <CardHeader>
              <CardTitle>Valor del Equipo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <InfoField
                label="Moneda"
                value={vehicle.currency ? getLabel(vehicle.currency, currencySymbols) : null}
              />
              <InfoField
                label="Valor"
                value={
                  vehicle.price
                    ? `${vehicle.currency ? currencySymbols[vehicle.currency] : '$'} ${Number(vehicle.price).toLocaleString('es-AR', { minimumFractionDigits: 2 })}`
                    : null
                }
              />
            </CardContent>
          </Card>
        </UrlTabsContent>

        {/* Tab: Asignación */}
        <UrlTabsContent value="assignment" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Centro de Costo y Sector</CardTitle>
              <CardDescription>Asignación contable y operativa</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <InfoField label="Centro de Costo" value={vehicle.costCenter?.name} />
              <InfoField
                label="Tipo de Costo"
                value={vehicle.costType ? getLabel(vehicle.costType, costTypeLabels) : null}
              />
              <InfoField label="Sector" value={vehicle.sector?.name} />
              <InfoField label="Tipo Operativo" value={vehicle.typeOperative?.name} />
            </CardContent>
          </Card>
        </UrlTabsContent>

        {/* Tab: Contratistas */}
        <UrlTabsContent value="contractors" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Contratistas Asignados</CardTitle>
              <CardDescription>
                Este equipo está asignado a los siguientes contratistas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {vehicle.contractorAllocations.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {vehicle.contractorAllocations.map((allocation) => (
                    <div
                      key={allocation.id}
                      className="flex items-center gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{allocation.contractor.name}</p>
                        {allocation.contractor.taxId && (
                          <p className="text-sm text-muted-foreground">
                            CUIT: {allocation.contractor.taxId}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Este equipo no está asignado a ningún contratista
                </p>
              )}
            </CardContent>
          </Card>
        </UrlTabsContent>

        {/* Tab: Documentos */}
        <UrlTabsContent value="documents" className="mt-4">
          <EquipmentDocumentsList vehicleId={id} />
        </UrlTabsContent>

        {/* Tab: Depreciación */}
        <UrlTabsContent value="depreciation" className="mt-4">
          <_DepreciationTab
            vehicleId={id}
            vehiclePrice={vehicle.price ? Number(vehicle.price) : null}
          />
        </UrlTabsContent>

          {/* Tab: QR (solo si está activo) */}
          {vehicle.isActive && (
            <UrlTabsContent value="qr" className="mt-4">
              <_EquipmentQR
                vehicleId={id}
                internNumber={vehicle.internNumber}
                domain={vehicle.domain}
              />
            </UrlTabsContent>
          )}
        </_EquipmentDetailTabs>
      </div>
    </PermissionGuard>
  );
}
