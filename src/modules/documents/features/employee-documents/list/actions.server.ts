'use server';

import type { DocumentState } from '@/generated/prisma/enums';
import { getActiveCompanyId } from '@/shared/lib/company';
import {
  checkDocumentTypeAppliesToEmployee,
  type DocumentTypeConditions,
  type EmployeeForConditionCheck,
} from '@/shared/lib/documentConditions';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';
import { getPresignedDownloadUrl } from '@/shared/lib/storage';

// ============================================
// TIPOS
// ============================================

export interface EmployeeDocumentsFilters {
  state?: DocumentState;
  documentTypeId?: string;
}

export interface EmployeeDocumentsSummary {
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
      // Necesitamos jobCategory para obtener agreement y union
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
    // Derivar unionId y collectiveAgreementId desde jobCategory
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
 * Obtiene todos los documentos de un empleado
 */
export async function getDocumentsByEmployee(
  employeeId: string,
  filters?: EmployeeDocumentsFilters
) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que el empleado pertenece a la empresa
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true },
    });

    if (!employee) {
      throw new Error('Empleado no encontrado');
    }

    return await prisma.employeeDocument.findMany({
      where: {
        employeeId,
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
      orderBy: [{ createdAt: 'desc' }],
    });
  } catch (error) {
    logger.error('Error getting employee documents', {
      data: { error, employeeId },
    });
    throw error;
  }
}

/**
 * Obtiene un resumen del estado de documentos de un empleado
 * - Calcula obligatorios solo sobre tipos que aplican al empleado
 */
export async function getEmployeeDocumentsSummary(
  employeeId: string
): Promise<EmployeeDocumentsSummary> {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Obtener datos del empleado para verificar condiciones
    const employeeData = await getEmployeeForConditions(employeeId, companyId);
    if (!employeeData) {
      throw new Error('Empleado no encontrado');
    }

    // Obtener todos los documentos del empleado
    const documents = await prisma.employeeDocument.findMany({
      where: { employeeId },
      select: {
        state: true,
        documentType: {
          select: { isMandatory: true },
        },
      },
    });

    // Obtener tipos de documento obligatorios para empleados CON condiciones
    const mandatoryTypes = await prisma.documentType.findMany({
      where: {
        companyId,
        appliesTo: 'EMPLOYEE',
        isMandatory: true,
        isActive: true,
      },
      select: {
        id: true,
        isConditional: true,
        genders: true,
        costTypes: true,
        conditionJobPositions: { select: { jobPositionId: true } },
        conditionContractTypes: { select: { contractTypeId: true } },
        conditionJobCategories: { select: { jobCategoryId: true } },
        conditionUnions: { select: { unionId: true } },
        conditionCollectiveAgreements: { select: { collectiveAgreementId: true } },
      },
    });

    // Filtrar por condiciones: solo contar obligatorios que aplican al empleado
    const applicableMandatoryTypes = mandatoryTypes.filter((type) => {
      const conditions = mapDocumentTypeConditions(type);
      return checkDocumentTypeAppliesToEmployee(conditions, employeeData);
    });

    const applicableMandatoryTypeIds = new Set(applicableMandatoryTypes.map((t) => t.id));

    // Contar documentos obligatorios aprobados (únicos por tipo) que aplican al empleado
    const mandatoryApproved = await prisma.employeeDocument.findMany({
      where: {
        employeeId,
        state: 'APPROVED',
        documentType: { isMandatory: true },
      },
      select: { documentTypeId: true },
      distinct: ['documentTypeId'],
    });

    // Solo contar los que aplican al empleado
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
    logger.error('Error getting employee documents summary', {
      data: { error, employeeId },
    });
    throw error;
  }
}

/**
 * Obtiene los tipos de documento pendientes de un empleado
 * - Filtra por condiciones (solo tipos que aplican al empleado)
 * - Solo muestra obligatorios que no tienen documento aprobado
 */
