'use server';

import type { Prisma } from '@/generated/prisma/client';

import { prisma } from '@/shared/lib/prisma';
import { getActiveCompanyId } from '@/shared/lib/company';
import { getCurrentUserId } from '@/shared/lib/current-user';
import { logger } from '@/shared/lib/logger';

import type { AuditAction } from './constants';

const log = logger;

interface CreateAuditLogParams {
  action: AuditAction;
  targetType: 'role' | 'member' | 'invitation';
  targetId: string;
  targetName?: string;
  module?: string;
  details?: Prisma.InputJsonValue;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
}

/**
 * Crea una entrada en el log de auditoría de permisos
 */
export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      log.warn('Attempted to create audit log without user');
      return;
    }

    const companyId = await getActiveCompanyId();
    if (!companyId) {
      log.warn('Attempted to create audit log without company');
      return;
    }

    await prisma.permissionAuditLog.create({
      data: {
        companyId,
        performedBy: userId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        targetName: params.targetName,
        module: params.module,
        details: params.details,
        oldValue: params.oldValue,
        newValue: params.newValue,
      },
    });
  } catch (error) {
    log.error('Error creating audit log', { data: { error, params } });
    // No lanzamos el error para no interrumpir la operación principal
  }
}

interface GetAuditLogsParams {
  page?: number;
  pageSize?: number;
  targetType?: 'role' | 'member' | 'invitation';
  action?: string;
}

/**
 * Obtiene los logs de auditoría de la empresa activa
 */
export async function getAuditLogs(params: GetAuditLogsParams = {}) {
  const { page = 1, pageSize = 20, targetType, action } = params;

  try {
    const companyId = await getActiveCompanyId();
    if (!companyId) {
      return { data: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
    }

    const where = {
      companyId,
      ...(targetType && { targetType }),
      ...(action && { action }),
    };

    const [logs, total] = await Promise.all([
      prisma.permissionAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.permissionAuditLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    log.error('Error getting audit logs', { data: { error, params } });
    return { data: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
  }
}
