import { EditCard } from '@/modules/commercial/features/treasury/features/cards';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditCardPage({ params }: PageProps) {
  const { id } = await params;
  return <EditCard cardId={id} />;
}
