import React, { useEffect, useState } from 'react';
import PaymentTable from './PaymentTable';

const API = process.env.REACT_APP_INDEXER_URL || 'http://localhost:3001';

export default function PaymentHistory({ merchantAddress }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!merchantAddress) return;
    setLoading(true);
    fetch(`${API}/events/payment_processed`)
      .then(r => r.json())
      .then(data => setPayments(data.filter(e =>
        JSON.stringify(e.topics).includes(merchantAddress)
      )))
      .finally(() => setLoading(false));
  }, [merchantAddress]);

  if (loading) return <p aria-live="polite">Loading payments…</p>;

  return (
    <section aria-labelledby="payments-heading">
      <h2 id="payments-heading">Payment History</h2>
      <PaymentTable payments={payments} />
    </section>
  );
}
