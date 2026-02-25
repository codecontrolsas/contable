'use server';

import type { DocumentState } from '@/generated/prisma/enums';
import { getActiveCompanyId } from '@/shared/lib/company';
import {
  checkDocumentTypeAppliesToEquipment,
  type DocumentTypeConditions,
  type EquipmentForConditionCheck,
} from '@/shared/lib/documentConditions';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';
import { getPresignedDownloadUrl } from '@/shared/lib/storage';

// ============================================
// TIPOS
// ============================================

export interface EquipmentDocumentsFilters {
  state?: DocumentState;
  documentTypeId?: string;
}

export interface EquipmentDocumentsSummary {
  total: number;
  pending: number;
  approved: number;
  expired: number;
  mandatory: number;
  mandatoryCompleted: number;
}

// ============================================
// HELPERS PARA CONDICIONES
// ============================================

/**
 * Obtiene los datos del vehículo necesarios para verificar condiciones de documentos
 */
async function getVehicleForConditions(
  vehicleId: string,
  companyId: string
): Promise<EquipmentForConditionCheck | null> {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, companyId },
    select: {
      id: true,
      brandId: true,
      typeId: true,
    },
  });

  if (!vehicle) return null;

  return {
    vehicleBrandId: vehicle.brandId,
    vehicleTypeId: vehicle.typeId,
  };
}

/**
 * Mapea las relaciones de condiciones de un DocumentType a DocumentTypeConditions
 */
