import { useState, useMemo } from 'react';

export interface SortConfig<T> {
  key: keyof T | string;
  direction: 'asc' | 'desc';
}

export function useSortableTable<T>(items: T[], initialSort?: SortConfig<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(initialSort || null);

  const sortedItems = useMemo(() => {
    if (!sortConfig) return items;

    return [...items].sort((a, b) => {
      // Gérer les chemins nested (ex: "transaction.date")
      const getNestedValue = (obj: any, path: string) => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
      };

      const aValue = getNestedValue(a, sortConfig.key as string) ?? '';
      const bValue = getNestedValue(b, sortConfig.key as string) ?? '';

      // Comparaison numérique
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' 
          ? aValue - bValue 
          : bValue - aValue;
      }

      // Comparaison string
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortConfig]);

  const requestSort = (key: keyof T | string) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key: keyof T | string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return null;
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  return {
    sortedItems,
    requestSort,
    sortConfig,
    getSortIndicator,
  };
}
