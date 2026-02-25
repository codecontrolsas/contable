'use server';

import type { DocumentAppliesTo, Gender, CostType } from '@/generated/prisma/enums';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import {
  buildFiltersWhere,
  buildSearchWhere,
  parseSearchParams,
  stateToPrismaParams,
} from '@/shared/components/common/DataTable/helpers';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';
import { slugify } from '@/shared/utils/slugify';
import { revalidatePath } from 'next/cache';
import {
  searchJobPositionsForSelect,
  searchContractTypesForSelect,
  searchJobCategoriesForSelect,
  searchUnionsForSelect,
  searchCollectiveAgreementsForSelect,
  searchVehicleBrandsForSelect,
  searchVehicleTypesForSelect,
} from '@/shared/actions/catalogSearch.server';

// ============================================
// TIPOS
// ============================================

export interface DocumentTypeFilters {
  appliesTo?: DocumentAppliesTo;
  isMandatory?: boolean;
  isActive?: boolean;
}

export interface ConditionsInput {
  // Employee conditions
  jobPositionIds: string[];
  contractTypeIds: string[];
  jobCategoryIds: string[];
  unionIds: string[];
  collectiveAgreementIds: string[];
  genders: Gender[];
  costTypes: CostType[];
  // Equipment conditions
  vehicleBrandIds: string[];
  vehicleTypeIds: string[];
}

export interface CreateDocumentTypeInput {
  name: string;
  appliesTo: DocumentAppliesTo;
  isMandatory?: boolean;
  hasExpiration?: boolean;
  isMonthly?: boolean;
  isPrivate?: boolean;
  isTermination?: boolean;
  isMultiResource?: boolean;
  description?: string;
  // Conditions
  isConditional?: boolean;
  conditions?: ConditionsInput;
}

export interface UpdateDocumentTypeInput {
  name?: string;
  appliesTo?: DocumentAppliesTo;
  isMandatory?: boolean;
  hasExpiration?: boolean;
  isMonthly?: boolean;
  isPrivate?: boolean;
  isTermination?: boolean;
  isMultiResource?: boolean;
  description?: string;
  // Conditions
  isConditional?: boolean;
  conditions?: ConditionsInput;
}

export type DocumentTypeTab = 'ALL' | DocumentAppliesTo;

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene tipos de documento con paginación server-side para DataTable
 */
export async function getDocumentTypesPaginated(
  searchParams: DataTableSearchParams,
  tab: DocumentTypeTab = 'ALL'
) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Parsear parámetros de URL
    const state = parseSearchParams(searchParams);
    const { skip, take, orderBy } = stateToPrismaParams(state);

    // Excluir 'tab', 'subtab' y 'docTypeTab' de los filtros (se manejan aparte)
    const { tab: _tab, subtab: _subtab, docTypeTab: _docTypeTab, ...cleanFilters } = state.filters;

    // Construir cláusula de búsqueda
    const searchWhere = buildSearchWhere(state.search, ['name', 'description']);

    // Construir cláusula de filtros
    const filtersWhere = buildFiltersWhere(cleanFilters, {
      isMandatory: 'isMandatory',
      hasExpiration: 'hasExpiration',
      isMonthly: 'isMonthly',
    });

    // Transformar booleans de string
    if (filtersWhere.isMandatory) {
      filtersWhere.isMandatory = filtersWhere.isMandatory === 'true';
    }
    if (filtersWhere.hasExpiration) {
      filtersWhere.hasExpiration = filtersWhere.hasExpiration === 'true';
    }
    if (filtersWhere.isMonthly) {
      filtersWhere.isMonthly = filtersWhere.isMonthly === 'true';
    }

    // Filtrado por tab
    const tabWhere = tab !== 'ALL' ? { appliesTo: tab } : {};

    const where = {
      companyId,
      isActive: true,
      ...tabWhere,
      ...searchWhere,
      ...filtersWhere,
    };

    // Ejecutar queries en paralelo
    const [data, total] = await Promise.all([
      prisma.documentType.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || [{ appliesTo: 'asc' }, { name: 'asc' }],
      }),
      prisma.documentType.count({ where }),
    ]);

    return { data, total };
  } catch (error) {
    logger.error('Error al obtener tipos de documento paginados', { data: { error, companyId } });
    throw new Error('Error al obtener tipos de documento');
  }
}

/**
 * Obtiene contadores para cada tab
 */
