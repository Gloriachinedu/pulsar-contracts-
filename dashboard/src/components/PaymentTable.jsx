import React from 'react';
import './PaymentTable.css';

/**
 * PaymentTable renders payment rows as a standard table on wide screens and
 * collapses to a stacked card layout on viewports narrower than 640 px so that
 * mobile users never need to scroll horizontally.
 *
 * @param {{ payments: Array<{id:string,ledger:number,tx_hash:string,event_type:string,created_at:string}> }} props
 */
export default function PaymentTable({ payments = [] }) {
  if (payments.length === 0) {
    return <p className="payment-table__empty">No payments found.</p>;
  }

  return (
    <div className="payment-table-wrapper" role="region" aria-label="Payment history table">
      {/* ── Desktop table (hidden on mobile via CSS) ── */}
      <table className="payment-table" aria-label="Payment history">
        <thead>
          <tr>
            <th scope="col">Ledger</th>
            <th scope="col">Tx Hash</th>
            <th scope="col">Event</th>
            <th scope="col">Date</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(p => (
            <tr key={p.id}>
              <td>{p.ledger}</td>
              <td className="payment-table__hash">
                <span title={p.tx_hash}>{p.tx_hash.slice(0, 12)}…</span>
              </td>
              <td>{p.event_type}</td>
              <td>{new Date(p.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Mobile card list (hidden on desktop via CSS) ── */}
      <ul className="payment-cards" aria-label="Payment history">
        {payments.map(p => (
          <li key={p.id} className="payment-card">
            <dl>
              <div className="payment-card__row">
                <dt>Ledger</dt>
                <dd>{p.ledger}</dd>
              </div>
              <div className="payment-card__row">
                <dt>Tx Hash</dt>
                <dd className="payment-table__hash" title={p.tx_hash}>
                  {p.tx_hash.slice(0, 16)}…
                </dd>
              </div>
              <div className="payment-card__row">
                <dt>Event</dt>
                <dd>{p.event_type}</dd>
              </div>
              <div className="payment-card__row">
                <dt>Date</dt>
                <dd>{new Date(p.created_at).toLocaleString()}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </div>
  );
}
