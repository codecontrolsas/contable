'use client';

import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { DEFAULT_PAGE_SIZE, parseSearchParams, stateToSearchParams } from './helpers';
import type { DataTableSearchParams, DataTableState } from './types';

// Re-export helpers para conveniencia (pero los server actions deben importar de ./helpers directamente)
export {
  buildFiltersWhere,
  buildSearchWhere,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  parseSearchParams,
  stateToPrismaParams,
  stateToSearchParams,
} from './helpers';

// ============================================================================
// PERSISTENCIA EN LOCALSTORAGE
// ============================================================================

const STORAGE_PREFIX = 'dt-state:';

interface PersistedTableState {
  pageSize?: number;
  sortBy?: string | null;
  sortOrder?: 'asc' | 'desc';
  filters?: Record<string, string[]>;
}

function getPersistedState(tableId: string): PersistedTableState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persistState(tableId: string, state: PersistedTableState): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${tableId}`, JSON.stringify(state));
  } catch {
    // localStorage lleno o no disponible, ignorar silenciosamente
  }
}

function clearPersistedState(tableId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${tableId}`);
  } catch {
    // ignorar
  }
}

// ============================================================================
// HOOK: useDataTable
// ============================================================================

interface UseDataTableOptions {
  /** Tamaño de página por defecto */
  defaultPageSize?: number;
  /** Columnas que se pueden filtrar via URL */
  filterableColumns?: string[];
  /** ID de tabla para persistencia de estado (filtros, sort, pageSize) */
  tableId?: string;
}

interface UseDataTableReturn {
  /** Estado actual parseado */
  state: DataTableState;
  /** Estado de paginación para TanStack Table */
  pagination: PaginationState;
  /** Estado de sorting para TanStack Table */
  sorting: SortingState;
  /** Estado de filtros para TanStack Table */
  columnFilters: ColumnFiltersState;
  /** Callback cuando cambia la paginación */
  onPaginationChange: (
    updater: PaginationState | ((old: PaginationState) => PaginationState)
  ) => void;
  /** Callback cuando cambia el sorting */
  onSortingChange: (updater: SortingState | ((old: SortingState) => SortingState)) => void;
  /** Callback cuando cambian los filtros */
  onColumnFiltersChange: (
    updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)
  ) => void;
  /** Callback para búsqueda global */
  onGlobalFilterChange: (value: string) => void;
  /** Resetear todos los filtros */
  resetFilters: () => void;
}

/**
 * Hook para manejar el estado del DataTable sincronizado con la URL
 *
 * @example
 * ```tsx
 * const {
 *   state,
 *   pagination,
 *   sorting,
 *   columnFilters,
 *   onPaginationChange,
 *   onSortingChange,
 *   onColumnFiltersChange,
 * } = useDataTable({
 *   defaultPageSize: 20,
 *   filterableColumns: ['status', 'priority'],
 * });
 *
 * const table = useReactTable({
 *   manualPagination: true,
 *   manualSorting: true,
 *   manualFiltering: true,
 *   state: { pagination, sorting, columnFilters },
 *   onPaginationChange,
 *   onSortingChange,
 *   onColumnFiltersChange,
 *   // ...
 * });
 * ```
 */
