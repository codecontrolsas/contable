import type { Metadata } from 'next';
import { DashboardContent } from '@/modules/dashboard/DashboardContent';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Panel principal',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; months?: string }>;
}) {
  const params = await searchParams;
  const monthsRange = params.months === '3' || params.months === '12' ? Number(params.months) : 6;
  return <DashboardContent period={params.month} monthsRange={monthsRange} />;
}
