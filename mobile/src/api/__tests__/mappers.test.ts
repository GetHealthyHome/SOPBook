import { customerDisplayName, mapAddress, mapCustomer, mapJob, mapWorkStatus } from '../mappers';
import type { HcpCustomer, HcpJob } from '@/types';

describe('mapWorkStatus', () => {
  it('folds both completion variants into one state', () => {
    // Housecall Pro splits "complete" by whether the customer rated the job.
    // That distinction is meaningless to a tech and must not leak into the UI.
    expect(mapWorkStatus('complete rated')).toBe('completed');
    expect(mapWorkStatus('complete unrated')).toBe('completed');
  });

  it('folds both cancellation sources into one state', () => {
    expect(mapWorkStatus('user canceled')).toBe('canceled');
    expect(mapWorkStatus('pro canceled')).toBe('canceled');
  });

  it('accepts underscored variants of the same status', () => {
    expect(mapWorkStatus('in_progress')).toBe('in_progress');
    expect(mapWorkStatus('in progress')).toBe('in_progress');
  });

  it('degrades an unrecognized upstream status to unknown rather than throwing', () => {
    expect(mapWorkStatus('some_new_status_shipped_next_quarter')).toBe('unknown');
  });
});

describe('customerDisplayName', () => {
  it('prefers a person name', () => {
    expect(customerDisplayName({ id: 'c1', first_name: 'Ada', last_name: 'Lovelace' })).toBe(
      'Ada Lovelace',
    );
  });

  it('falls back to the company when there is no person name', () => {
    expect(customerDisplayName({ id: 'c1', company: 'Northside HOA' })).toBe('Northside HOA');
  });

  it('never returns an empty label, so a card is always tappable', () => {
    expect(customerDisplayName({ id: 'abcdef123456' })).toBe('Customer abcdef12');
  });
});

describe('mapAddress', () => {
  it('joins the parts it has and skips the ones it does not', () => {
    expect(mapAddress({ street: '12 Elm St', city: 'Boulder', state: 'CO', zip: '80301' })?.formatted).toBe(
      '12 Elm St, Boulder, CO, 80301',
    );
  });

  it('returns undefined for an address with no usable parts', () => {
    expect(mapAddress({ street: null, city: null })).toBeUndefined();
    expect(mapAddress(null)).toBeUndefined();
  });
});

describe('mapJob', () => {
  const baseJob: HcpJob = {
    id: 'job_abcdef123456',
    work_status: 'scheduled',
  };

  it('uses the invoice number as the reference when present', () => {
    expect(mapJob({ ...baseJob, invoice_number: '1042' }).reference).toBe('1042');
  });

  it('falls back to a truncated id when the invoice number is blank', () => {
    expect(mapJob({ ...baseJob, invoice_number: '   ' }).reference).toBe('#job_abcd');
  });

  it('falls back to the customer address when the job has none of its own', () => {
    const customer: HcpCustomer = {
      id: 'c1',
      first_name: 'Ada',
      addresses: [{ street: '12 Elm St', city: 'Boulder' }],
    };
    const job = mapJob({ ...baseJob, customer });
    expect(job.address?.formatted).toBe('12 Elm St, Boulder');
  });

  it('retains the raw status alongside the normalized one', () => {
    const job = mapJob({ ...baseJob, work_status: 'complete rated' });
    expect(job.status).toBe('completed');
    expect(job.rawStatus).toBe('complete rated');
  });

  it('drops assigned employees that have no name at all', () => {
    const job = mapJob({
      ...baseJob,
      assigned_employees: [
        { id: 'e1', first_name: 'Sam', last_name: 'Ortiz' },
        { id: 'e2' },
      ],
    });
    expect(job.assignedEmployeeNames).toEqual(['Sam Ortiz']);
  });
});

describe('mapCustomer', () => {
  it('prefers mobile over home and work numbers', () => {
    const customer = mapCustomer({
      id: 'c1',
      mobile_number: '555-0100',
      home_number: '555-0200',
      work_number: '555-0300',
    });
    expect(customer.phone).toBe('555-0100');
  });

  it('defaults tags to an empty array when upstream omits them', () => {
    expect(mapCustomer({ id: 'c1' }).tags).toEqual([]);
  });
});
