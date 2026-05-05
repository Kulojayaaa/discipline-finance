import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFinanceStore } from '@/store/financeStore';

export function useTransactions() {
  const { user } = useAuth();
  const { transactions, loading, error, refresh } = useFinanceStore();

  useEffect(() => {
    if (user?.id) void refresh(user.id);
  }, [refresh, user?.id]);

  return { data: transactions, isLoading: loading, error };
}