export async function getDocumentTypeTabCounts() {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) return { ALL: 0, EMPLOYEE: 0, EQUIPMENT: 0, COMPANY: 0 };

  try {
    const [all, employee, equipment, company] = await Promise.all([
      prisma.documentType.count({ where: { companyId, isActive: true } }),
      prisma.documentType.count({ where: { companyId, isActive: true, appliesTo: 'EMPLOYEE' } }),
      prisma.documentType.count({ where: { companyId, isActive: true, appliesTo: 'EQUIPMENT' } }),
      prisma.documentType.count({ where: { companyId, isActive: true, appliesTo: 'COMPANY' } }),
    ]);

    return { ALL: all, EMPLOYEE: employee, EQUIPMENT: equipment, COMPANY: company };
  } catch (error) {
    logger.error('Error al obtener contadores de tabs', { data: { error } });
    return { ALL: 0, EMPLOYEE: 0, EQUIPMENT: 0, COMPANY: 0 };
  }
}

/**
 * Obtiene todos los tipos de documento de la empresa activa (sin paginación)
 * @deprecated Usar getDocumentTypesPaginated para listas grandes
 */
export async function getAllDocumentTypes(filters?: DocumentTypeFilters) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    return await prisma.documentType.findMany({
      where: {
        companyId,
        isActive: filters?.isActive ?? true,
        ...(filters?.appliesTo && { appliesTo: filters.appliesTo }),
        ...(filters?.isMandatory !== undefined && {
          isMandatory: filters.isMandatory,
        }),
      },
      orderBy: [{ appliesTo: 'asc' }, { name: 'asc' }],
    });
  } catch (error) {
    logger.error('Error getting document types', { data: { error } });
    throw new Error('Error al obtener tipos de documento');
  }
}

/**
 * Obtiene tipos de documento para select (filtrado por appliesTo)
 */
export async function getDocumentTypesForSelect(appliesTo: DocumentAppliesTo) {
  const companyId = await getActiveCompanyId();
  if (!companyId) return [];

  try {
    return await prisma.documentType.findMany({
      where: {
        companyId,
        appliesTo,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        isMandatory: true,
        hasExpiration: true,
        isMonthly: true,
      },
      orderBy: { name: 'asc' },
    });
  } catch (error) {
    logger.error('Error getting document types for select', { data: { error } });
    return [];
  }
}

/**
 * Obtiene las opciones iniciales para condiciones (20 primeras de cada catálogo)
 */
export async function getInitialConditionOptions() {
  const [
    jobPositions,
    contractTypes,
    jobCategories,
    unions,
    collectiveAgreements,
    vehicleBrands,
    vehicleTypes,
  ] = await Promise.all([
    searchJobPositionsForSelect('', 20),
    searchContractTypesForSelect('', 20),
    searchJobCategoriesForSelect('', 20),
    searchUnionsForSelect('', 20),
    searchCollectiveAgreementsForSelect('', 20),
    searchVehicleBrandsForSelect('', 20),
    searchVehicleTypesForSelect('', 20),
  ]);

  return {
    jobPositions,
    contractTypes,
    jobCategories,
    unions,
    collectiveAgreements,
    vehicleBrands,
    vehicleTypes,
  };
}

/**
 * Obtiene un tipo de documento con sus condiciones (para edición)
 */
export async function getDocumentTypeWithConditions(id: string) {
  await checkPermission('documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const documentType = await prisma.documentType.findFirst({
      where: { id, companyId },
      include: {
        conditionJobPositions: {
          select: { jobPositionId: true, jobPosition: { select: { id: true, name: true } } },
        },
        conditionContractTypes: {
          select: { contractTypeId: true, contractType: { select: { id: true, name: true } } },
        },
        conditionJobCategories: {
          select: { jobCategoryId: true, jobCategory: { select: { id: true, name: true } } },
        },
        conditionUnions: {
          select: { unionId: true, union: { select: { id: true, name: true } } },
        },
        conditionCollectiveAgreements: {
          select: {
            collectiveAgreementId: true,
            collectiveAgreement: { select: { id: true, name: true } },
          },
        },
        conditionVehicleBrands: {
          select: { vehicleBrandId: true, vehicleBrand: { select: { id: true, name: true } } },
        },
        conditionVehicleTypes: {
          select: { vehicleTypeId: true, vehicleType: { select: { id: true, name: true } } },
        },
      },
    });

    if (!documentType) {
      throw new Error('Tipo de documento no encontrado');
    }

    return documentType;
  } catch (error) {
    logger.error('Error getting document type with conditions', { data: { error, id } });
    throw error;
  }
}

// ============================================
// MUTATIONS
// ============================================

/**
 * Crea un nuevo tipo de documento
 */
