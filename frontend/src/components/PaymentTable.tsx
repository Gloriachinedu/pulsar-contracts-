import React from "react";
import type { PaymentRecord } from "../contract";
import "./PaymentTable.css";

interface Props {
  records: PaymentRecord[];
  loading: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  Completed: "#22c55e",
  PartiallyRefunded: "#f59e0b",
  FullyRefunded: "#3b82f6",
};

export function PaymentTable({ records, loading }: Props) {
  if (loading) return <p>Loading…</p>;
  if (!records.length) return <p>No payments found.</p>;

  return (
    <>
      <div className="payment-table__desktop" role="region" aria-label="Payment history">
        <table className="payment-table">
          <thead>
            <tr>
              {["Order ID", "Merchant", "Token", "Amount", "Date", "Status"].map((heading) => (
                <th key={heading} scope="col">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.order_id}>
                <td className="payment-table__mono">{record.order_id}</td>
                <td className="payment-table__mono">
                  {record.merchant_address.slice(0, 8)}…{record.merchant_address.slice(-4)}
                </td>
                <td className="payment-table__mono">
                  {record.token.slice(0, 8)}…{record.token.slice(-4)}
                </td>
                <td>{record.amount}</td>
                <td>{new Date(record.paid_at * 1000).toLocaleString()}</td>
                <td>
                  <span style={{ color: STATUS_COLOR[record.status] ?? "#64748b", fontWeight: 600 }}>
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="payment-table__cards" aria-label="Payment history">
        {records.map((record) => (
          <li className="payment-table__card" key={record.order_id}>
            <dl>
              <div><dt>Order ID</dt><dd className="payment-table__mono">{record.order_id}</dd></div>
              <div><dt>Merchant</dt><dd className="payment-table__mono">{record.merchant_address}</dd></div>
              <div><dt>Token</dt><dd className="payment-table__mono">{record.token}</dd></div>
              <div><dt>Amount</dt><dd>{record.amount}</dd></div>
              <div><dt>Date</dt><dd>{new Date(record.paid_at * 1000).toLocaleString()}</dd></div>
              <div>
                <dt>Status</dt>
                <dd style={{ color: STATUS_COLOR[record.status] ?? "#64748b", fontWeight: 600 }}>
                  {record.status}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
