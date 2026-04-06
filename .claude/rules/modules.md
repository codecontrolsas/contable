# Reglas de Módulos Activables por Empresa

## 1. Todo módulo de primer nivel debe registrarse

Al crear un nuevo módulo de primer nivel (como employees, equipment, commercial, etc.), SIEMPRE registrarlo en `src/shared/lib/modules/constants.ts` para que aparezca en la pantalla de activación por empresa.

## 2. Archivos a modificar

### `src/shared/lib/modules/constants.ts`

1. Agregar al objeto `ACTIVATABLE_MODULES`
2. Agregar label en `MODULE_DISPLAY_LABELS`
3. Agregar descripción en `MODULE_DESCRIPTIONS`
4. Agregar ícono en `MODULE_ICONS`
5. Si depende de otro módulo: agregar en `MODULE_DEPENDENCIES`
6. Mapear TODOS los permisos del módulo en `PERMISSION_MODULE_MAP`

### Mapeo de permisos

```typescript
// Mapear el módulo principal y sus sub-módulos
PERMISSION_MODULE_MAP: {
  'newModule': 'newModule',
  'newModule.feature1': 'newModule',
  'newModule.feature2': 'newModule',
  // También mapear configs de empresa relacionadas
  'company.newModule-config': 'newModule',
}
```

## 3. Tres capas de filtrado

El sidebar aplica 3 capas en orden:

1. **RBAC** — Permisos del usuario/rol (checkPermission)
2. **Industria** — Tipo de empresa (INDUSTRY_MODULES, INDUSTRY_FEATURES)
3. **Módulos activos** — Activación por empresa (activeModules)

Las 3 capas se aplican en `src/shared/actions/sidebar.ts`.

## 4. Backward compatibility

`activeModules` vacío (`[]`) = todos los módulos activos. Las empresas existentes no se ven afectadas.

## 5. Dependencias

```typescript
// Ejemplo: Contabilidad requiere Comercial
MODULE_DEPENDENCIES: {
  accounting: ['commercial'],
}
```

- Al activar un módulo, sus dependencias se activan automáticamente
- Al desactivar un módulo, los que dependen de él se desactivan automáticamente
- La UI muestra advertencias antes de desactivar módulos con dependientes

## 6. UI de configuración

Ruta: `/dashboard/company/modules`
Permiso: `company.general.users` (administración)
Archivo: `src/modules/companies/features/modules/`
