'use server';

import type { DocumentState } from '@/generated/prisma/enums';
import { getActiveCompanyId } from '@/shared/lib/company';
import { logger } from '@/shared/lib/logger';
import { checkPermission } from '@/shared/lib/permissions';
import { prisma } from '@/shared/lib/prisma';

// ============================================
// TIPOS
// ============================================

export interface CompanyDocumentsFilters {
  state?: DocumentState;
  documentTypeId?: string;
}

export interface CompanyDocumentsSummary {
  total: number;
  pending: number;
  approved: number;
  expired: number;
  mandatory: number;
  mandatoryCompleted: number;
}

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene todos los documentos de la empresa activa
 */
export async function getCompanyDocuments(filters?: CompanyDocumentsFilters) {
  await checkPermission('company.documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    return await prisma.companyDocument.findMany({
      where: {
        companyId,
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
    logger.error('Error getting company documents', { data: { error } });
    throw error;
  }
}

/**
 * Obtiene un resumen del estado de documentos de la empresa
 */
export async function getCompanyDocumentsSummary(): Promise<CompanyDocumentsSummary> {
  await checkPermission('company.documents', 'view', { redirect: true });
  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const documents = await prisma.companyDocument.findMany({
      where: { companyId },
      select: {
        state: true,
        documentType: {
          select: { isMandatory: true },
        },
      },
    });

    const mandatoryTypes = await prisma.documentType.count({
      where: {
        companyId,
        appliesTo: 'COMPANY',
        isMandatory: true,
        isActive: true,
      },
    });

    const mandatoryApproved = await prisma.companyDocument.findMany({
      where: {
        companyId,
        state: 'APPROVED',
        documentType: { isMandatory: true },
      },
      select: { documentTypeId: true },
      distinct: ['documentTypeId'],
    });

    return {
      total: documents.length,
      pending: documents.filter((d) => d.state === 'PENDING').length,
      approved: documents.filter((d) => d.state === 'APPROVED').length,
      expired: documents.filter((d) => d.state === 'EXPIRED').length,
      mandatory: mandatoryTypes,
      mandatoryCompleted: mandatoryApproved.length,
    };
  } catch (error) {
    logger.error('Error getting company documents summary', { data: { error } });
    throw error;
  }
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type CompanyDocumentListItem = Awaited<
  ReturnType<typeof getCompanyDocuments>
>[number];