function mapDocumentTypeConditions(docType: {
  isConditional: boolean;
  genders: string[];
  costTypes: string[];
  conditionVehicleBrands?: { vehicleBrandId: string }[];
  conditionVehicleTypes?: { vehicleTypeId: string }[];
}): DocumentTypeConditions {
  return {
    isConditional: docType.isConditional,
    // Condiciones de empleado (no aplican aquí)
    jobPositionIds: [],
    contractTypeIds: [],
    jobCategoryIds: [],
    unionIds: [],
    collectiveAgreementIds: [],
    genders: docType.genders as DocumentTypeConditions['genders'],
    costTypes: docType.costTypes as DocumentTypeConditions['costTypes'],
    // Condiciones de equipo
    vehicleBrandIds: docType.conditionVehicleBrands?.map((c) => c.vehicleBrandId) ?? [],
    vehicleTypeIds: docType.conditionVehicleTypes?.map((c) => c.vehicleTypeId) ?? [],
  };
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene todos los documentos de un vehículo/equipo
 */
export async function getDocumentsByEquipment(
  vehicleId: string,
  filters?: EquipmentDocumentsFilters
) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que el vehículo pertenece a la empresa
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, companyId },
      select: { id: true },
    });

    if (!vehicle) {
      throw new Error('Vehículo no encontrado');
    }

    return await prisma.equipmentDocument.findMany({
      where: {
        vehicleId,
        ...(filters?.state && { state: filters.state }),
        ...(filters?.documentTypeId && { documentTypeId: filters.documentTypeId }),
      },
      include: {
        documentType: {
          select: {
            id: true,
            name: true,
            slug: true,
            isMandatory: true,
            hasExpiration: true,
            isMonthly: true,
          },
        },
      },
      orderBy: [
        { documentType: { name: 'asc' } },
        { period: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  } catch (error) {
    logger.error('Error getting equipment documents', {
      data: { error, vehicleId },
    });
    throw error;
  }
}

/**
 * Obtiene un resumen del estado de documentos de un vehículo
 * - Calcula obligatorios solo sobre tipos que aplican al vehículo
 */
export async function getEquipmentDocumentsSummary(
  vehicleId: string
): Promise<EquipmentDocumentsSummary> {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Obtener datos del vehículo para verificar condiciones
    const vehicleData = await getVehicleForConditions(vehicleId, companyId);
    if (!vehicleData) {
      throw new Error('Vehículo no encontrado');
    }

    // Obtener todos los documentos del vehículo
    const documents = await prisma.equipmentDocument.findMany({
      where: { vehicleId },
      select: {
        state: true,
        documentType: {
          select: { isMandatory: true },
        },
      },
    });

    // Obtener tipos de documento obligatorios para equipos CON condiciones
    const mandatoryTypes = await prisma.documentType.findMany({
      where: {
        companyId,
        appliesTo: 'EQUIPMENT',
        isMandatory: true,
        isActive: true,
      },
      select: {
        id: true,
        isConditional: true,
        genders: true,
        costTypes: true,
        conditionVehicleBrands: { select: { vehicleBrandId: true } },
        conditionVehicleTypes: { select: { vehicleTypeId: true } },
      },
    });

    // Filtrar por condiciones: solo contar obligatorios que aplican al vehículo
    const applicableMandatoryTypes = mandatoryTypes.filter((type) => {
      const conditions = mapDocumentTypeConditions(type);
      return checkDocumentTypeAppliesToEquipment(conditions, vehicleData);
    });

    const applicableMandatoryTypeIds = new Set(applicableMandatoryTypes.map((t) => t.id));

    // Contar documentos obligatorios aprobados (únicos por tipo) que aplican al vehículo
    const mandatoryApproved = await prisma.equipmentDocument.findMany({
      where: {
        vehicleId,
        state: 'APPROVED',
        documentType: { isMandatory: true },
      },
      select: { documentTypeId: true },
      distinct: ['documentTypeId'],
    });

    // Solo contar los que aplican al vehículo
    const mandatoryCompletedCount = mandatoryApproved.filter((d) =>
      applicableMandatoryTypeIds.has(d.documentTypeId)
    ).length;

    return {
      total: documents.length,
      pending: documents.filter((d) => d.state === 'PENDING').length,
      approved: documents.filter((d) => d.state === 'APPROVED').length,
      expired: documents.filter((d) => d.state === 'EXPIRED').length,
      mandatory: applicableMandatoryTypes.length,
      mandatoryCompleted: mandatoryCompletedCount,
    };
  } catch (error) {
    logger.error('Error getting equipment documents summary', {
      data: { error, vehicleId },
    });
    throw error;
  }
}

/**
 * Obtiene los tipos de documento pendientes de un vehículo
 * - Filtra por condiciones (solo tipos que aplican al vehículo)
 * - Solo muestra obligatorios que no tienen documento aprobado
 */
export async function getPendingEquipmentDocumentTypes(vehicleId: string) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    // Obtener datos del vehículo para verificar condiciones
    const vehicleData = await getVehicleForConditions(vehicleId, companyId);
    if (!vehicleData) {
      return [];
    }

    // Obtener tipos obligatorios para equipos CON sus condiciones
    const mandatoryTypes = await prisma.documentType.findMany({
      where: {
        companyId,
        appliesTo: 'EQUIPMENT',
        isMandatory: true,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        hasExpiration: true,
        isMonthly: true,
        isConditional: true,
        genders: true,
        costTypes: true,
        conditionVehicleBrands: { select: { vehicleBrandId: true } },
        conditionVehicleTypes: { select: { vehicleTypeId: true } },
      },
    });

    // Filtrar por condiciones: solo tipos obligatorios que aplican al vehículo
    const applicableTypes = mandatoryTypes.filter((type) => {
      const conditions = mapDocumentTypeConditions(type);
      return checkDocumentTypeAppliesToEquipment(conditions, vehicleData);
    });

    // Obtener tipos que ya tienen documento aprobado
    const approvedDocs = await prisma.equipmentDocument.findMany({
      where: {
        vehicleId,
        state: 'APPROVED',
      },
      select: { documentTypeId: true },
      distinct: ['documentTypeId'],
    });

    const approvedTypeIds = new Set(approvedDocs.map((d) => d.documentTypeId));

    // Filtrar los que no tienen documento aprobado
    return applicableTypes
      .filter((type) => !approvedTypeIds.has(type.id))
      .map((type) => ({
        id: type.id,
        name: type.name,
        slug: type.slug,
        hasExpiration: type.hasExpiration,
        isMonthly: type.isMonthly,
        isConditional: type.isConditional,
      }));
  } catch (error) {
    logger.error('Error getting pending equipment document types', {
      data: { error, vehicleId },
    });
    return [];
  }
}

/**
 * Obtiene la URL de descarga de un documento de equipo
 * Genera una presigned URL válida por 1 hora
 */
export async function getEquipmentDocumentDownloadUrl(
  documentId: string,
  vehicleId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    return { success: false, error: 'No hay empresa activa' };
  }

  try {
    // Verificar que el documento existe y pertenece al vehículo de la empresa
    const document = await prisma.equipmentDocument.findFirst({
      where: {
        id: documentId,
        vehicleId,
        vehicle: { companyId },
      },
      select: {
        id: true,
        documentKey: true,
        fileName: true,
      },
    });

    if (!document) {
      return { success: false, error: 'Documento no encontrado' };
    }

    if (!document.documentKey) {
      return { success: false, error: 'El documento no tiene archivo asociado' };
    }

    // Generar presigned URL (1 hora)
    const url = await getPresignedDownloadUrl(document.documentKey, { expiresIn: 3600 });

    return { success: true, url };
  } catch (error) {
    logger.error('Error getting equipment document download URL', {
      data: { error, documentId, vehicleId },
    });
    return { success: false, error: 'Error al obtener URL de descarga' };
  }
}

