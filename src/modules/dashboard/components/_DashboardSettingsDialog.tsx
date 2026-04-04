'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Separator } from '@/shared/components/ui/separator';
import { Label } from '@/shared/components/ui/label';
import { Settings2, RotateCcw } from 'lucide-react';
import { WIDGET_CATEGORIES, getWidgetsByCategory } from '../constants';
import { useDashboardPreferences } from '../hooks/useDashboardPreferences';

interface DashboardSettingsDialogProps {
  companyId: string;
}

export function _DashboardSettingsDialog({ companyId }: DashboardSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const { preferences, toggleWidget, setAccordionsOpen, isWidgetVisible, resetDefaults } =
    useDashboardPreferences(companyId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="h-8 w-8">
          <Settings2 className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar Dashboard</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Accordion setting */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Iniciar widgets abiertos</Label>
              <p className="text-xs text-muted-foreground">
                Los acordeones de los widgets se abren automaticamente al cargar
              </p>
            </div>
            <Switch
              checked={preferences.accordionsOpen}
              onCheckedChange={setAccordionsOpen}
            />
          </div>

          <Separator />

          {/* Widgets by category */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Widgets visibles</Label>
            {WIDGET_CATEGORIES.map((category) => {
              const widgets = getWidgetsByCategory(category);
              return (
                <div key={category}>
                  <p className="text-sm font-medium text-muted-foreground mb-2">{category}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {widgets.map((widget) => (
                      <label
                        key={widget.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md border p-2 text-sm hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={isWidgetVisible(widget.id)}
                          onCheckedChange={() => toggleWidget(widget.id)}
                        />
                        <span>{widget.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <Separator />

          {/* Reset */}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={resetDefaults} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar valores por defecto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