export async function createDocumentType(input: CreateDocumentTypeInput) {
  await checkPermission('documents', 'create', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const slug = slugify(input.name);

    // Verificar que no exista un tipo con el mismo nombre o slug
    const existing = await prisma.documentType.findFirst({
      where: {
        companyId,
        OR: [{ name: input.name }, { slug }],
      },
      select: { id: true },
    });

    if (existing) {
      throw new Error('Ya existe un tipo de documento con ese nombre');
    }

    const { conditions, isConditional, ...basicData } = input;

    // Usar transacción para crear tipo + condiciones
    const documentType = await prisma.$transaction(async (tx) => {
      // Forzar isMultiResource a false si appliesTo es COMPANY
      const isMultiResourceValue = basicData.appliesTo === 'COMPANY'
        ? false
        : (basicData.isMultiResource ?? false);

      // Crear tipo de documento
      const docType = await tx.documentType.create({
        data: {
          companyId,
          name: basicData.name,
          slug,
          appliesTo: basicData.appliesTo,
          isMandatory: basicData.isMandatory ?? false,
          hasExpiration: basicData.hasExpiration ?? false,
          isMonthly: basicData.isMonthly ?? false,
          isPrivate: basicData.isPrivate ?? false,
          isTermination: basicData.isTermination ?? false,
          isMultiResource: isMultiResourceValue,
          description: basicData.description,
          isConditional: isConditional ?? false,
          genders: conditions?.genders ?? [],
          costTypes: conditions?.costTypes ?? [],
        },
        select: { id: true },
      });

      // Si hay condiciones, crear relaciones
      if (isConditional && conditions) {
        // Job Positions
        if (conditions.jobPositionIds.length > 0) {
          await tx.documentTypeJobPosition.createMany({
            data: conditions.jobPositionIds.map((jobPositionId) => ({
              documentTypeId: docType.id,
              jobPositionId,
            })),
          });
        }

        // Contract Types
        if (conditions.contractTypeIds.length > 0) {
          await tx.documentTypeContractType.createMany({
            data: conditions.contractTypeIds.map((contractTypeId) => ({
              documentTypeId: docType.id,
              contractTypeId,
            })),
          });
        }

        // Job Categories
        if (conditions.jobCategoryIds.length > 0) {
          await tx.documentTypeJobCategory.createMany({
            data: conditions.jobCategoryIds.map((jobCategoryId) => ({
              documentTypeId: docType.id,
              jobCategoryId,
            })),
          });
        }

        // Unions
        if (conditions.unionIds.length > 0) {
          await tx.documentTypeUnion.createMany({
            data: conditions.unionIds.map((unionId) => ({
              documentTypeId: docType.id,
              unionId,
            })),
          });
        }

        // Collective Agreements
        if (conditions.collectiveAgreementIds.length > 0) {
          await tx.documentTypeCollectiveAgreement.createMany({
            data: conditions.collectiveAgreementIds.map((collectiveAgreementId) => ({
              documentTypeId: docType.id,
              collectiveAgreementId,
            })),
          });
        }

        // Vehicle Brands
        if (conditions.vehicleBrandIds.length > 0) {
          await tx.documentTypeVehicleBrand.createMany({
            data: conditions.vehicleBrandIds.map((vehicleBrandId) => ({
              documentTypeId: docType.id,
              vehicleBrandId,
            })),
          });
        }

        // Vehicle Types
        if (conditions.vehicleTypeIds.length > 0) {
          await tx.documentTypeVehicleType.createMany({
            data: conditions.vehicleTypeIds.map((vehicleTypeId) => ({
              documentTypeId: docType.id,
              vehicleTypeId,
            })),
          });
        }
      }

      return docType;
    });

    logger.info('Document type created', { data: { id: documentType.id } });
    revalidatePath('/dashboard/documents');

    return documentType;
  } catch (error) {
    logger.error('Error creating document type', { data: { error } });
    throw error;
  }
}

/**
 * Actualiza un tipo de documento existente
 */
