import type {
  Customer,
  HcpAddress,
  HcpCustomer,
  HcpJob,
  HcpWorkStatus,
  Job,
  JobStatus,
  PostalAddress,
} from '@/types';

/**
 * Housecall Pro's `work_status` strings, folded into our five states. Upstream
 * uses spaces and splits "complete" by whether the customer rated the job —
 * a distinction that means nothing to a tech standing in an attic.
 */
const STATUS_MAP: Record<string, JobStatus> = {
  unscheduled: 'unscheduled',
  'needs scheduling': 'unscheduled',
  scheduled: 'scheduled',
  'in progress': 'in_progress',
  'complete unrated': 'completed',
  'complete rated': 'completed',
  'user canceled': 'canceled',
  'pro canceled': 'canceled',
  canceled: 'canceled',
};

export function mapWorkStatus(raw: HcpWorkStatus): JobStatus {
  return STATUS_MAP[raw.toLowerCase().replace(/_/g, ' ')] ?? 'unknown';
}

function formatAddress(address: HcpAddress): string {
  const line1 = [address.street, address.street_line_2].filter(Boolean).join(' ');
  const cityState = [address.city, address.state].filter(Boolean).join(', ');
  return [line1, cityState, address.zip].filter((part) => part && part.length > 0).join(', ');
}

export function mapAddress(address?: HcpAddress | null): PostalAddress | undefined {
  if (!address) return undefined;
  const formatted = formatAddress(address);
  if (!formatted) return undefined;
  return {
    street: address.street ?? undefined,
    street2: address.street_line_2 ?? undefined,
    city: address.city ?? undefined,
    state: address.state ?? undefined,
    zip: address.zip ?? undefined,
    formatted,
  };
}

/**
 * Falls back through name → company → id so a card never renders blank. A
 * nameless customer still has to be tappable.
 */
export function customerDisplayName(customer: HcpCustomer): string {
  const person = [customer.first_name, customer.last_name].filter(Boolean).join(' ').trim();
  if (person) return person;
  if (customer.company) return customer.company;
  return `Customer ${customer.id.slice(0, 8)}`;
}

export function mapCustomer(customer: HcpCustomer): Customer {
  // Addresses arrive as a list; the first is the service address in practice.
  const primaryAddress = customer.addresses?.[0];
  return {
    id: customer.id,
    displayName: customerDisplayName(customer),
    firstName: customer.first_name ?? undefined,
    lastName: customer.last_name ?? undefined,
    company: customer.company ?? undefined,
    email: customer.email ?? undefined,
    phone: customer.mobile_number ?? customer.home_number ?? customer.work_number ?? undefined,
    address: mapAddress(primaryAddress),
    tags: customer.tags ?? [],
    notes: customer.notes ?? undefined,
    updatedAt: customer.updated_at,
  };
}

export function mapJob(job: HcpJob): Job {
  const employees = job.assigned_employees ?? [];
  return {
    id: job.id,
    reference: job.invoice_number?.trim() || `#${job.id.slice(0, 8)}`,
    description: job.description ?? undefined,
    status: mapWorkStatus(job.work_status),
    rawStatus: job.work_status,
    customerId: job.customer?.id,
    customerName: job.customer ? customerDisplayName(job.customer) : undefined,
    address: mapAddress(job.address ?? job.customer?.addresses?.[0]),
    scheduledStart: job.schedule?.scheduled_start ?? undefined,
    scheduledEnd: job.schedule?.scheduled_end ?? undefined,
    jobType: job.job_fields?.job_type?.name ?? undefined,
    assignedEmployeeNames: employees
      .map((employee) => [employee.first_name, employee.last_name].filter(Boolean).join(' ').trim())
      .filter((name) => name.length > 0),
    totalAmountCents: job.total_amount ?? undefined,
    updatedAt: job.updated_at,
  };
}