export async function getPendingDocumentTypes(employeeId: string) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    // Obtener datos del empleado para verificar condiciones
    const employeeData = await getEmployeeForConditions(employeeId, companyId);
    if (!employeeData) {
      return [];
    }

    // Obtener tipos obligatorios para empleados CON sus condiciones
    const mandatoryTypes = await prisma.documentType.findMany({
      where: {
        companyId,
        appliesTo: 'EMPLOYEE',
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
        conditionJobPositions: { select: { jobPositionId: true } },
        conditionContractTypes: { select: { contractTypeId: true } },
        conditionJobCategories: { select: { jobCategoryId: true } },
        conditionUnions: { select: { unionId: true } },
        conditionCollectiveAgreements: { select: { collectiveAgreementId: true } },
      },
    });

    // Filtrar por condiciones: solo tipos obligatorios que aplican al empleado
    const applicableTypes = mandatoryTypes.filter((type) => {
      const conditions = mapDocumentTypeConditions(type);
      return checkDocumentTypeAppliesToEmployee(conditions, employeeData);
    });

    // Obtener tipos que ya tienen documento aprobado
    const approvedDocs = await prisma.employeeDocument.findMany({
      where: {
        employeeId,
        state: 'APPROVED',
      },
      select: { documentTypeId: true },
      distinct: ['documentTypeId'],
    });

    const approvedTypeIds = new Set(approvedDocs.map((d) => d.documentTypeId));

    // Filtrar los que no tienen documento aprobado y mapear a estructura de retorno
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
    logger.error('Error getting pending document types', {
      data: { error, employeeId },
    });
    return [];
  }
}

/**
 * Obtiene la URL de descarga de un documento
 * Genera una presigned URL válida por 1 hora
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
    // Verificar que el documento existe y pertenece al empleado de la empresa
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

    // Generar presigned URL (1 hora)
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
 * Obtiene los tipos de documento disponibles para subir
 * - Filtra por condiciones (solo muestra tipos que aplican al empleado)
 * - Excluye tipos que ya tienen documento aprobado (excepto mensuales)
 */
export async function getAvailableDocumentTypesForUpload(employeeId: string) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    // Obtener datos del empleado para verificar condiciones
    const employeeData = await getEmployeeForConditions(employeeId, companyId);
    if (!employeeData) {
      logger.warn('Employee not found for condition check', { data: { employeeId } });
      return [];
    }

    // Obtener todos los tipos de documento para empleados CON sus condiciones
    // Excluir tipos multirrecurso (se suben desde Overview > Generales)
    const allTypes = await prisma.documentType.findMany({
      where: {
        companyId,
        appliesTo: 'EMPLOYEE',
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
        conditionJobPositions: { select: { jobPositionId: true } },
        conditionContractTypes: { select: { contractTypeId: true } },
        conditionJobCategories: { select: { jobCategoryId: true } },
        conditionUnions: { select: { unionId: true } },
        conditionCollectiveAgreements: { select: { collectiveAgreementId: true } },
      },
      orderBy: [{ isMandatory: 'desc' }, { name: 'asc' }],
    });

    // Filtrar por condiciones: solo tipos que aplican al empleado
    const applicableTypes = allTypes.filter((type) => {
      const conditions = mapDocumentTypeConditions(type);
      return checkDocumentTypeAppliesToEmployee(conditions, employeeData);
    });

    // Obtener documentos ya subidos (APPROVED) del empleado
    const uploadedDocs = await prisma.employeeDocument.findMany({
      where: {
        employeeId,
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
    // Y mapear a la estructura de retorno (sin las condiciones)
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
    logger.error('Error getting available document types for upload', {
      data: { error, employeeId },
    });
    return [];
  }
}

/**
 * Obtiene el detalle de un documento con su historial
 */
export async function getDocumentDetail(documentId: string, employeeId: string) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que el empleado pertenece a la empresa
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeNumber: true,
        pictureUrl: true,
      },
    });

    if (!employee) {
      throw new Error('Empleado no encontrado');
    }

    // Obtener documento con historial
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
          },
        },
        history: {
          orderBy: { changedAt: 'desc' },
          take: 50, // Limitar historial a últimos 50 eventos
        },
      },
    });

    if (!document) {
      throw new Error('Documento no encontrado');
    }

    return {
      document,
      employee,
    };
  } catch (error) {
    logger.error('Error getting document detail', {
      data: { error, documentId, employeeId },
    });
    throw error;
  }
}

/**
 * Obtiene documentos multirrecurso que cubren a todos los empleados
 * Estos son documentos con employeeId = NULL y documentType.isMultiResource = true
 */
export async function getMultiResourceDocumentsForEmployee() {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    return await prisma.employeeDocument.findMany({
      where: {
        employee: null,
        documentType: {
          companyId,
          appliesTo: 'EMPLOYEE',
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
    logger.error('Error getting multi-resource documents for employee', {
      data: { error },
    });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type EmployeeDocumentListItem = Awaited<ReturnType<typeof getDocumentsByEmployee>>[number];

export type MultiResourceDocumentItem = Awaited<ReturnType<typeof getMultiResourceDocumentsForEmployee>>[number];

export type PendingDocumentType = Awaited<ReturnType<typeof getPendingDocumentTypes>>[number];

export type AvailableDocumentType = Awaited<ReturnType<typeof getAvailableDocumentTypesForUpload>>[number];

export type DocumentDetail = Awaited<ReturnType<typeof getDocumentDetail>>;
