import React, { useEffect, useState, useCallback } from 'react';

// ─── Icons ───────────────────────────────────────────────────────────────────
const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const JobIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);
const CustomerIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const InvoiceIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);
const EstimateIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);
const DollarIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface Job {
  id: string;
  work_status: string;
  customer?: { first_name?: string; last_name?: string; email?: string };
  address?: { street?: string; city?: string; state?: string; zip?: string };
  scheduled_start?: string;
  scheduled_end?: string;
  invoice?: { total_amount_cents?: number };
  assigned_employees?: { id: string; first_name?: string; last_name?: string }[];
  notes?: string;
  tags?: string[];
}

interface Customer {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile_number?: string;
  home_number?: string;
  company?: string;
  created_at?: string;
  addresses?: { street?: string; city?: string; state?: string }[];
}

interface Invoice {
  id: string;
  number?: string;
  status?: string;
  total_amount_cents?: number;
  balance_due_cents?: number;
  created_at?: string;
  customer?: { first_name?: string; last_name?: string };
  job_id?: string;
}

interface Estimate {
  id: string;
  number?: string;
  status?: string;
  total_amount_cents?: number;
  created_at?: string;
  customer?: { first_name?: string; last_name?: string };
}

type Tab = 'overview' | 'jobs' | 'customers' | 'invoices' | 'estimates';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt$ = (cents?: number) =>
  cents != null ? `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—';

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtTime = (iso?: string) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const statusColor = (status?: string) => {
  const s = (status || '').toLowerCase();
  if (s.includes('complete') || s.includes('paid')) return 'bg-green-100 text-green-800';
  if (s.includes('progress') || s.includes('in_progress')) return 'bg-blue-100 text-blue-800';
  if (s.includes('scheduled') || s.includes('pending')) return 'bg-yellow-100 text-yellow-800';
  if (s.includes('cancel')) return 'bg-red-100 text-red-800';
  if (s.includes('dispatch')) return 'bg-purple-100 text-purple-800';
  return 'bg-gray-100 text-gray-700';
};

// ─── Components ───────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4">
      <div className={`${color} rounded-lg p-2.5 shrink-0`}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Badge({ status }: { status?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor(status)}`}>
      {(status || 'unknown').replace(/_/g, ' ')}
    </span>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || 'Search…'}
        className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [error, setError] = useState<string | null>(null);

  const [jobSearch, setJobSearch] = useState('');
  const [jobStatusFilter, setJobStatusFilter] = useState('all');
  const [customerSearch, setCustomerSearch] = useState('');
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState('all');
  const [estimateSearch, setEstimateSearch] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [jobsRes, customersRes, invoicesRes, estimatesRes] = await Promise.all([
        fetch('/api/housecallpro/jobs?page_size=100&sort_direction=desc'),
        fetch('/api/housecallpro/customers?page_size=100&sort_direction=desc'),
        fetch('/api/housecallpro/invoices?page_size=100&sort_direction=desc'),
        fetch('/api/housecallpro/estimates?page_size=100&sort_direction=desc'),
      ]);

      const [jobsData, customersData, invoicesData, estimatesData] = await Promise.all([
        jobsRes.json(),
        customersRes.json(),
        invoicesRes.json(),
        estimatesRes.json(),
      ]);

      setJobs(jobsData.jobs || jobsData.results || []);
      setCustomers(customersData.customers || customersData.results || []);
      setInvoices(invoicesData.invoices || invoicesData.results || []);
      setEstimates(estimatesData.estimates || estimatesData.results || []);
      setLastRefresh(new Date());
    } catch (e) {
      setError('Failed to load data. Check your API key configuration.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, [fetchAll]);

  // ── Derived stats ──
  const today = new Date().toDateString();
  const todayJobs = jobs.filter(j => j.scheduled_start && new Date(j.scheduled_start).toDateString() === today);
  const openInvoices = invoices.filter(i => (i.status || '').toLowerCase() !== 'paid');
  const openInvoiceTotal = openInvoices.reduce((s, i) => s + (i.balance_due_cents || 0), 0);
  const todayRevenue = invoices
    .filter(i => i.created_at && new Date(i.created_at).toDateString() === today)
    .reduce((s, i) => s + (i.total_amount_cents || 0), 0);
  const pendingEstimates = estimates.filter(e => (e.status || '').toLowerCase() === 'pending');

  // ── Filtered lists ──
  const filteredJobs = jobs.filter(j => {
    const name = `${j.customer?.first_name} ${j.customer?.last_name}`.toLowerCase();
    const addr = `${j.address?.street} ${j.address?.city}`.toLowerCase();
    const matchesSearch = !jobSearch || name.includes(jobSearch.toLowerCase()) || addr.includes(jobSearch.toLowerCase());
    const matchesStatus = jobStatusFilter === 'all' || (j.work_status || '').toLowerCase().includes(jobStatusFilter);
    return matchesSearch && matchesStatus;
  });

  const filteredCustomers = customers.filter(c => {
    const name = `${c.first_name} ${c.last_name} ${c.email} ${c.company}`.toLowerCase();
    return !customerSearch || name.includes(customerSearch.toLowerCase());
  });

  const filteredInvoices = invoices.filter(i => {
    const name = `${i.customer?.first_name} ${i.customer?.last_name} ${i.number}`.toLowerCase();
    const matchesSearch = !invoiceSearch || name.includes(invoiceSearch.toLowerCase());
    const matchesStatus = invoiceStatusFilter === 'all' || (i.status || '').toLowerCase() === invoiceStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredEstimates = estimates.filter(e => {
    const name = `${e.customer?.first_name} ${e.customer?.last_name} ${e.number}`.toLowerCase();
    return !estimateSearch || name.includes(estimateSearch.toLowerCase());
  });

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'jobs', label: `Jobs (${jobs.length})` },
    { id: 'customers', label: `Customers (${customers.length})` },
    { id: 'invoices', label: `Invoices (${invoices.length})` },
    { id: 'estimates', label: `Estimates (${estimates.length})` },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Housecall Pro Dashboard</h1>
              <p className="text-xs text-gray-400">
                Last updated {lastRefresh.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            <span className={loading ? 'animate-spin' : ''}><RefreshIcon /></span>
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading && jobs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center text-gray-400">
              <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
              <p className="text-sm">Loading data from Housecall Pro…</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── OVERVIEW ── */}
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <StatCard icon={<JobIcon />} label="Today's Jobs" value={todayJobs.length} sub={`of ${jobs.length} total`} color="bg-blue-50 text-blue-600" />
                  <StatCard icon={<CustomerIcon />} label="Customers" value={customers.length} color="bg-purple-50 text-purple-600" />
                  <StatCard icon={<InvoiceIcon />} label="Open Invoices" value={openInvoices.length} sub={fmt$(openInvoiceTotal)} color="bg-orange-50 text-orange-600" />
                  <StatCard icon={<EstimateIcon />} label="Pending Estimates" value={pendingEstimates.length} color="bg-yellow-50 text-yellow-600" />
                  <StatCard icon={<DollarIcon />} label="Today's Revenue" value={fmt$(todayRevenue)} color="bg-green-50 text-green-600" />
                </div>

                {/* Today's Jobs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h2 className="font-semibold text-gray-900">Today's Schedule</h2>
                  </div>
                  {todayJobs.length === 0 ? (
                    <p className="text-gray-400 text-sm px-6 py-8 text-center">No jobs scheduled for today</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {todayJobs.map(job => (
                        <div key={job.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {job.customer?.first_name} {job.customer?.last_name}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {job.address?.street}, {job.address?.city} · {fmtTime(job.scheduled_start)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            {job.assigned_employees?.map(e => (
                              <span key={e.id} className="text-xs text-gray-500">{e.first_name} {e.last_name}</span>
                            ))}
                            <Badge status={job.work_status} />
                            {job.invoice?.total_amount_cents != null && (
                              <span className="text-sm font-semibold text-gray-700">{fmt$(job.invoice.total_amount_cents)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent invoices & estimates side by side */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h2 className="font-semibold text-gray-900">Outstanding Invoices</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {openInvoices.slice(0, 5).map(inv => (
                        <div key={inv.id} className="px-6 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{inv.customer?.first_name} {inv.customer?.last_name}</p>
                            <p className="text-xs text-gray-400">#{inv.number} · {fmtDate(inv.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge status={inv.status} />
                            <span className="text-sm font-semibold text-red-600">{fmt$(inv.balance_due_cents)}</span>
                          </div>
                        </div>
                      ))}
                      {openInvoices.length === 0 && <p className="text-gray-400 text-sm px-6 py-4 text-center">All paid up!</p>}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h2 className="font-semibold text-gray-900">Recent Estimates</h2>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {estimates.slice(0, 5).map(est => (
                        <div key={est.id} className="px-6 py-3 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{est.customer?.first_name} {est.customer?.last_name}</p>
                            <p className="text-xs text-gray-400">#{est.number} · {fmtDate(est.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge status={est.status} />
                            <span className="text-sm font-semibold text-gray-700">{fmt$(est.total_amount_cents)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── JOBS ── */}
            {tab === 'jobs' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                  <SearchInput value={jobSearch} onChange={setJobSearch} placeholder="Search jobs…" />
                  <select
                    value={jobStatusFilter}
                    onChange={e => setJobStatusFilter(e.target.value)}
                    className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Statuses</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="in_progress">In Progress</option>
                    <option value="complete">Complete</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <span className="text-sm text-gray-400 ml-auto">{filteredJobs.length} jobs</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-6 py-3">Customer</th>
                        <th className="px-6 py-3">Address</th>
                        <th className="px-6 py-3">Scheduled</th>
                        <th className="px-6 py-3">Technician</th>
                        <th className="px-6 py-3">Status</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredJobs.map(job => (
                        <tr key={job.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">
                            {job.customer?.first_name} {job.customer?.last_name}
                            {job.customer?.email && <div className="text-xs text-gray-400 font-normal">{job.customer.email}</div>}
                          </td>
                          <td className="px-6 py-3 text-gray-600">
                            {job.address?.street && <div>{job.address.street}</div>}
                            <div className="text-xs text-gray-400">{job.address?.city}{job.address?.state ? `, ${job.address.state}` : ''}</div>
                          </td>
                          <td className="px-6 py-3 text-gray-600 whitespace-nowrap">
                            {fmtDate(job.scheduled_start)}
                            {job.scheduled_start && <div className="text-xs text-gray-400">{fmtTime(job.scheduled_start)}</div>}
                          </td>
                          <td className="px-6 py-3 text-gray-600">
                            {job.assigned_employees?.map(e => `${e.first_name} ${e.last_name}`).join(', ') || '—'}
                          </td>
                          <td className="px-6 py-3"><Badge status={job.work_status} /></td>
                          <td className="px-6 py-3 text-right font-semibold text-gray-700">{fmt$(job.invoice?.total_amount_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredJobs.length === 0 && <p className="text-center text-gray-400 text-sm py-10">No jobs found</p>}
                </div>
              </div>
            )}

            {/* ── CUSTOMERS ── */}
            {tab === 'customers' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                  <SearchInput value={customerSearch} onChange={setCustomerSearch} placeholder="Search customers…" />
                  <span className="text-sm text-gray-400 ml-auto">{filteredCustomers.length} customers</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                        <th className="px-6 py-3">Name</th>
                        <th className="px-6 py-3">Company</th>
                        <th className="px-6 py-3">Contact</th>
                        <th className="px-6 py-3">Address</th>
                        <th className="px-6 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredCustomers.map(c => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-6 py-3 font-medium text-gray-900">{c.first_name} {c.last_name}</td>
                          <td className="px-6 py-3 text-gray-600">{c.company || '—'}</td>
                          <td className="px-6 py-3 text-gray-600">
                            {c.email && <div>{c.email}</div>}
                            <div className="text-xs text-gray-400">{c.mobile_number || c.home_number || ''}</div>
                          </td>
                          <td className="px-6 py-3 text-gray-600">
                            {c.addresses?.[0] ? `${c.addresses[0].street}, ${c.addresses[0].city}` : '—'}
                          </td>
                          <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{fmtDate(c.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredCustomers.length === 0 && <p className="text-center text-gray-400 text-sm py-10">No customers found</p>}
                </div>
              </div>
            )}

            {/* ── INVOICES ── */}
            {tab === 'invoices' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <StatCard icon={<InvoiceIcon />} label="Total Invoices" value={invoices.length} color="bg-blue-50 text-blue-600" />
                  <StatCard icon={<DollarIcon />} label="Outstanding Balance" value={fmt$(openInvoiceTotal)} color="bg-red-50 text-red-600" />
                  <StatCard icon={<DollarIcon />} label="Total Invoiced" value={fmt$(invoices.reduce((s, i) => s + (i.total_amount_cents || 0), 0))} color="bg-green-50 text-green-600" />
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap">
                    <SearchInput value={invoiceSearch} onChange={setInvoiceSearch} placeholder="Search invoices…" />
                    <select
                      value={invoiceStatusFilter}
                      onChange={e => setInvoiceStatusFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="paid">Paid</option>
                      <option value="pending">Pending</option>
                      <option value="past_due">Past Due</option>
                    </select>
                    <span className="text-sm text-gray-400 ml-auto">{filteredInvoices.length} invoices</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-6 py-3">Invoice #</th>
                          <th className="px-6 py-3">Customer</th>
                          <th className="px-6 py-3">Date</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Total</th>
                          <th className="px-6 py-3 text-right">Balance Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredInvoices.map(inv => (
                          <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 font-mono text-gray-600">#{inv.number || inv.id.slice(0, 8)}</td>
                            <td className="px-6 py-3 font-medium text-gray-900">{inv.customer?.first_name} {inv.customer?.last_name}</td>
                            <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{fmtDate(inv.created_at)}</td>
                            <td className="px-6 py-3"><Badge status={inv.status} /></td>
                            <td className="px-6 py-3 text-right font-semibold text-gray-700">{fmt$(inv.total_amount_cents)}</td>
                            <td className="px-6 py-3 text-right font-semibold text-red-600">
                              {(inv.balance_due_cents || 0) > 0 ? fmt$(inv.balance_due_cents) : <span className="text-green-600">Paid</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredInvoices.length === 0 && <p className="text-center text-gray-400 text-sm py-10">No invoices found</p>}
                  </div>
                </div>
              </div>
            )}

            {/* ── ESTIMATES ── */}
            {tab === 'estimates' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <StatCard icon={<EstimateIcon />} label="Total Estimates" value={estimates.length} color="bg-blue-50 text-blue-600" />
                  <StatCard icon={<EstimateIcon />} label="Pending" value={pendingEstimates.length} color="bg-yellow-50 text-yellow-600" />
                  <StatCard icon={<DollarIcon />} label="Estimated Value" value={fmt$(estimates.reduce((s, e) => s + (e.total_amount_cents || 0), 0))} color="bg-green-50 text-green-600" />
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                    <SearchInput value={estimateSearch} onChange={setEstimateSearch} placeholder="Search estimates…" />
                    <span className="text-sm text-gray-400 ml-auto">{filteredEstimates.length} estimates</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-6 py-3">Estimate #</th>
                          <th className="px-6 py-3">Customer</th>
                          <th className="px-6 py-3">Date</th>
                          <th className="px-6 py-3">Status</th>
                          <th className="px-6 py-3 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredEstimates.map(est => (
                          <tr key={est.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 font-mono text-gray-600">#{est.number || est.id.slice(0, 8)}</td>
                            <td className="px-6 py-3 font-medium text-gray-900">{est.customer?.first_name} {est.customer?.last_name}</td>
                            <td className="px-6 py-3 text-gray-500 whitespace-nowrap">{fmtDate(est.created_at)}</td>
                            <td className="px-6 py-3"><Badge status={est.status} /></td>
                            <td className="px-6 py-3 text-right font-semibold text-gray-700">{fmt$(est.total_amount_cents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredEstimates.length === 0 && <p className="text-center text-gray-400 text-sm py-10">No estimates found</p>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
