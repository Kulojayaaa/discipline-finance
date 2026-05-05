import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED' | 'SGD';

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SGD: 'S$',
};

const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  INR: 'Indian Rupee (₹)',
  USD: 'US Dollar ($)',
  EUR: 'Euro (€)',
  GBP: 'British Pound (£)',
  AED: 'UAE Dirham (د.إ)',
  SGD: 'Singapore Dollar (S$)',
};

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  formatCurrency: (amount: number) => string;
  currencySymbol: string;
  currencyLabels: typeof CURRENCY_LABELS;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'INR',
  setCurrency: () => {},
  formatCurrency: (a) => `₹${a.toLocaleString()}`,
  currencySymbol: '₹',
  currencyLabels: CURRENCY_LABELS,
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    return (localStorage.getItem('evolve_currency') as CurrencyCode) || 'INR';
  });

  const setCurrency = (c: CurrencyCode) => {
    localStorage.setItem('evolve_currency', c);
    setCurrencyState(c);
  };

  const currencySymbol = CURRENCY_SYMBOLS[currency];

  const formatCurrency = (amount: number): string => {
    return `${currencySymbol}${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatCurrency, currencySymbol, currencyLabels: CURRENCY_LABELS }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
