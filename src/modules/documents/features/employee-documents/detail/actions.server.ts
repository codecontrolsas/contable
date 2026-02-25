'use server';

import {
  checkDocumentTypeAppliesToEmployee,
  type DocumentTypeConditions,
  type EmployeeForConditionCheck,
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
 * Obtiene los datos del empleado necesarios para verificar condiciones de documentos
 */
async function getEmployeeForConditions(
  employeeId: string,
  companyId: string
): Promise<EmployeeForConditionCheck | null> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: {
      id: true,
      jobPositionId: true,
      contractTypeId: true,
      jobCategoryId: true,
      gender: true,
      costType: true,
      jobCategory: {
        select: {
          id: true,
          agreementId: true,
          agreement: {
            select: {
              id: true,
              unionId: true,
            },
          },
        },
      },
    },
  });

  if (!employee) return null;

  return {
    jobPositionId: employee.jobPositionId,
    contractTypeId: employee.contractTypeId,
    jobCategoryId: employee.jobCategoryId,
    gender: employee.gender,
    costType: employee.costType,
    unionId: employee.jobCategory?.agreement?.unionId ?? null,
    collectiveAgreementId: employee.jobCategory?.agreementId ?? null,
  };
}

/**
 * Mapea las relaciones de condiciones de un DocumentType a DocumentTypeConditions
 */
function mapDocumentTypeConditions(
  docType: {
    isConditional: boolean;
    genders: string[];
    costTypes: string[];
    conditionJobPositions?: { jobPositionId: string }[];
    conditionContractTypes?: { contractTypeId: string }[];
    conditionJobCategories?: { jobCategoryId: string }[];
    conditionUnions?: { unionId: string }[];
    conditionCollectiveAgreements?: { collectiveAgreementId: string }[];
  }
): DocumentTypeConditions {
  return {
    isConditional: docType.isConditional,
    jobPositionIds: docType.conditionJobPositions?.map((c) => c.jobPositionId) ?? [],
    contractTypeIds: docType.conditionContractTypes?.map((c) => c.contractTypeId) ?? [],
    jobCategoryIds: docType.conditionJobCategories?.map((c) => c.jobCategoryId) ?? [],
    unionIds: docType.conditionUnions?.map((c) => c.unionId) ?? [],
    collectiveAgreementIds:
      docType.conditionCollectiveAgreements?.map((c) => c.collectiveAgreementId) ?? [],
    genders: docType.genders as DocumentTypeConditions['genders'],
    costTypes: docType.costTypes as DocumentTypeConditions['costTypes'],
    // Equipos no aplican aquí
    vehicleBrandIds: [],
    vehicleTypeIds: [],
  };
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene el detalle completo de un documento con su historial y datos del empleado
 * Incluye verificación de si el tipo de documento aún aplica al empleado
 */
export async function getDocumentDetailById(documentId: string, employeeId: string) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que el empleado pertenece a la empresa (datos para UI)
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        documentNumber: true,
        pictureUrl: true,
      },
    });

    if (!employee) {
      throw new Error('Empleado no encontrado');
    }

    // Obtener documento con historial Y condiciones del tipo de documento
    const document = await prisma.employeeDocument.findFirst({
      where: {
        id: documentId,
        employeeId,
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
            // Condiciones para verificar si aún aplica
            isConditional: true,
            genders: true,
            costTypes: true,
            conditionJobPositions: { select: { jobPositionId: true } },
            conditionContractTypes: { select: { contractTypeId: true } },
            conditionJobCategories: { select: { jobCategoryId: true } },
            conditionUnions: { select: { unionId: true } },
            conditionCollectiveAgreements: { select: { collectiveAgreementId: true } },
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

    // Verificar si el tipo de documento aún aplica al empleado
    let appliesCurrently = true;
    if (document.documentType.isConditional) {
      const employeeData = await getEmployeeForConditions(employeeId, companyId);
      if (employeeData) {
        const conditions = mapDocumentTypeConditions(document.documentType);
        appliesCurrently = checkDocumentTypeAppliesToEmployee(conditions, employeeData);
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
      employee,
      previewUrl,
      appliesCurrently,
    };
  } catch (error) {
    logger.error('Error getting document detail', {
      data: { error, documentId, employeeId },
    });
    throw error;
  }
}

/**
 * Obtiene la URL de descarga de un documento
 */
export async function getDocumentDownloadUrl(
  documentId: string,
  employeeId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    return { success: false, error: 'No hay empresa activa' };
  }

  try {
    const document = await prisma.employeeDocument.findFirst({
      where: {
        id: documentId,
        employeeId,
        employee: { companyId },
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

    const url = await getPresignedDownloadUrl(document.documentKey, { expiresIn: 3600 });

    return { success: true, url };
  } catch (error) {
    logger.error('Error getting document download URL', {
      data: { error, documentId, employeeId },
    });
    return { success: false, error: 'Error al obtener URL de descarga' };
  }
}

/**
 * Obtiene la URL de descarga de una versión específica del historial
 */
export async function getHistoryVersionDownloadUrl(
  historyId: string,
  documentId: string,
  employeeId: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) {
    return { success: false, error: 'No hay empresa activa' };
  }

  try {
    // Verificar que el historial pertenece al documento y empleado correcto
    const historyEntry = await prisma.employeeDocumentHistory.findFirst({
      where: {
        id: historyId,
        documentId,
        document: {
          employeeId,
          employee: { companyId },
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
    logger.error('Error getting history version download URL', {
      data: { error, historyId, documentId, employeeId },
    });
    return { success: false, error: 'Error al obtener URL de descarga' };
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type DocumentDetailData = Awaited<ReturnType<typeof getDocumentDetailById>>;
