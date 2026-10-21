import React, { useEffect, useState, useCallback } from 'react';
import './PayerPaymentHistory.css';

const API = process.env.REACT_APP_INDEXER_URL || 'http://localhost:3001';

const STATUS_OPTIONS = ['Any', 'Completed', 'PartiallyRefunded', 'FullyRefunded'];
const SORT_FIELDS = ['Date', 'Amount'];
const SORT_ORDERS = ['Descending', 'Ascending'];
const PAGE_SIZE = 10;

const REFUND_STATUS_LABEL = {
  Pending: 'Pending',
  Approved: 'Approved',
  Rejected: 'Rejected',
  Completed: 'Completed',
};

/**
 * PayerPaymentHistory — full payer-facing payment history with:
 * - Filter controls (status, amount range, date range)
 * - Sort controls (field + order)
 * - Cursor-based paginated table / mobile cards
 * - Inline refund status tracker per payment
 *
 * Requires a Freighter wallet connection (payerAddress prop).
 */
export default function PayerPaymentHistory({ payerAddress }) {
  // ── Filter & sort state ──────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('Any');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [sortField, setSortField] = useState('Date');
  const [sortOrder, setSortOrder] = useState('Descending');

  // ── Pagination state ─────────────────────────────────────
  const [payments, setPayments] = useState([]);
  const [cursors, setCursors] = useState([null]); // cursors[0] = null (first page)
  const [pageIndex, setPageIndex] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // ── UI state ─────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refundStatuses, setRefundStatuses] = useState({}); // orderId → refund info

  // ── Fetch a page of payments ─────────────────────────────
  const fetchPage = useCallback(
    async (cursor) => {
      if (!payerAddress) return;
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        payer: payerAddress,
        limit: PAGE_SIZE,
        sort_field: sortField,
        sort_order: sortOrder,
        status: statusFilter,
      });
      if (cursor) params.set('cursor', cursor);
      if (amountMin) params.set('amount_min', amountMin);
      if (amountMax) params.set('amount_max', amountMax);
      if (dateStart) params.set('date_start', Math.floor(new Date(dateStart).getTime() / 1000));
      if (dateEnd) params.set('date_end', Math.floor(new Date(dateEnd).getTime() / 1000));

      try {
        const res = await fetch(`${API}/payer/payments?${params}`);
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        const data = await res.json();
        setPayments(data.payments ?? []);
        setHasMore(!!data.next_cursor);

        // Store the next_cursor for forward navigation
        setCursors((prev) => {
          const updated = [...prev];
          updated[pageIndex + 1] = data.next_cursor ?? null;
          return updated;
        });
      } catch (err) {
        setError(err.message);
        setPayments([]);
      } finally {
        setLoading(false);
      }
    },
    [payerAddress, sortField, sortOrder, statusFilter, amountMin, amountMax, dateStart, dateEnd, pageIndex]
  );

  // Re-fetch when filters/sort change (reset to page 0)
  useEffect(() => {
    setCursors([null]);
    setPageIndex(0);
  }, [sortField, sortOrder, statusFilter, amountMin, amountMax, dateStart, dateEnd]);

  useEffect(() => {
    fetchPage(cursors[pageIndex]);
  }, [pageIndex, cursors[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch refund status for a given order
  const fetchRefundStatus = useCallback(async (orderId) => {
    try {
      const res = await fetch(`${API}/refunds?order_id=${encodeURIComponent(orderId)}`);
      if (!res.ok) return;
      const data = await res.json();
      setRefundStatuses((prev) => ({ ...prev, [orderId]: data }));
    } catch {
      // silently ignore
    }
  }, []);

  const handleApplyFilters = (e) => {
    e.preventDefault();
    setCursors([null]);
    setPageIndex(0);
    fetchPage(null);
  };

  const handlePrev = () => {
    if (pageIndex > 0) setPageIndex((p) => p - 1);
  };
  const handleNext = () => {
    if (hasMore) setPageIndex((p) => p + 1);
  };

  if (!payerAddress) {
    return (
      <section aria-labelledby="payer-history-heading">
        <h2 id="payer-history-heading">My Payment History</h2>
        <p className="pph__connect-prompt">Connect your Freighter wallet to view your payment history.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="payer-history-heading" className="pph">
      <h2 id="payer-history-heading">My Payment History</h2>

      {/* ── Filter / sort controls ── */}
      <form
        className="pph__filters"
        onSubmit={handleApplyFilters}
        aria-label="Filter and sort payments"
      >
        <div className="pph__filter-row">
          <div className="pph__field">
            <label htmlFor="pph-status">Status</label>
            <select
              id="pph-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="pph__field">
            <label htmlFor="pph-amount-min">Min Amount</label>
            <input
              id="pph-amount-min"
              type="number"
              min="0"
              placeholder="0"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
            />
          </div>

          <div className="pph__field">
            <label htmlFor="pph-amount-max">Max Amount</label>
            <input
              id="pph-amount-max"
              type="number"
              min="0"
              placeholder="Any"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
            />
          </div>

          <div className="pph__field">
            <label htmlFor="pph-date-start">From</label>
            <input
              id="pph-date-start"
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
            />
          </div>

          <div className="pph__field">
            <label htmlFor="pph-date-end">To</label>
            <input
              id="pph-date-end"
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
            />
          </div>

          <div className="pph__field">
            <label htmlFor="pph-sort-field">Sort by</label>
            <select
              id="pph-sort-field"
              value={sortField}
              onChange={(e) => setSortField(e.target.value)}
            >
              {SORT_FIELDS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="pph__field">
            <label htmlFor="pph-sort-order">Order</label>
            <select
              id="pph-sort-order"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              {SORT_ORDERS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        <button type="submit" className="pph__apply-btn">Apply Filters</button>
      </form>

      {/* ── Status / error ── */}
      {loading && <p aria-live="polite" className="pph__status">Loading…</p>}
      {error && <p role="alert" className="pph__error">{error}</p>}

      {/* ── Desktop table ── */}
      {!loading && !error && (
        <div className="pph__table-wrap" role="region" aria-label="Payment history">
          <table className="pph__table">
            <thead>
              <tr>
                <th scope="col">Order ID</th>
                <th scope="col">Merchant</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
                <th scope="col">Date</th>
                <th scope="col">Refund</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="pph__empty">No payments found.</td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.order_id}>
                    <td className="pph__mono" title={p.order_id}>
                      {p.order_id.slice(0, 12)}…
                    </td>
                    <td className="pph__mono" title={p.merchant_address}>
                      {p.merchant_address.slice(0, 8)}…
                    </td>
                    <td>{p.amount.toLocaleString()}</td>
                    <td>
                      <span className={`pph__badge pph__badge--${p.status.toLowerCase().replace(/\s/g, '-')}`}>
                        {p.status}
                      </span>
                    </td>
                    <td>{new Date(p.paid_at * 1000).toLocaleDateString()}</td>
                    <td>
                      <RefundStatusCell
                        orderId={p.order_id}
                        refundInfo={refundStatuses[p.order_id]}
                        onFetch={fetchRefundStatus}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Mobile cards ── */}
      {!loading && !error && payments.length > 0 && (
        <ul className="pph__cards" aria-label="Payment history">
          {payments.map((p) => (
            <li key={p.order_id} className="pph__card">
              <dl>
                <div className="pph__card-row">
                  <dt>Order ID</dt>
                  <dd className="pph__mono" title={p.order_id}>{p.order_id.slice(0, 16)}…</dd>
                </div>
                <div className="pph__card-row">
                  <dt>Merchant</dt>
                  <dd className="pph__mono" title={p.merchant_address}>{p.merchant_address.slice(0, 8)}…</dd>
                </div>
                <div className="pph__card-row">
                  <dt>Amount</dt>
                  <dd>{p.amount.toLocaleString()}</dd>
                </div>
                <div className="pph__card-row">
                  <dt>Status</dt>
                  <dd>
                    <span className={`pph__badge pph__badge--${p.status.toLowerCase().replace(/\s/g, '-')}`}>
                      {p.status}
                    </span>
                  </dd>
                </div>
                <div className="pph__card-row">
                  <dt>Date</dt>
                  <dd>{new Date(p.paid_at * 1000).toLocaleDateString()}</dd>
                </div>
                <div className="pph__card-row">
                  <dt>Refund</dt>
                  <dd>
                    <RefundStatusCell
                      orderId={p.order_id}
                      refundInfo={refundStatuses[p.order_id]}
                      onFetch={fetchRefundStatus}
                    />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      {/* ── Pagination ── */}
      {!loading && !error && (
        <nav className="pph__pagination" aria-label="Payment history pagination">
          <button
            onClick={handlePrev}
            disabled={pageIndex === 0}
            aria-label="Previous page"
          >
            ← Prev
          </button>
          <span className="pph__page-info" aria-live="polite">
            Page {pageIndex + 1}
          </span>
          <button
            onClick={handleNext}
            disabled={!hasMore}
            aria-label="Next page"
          >
            Next →
          </button>
        </nav>
      )}
    </section>
  );
}

/* ── Refund status sub-component ─────────────────────────── */
function RefundStatusCell({ orderId, refundInfo, onFetch }) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = () => {
    if (!expanded && !refundInfo) onFetch(orderId);
    setExpanded((v) => !v);
  };

  if (!expanded) {
    return (
      <button
        className="pph__refund-btn"
        onClick={handleToggle}
        aria-expanded="false"
        aria-label={`View refund status for order ${orderId}`}
      >
        View
      </button>
    );
  }

  return (
    <div className="pph__refund-detail" aria-live="polite">
      <button
        className="pph__refund-btn"
        onClick={handleToggle}
        aria-expanded="true"
        aria-label={`Hide refund status for order ${orderId}`}
      >
        Hide
      </button>
      {!refundInfo ? (
        <span className="pph__refund-status pph__refund-status--none">No refunds</span>
      ) : (
        <span className={`pph__refund-status pph__refund-status--${refundInfo.status?.toLowerCase()}`}>
          {REFUND_STATUS_LABEL[refundInfo.status] ?? refundInfo.status}
          {refundInfo.amount != null && ` — ${refundInfo.amount.toLocaleString()}`}
        </span>
      )}
    </div>
  );
}
