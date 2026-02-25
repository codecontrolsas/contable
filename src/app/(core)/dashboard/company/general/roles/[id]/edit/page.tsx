import type { Metadata } from 'next';
import { RoleEdit } from '@/modules/company';

export const metadata: Metadata = {
  title: 'Editar Rol | Empresa',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditRolePage({ params }: Props) {
  const { id } = await params;
  return <RoleEdit roleId={id} />;
}
