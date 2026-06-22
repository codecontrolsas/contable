import { PartnerDetail } from '@/modules/commercial/features/treasury/features/partners';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function PartnerDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <PartnerDetail partnerId={id} />;
}