export async function updateDocumentType(id: string, input: UpdateDocumentTypeInput) {
  await checkPermission('documents', 'update', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que existe
    const existing = await prisma.documentType.findFirst({
      where: { id, companyId },
      select: { name: true },
    });

    if (!existing) {
      throw new Error('Tipo de documento no encontrado');
    }

    // Si cambia el nombre, verificar que no exista otro con ese nombre
    if (input.name && input.name !== existing.name) {
      const duplicate = await prisma.documentType.findFirst({
        where: {
          companyId,
          name: input.name,
          id: { not: id },
        },
        select: { id: true },
      });

      if (duplicate) {
        throw new Error('Ya existe un tipo de documento con ese nombre');
      }
    }

    const { conditions, isConditional, ...basicData } = input;

    // Usar transacción para actualizar tipo + condiciones
    const documentType = await prisma.$transaction(async (tx) => {
      // Preparar datos de actualización
      const updateData: Record<string, unknown> = { ...basicData };
      if (basicData.name) {
        updateData.slug = slugify(basicData.name);
      }

      // Forzar isMultiResource a false si appliesTo es COMPANY
      if (basicData.appliesTo === 'COMPANY') {
        updateData.isMultiResource = false;
      }

      // Agregar campos de condiciones si se proporcionaron
      if (isConditional !== undefined) {
        updateData.isConditional = isConditional;
      }
      if (conditions !== undefined) {
        updateData.genders = conditions.genders;
        updateData.costTypes = conditions.costTypes;

        // Eliminar condiciones existentes
        await Promise.all([
          tx.documentTypeJobPosition.deleteMany({ where: { documentTypeId: id } }),
          tx.documentTypeContractType.deleteMany({ where: { documentTypeId: id } }),
          tx.documentTypeJobCategory.deleteMany({ where: { documentTypeId: id } }),
          tx.documentTypeUnion.deleteMany({ where: { documentTypeId: id } }),
          tx.documentTypeCollectiveAgreement.deleteMany({ where: { documentTypeId: id } }),
          tx.documentTypeVehicleBrand.deleteMany({ where: { documentTypeId: id } }),
          tx.documentTypeVehicleType.deleteMany({ where: { documentTypeId: id } }),
        ]);

        // Crear nuevas condiciones si está activo
        if (isConditional) {
          if (conditions.jobPositionIds.length > 0) {
            await tx.documentTypeJobPosition.createMany({
              data: conditions.jobPositionIds.map((jobPositionId) => ({
                documentTypeId: id,
                jobPositionId,
              })),
            });
          }

          if (conditions.contractTypeIds.length > 0) {
            await tx.documentTypeContractType.createMany({
              data: conditions.contractTypeIds.map((contractTypeId) => ({
                documentTypeId: id,
                contractTypeId,
              })),
            });
          }

          if (conditions.jobCategoryIds.length > 0) {
            await tx.documentTypeJobCategory.createMany({
              data: conditions.jobCategoryIds.map((jobCategoryId) => ({
                documentTypeId: id,
                jobCategoryId,
              })),
            });
          }

          if (conditions.unionIds.length > 0) {
            await tx.documentTypeUnion.createMany({
              data: conditions.unionIds.map((unionId) => ({
                documentTypeId: id,
                unionId,
              })),
            });
          }

          if (conditions.collectiveAgreementIds.length > 0) {
            await tx.documentTypeCollectiveAgreement.createMany({
              data: conditions.collectiveAgreementIds.map((collectiveAgreementId) => ({
                documentTypeId: id,
                collectiveAgreementId,
              })),
            });
          }

          if (conditions.vehicleBrandIds.length > 0) {
            await tx.documentTypeVehicleBrand.createMany({
              data: conditions.vehicleBrandIds.map((vehicleBrandId) => ({
                documentTypeId: id,
                vehicleBrandId,
              })),
            });
          }

          if (conditions.vehicleTypeIds.length > 0) {
            await tx.documentTypeVehicleType.createMany({
              data: conditions.vehicleTypeIds.map((vehicleTypeId) => ({
                documentTypeId: id,
                vehicleTypeId,
              })),
            });
          }
        }
      }

      // Actualizar el tipo de documento
      const docType = await tx.documentType.update({
        where: { id },
        data: updateData,
        select: { id: true },
      });

      return docType;
    });

    logger.info('Document type updated', { data: { id: documentType.id } });
    revalidatePath('/dashboard/documents');

    return documentType;
  } catch (error) {
    logger.error('Error updating document type', { data: { error, id } });
    throw error;
  }
}

/**
 * Elimina un tipo de documento
 */
export async function deleteDocumentType(id: string) {
  await checkPermission('documents', 'delete', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    // Verificar que no tenga documentos asociados
    const hasEmployeeDocuments = await prisma.employeeDocument.findFirst({
      where: { documentTypeId: id },
      select: { id: true },
    });

    const hasEquipmentDocuments = await prisma.equipmentDocument.findFirst({
      where: { documentTypeId: id },
      select: { id: true },
    });

    const hasCompanyDocuments = await prisma.companyDocument.findFirst({
      where: { documentTypeId: id },
      select: { id: true },
    });

    if (hasEmployeeDocuments || hasEquipmentDocuments || hasCompanyDocuments) {
      throw new Error('No se puede eliminar: hay documentos asociados a este tipo');
    }

    await prisma.documentType.delete({
      where: { id, companyId },
    });

    revalidatePath('/dashboard/documents');
    return { success: true };
  } catch (error) {
    logger.error('Error deleting document type', { data: { error, id } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type DocumentTypeListItem = Awaited<
  ReturnType<typeof getDocumentTypesPaginated>
>['data'][number];
export type DocumentTypeOption = Awaited<ReturnType<typeof getDocumentTypesForSelect>>[number];
export type TabCounts = Awaited<ReturnType<typeof getDocumentTypeTabCounts>>;
export type DocumentTypeWithConditions = Awaited<ReturnType<typeof getDocumentTypeWithConditions>>;
export type InitialConditionOptions = Awaited<ReturnType<typeof getInitialConditionOptions>>;
