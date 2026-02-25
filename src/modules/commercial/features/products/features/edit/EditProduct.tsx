import { PermissionGuard } from '@/shared/components/common/PermissionGuard';
import { getProductById } from '../list/actions.server';
import { getCategories } from '../categories/actions.server';
import { _EditProductForm } from './components/_EditProductForm';
import { notFound } from 'next/navigation';

interface EditProductProps {
  productId: string;
}

export async function EditProduct({ productId }: EditProductProps) {
  const [product, categories] = await Promise.all([
    getProductById(productId),
    getCategories(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <PermissionGuard module="commercial.products" action="update" redirect>
      <div className="flex flex-1 flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Editar Producto</h1>
          <p className="text-sm text-muted-foreground">
            Modifica la información de: {product.name}
          </p>
        </div>

        <_EditProductForm product={product} categories={categories} />
      </div>
    </PermissionGuard>
  );
}
