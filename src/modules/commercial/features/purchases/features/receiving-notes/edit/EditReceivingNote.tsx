import {
  getSuppliersForSelect,
  getWarehousesForSelect,
  getReceivingNoteById,
} from '../list/actions.server';
import { _ReceivingNoteForm } from '../create/components/_ReceivingNoteForm';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { PermissionGuard } from '@/shared/components/common/PermissionGuard';

interface EditReceivingNoteProps {
  noteId: string;
}

export async function EditReceivingNote({ noteId }: EditReceivingNoteProps) {
  const [suppliers, warehouses, note] = await Promise.all([
    getSuppliersForSelect(),
    getWarehousesForSelect(),
    getReceivingNoteById(noteId),
  ]);

  if (note.status !== 'DRAFT') {
    return (
      <PermissionGuard module="commercial.receiving-notes" action="update" redirect>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Editar Remito de Recepción</h1>
            <p className="text-muted-foreground">Remito {note.fullNumber}</p>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No se puede editar un remito confirmado. Solo los remitos en estado borrador
              pueden ser modificados.
            </AlertDescription>
          </Alert>
        </div>
      </PermissionGuard>
    );
  }

  const defaultValues = {
    supplierId: note.supplierId,
    warehouseId: note.warehouseId,
    purchaseOrderId: note.purchaseOrderId ?? '',
    purchaseInvoiceId: note.purchaseInvoiceId ?? '',
    receptionDate: new Date(note.receptionDate),
    notes: note.notes ?? '',
    lines: note.lines.map((line) => ({
      productId: line.productId,
      description: line.description,
      quantity: String(line.quantity),
      purchaseOrderLineId: line.purchaseOrderLineId ?? '',
      notes: line.notes ?? '',
    })),
  };

  return (
    <PermissionGuard module="commercial.receiving-notes" action="update" redirect>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Editar Remito de Recepción</h1>
          <p className="text-muted-foreground">
            Modificar remito {note.fullNumber} - Estado: Borrador
          </p>
        </div>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Estás editando un remito en estado borrador. Una vez confirmado, no podrá ser
            modificado.
          </AlertDescription>
        </Alert>

        <_ReceivingNoteForm
          suppliers={suppliers}
          warehouses={warehouses}
          mode="edit"
          noteId={noteId}
          defaultValues={defaultValues}
        />
      </div>
    </PermissionGuard>
  );
}
