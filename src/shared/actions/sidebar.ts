'use server';

import { getIndustryType, isModuleAvailableForIndustry } from '@/shared/lib/industry';
import { isModuleActiveForCompany } from '@/shared/lib/modules';
import { getCurrentUserPermissions, MODULES } from '@/shared/lib/permissions';

/**
 * Mapa de permisos del sidebar
 * Key: módulo, Value: tiene permiso view
 */
export type SidebarPermissions = Record<string, boolean>;

/**
 * Obtiene los permisos de vista para todos los módulos del sidebar.
 *
 * Aplica tres capas de filtrado:
 * 1. Permisos RBAC del usuario (roles y permisos)
 * 2. Filtro de industria (módulos específicos por tipo de empresa)
 * 3. Módulos activos de la empresa (activación/desactivación por empresa)
 */
export async function getSidebarPermissions(
  industry?: string | null,
  activeModules?: string[],
): Promise<SidebarPermissions> {
  const userPermissions = await getCurrentUserPermissions();

  // Si no hay usuario o no es miembro activo, sin acceso
  if (!userPermissions) {
    return {};
  }

  const permissions: SidebarPermissions = {};

  // Owners y roles de sistema tienen TODOS los permisos
  if (
    userPermissions.isOwner ||
    userPermissions.roleSlug === 'owner' ||
    userPermissions.roleSlug === 'developer'
  ) {
    for (const mod of Object.values(MODULES)) {
      permissions[mod] = true;
    }
  } else {
    // Construir mapa de permisos (solo acción 'view')
    for (const mod of Object.values(MODULES)) {
      permissions[mod] = userPermissions.permissions[mod]?.view === true;
    }
  }

  // Aplicar filtro de industria (Nivel 1)
  // Se aplica DESPUÉS de permisos, tanto para owners como usuarios normales
  const industryType = getIndustryType(industry);
  for (const mod of Object.keys(permissions)) {
    if (!isModuleAvailableForIndustry(mod, industryType)) {
      permissions[mod] = false;
    }
  }

  // Aplicar filtro de módulos activos de la empresa (Nivel 2)
  // Se aplica DESPUÉS de industria. Vacío = todos activos (backward compatible)
  if (activeModules && activeModules.length > 0) {
    for (const mod of Object.keys(permissions)) {
      if (!isModuleActiveForCompany(mod, activeModules)) {
        permissions[mod] = false;
      }
    }
  }

  return permissions;
}
