import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

function loadEnvFile() {
  try {
    const text = readFileSync('.env', 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=["']?(.*?)["']?$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // Allow CI/local shells to provide env vars without a .env file.
  }
}

loadEnvFile();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SAMPLE_USER_EMAIL;
const password = process.env.SAMPLE_USER_PASSWORD;

if (!supabaseUrl || !serviceRoleKey || !email || !password) {
  throw new Error(
    'Missing VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SAMPLE_USER_EMAIL, or SAMPLE_USER_PASSWORD',
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const childTables = [
  'habit_logs',
  'goal_updates',
  'goal_milestones',
  'emi_payments',
  'bill_payment_history',
  'product_purchase_history',
  'goal_contributions',
  'transactions',
];

const parentTables = [
  'passwords',
  'budgets',
  'monthly_plan',
  'debt_tracker',
  'bills',
  'product_usage',
  'emis',
  'savings_goals',
  'accounts',
  'categories',
  'habits',
  'goals',
  'notes',
  'reminders',
  'calendar_events',
  'profiles',
];

const today = '2026-05-03';
const month = '2026-05';
const marker = `Fresh Seed ${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
const report = [];

async function deleteTable(table) {
  const { error } = await supabase.from(table).delete().not('id', 'is', null);
  if (error && !/does not exist|Could not find the table/i.test(error.message)) throw new Error(`${table}: ${error.message}`);
  report.push({ table, status: error ? 'skipped' : 'cleared' });
}

async function clearPublicData() {
  for (const table of childTables) await deleteTable(table);
  for (const table of parentTables) await deleteTable(table);
}

async function clearAuthUsers() {
  let page = 1;
  const perPage = 1000;
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const user of data.users) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      if (deleteError) throw deleteError;
    }
    if (data.users.length < perPage) break;
    page += 1;
  }
  report.push({ table: 'auth.users', status: 'cleared' });
}

function missingColumn(error) {
  const text = `${error?.message || ''} ${error?.details || ''}`;
  const quoted = text.match(/'([^']+)' column|column "([^"]+)"/i);
  if (quoted) return quoted[1] || quoted[2];
  const bare = text.match(/column ([a-zA-Z0-9_]+) does not exist/i);
  return bare?.[1];
}

async function insertOne(table, payload, label = table) {
  let current = { ...payload };
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { data, error } = await supabase.from(table).insert(current).select().single();
    if (!error) {
      report.push({ table, label, status: 'created', id: data.id });
      return data;
    }

    const column = missingColumn(error);
    if (column && Object.prototype.hasOwnProperty.call(current, column)) {
      delete current[column];
      report.push({ table, label, status: 'dropped_missing_column', column });
      continue;
    }

    throw new Error(`${label}: ${error.message}`);
  }

  throw new Error(`${label}: too many missing-column retries`);
}

async function upsertOne(table, payload, onConflict, label = table) {
  let current = { ...payload };
  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { data, error } = await supabase.from(table).upsert(current, { onConflict }).select().single();
    if (!error) {
      report.push({ table, label, status: 'upserted', id: data.id });
      return data;
    }

    const column = missingColumn(error);
    if (column && Object.prototype.hasOwnProperty.call(current, column)) {
      delete current[column];
      report.push({ table, label, status: 'dropped_missing_column', column });
      continue;
    }

    throw new Error(`${label}: ${error.message}`);
  }

  throw new Error(`${label}: too many missing-column retries`);
}

async function createSeedUser() {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'Fresh Finance User' },
  });
  if (error) throw error;
  report.push({ table: 'auth.users', label: 'Sample user', status: 'created', id: data.user.id });
  return data.user.id;
}

async function seed(userId) {
  await upsertOne(
    'profiles',
    { user_id: userId, full_name: 'Fresh Finance User', avatar_url: null, currency: 'INR', daily_spending_limit: 1500 },
    'user_id',
    'Profile',
  );

  const salaryCategory = await insertOne('categories', { user_id: userId, name: 'Salary', type: 'income', icon: 'Rs', color: '#16A34A', is_default: true }, 'Salary category');
  const foodCategory = await insertOne('categories', { user_id: userId, name: 'Food', type: 'expense', icon: 'Fd', color: '#F97316', is_default: true }, 'Food category');
  const transferCategory = await insertOne('categories', { user_id: userId, name: 'Transfer', type: 'expense', icon: 'Tf', color: '#2563EB', is_default: true }, 'Transfer category');

  const bank = await insertOne('accounts', {
    user_id: userId,
    name: 'Main Bank',
    type: 'bank',
    balance: 25000,
    initial_balance: 25000,
    opening_balance: 25000,
    color: '#10B981',
    icon: 'Bank',
    is_active: true,
  }, 'Main bank account');

  const wallet = await insertOne('accounts', {
    user_id: userId,
    name: 'Cash Wallet',
    type: 'cash',
    balance: 3500,
    initial_balance: 3500,
    opening_balance: 3500,
    color: '#F59E0B',
    icon: 'Cash',
    is_active: true,
  }, 'Cash wallet account');

  await insertOne('transactions', {
    user_id: userId,
    account_id: bank.id,
    type: 'credit',
    amount: 75000,
    category_id: salaryCategory.id,
    category: salaryCategory.name,
    description: `${marker} salary credit`,
    payment_mode: 'Bank Transfer',
    transaction_date: today,
    source_module: 'manual',
  }, 'Income transaction');

  await insertOne('transactions', {
    user_id: userId,
    account_id: wallet.id,
    type: 'debit',
    amount: 1250,
    category_id: foodCategory.id,
    category: foodCategory.name,
    description: `${marker} grocery expense`,
    payment_mode: 'UPI',
    transaction_date: today,
    source_module: 'manual',
    spending_type: 'self',
  }, 'Expense transaction');

  await insertOne('transactions', {
    user_id: userId,
    account_id: bank.id,
    to_account_id: wallet.id,
    type: 'transfer',
    amount: 5000,
    category_id: transferCategory.id,
    category: transferCategory.name,
    description: `${marker} cash transfer`,
    payment_mode: 'Internal Transfer',
    transaction_date: today,
    source_module: 'manual',
  }, 'Transfer transaction');

  await insertOne('budgets', {
    user_id: userId,
    category_id: foodCategory.id,
    category: foodCategory.name,
    amount: 15000,
    month: 5,
    year: 2026,
    carry_forward: true,
    rollover_amount: 1200,
    color: '#F97316',
  }, 'Food budget');

  const savingsGoal = await insertOne('savings_goals', {
    user_id: userId,
    name: 'Emergency Fund',
    target_amount: 200000,
    current_amount: 65000,
    deadline: '2026-12-31',
    account_id: bank.id,
    color: '#EC4899',
    icon: 'Safe',
    is_completed: false,
  }, 'Savings goal');

  await insertOne('goal_contributions', {
    user_id: userId,
    goal_id: savingsGoal.id,
    amount: 5000,
  }, 'Goal contribution');

  const emi = await insertOne('emis', {
    user_id: userId,
    account_id: bank.id,
    name: 'Laptop EMI',
    principal_amount: 120000,
    total_amount: 120000,
    interest_rate: 10.5,
    total_months: 12,
    tenure_months: 12,
    emi_amount: 10550,
    monthly_amount: 10550,
    start_date: '2026-05-01',
    due_day: 7,
    next_due_date: '2026-05-07',
    notes: `${marker} EMI`,
    is_active: true,
  }, 'EMI');

  await insertOne('emi_payments', {
    user_id: userId,
    emi_id: emi.id,
    month_number: 1,
    due_date: '2026-05-07',
    is_paid: false,
    principal_component: 9550,
    interest_component: 1000,
    status: 'pending',
  }, 'EMI payment');

  const bill = await insertOne('bills', {
    user_id: userId,
    name: 'Broadband Bill',
    provider: 'FiberNet Sample',
    amount: 1499,
    due_date: '2026-05-10',
    billing_cycle: 'monthly',
    is_recurring: true,
    recurring: true,
    reminder_days_before: 3,
    is_paid: false,
    status: 'pending',
    notes: `${marker} bill`,
    icon: 'Bill',
    color: '#F59E0B',
  }, 'Bill');

  await insertOne('bill_payment_history', {
    user_id: userId,
    bill_id: bill.id,
    paid_date: '2026-04-10',
    amount: 1499,
    notes: `${marker} previous bill payment`,
  }, 'Bill payment history');

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

  await insertOne('habits', {
    user_id: userId,
    name: 'Morning Walk',
    description: `${marker} habit`,
    category: 'health',
    frequency: 'daily',
    target_count: 1,
    color: '#8B5CF6',
    icon: 'Walk',
    is_active: true,
  }, 'Habit');

  await insertOne('notes', {
    user_id: userId,
    title: 'Planning Note',
    content: `${marker} note body`,
    note_date: today,
    tags: ['fresh', 'seed'],
    color: '#6366F1',
    is_pinned: true,
  }, 'Note');

  await insertOne('reminders', {
    user_id: userId,
    title: 'Call accountant',
    description: `${marker} reminder`,
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
    title: 'Budget Review',
    description: `${marker} event`,
    event_date: '2026-05-05',
    event_type: 'plan',
    color: '#8B5CF6',
    all_day: false,
    start_time: '18:00',
    end_time: '19:00',
  }, 'Calendar event');
}

await clearPublicData();
await clearAuthUsers();
const userId = await createSeedUser();
await seed(userId);

console.log(JSON.stringify({ userId, marker, report }, null, 2));
