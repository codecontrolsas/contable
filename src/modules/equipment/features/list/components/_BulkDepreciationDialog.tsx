'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import moment from 'moment';
import { Calculator, Loader2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

import {
  getPendingDepreciationsSummary,
  postAllPendingDepreciations,
} from '@/modules/equipment/features/depreciation/actions.server';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function _BulkDepreciationDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [upToDate, setUpToDate] = useState(moment().format('YYYY-MM-DD'));

  const {
    data: summary,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['pendingDepreciations', upToDate],
    queryFn: () => getPendingDepreciationsSummary(new Date(upToDate)),
    enabled: open,
  });

  const postMutation = useMutation({
    mutationFn: () => postAllPendingDepreciations(new Date(upToDate)),
    onSuccess: (result) => {
      if (result.posted > 0) {
        toast.success(`${result.posted} período(s) contabilizado(s)`);
      }
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} error(es) durante la contabilización`);
      }
      router.refresh();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Contabilizar Depreciaciones</DialogTitle>
          <DialogDescription>
            Contabilice todos los períodos de depreciación pendientes hasta la fecha seleccionada
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="upToDate">Contabilizar hasta</Label>
            <Input
              id="upToDate"
              type="date"
              value={upToDate}
              onChange={(e) => setUpToDate(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : summary ? (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-muted-foreground">Períodos pendientes</p>
                  <p className="text-lg font-semibold">{summary.totalEntries}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Equipos afectados</p>
                  <p className="text-lg font-semibold">{summary.vehicleCount}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monto total a contabilizar</p>
                <p className="text-lg font-semibold">
                  $ {summary.totalAmount.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => postMutation.mutate()}
            disabled={postMutation.isPending || !summary || summary.totalEntries === 0}
          >
            {postMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Contabilizando...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                Contabilizar {summary?.totalEntries || 0} período(s)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
