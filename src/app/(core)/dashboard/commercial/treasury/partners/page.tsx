import type { Metadata } from 'next';
import { PartnersList } from '@/modules/commercial/features/treasury/features/partners';

export const metadata: Metadata = {
  title: 'Socios',
};

interface Props {
  searchParams: Promise<{
    page?: string;
    search?: string;
    pageSize?: string;
  }>;
}

export default async function PartnersPage({ searchParams }: Props) {
  const resolvedSearchParams = await searchParams;
  return <PartnersList searchParams={resolvedSearchParams} />;
}
