'use server';

import { prisma } from '@/shared/lib/prisma';
import { logger } from '@/shared/lib/logger';
import { getActiveCompanyId } from '@/shared/lib/company';
import { checkPermission } from '@/shared/lib/permissions';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';
import {
  parseSearchParams,
  stateToPrismaParams,
} from '@/shared/components/common/DataTable/helpers';
import { AUDIT_ACTIONS } from '@/shared/lib/permissions';

// ============================================
// QUERIES
// ============================================

/**
 * Obtiene los logs de auditoría con paginación
 */
export async function getAuditLogsPaginated(searchParams: DataTableSearchParams) {
  await checkPermission('company.general.audit', 'view', { redirect: true });

  const companyId = await getActiveCompanyId();
  if (!companyId) throw new Error('No hay empresa activa');

  try {
    const state = parseSearchParams(searchParams);
    const { skip, take } = stateToPrismaParams(state);

    const where = { companyId };

    const [logs, total] = await Promise.all([
      prisma.permissionAuditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          performedBy: true,
          action: true,
          targetType: true,
          targetId: true,
          targetName: true,
          module: true,
          details: true,
          oldValue: true,
          newValue: true,
          createdAt: true,
        },
      }),
      prisma.permissionAuditLog.count({ where }),
    ]);

    // Enriquecer con datos de usuarios (batch)
    const userIds = [...new Set(logs.map((log) => log.performedBy))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, imageUrl: true },
    });
    const usersMap = new Map<string, { firstName: string; lastName: string; imageUrl: string | null }>(
      users.map((u) => [
        u.id,
        {
          firstName: u.firstName ?? '',
          lastName: u.lastName ?? '',
          imageUrl: u.imageUrl ?? null,
        },
      ])
    );

    const enrichedLogs = logs.map((log) => ({
      ...log,
      performedByUser: usersMap.get(log.performedBy) ?? {
        firstName: 'Usuario',
        lastName: 'Desconocido',
        imageUrl: null,
      },
    }));

    return { data: enrichedLogs, total };
  } catch (error) {
    logger.error('Error al obtener logs de auditoría', { data: { error, companyId } });
    throw new Error('Error al obtener logs de auditoría');
  }
}

/**
 * Obtiene los tipos de acciones disponibles para filtrar
 */
export async function getAuditActionTypes() {
  await checkPermission('company.general.audit', 'view', { redirect: true });

  return Object.entries(AUDIT_ACTIONS).map(([key, value]) => ({
    key,
    value,
    label: getActionLabel(value),
  }));
}

// ============================================
// HELPERS
// ============================================

function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    [AUDIT_ACTIONS.role_created]: 'Rol creado',
    [AUDIT_ACTIONS.role_updated]: 'Rol actualizado',
    [AUDIT_ACTIONS.role_deleted]: 'Rol eliminado',
    [AUDIT_ACTIONS.role_permission_granted]: 'Permiso de rol otorgado',
    [AUDIT_ACTIONS.role_permission_revoked]: 'Permiso de rol revocado',
    [AUDIT_ACTIONS.member_invited]: 'Miembro invitado',
    [AUDIT_ACTIONS.member_role_changed]: 'Rol de miembro cambiado',
    [AUDIT_ACTIONS.member_deactivated]: 'Miembro desactivado',
    [AUDIT_ACTIONS.member_reactivated]: 'Miembro reactivado',
    [AUDIT_ACTIONS.member_permission_granted]: 'Permiso individual otorgado',
    [AUDIT_ACTIONS.member_permission_revoked]: 'Permiso individual revocado',
    [AUDIT_ACTIONS.invitation_accepted]: 'Invitación aceptada',
    [AUDIT_ACTIONS.invitation_expired]: 'Invitación expirada',
    [AUDIT_ACTIONS.invitation_cancelled]: 'Invitación cancelada',
  };

  return labels[action] ?? action;
}

// ============================================
// TIPOS INFERIDOS
// ============================================

export type AuditLogListItem = Awaited<ReturnType<typeof getAuditLogsPaginated>>['data'][number];
