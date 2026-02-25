import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { getCategoryById, updateCategory } from '../list/actions.server';
import { CategoryForm } from '../create/components/_CategoryForm';
import type { CreateCategoryFormData } from '../shared/validators';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';

interface EditCategoryProps {
  categoryId: string;
}

export async function EditCategory({ categoryId }: EditCategoryProps) {
  const category = await getCategoryById(categoryId);

  const defaultValues: CreateCategoryFormData = {
    name: category.name,
    description: category.description || undefined,
    parentId: category.parentId || undefined,
  };

  const handleSubmit = async (data: CreateCategoryFormData) => {
    'use server';
    await updateCategory(categoryId, data);
  };

  return (
    <PermissionGuard module="commercial.categories" action="update" redirect>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Categoría</h1>
          <p className="text-muted-foreground">
            Modifica los datos de la categoría {category.name}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Información de la Categoría</CardTitle>
            <CardDescription>
              Actualiza los datos de la categoría
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryForm
              defaultValues={defaultValues}
              categoryId={categoryId}
              onSubmit={handleSubmit}
            />
          </CardContent>
        </Card>
      </div>
    </PermissionGuard>
  );
}
