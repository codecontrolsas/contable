'use client';

import { useMemo } from 'react';

import {
  DataTable,
  type DataTableFacetedFilterConfig,
  type DataTableSearchParams,
} from '@/shared/components/common/DataTable';
import { getColumns, CARD_INSTALLMENT_STATUS_LABELS, type CardInstallment } from '../columns';
import { COMPANY_OWNER_FILTER_VALUE } from '../query';
import type { getCardInstallmentFilterOptions } from '../actions.server';

type CardInstallmentFilterOptions = Awaited<ReturnType<typeof getCardInstallmentFilterOptions>>;

interface CardInstallmentsTableProps {
  data: CardInstallment[];
  totalRows: number;
  searchParams: DataTableSearchParams;
  filterOptions: CardInstallmentFilterOptions;
}

export function _CardInstallmentsTable({
  data,
  totalRows,
  searchParams,
  filterOptions,
}: CardInstallmentsTableProps) {
  const columns = useMemo(() => getColumns(), []);

  const facetedFilters = useMemo<DataTableFacetedFilterConfig[]>(
    () => [
      {
        columnId: 'status',
        title: 'Estado',
        options: Object.entries(CARD_INSTALLMENT_STATUS_LABELS).map(([value, label]) => ({
          value,
          label,
        })),
      },
      {
        columnId: 'dueDate',
        title: 'Vencimiento',
        type: 'dateRange',
      },
      {
        columnId: 'cardName',
        title: 'Tarjeta',
        options: filterOptions.cards,
      },
      {
        columnId: 'ownerLabel',
        title: 'Titular',
        options: [
          ...(filterOptions.hasCompanyCards
            ? [{ value: COMPANY_OWNER_FILTER_VALUE, label: 'Empresa' }]
            : []),
          ...filterOptions.partners,
        ],
      },
      {
        columnId: 'originFullNumber',
        title: 'Origen',
        type: 'text',
        placeholder: 'Buscar por N° de OP...',
      },
    ],
    [filterOptions]
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      totalRows={totalRows}
      searchParams={searchParams}
      showSearch={false}
      tableId="commercial-treasury-card-installments"
      facetedFilters={facetedFilters}
      showFilterToggle
    />
  );
}