/**
 * Obtiene los tipos de documento disponibles para subir a un vehículo
 * - Filtra por condiciones (solo muestra tipos que aplican al vehículo)
 * - Excluye tipos que ya tienen documento aprobado (excepto mensuales)
 */
export async function getAvailableEquipmentDocumentTypesForUpload(vehicleId: string) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    // Obtener datos del vehículo para verificar condiciones
    const vehicleData = await getVehicleForConditions(vehicleId, companyId);
    if (!vehicleData) {
      logger.warn('Vehicle not found for condition check', { data: { vehicleId } });
      return [];
    }

    // Obtener todos los tipos de documento para equipos CON sus condiciones
    // Excluir tipos multirrecurso (se suben desde Overview > Generales)
    const allTypes = await prisma.documentType.findMany({
      where: {
        companyId,
        appliesTo: 'EQUIPMENT',
        isActive: true,
        isMultiResource: false,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        hasExpiration: true,
        isMonthly: true,
        isMandatory: true,
        isConditional: true,
        genders: true,
        costTypes: true,
        conditionVehicleBrands: { select: { vehicleBrandId: true } },
        conditionVehicleTypes: { select: { vehicleTypeId: true } },
      },
      orderBy: [{ isMandatory: 'desc' }, { name: 'asc' }],
    });

    // Filtrar por condiciones: solo tipos que aplican al vehículo
    const applicableTypes = allTypes.filter((type) => {
      const conditions = mapDocumentTypeConditions(type);
      return checkDocumentTypeAppliesToEquipment(conditions, vehicleData);
    });

    // Obtener documentos ya subidos (APPROVED) del vehículo
    const uploadedDocs = await prisma.equipmentDocument.findMany({
      where: {
        vehicleId,
        state: 'APPROVED',
      },
      select: {
        documentTypeId: true,
        documentType: {
          select: { isMonthly: true },
        },
      },
    });

    // Crear set de tipos ya subidos (solo los NO mensuales)
    const uploadedNonMonthlyTypeIds = new Set(
      uploadedDocs.filter((d) => !d.documentType.isMonthly).map((d) => d.documentTypeId)
    );

    // Filtrar: incluir todos los mensuales + los no mensuales que no estén subidos
    return applicableTypes
      .filter((type) => {
        if (type.isMonthly) return true; // Mensuales siempre disponibles
        return !uploadedNonMonthlyTypeIds.has(type.id);
      })
      .map((type) => ({
        id: type.id,
        name: type.name,
        slug: type.slug,
        hasExpiration: type.hasExpiration,
        isMonthly: type.isMonthly,
        isMandatory: type.isMandatory,
        isConditional: type.isConditional,
      }));
  } catch (error) {
    logger.error('Error getting available equipment document types for upload', {
      data: { error, vehicleId },
    });
    return [];
  }
}

/**
 * Obtiene documentos multirrecurso que cubren a todos los equipos
 * Estos son documentos con vehicleId = NULL y documentType.isMultiResource = true
 */
export async function getMultiResourceDocumentsForEquipment() {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    return await prisma.equipmentDocument.findMany({
      where: {
        vehicle: null,
        documentType: {
          companyId,
          appliesTo: 'EQUIPMENT',
          isMultiResource: true,
          isActive: true,
        },
      },
      include: {
        documentType: {
          select: {
            id: true,
            name: true,
            slug: true,
            isMandatory: true,
            hasExpiration: true,
            isMonthly: true,
            isMultiResource: true,
          },
        },
      },
      orderBy: [{ documentType: { name: 'asc' } }, { createdAt: 'desc' }],
    });
  } catch (error) {
    logger.error('Error getting multi-resource documents for equipment', {
      data: { error },
    });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type EquipmentDocumentListItem = Awaited<
  ReturnType<typeof getDocumentsByEquipment>
>[number];

export type MultiResourceEquipmentDocumentItem = Awaited<
  ReturnType<typeof getMultiResourceDocumentsForEquipment>
>[number];

export type PendingEquipmentDocumentType = Awaited<
  ReturnType<typeof getPendingEquipmentDocumentTypes>
>[number];

export type AvailableEquipmentDocumentType = Awaited<
  ReturnType<typeof getAvailableEquipmentDocumentTypesForUpload>
>[number];
