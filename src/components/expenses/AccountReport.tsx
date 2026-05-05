import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth, parseISO, isBefore, isWithinInterval } from 'date-fns';
import { useCurrency } from '@/hooks/CurrencyContext';
import { FinanceAccount, FinanceTransaction } from '@/lib/finance';

interface AccountReportProps {
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
}

export function AccountReport({ accounts, transactions }: AccountReportProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const { formatCurrency, currencySymbol } = useCurrency();

  const monthDate = parseISO(`${selectedMonth}-01`);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  const monthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let index = 0; index < 12; index += 1) {
      const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
      options.push({
        value: format(date, 'yyyy-MM'),
        label: format(date, 'MMMM yyyy'),
      });
    }
    return options;
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((transaction) => {
        const txDate = parseISO(transaction.transaction_date);
        const isInMonth = isWithinInterval(txDate, { start: monthStart, end: monthEnd });
        const matchesAccount =
          selectedAccountId === 'all' ||
          transaction.account_id === selectedAccountId ||
          transaction.to_account_id === selectedAccountId;
        return isInMonth && matchesAccount;
      })
      .sort((left, right) => parseISO(left.transaction_date).getTime() - parseISO(right.transaction_date).getTime());
  }, [transactions, selectedAccountId, monthStart, monthEnd]);

  const openingBalance = useMemo(() => {
    const getBalanceBeforeMonth = (accountId: string | null) => {
      const initialBalance =
        accountId === null
          ? accounts.reduce((sum, account) => sum + Number(account.initial_balance ?? 0), 0)
          : Number(accounts.find((account) => account.id === accountId)?.initial_balance ?? 0);

      const priorTransactions = transactions.filter((transaction) => {
        const txDate = parseISO(transaction.transaction_date);
        if (!isBefore(txDate, monthStart)) return false;
        if (accountId) {
          return transaction.account_id === accountId || transaction.to_account_id === accountId;
        }
        return true;
      });

      return priorTransactions.reduce((balance, transaction) => {
        if (accountId) {
          if (transaction.account_id === accountId) {
            if (transaction.type === 'credit') return balance + transaction.amount;
            if (transaction.type === 'debit') return balance - transaction.amount;
            if (transaction.type === 'transfer') return balance - transaction.amount;
          }
          if (transaction.to_account_id === accountId && transaction.type === 'transfer') {
            return balance + transaction.amount;
          }
          return balance;
        }

        if (transaction.type === 'credit') return balance + transaction.amount;
        if (transaction.type === 'debit') return balance - transaction.amount;
        return balance;
      }, initialBalance);
    };

    return selectedAccountId === 'all' ? getBalanceBeforeMonth(null) : getBalanceBeforeMonth(selectedAccountId);
  }, [accounts, transactions, selectedAccountId, monthStart]);

  const reportData = useMemo(() => {
    let runningBalance = openingBalance;

    const rows: Array<{
      sno: number;
      date: string;
      description: string;
      credit: number;
      debit: number;
      balance: number;
    }> = [];

    let snoCounter = 1;

    filteredTransactions.forEach((transaction) => {
      let credit = 0;
      let debit = 0;
      let description = transaction.category_name;
      const remarks = transaction.description?.trim();
      const fromAccount = accounts.find((account) => account.id === transaction.account_id);
      const toAccount = accounts.find((account) => account.id === transaction.to_account_id);

      if (selectedAccountId === 'all') {
        if (transaction.type === 'credit') {
          credit = transaction.amount;
        }
        if (transaction.type === 'debit') {
          debit = transaction.amount;
        }
        if (transaction.type === 'transfer') {
          return;
        }

        if (remarks) {
          description = `${transaction.category_name} - ${remarks}`;
        }

        runningBalance = runningBalance + credit - debit;
        rows.push({
          sno: snoCounter += 1,
          date: format(parseISO(transaction.transaction_date), 'dd/MM/yyyy'),
          description,
          credit,
          debit,
          balance: runningBalance,
        });
        return;
      }

      if (transaction.account_id === selectedAccountId) {
        if (transaction.type === 'credit') {
          credit = transaction.amount;
          description = remarks ? `${transaction.category_name} - ${remarks}` : transaction.category_name;
        }
        if (transaction.type === 'debit') {
          debit = transaction.amount;
          description = remarks ? `${transaction.category_name} - ${remarks}` : transaction.category_name;
        }
        if (transaction.type === 'transfer') {
          debit = transaction.amount;
          description = `Transfer to ${toAccount?.name || 'Unknown'}${remarks ? ` - ${remarks}` : ''}`;
        }

        runningBalance = runningBalance + credit - debit;
        rows.push({
          sno: snoCounter += 1,
          date: format(parseISO(transaction.transaction_date), 'dd/MM/yyyy'),
          description,
          credit,
          debit,
          balance: runningBalance,
        });
      }

      if (transaction.to_account_id === selectedAccountId && transaction.type === 'transfer') {
        credit = transaction.amount;
        description = `Transfer from ${fromAccount?.name || 'Unknown'}${remarks ? ` - ${remarks}` : ''}`;
        runningBalance = runningBalance + credit;
        rows.push({
          sno: snoCounter += 1,
          date: format(parseISO(transaction.transaction_date), 'dd/MM/yyyy'),
          description,
          credit,
          debit: 0,
          balance: runningBalance,
        });
      }
    });

    return rows.map((row, index) => ({ ...row, sno: index + 1 }));
  }, [accounts, filteredTransactions, openingBalance, selectedAccountId]);

  const totalCredit = reportData.reduce((sum, row) => sum + row.credit, 0);
  const totalDebit = reportData.reduce((sum, row) => sum + row.debit, 0);
  const closingBalance = openingBalance + totalCredit - totalDebit;

  const selectedAccountName =
    selectedAccountId === 'all' ? 'All Accounts' : accounts.find((account) => account.id === selectedAccountId)?.name || 'Unknown';

  const exportToExcel = async () => {
    const XLSX = await import('xlsx');
    const header = [
      ['Account Report'],
      [`Account: ${selectedAccountName}`],
      [`Period: ${format(monthStart, 'MMMM yyyy')}`],
      [`Opening Balance: ${formatCurrency(openingBalance)}`],
      [],
      ['S.No', 'Date', 'Description', `Credit (${currencySymbol})`, `Debit (${currencySymbol})`, `Balance (${currencySymbol})`],
    ];

    const data = reportData.map((row) => [
      row.sno,
      row.date,
      row.description,
      row.credit || '',
      row.debit || '',
      formatCurrency(row.balance),
    ]);

    const footer = [
      [],
      ['', 'Total', '', totalCredit.toLocaleString(), totalDebit.toLocaleString(), ''],
      ['', 'Closing Balance', '', '', '', closingBalance.toLocaleString()],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([...header, ...data, ...footer]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, `Account_Report_${selectedAccountName}_${selectedMonth}.xlsx`);
  };

  const exportToPDF = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Account Report', 14, 20);

    doc.setFontSize(11);
    doc.text(`Account: ${selectedAccountName}`, 14, 30);
    doc.text(`Period: ${format(monthStart, 'MMMM yyyy')}`, 14, 37);
    doc.text(`Opening Balance: ${formatCurrency(openingBalance)}`, 14, 44);

    autoTable(doc, {
      startY: 52,
      head: [['S.No', 'Date', 'Description', `Credit (${currencySymbol})`, `Debit (${currencySymbol})`, `Balance (${currencySymbol})`]],
      body: reportData.map((row) => [
        row.sno,
        row.date,
        row.description,
        row.credit ? `${currencySymbol} ${row.credit.toLocaleString()}` : '-',
        row.debit ? `${currencySymbol} ${row.debit.toLocaleString()}` : '-',
        `${currencySymbol} ${row.balance.toLocaleString()}`,
      ]),
      foot: [
        ['', 'Total', '', `${currencySymbol} ${totalCredit.toLocaleString()}`, `${currencySymbol} ${totalDebit.toLocaleString()}`, ''],
        ['', 'Closing Balance', '', '', '', `${currencySymbol} ${closingBalance.toLocaleString()}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [37, 99, 235] },
      footStyles: { fillColor: [243, 244, 246], textColor: [0, 0, 0], fontStyle: 'bold' },
    });

    doc.save(`Account_Report_${selectedAccountName}_${selectedMonth}.pdf`);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle>Account Statement</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.icon} {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" onClick={() => void exportToExcel()} title="Export Excel">
              <FileSpreadsheet className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => void exportToPDF()} title="Export PDF">
              <FileText className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">Opening Balance</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(openingBalance)}</p>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">S.No</TableHead>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-[120px]">Credit ({currencySymbol})</TableHead>
                <TableHead className="text-right w-[120px]">Debit ({currencySymbol})</TableHead>
                <TableHead className="text-right w-[120px]">Balance ({currencySymbol})</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No transactions for this period
                  </TableCell>
                </TableRow>
              ) : (
                reportData.map((row) => (
                  <TableRow key={`${row.date}-${row.sno}`}>
                    <TableCell>{row.sno}</TableCell>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell className="text-right text-green-600">{row.credit ? `+${formatCurrency(row.credit)}` : '-'}</TableCell>
                    <TableCell className="text-right text-red-600">{row.debit ? `-${formatCurrency(row.debit)}` : '-'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.balance)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {reportData.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">+{formatCurrency(totalCredit)}</TableCell>
                  <TableCell className="text-right font-semibold text-red-600">-{formatCurrency(totalDebit)}</TableCell>
                  <TableCell />
                </TableRow>
                <TableRow className="bg-primary/5">
                  <TableCell colSpan={5} className="font-bold">Closing Balance</TableCell>
                  <TableCell className="text-right font-bold text-lg">{formatCurrency(closingBalance)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
