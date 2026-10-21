import React, { useEffect, useState } from 'react';
import PaymentTable from './PaymentTable';

const API = process.env.REACT_APP_INDEXER_URL || 'http://localhost:3001';
const PAGE_SIZE = 20;

function StatusBadge({ status }) {
  const cls = {
    Completed:         'badge badge-completed',
    PartiallyRefunded: 'badge badge-refunded',
    FullyRefunded:     'badge badge-refunded',
    Pending:           'badge badge-pending',
  }[status] || 'badge';
  return <span className={cls}>{status || 'Unknown'}</span>;
}

export default function PaymentHistory({ merchantAddress }) {
  const [payments,   setPayments]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [page,       setPage]       = useState(1);
  const [filterText, setFilterText] = useState('');

  const fetchPayments = useCallback(() => {
    if (!merchantAddress) return;
    setLoading(true);
    setError(null);
    fetch(`${API}/events/payment_processed`)
      .then(r => {
        if (!r.ok) throw new Error(`Server responded ${r.status}`);
        return r.json();
      })
      .then(data => {
        const filtered = (Array.isArray(data) ? data : []).filter(e =>
          JSON.stringify(e.topics || '').includes(merchantAddress)
        );
        setPayments(filtered);
        setPage(1);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [merchantAddress]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  /* Client-side filter by order ID / tx hash */
  const displayed = payments.filter(p => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      (p.id          || '').toLowerCase().includes(q) ||
      (p.tx_hash     || '').toLowerCase().includes(q) ||
      (p.event_type  || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const pageItems  = displayed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <section aria-labelledby="payments-heading">
      <h2 id="payments-heading">Payment History</h2>
      <PaymentTable payments={payments} />
    </section>
  );
}
