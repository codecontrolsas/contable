import type { Metadata } from 'next';
import { CardsList } from '@/modules/commercial/features/treasury/features/cards';
import type { DataTableSearchParams } from '@/shared/components/common/DataTable';

export const metadata: Metadata = {
  title: 'Tarjetas',
};

interface Props {
  searchParams: Promise<DataTableSearchParams>;
}

export default async function CardsPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  return <CardsList searchParams={resolvedSearchParams} />;
}
