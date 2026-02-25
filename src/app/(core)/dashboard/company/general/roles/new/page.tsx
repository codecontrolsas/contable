import type { Metadata } from 'next';
import { RoleCreate } from '@/modules/company';

export const metadata: Metadata = {
  title: 'Nuevo Rol | Empresa',
};

export default function NewRolePage() {
  return <RoleCreate />;
}
