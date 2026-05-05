import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function loadEnvFile() {
  const text = readFileSync('.env', 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=["']?(.*?)["']?$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

loadEnvFile();

const email = process.env.SAMPLE_USER_EMAIL;
const password = process.env.SAMPLE_USER_PASSWORD;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!email || !password || !supabaseUrl || !supabaseKey) {
  throw new Error('Missing SAMPLE_USER_EMAIL, SAMPLE_USER_PASSWORD, VITE_SUPABASE_URL, or VITE_SUPABASE_PUBLISHABLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const today = '2026-05-02';
const month = '2026-05';
const marker = `Audit Sample ${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
const report = [];

function missingColumn(error) {
  const text = `${error?.message || ''} ${error?.details || ''}`;
  const quoted = text.match(/'([^']+)' column|column "([^"]+)"/i);
  if (quoted) return quoted[1] || quoted[2];
  const bare = text.match(/column ([a-zA-Z0-9_]+) does not exist/i);
  return bare?.[1];
}

async function insertOne(table, payload, label = table) {
  let current = { ...payload };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabase.from(table).insert(current).select().single();
    if (!error) {
      report.push({ label, table, status: 'created', id: data.id });
      return data;
    }

    const column = missingColumn(error);
    if (column && Object.prototype.hasOwnProperty.call(current, column)) {
      delete current[column];
      continue;
    }

    report.push({ label, table, status: 'failed', message: error.message });
    return null;
  }

  report.push({ label, table, status: 'failed', message: 'too many missing-column retries' });
  return null;
}

async function upsertOne(table, payload, onConflict, label = table) {
  let current = { ...payload };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data, error } = await supabase.from(table).upsert(current, { onConflict }).select().single();
    if (!error) {
      report.push({ label, table, status: 'upserted', id: data.id });
      return data;
    }

    const column = missingColumn(error);
    if (column && Object.prototype.hasOwnProperty.call(current, column)) {
      delete current[column];
      continue;
    }

    report.push({ label, table, status: 'failed', message: error.message });
    return null;
  }

  report.push({ label, table, status: 'failed', message: 'too many missing-column retries' });
  return null;
}

async function ensureCategory(userId, name, type, icon, color) {
  const { data: existing } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId)
    .eq('name', name)
    .eq('type', type)
    .maybeSingle();
  if (existing) return existing;

  return insertOne('categories', { user_id: userId, name, type, icon, color, is_default: false }, `Category: ${name}`);
}

const { data: auth, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
if (signInError) throw signInError;

const userId = auth.user.id;

await upsertOne(
  'profiles',
  {
    user_id: userId,
    full_name: 'Pankara Dithya Audit User',
    phone: '+91 98765 43210',
    avatar_url: null,
  },
  'user_id',
  'Profile',
);

const salaryCategory = await ensureCategory(userId, `${marker} Salary`, 'income', 'Rs', '#16A34A');
const foodCategory = await ensureCategory(userId, `${marker} Food`, 'expense', 'Fd', '#F97316');
const utilityCategory = await ensureCategory(userId, `${marker} Utilities`, 'expense', 'Ut', '#2563EB');
/** Required for transfer rows when category_id is NOT NULL (post-20260503). */
const transferCategory = await ensureCategory(userId, 'Transfer', 'expense', 'Tf', '#2563EB');

const bank = await insertOne('accounts', {
  user_id: userId,
  name: `${marker} Main Bank`,
  type: 'bank',
  balance: 25000,
  initial_balance: 25000,
  color: '#10B981',
  icon: 'Bank',
  is_active: true,
}, 'Account: Main Bank');

const wallet = await insertOne('accounts', {
  user_id: userId,
  name: `${marker} Cash Wallet`,
  type: 'cash',
  balance: 3500,
  initial_balance: 3500,
  color: '#F59E0B',
  icon: 'Cash',
  is_active: true,
}, 'Account: Cash Wallet');

if (bank && wallet) {
  await insertOne('transactions', {
    user_id: userId,
    account_id: bank.id,
    type: 'credit',
    amount: 75000,
    category_id: salaryCategory?.id,
    category: salaryCategory?.name || 'Salary',
    description: `${marker} monthly salary credit`,
    payment_mode: 'Bank Transfer',
    transaction_date: today,
    source_module: 'manual',
    reference_id: null,
    spending_type: null,
  }, 'Transaction: income');

  await insertOne('transactions', {
    user_id: userId,
    account_id: wallet.id,
    type: 'debit',
    amount: 1250,
    category_id: foodCategory?.id,
    category: foodCategory?.name || 'Food',
    description: `${marker} grocery and dinner expense`,
    payment_mode: 'UPI',
    transaction_date: today,
    source_module: 'manual',
    reference_id: null,
    spending_type: 'self',
  }, 'Transaction: self expense');

  await insertOne('transactions', {
    user_id: userId,
    account_id: bank.id,
    type: 'debit',
    amount: 3200,
    category_id: utilityCategory?.id,
    category: utilityCategory?.name || 'Utilities',
    description: `${marker} electricity and internet`,
    payment_mode: 'Card',
    transaction_date: today,
    source_module: 'manual',
    reference_id: null,
    spending_type: 'family',
  }, 'Transaction: family expense');

  await insertOne('transactions', {
    user_id: userId,
    account_id: bank.id,
    to_account_id: wallet.id,
    type: 'transfer',
    amount: 5000,
    category_id: transferCategory?.id,
    category: transferCategory?.name || 'Transfer',
    description: `${marker} ATM cash transfer`,
    payment_mode: 'Internal Transfer',
    transaction_date: today,
    source_module: 'manual',
    reference_id: null,
    spending_type: null,
  }, 'Transaction: transfer');
}

await insertOne('budgets', {
  user_id: userId,
  category_id: foodCategory?.id,
  category: foodCategory?.name || 'Food',
  amount: 15000,
  month: 5,
  year: 2026,
  carry_forward: true,
  rollover_amount: 1200,
  color: '#F97316',
}, 'Budget: food');

const savingsGoal = await insertOne('savings_goals', {
  user_id: userId,
  name: `${marker} Emergency Fund`,
  target_amount: 200000,
  current_amount: 65000,
  deadline: '2026-12-31',
  account_id: bank?.id,
  color: '#EC4899',
  icon: 'Safe',
  is_completed: false,
}, 'Savings goal');

const emi = await insertOne('emis', {
  user_id: userId,
  name: `${marker} Laptop EMI`,
  principal_amount: 120000,
  interest_rate: 10.5,
  total_months: 12,
  emi_amount: 10550,
  start_date: '2026-05-01',
  due_day: 7,
  notes: `${marker} test EMI details`,
  is_active: true,
}, 'EMI');

if (emi) {
  await insertOne('emi_payments', {
    user_id: userId,
    emi_id: emi.id,
    month_number: 1,
    due_date: '2026-05-07',
    paid_date: null,
    is_paid: false,
    principal_component: 9550,
    interest_component: 1000,
    transaction_id: null,
  }, 'EMI payment');
}

const bill = await insertOne('bills', {
  user_id: userId,
  name: `${marker} Broadband Bill`,
  provider: 'FiberNet Sample',
  amount: 1499,
  due_date: '2026-05-10',
  billing_cycle: 'monthly',
  is_recurring: true,
  reminder_days_before: 3,
  last_paid_date: '2026-04-10',
  is_paid: false,
  notes: `${marker} bill note`,
  icon: 'Bill',
  color: '#F59E0B',
}, 'Bill');

if (bill) {
  await insertOne('bill_payment_history', {
    user_id: userId,
    bill_id: bill.id,
    paid_date: '2026-04-10',
    amount: 1499,
    notes: `${marker} previous bill payment`,
  }, 'Bill payment history');
}

const product = await insertOne('product_usage', {
  user_id: userId,
  name: `${marker} Coffee Beans`,
  category: 'groceries',
  last_purchase_date: '2026-04-25',
  quantity: 1,
  unit: 'kg',
  cost: 850,
  estimated_days: 30,
  actual_days: 28,
  notes: `${marker} product usage note`,
  icon: 'Coffee',
  color: '#10B981',
}, 'Product usage');

if (product) {
  await insertOne('product_purchase_history', {
    user_id: userId,
    product_id: product.id,
    purchase_date: '2026-04-25',
    quantity: 1,
    unit: 'kg',
    cost: 850,
    days_lasted: 28,
    notes: `${marker} purchase history note`,
  }, 'Product purchase history');
}

const habit = await insertOne('habits', {
  user_id: userId,
  name: `${marker} Morning Walk`,
  description: `${marker} habit description`,
  category: 'health',
  frequency: 'daily',
  target_count: 1,
  color: '#8B5CF6',
  icon: 'Walk',
  is_active: true,
}, 'Habit');

if (habit) {
  await insertOne('habit_logs', {
    user_id: userId,
    habit_id: habit.id,
    completed_at: today,
    count: 1,
    notes: `${marker} completed habit note`,
  }, 'Habit log');
}

const goal = await insertOne('goals', {
  user_id: userId,
  title: `${marker} Learn TypeScript`,
  description: `${marker} goal description`,
  category: 'learning',
  target_date: '2026-08-31',
  is_completed: false,
  progress: 45,
  color: '#8B5CF6',
  icon: 'Goal',
}, 'Goal');

if (goal) {
  await insertOne('goal_updates', {
    user_id: userId,
    goal_id: goal.id,
    update_date: today,
    note: `${marker} goal update note`,
    progress_value: 45,
  }, 'Goal update');

  await insertOne('goal_milestones', {
    user_id: userId,
    goal_id: goal.id,
    title: `${marker} finish generics module`,
    is_completed: true,
  }, 'Goal milestone');
}

await insertOne('notes', {
  user_id: userId,
  title: `${marker} Planning Note`,
  content: `${marker} note body with tags, pinned state, and date.`,
  note_date: today,
  tags: ['audit', 'sample', 'finance'],
  color: '#6366F1',
  is_pinned: true,
}, 'Note');

await insertOne('reminders', {
  user_id: userId,
  title: `${marker} Call accountant`,
  description: `${marker} reminder description`,
  reminder_date: '2026-05-04',
  reminder_time: '10:30',
  type: 'custom',
  is_recurring: true,
  recurring_frequency: 'monthly',
  is_completed: false,
  color: '#F97316',
}, 'Reminder');

await insertOne('calendar_events', {
  user_id: userId,
  title: `${marker} Budget Review`,
  description: `${marker} calendar event description`,
  event_date: '2026-05-05',
  event_type: 'plan',
  color: '#8B5CF6',
  all_day: false,
  start_time: '18:00',
  end_time: '19:00',
}, 'Calendar event');

await upsertOne('debt_tracker', {
  user_id: userId,
  month,
  opening_balance: 50000,
  paid_amount: 8000,
  borrowed_amount: 3000,
  closing_balance: 45000,
}, 'user_id,month', 'Debt tracker');

await upsertOne('monthly_plan', {
  user_id: userId,
  month,
  total_income: 75000,
  allocated_self: 18000,
  allocated_family: 22000,
  allocated_debt: 8000,
  remaining_balance: 27000,
}, 'user_id,month', 'Monthly plan');

const { error: vaultError } = await supabase.rpc('save_password', {
  vault_key: process.env.SAMPLE_VAULT_KEY || 'AuditSampleVaultKey2026',
  entry_title: `${marker} Demo Login`,
  entry_username: 'sample-login@example.com',
  entry_password: 'SamplePassword#2026',
  entry_url: 'https://example.com',
  entry_notes: `${marker} encrypted vault sample`,
});
report.push({
  label: 'Vault encrypted password',
  table: 'passwords',
  status: vaultError ? 'skipped' : 'created',
  message: vaultError?.message,
});

console.log(JSON.stringify({ userId, marker, report }, null, 2));
