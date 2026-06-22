import { EditPartner } from '@/modules/commercial/features/treasury/features/partners';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditPartnerPage({ params }: PageProps) {
  const { id } = await params;
  return <EditPartner partnerId={id} />;
}
