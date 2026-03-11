'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { useCallback } from 'react';

const RANGE_OPTIONS = [
  { value: '3', label: '3M' },
  { value: '6', label: '6M' },
  { value: '12', label: '12M' },
] as const;

interface MonthsRangeSelectorProps {
  currentRange: number;
}

export function _MonthsRangeSelector({ currentRange }: MonthsRangeSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = useCallback(
    (value: string) => {
      if (!value) return;
      const params = new URLSearchParams(searchParams.toString());
      if (value === '6') {
        params.delete('months');
      } else {
        params.set('months', value);
      }
      const query = params.toString();
      router.push(`/dashboard${query ? `?${query}` : ''}`);
    },
    [router, searchParams],
  );

  return (
    <ToggleGroup
      type="single"
      value={String(currentRange)}
      onValueChange={handleChange}
      size="sm"
      className="h-8"
    >
      {RANGE_OPTIONS.map((opt) => (
        <ToggleGroupItem
          key={opt.value}
          value={opt.value}
          className="h-7 px-2.5 text-xs"
        >
          {opt.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
