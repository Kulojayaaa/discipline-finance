import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useFinanceStore } from '@/store/financeStore';

export function useAccounts() {
  const { user } = useAuth();
  const { accounts, loading, error, refresh } = useFinanceStore();

  useEffect(() => {
    if (user?.id) void refresh(user.id);
  }, [refresh, user?.id]);

  return { data: accounts, isLoading: loading, error };
}
