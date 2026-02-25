'use server';

import {
  checkDocumentTypeAppliesToEquipment,
  type DocumentTypeConditions,
  type EquipmentForConditionCheck,
} from '@/shared/lib/documentConditions';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';
import { getPresignedDownloadUrl } from '@/shared/lib/storage';

// ============================================
// HELPERS PARA CONDICIONES
// ============================================

/**
 * Obtiene los datos del equipo necesarios para verificar condiciones de documentos
 */
async function getEquipmentForConditions(
  equipmentId: string,
  companyId: string
): Promise<EquipmentForConditionCheck | null> {
  const equipment = await prisma.vehicle.findFirst({
    where: { id: equipmentId, companyId },
    select: {
      id: true,
      brandId: true,
      typeId: true,
    },
  });

  if (!equipment) return null;

  return {
    vehicleBrandId: equipment.brandId,
    vehicleTypeId: equipment.typeId,
  };
}

/**
 * Mapea las relaciones de condiciones de un DocumentType para equipos
 */
function mapDocumentTypeConditions(docType: {
  isConditional: boolean;
  conditionVehicleBrands?: { vehicleBrandId: string }[];
  conditionVehicleTypes?: { vehicleTypeId: string }[];
}): DocumentTypeConditions {
  return {
    isConditional: docType.isConditional,
    vehicleBrandIds: docType.conditionVehicleBrands?.map((c) => c.vehicleBrandId) ?? [],
    vehicleTypeIds: docType.conditionVehicleTypes?.map((c) => c.vehicleTypeId) ?? [],
    // Empleados no aplican aquí
    jobPositionIds: [],
    contractTypeIds: [],
    jobCategoryIds: [],
    unionIds: [],
    collectiveAgreementIds: [],
    genders: [],
    costTypes: [],
  };
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene el detalle completo de un documento de equipo con su historial
 */
export async function getEquipmentDocumentDetailById(documentId: string, equipmentId: string) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que el equipo pertenece a la empresa (datos para UI)
    const equipment = await prisma.vehicle.findFirst({
      where: { id: equipmentId, companyId },
      select: {
        id: true,
        internNumber: true,
        domain: true,
        pictureUrl: true,
        brand: { select: { name: true } },
        model: { select: { name: true } },
        type: { select: { name: true } },
      },
    });

    if (!equipment) {
      throw new Error('Equipo no encontrado');
    }

    // Obtener documento con historial Y condiciones del tipo de documento
    const document = await prisma.equipmentDocument.findFirst({
      where: {
        id: documentId,
        vehicleId: equipmentId,
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
            isConditional: true,
            conditionVehicleBrands: { select: { vehicleBrandId: true } },
            conditionVehicleTypes: { select: { vehicleTypeId: true } },
          },
        },
        history: {
          orderBy: { changedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!document) {
      throw new Error('Documento no encontrado');
    }

    // Verificar si el tipo de documento aún aplica al equipo
    let appliesCurrently = true;
    if (document.documentType.isConditional) {
      const equipmentData = await getEquipmentForConditions(equipmentId, companyId);
      if (equipmentData) {
        const conditions = mapDocumentTypeConditions(document.documentType);
        appliesCurrently = checkDocumentTypeAppliesToEquipment(conditions, equipmentData);
      }
    }

    // Generar URL de preview si hay documento
    let previewUrl: string | null = null;
    if (document.documentKey) {
      try {
        previewUrl = await getPresignedDownloadUrl(document.documentKey, { expiresIn: 3600 });
      } catch {
        logger.warn('Could not generate preview URL', { data: { key: document.documentKey } });
      }
    }

    return {
      document,
      equipment,
      previewUrl,
      appliesCurrently,
    };
  } catch (error) {
    logger.error('Error getting equipment document detail', {
      data: { error, documentId, equipmentId },
    });
    throw error;
  }
}

/**
 * Obtiene la URL de descarga de una versión específica del historial
 */
export async function getEquipmentHistoryVersionDownloadUrl(
  historyId: string,
  documentId: string,
  equipmentId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    return { success: false, error: 'No hay empresa activa' };
  }

  try {
    const historyEntry = await prisma.equipmentDocumentHistory.findFirst({
      where: {
        id: historyId,
        documentId,
        document: {
          vehicleId: equipmentId,
          vehicle: { companyId },
        },
      },
      select: {
        id: true,
        documentKey: true,
        fileName: true,
      },
    });

    if (!historyEntry) {
      return { success: false, error: 'Versión no encontrada' };
    }

    if (!historyEntry.documentKey) {
      return { success: false, error: 'Esta versión no tiene archivo asociado' };
    }

    const url = await getPresignedDownloadUrl(historyEntry.documentKey, { expiresIn: 3600 });

    return { success: true, url };
  } catch (error) {
    logger.error('Error getting equipment history version download URL', {
      data: { error, historyId, documentId, equipmentId },
    });
    return { success: false, error: 'Error al obtener URL de descarga' };
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type EquipmentDocumentDetailData = Awaited<ReturnType<typeof getEquipmentDocumentDetailById>>;