export function useDataTable(options: UseDataTableOptions = {}): UseDataTableReturn {
  const { defaultPageSize = DEFAULT_PAGE_SIZE, filterableColumns = [], tableId } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const restoredRef = useRef(false);

  // Restaurar estado guardado si la URL no tiene params relevantes
  useEffect(() => {
    if (!tableId || restoredRef.current) return;
    restoredRef.current = true;

    // Verificar si la URL tiene params de tabla (excluyendo params no-tabla como "tab")
    const tableParamKeys = ['page', 'pageSize', 'sortBy', 'sortOrder', 'search'];
    const hasTableParams = tableParamKeys.some((k) => searchParams.has(k)) ||
      filterableColumns.some((k) => searchParams.has(k));

    if (hasTableParams) return;

    const saved = getPersistedState(tableId);
    if (!saved) return;

    // Reconstruir estado desde localStorage
    const restoredState: Partial<DataTableState> = {
      page: 0,
      pageSize: saved.pageSize ?? defaultPageSize,
      sortBy: saved.sortBy ?? null,
      sortOrder: saved.sortOrder ?? 'asc',
      filters: saved.filters ?? {},
      search: '',
    };

    const params = stateToSearchParams(restoredState);
    const queryString = params.toString();
    if (queryString) {
      router.replace(`${pathname}?${queryString}`, { scroll: false });
    }
  }, [tableId, searchParams, filterableColumns, defaultPageSize, pathname, router]);

  // Parsear estado actual de la URL
  const state = useMemo(() => {
    const params: DataTableSearchParams = {};
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    const parsed = parseSearchParams(params);
    // Aplicar defaultPageSize si no hay pageSize en URL
    if (!searchParams.has('pageSize')) {
      parsed.pageSize = defaultPageSize;
    }
    return parsed;
  }, [searchParams, defaultPageSize]);

  // Convertir a formatos de TanStack Table
  const pagination: PaginationState = useMemo(
    () => ({
      pageIndex: state.page,
      pageSize: state.pageSize,
    }),
    [state.page, state.pageSize]
  );

  const sorting: SortingState = useMemo(
    () => (state.sortBy ? [{ id: state.sortBy, desc: state.sortOrder === 'desc' }] : []),
    [state.sortBy, state.sortOrder]
  );

  const columnFilters: ColumnFiltersState = useMemo(() => {
    const filters: ColumnFiltersState = [];

    // Filtro de búsqueda global (si existe)
    if (state.search) {
      filters.push({ id: 'global', value: state.search });
    }

    // Filtros de columnas
    Object.entries(state.filters).forEach(([columnId, values]) => {
      if (filterableColumns.length === 0 || filterableColumns.includes(columnId)) {
        filters.push({ id: columnId, value: values });
      }
    });

    return filters;
  }, [state.search, state.filters, filterableColumns]);

  // Función helper para actualizar URL y persistir estado
  const updateURL = useCallback(
    (newState: Partial<DataTableState>) => {
      const merged = { ...state, ...newState };
      const params = stateToSearchParams(merged);
      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });

      // Persistir estado (sin página ni search, que son efímeros)
      if (tableId) {
        persistState(tableId, {
          pageSize: merged.pageSize,
          sortBy: merged.sortBy,
          sortOrder: merged.sortOrder,
          filters: merged.filters,
        });
      }
    },
    [state, pathname, router, tableId]
  );

  // Handlers
  const onPaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
      const newPagination = typeof updater === 'function' ? updater(pagination) : updater;
      updateURL({
        page: newPagination.pageIndex,
        pageSize: newPagination.pageSize,
      });
    },
    [pagination, updateURL]
  );

  const onSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newSorting = typeof updater === 'function' ? updater(sorting) : updater;
      if (newSorting.length > 0) {
        updateURL({
          sortBy: newSorting[0].id,
          sortOrder: newSorting[0].desc ? 'desc' : 'asc',
          page: 0, // Reset to first page on sort change
        });
      } else {
        updateURL({
          sortBy: null,
          sortOrder: 'asc',
          page: 0,
        });
      }
    },
    [sorting, updateURL]
  );

  const onColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
      const newFilters = typeof updater === 'function' ? updater(columnFilters) : updater;

      // Convertir de ColumnFiltersState a nuestro formato de filters
      const filters: Record<string, string[]> = {};
      let search = '';

      newFilters.forEach((filter) => {
        if (filter.id === 'global') {
          search = filter.value as string;
        } else {
          const value = filter.value;
          filters[filter.id] = Array.isArray(value) ? value : [String(value)];
        }
      });

      updateURL({
        filters,
        search,
        page: 0, // Reset to first page on filter change
      });
    },
    [columnFilters, updateURL]
  );

  const onGlobalFilterChange = useCallback(
    (value: string) => {
      updateURL({
        search: value,
        page: 0,
      });
    },
    [updateURL]
  );

  const resetFilters = useCallback(() => {
    if (tableId) clearPersistedState(tableId);
    router.push(pathname, { scroll: false });
  }, [pathname, router, tableId]);

  return {
    state,
    pagination,
    sorting,
    columnFilters,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    resetFilters,
  };
}
