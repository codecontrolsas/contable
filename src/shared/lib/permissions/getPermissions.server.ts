'use server';

import { prisma } from '@/shared/lib/prisma';
import { getActiveCompanyId } from '@/shared/lib/company';
import { getCurrentUserId } from '@/shared/lib/current-user';
import { logger } from '@/shared/lib/logger';

import type { PermissionMap, UserPermissions, RoleWithPermissions } from './types';

const log = logger;

/**
 * Obtiene los permisos efectivos del usuario actual para la empresa activa
 *
 * El sistema de permisos funciona así:
 * 1. Si es owner de la empresa → tiene TODOS los permisos
 * 2. Si tiene rol asignado → obtiene permisos del rol
 * 3. Los permisos individuales (CompanyMemberPermission) pueden:
 *    - Agregar permisos (isGranted: true)
 *    - Revocar permisos (isGranted: false)
 */
export async function getCurrentUserPermissions(): Promise<UserPermissions | null> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const companyId = await getActiveCompanyId();
    if (!companyId) return null;

    // Obtener el miembro con su rol y permisos
    const member = await prisma.companyMember.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
      select: {
        id: true,
        isOwner: true,
        isActive: true,
        roleId: true,
        role: {
          select: {
            id: true,
            name: true,
            slug: true,
            permissions: {
              select: {
                module: true,
                action: {
                  select: { slug: true },
                },
              },
            },
          },
        },
        permissions: {
          select: {
            module: true,
            isGranted: true,
            action: {
              select: { slug: true },
            },
          },
        },
      },
    });

    if (!member || !member.isActive) return null;

    // Construir mapa de permisos
    const permissions: PermissionMap = {};

    // 1. Si es owner, tiene todos los permisos (se manejan en checkPermission)
    // Aquí solo construimos el mapa base

    // 2. Agregar permisos del rol
    if (member.role?.permissions) {
      for (const perm of member.role.permissions) {
        if (!permissions[perm.module]) {
          permissions[perm.module] = {};
        }
        permissions[perm.module][perm.action.slug] = true;
      }
    }

    // 3. Aplicar overrides individuales
    for (const override of member.permissions) {
      if (!permissions[override.module]) {
        permissions[override.module] = {};
      }
      permissions[override.module][override.action.slug] = override.isGranted;
    }

    return {
      memberId: member.id,
      roleId: member.roleId,
      roleSlug: member.role?.slug ?? null,
      roleName: member.role?.name ?? null,
      isOwner: member.isOwner,
      permissions,
    };
  } catch (error) {
    log.error('Error getting current user permissions', { data: { error } });
    return null;
  }
}

/**
 * Obtiene todos los roles de una empresa con sus permisos
 */
export async function getCompanyRoles(companyId?: string): Promise<RoleWithPermissions[]> {
  try {
    const activeCompanyId = companyId ?? (await getActiveCompanyId());
    if (!activeCompanyId) return [];

    const roles = await prisma.companyRole.findMany({
      where: { companyId: activeCompanyId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        isSystem: true,
        isDefault: true,
        permissions: {
          select: {
            module: true,
            action: {
              select: { slug: true },
            },
          },
        },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });

    return roles.map((role) => {
      const permissions: PermissionMap = {};

      for (const perm of role.permissions) {
        if (!permissions[perm.module]) {
          permissions[perm.module] = {};
        }
        permissions[perm.module][perm.action.slug] = true;
      }

      return {
        id: role.id,
        name: role.name,
        slug: role.slug,
        description: role.description,
        color: role.color,
        isSystem: role.isSystem,
        isDefault: role.isDefault,
        permissions,
      };
    });
  } catch (error) {
    log.error('Error getting company roles', { data: { error, companyId } });
    return [];
  }
}

/**
 * Obtiene un rol específico con sus permisos
 */
export async function getRoleById(roleId: string): Promise<RoleWithPermissions | null> {
  try {
    const role = await prisma.companyRole.findUnique({
      where: { id: roleId },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        isSystem: true,
        isDefault: true,
        permissions: {
          select: {
            module: true,
            action: {
              select: { slug: true },
            },
          },
        },
      },
    });

    if (!role) return null;

    const permissions: PermissionMap = {};

    for (const perm of role.permissions) {
      if (!permissions[perm.module]) {
        permissions[perm.module] = {};
      }
      permissions[perm.module][perm.action.slug] = true;
    }

    return {
      id: role.id,
      name: role.name,
      slug: role.slug,
      description: role.description,
      color: role.color,
      isSystem: role.isSystem,
      isDefault: role.isDefault,
      permissions,
    };
  } catch (error) {
    log.error('Error getting role by id', { data: { error, roleId } });
    return null;
  }
}

/**
 * Obtiene las acciones disponibles del sistema
 */
export async function getSystemActions() {
  try {
    return await prisma.action.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
      },
      orderBy: { slug: 'asc' },
    });
  } catch (error) {
    log.error('Error getting system actions', { data: { error } });
    return [];
  }
}
