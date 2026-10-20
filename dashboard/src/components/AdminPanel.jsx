import React, { useState, useEffect, useCallback } from 'react';
import './AdminPanel.css';

const API = process.env.REACT_APP_INDEXER_URL || 'http://localhost:3001';

/**
 * AdminPanel — wallet-gated admin UI providing:
 *  1. Global stats dashboard (total payments, volume, refunds)
 *  2. Merchant list with per-merchant deactivation controls
 *  3. Cleanup trigger (archive expired payments)
 *  4. Audit log of admin actions (read from API)
 *
 * Access is gated: only the address returned by /admin/me is allowed.
 * All actions are logged to the audit log visible in the UI.
 */
export default function AdminPanel({ adminAddress }) {
  const [authorized, setAuthorized] = useState(null); // null=checking, true, false
  const [activeSection, setActiveSection] = useState('stats');

  // Verify admin status on mount
  useEffect(() => {
    if (!adminAddress) { setAuthorized(false); return; }
    fetch(`${API}/admin/verify?address=${encodeURIComponent(adminAddress)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setAuthorized(data.is_admin === true))
      .catch(() => setAuthorized(false));
  }, [adminAddress]);

  if (!adminAddress) {
    return (
      <section aria-labelledby="admin-heading">
        <h2 id="admin-heading">Admin Panel</h2>
        <p className="ap__prompt">Connect your Freighter wallet to access the admin panel.</p>
      </section>
    );
  }

  if (authorized === null) {
    return (
      <section aria-labelledby="admin-heading">
        <h2 id="admin-heading">Admin Panel</h2>
        <p aria-live="polite" className="ap__status">Verifying admin access…</p>
      </section>
    );
  }

  if (!authorized) {
    return (
      <section aria-labelledby="admin-heading">
        <h2 id="admin-heading">Admin Panel</h2>
        <p role="alert" className="ap__error">
          Access denied. The connected wallet is not an admin address.
        </p>
      </section>
    );
  }

  const NAV = [
    { id: 'stats',     label: 'Global Stats' },
    { id: 'merchants', label: 'Merchants' },
    { id: 'cleanup',   label: 'Cleanup' },
    { id: 'audit',     label: 'Audit Log' },
  ];

  return (
    <section aria-labelledby="admin-heading" className="ap">
      <h2 id="admin-heading">Admin Panel</h2>

      <nav aria-label="Admin sections" className="ap__nav">
        <ul role="tablist">
          {NAV.map(n => (
            <li key={n.id} role="presentation">
              <button
                role="tab"
                aria-selected={activeSection === n.id}
                aria-controls={`ap-panel-${n.id}`}
                id={`ap-tab-${n.id}`}
                onClick={() => setActiveSection(n.id)}
              >
                {n.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ap__content">
        {NAV.map(n => (
          <div
            key={n.id}
            id={`ap-panel-${n.id}`}
            role="tabpanel"
            aria-labelledby={`ap-tab-${n.id}`}
            hidden={activeSection !== n.id}
          >
            {activeSection === n.id && (
              <>
                {n.id === 'stats'     && <GlobalStats     adminAddress={adminAddress} />}
                {n.id === 'merchants' && <MerchantList    adminAddress={adminAddress} />}
                {n.id === 'cleanup'   && <CleanupPanel    adminAddress={adminAddress} />}
                {n.id === 'audit'     && <AuditLog        adminAddress={adminAddress} />}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Global Stats ──────────────────────────────────────────── */
function GlobalStats({ adminAddress }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/admin/stats?admin=${encodeURIComponent(adminAddress)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(setStats)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [adminAddress]);

  if (loading) return <p aria-live="polite" className="ap__status">Loading stats…</p>;
  if (error)   return <p role="alert" className="ap__error">Failed to load stats: {error}</p>;

  const METRICS = [
    { label: 'Total Payments',      value: stats?.total_payments?.toLocaleString() ?? '—' },
    { label: 'Total Volume',        value: stats?.total_volume != null ? stats.total_volume.toLocaleString() : '—' },
    { label: 'Total Refunds',       value: stats?.total_refunds?.toLocaleString() ?? '—' },
    { label: 'Total Refund Volume', value: stats?.total_refund_volume != null ? stats.total_refund_volume.toLocaleString() : '—' },
  ];

  return (
    <div>
      <h3 className="ap__section-title">Global Payment Statistics</h3>
      <ul className="ap__stats-grid" aria-label="Global payment statistics">
        {METRICS.map(m => (
          <li key={m.label} className="ap__stat-card">
            <span className="ap__stat-label">{m.label}</span>
            <span className="ap__stat-value">{m.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Merchant List ─────────────────────────────────────────── */
function MerchantList({ adminAddress }) {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionStatus, setActionStatus] = useState({});

  useEffect(() => {
    fetch(`${API}/admin/merchants?admin=${encodeURIComponent(adminAddress)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => setMerchants(data.merchants ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [adminAddress]);

  const handleDeactivate = useCallback(async (merchantAddress) => {
    const confirmed = window.confirm(
      `Deactivate merchant ${merchantAddress.slice(0, 12)}…? This cannot be undone from the UI.`
    );
    if (!confirmed) return;

    setActionStatus(prev => ({ ...prev, [merchantAddress]: 'loading' }));
    try {
      const res = await fetch(`${API}/admin/merchants/deactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin: adminAddress, merchant_address: merchantAddress }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMerchants(prev =>
        prev.map(m =>
          m.address === merchantAddress ? { ...m, active: false } : m
        )
      );
      setActionStatus(prev => ({ ...prev, [merchantAddress]: 'done' }));
    } catch (e) {
      setActionStatus(prev => ({ ...prev, [merchantAddress]: `error: ${e.message}` }));
    }
  }, [adminAddress]);

  if (loading) return <p aria-live="polite" className="ap__status">Loading merchants…</p>;
  if (error)   return <p role="alert" className="ap__error">Failed to load merchants: {error}</p>;

  return (
    <div>
      <h3 className="ap__section-title">Merchant Management</h3>
      {merchants.length === 0 ? (
        <p className="ap__empty">No merchants registered.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="ap__table-wrap">
            <table className="ap__table" aria-label="Merchant list">
              <thead>
                <tr>
                  <th scope="col">Address</th>
                  <th scope="col">Name</th>
                  <th scope="col">Category</th>
                  <th scope="col">Status</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {merchants.map(m => (
                  <tr key={m.address}>
                    <td className="ap__mono" title={m.address}>{m.address.slice(0, 10)}…</td>
                    <td>{m.name}</td>
                    <td>{m.category}</td>
                    <td>
                      <span className={`ap__badge ap__badge--${m.active ? 'active' : 'inactive'}`}>
                        {m.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      {m.active ? (
                        <button
                          className="ap__deactivate-btn"
                          onClick={() => handleDeactivate(m.address)}
                          disabled={actionStatus[m.address] === 'loading'}
                          aria-label={`Deactivate merchant ${m.name}`}
                        >
                          {actionStatus[m.address] === 'loading' ? 'Deactivating…' : 'Deactivate'}
                        </button>
                      ) : (
                        <span className="ap__muted">—</span>
                      )}
                      {actionStatus[m.address]?.startsWith('error') && (
                        <span role="alert" className="ap__error-inline">
                          {actionStatus[m.address]}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <ul className="ap__cards" aria-label="Merchant list">
            {merchants.map(m => (
              <li key={m.address} className="ap__card">
                <dl>
                  <div className="ap__card-row"><dt>Address</dt><dd className="ap__mono" title={m.address}>{m.address.slice(0, 14)}…</dd></div>
                  <div className="ap__card-row"><dt>Name</dt><dd>{m.name}</dd></div>
                  <div className="ap__card-row"><dt>Category</dt><dd>{m.category}</dd></div>
                  <div className="ap__card-row">
                    <dt>Status</dt>
                    <dd><span className={`ap__badge ap__badge--${m.active ? 'active' : 'inactive'}`}>{m.active ? 'Active' : 'Inactive'}</span></dd>
                  </div>
                  {m.active && (
                    <div className="ap__card-row">
                      <dt>Action</dt>
                      <dd>
                        <button
                          className="ap__deactivate-btn"
                          onClick={() => handleDeactivate(m.address)}
                          disabled={actionStatus[m.address] === 'loading'}
                          aria-label={`Deactivate merchant ${m.name}`}
                        >
                          {actionStatus[m.address] === 'loading' ? 'Deactivating…' : 'Deactivate'}
                        </button>
                      </dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ── Cleanup Panel ─────────────────────────────────────────── */
function CleanupPanel({ adminAddress }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCleanup = async () => {
    const confirmed = window.confirm(
      'Archive all expired payment records? This will remove expired payments from hot storage. Tombstones are preserved to prevent replay attacks.'
    );
    if (!confirmed) return;

    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API}/admin/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin: adminAddress }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus({ ok: true, message: `Cleanup complete. ${data.archived ?? 0} record(s) archived.` });
    } catch (e) {
      setStatus({ ok: false, message: `Cleanup failed: ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3 className="ap__section-title">Cleanup Expired Payments</h3>
      <p className="ap__description">
        Removes expired payment records from on-chain hot storage to reduce ledger entry costs.
        Order ID tombstones are preserved to prevent signature replay attacks.
      </p>
      <button
        className="ap__cleanup-btn"
        onClick={handleCleanup}
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? 'Running cleanup…' : 'Run Cleanup Now'}
      </button>
      {status && (
        <p
          role={status.ok ? 'status' : 'alert'}
          aria-live="polite"
          className={status.ok ? 'ap__success' : 'ap__error'}
        >
          {status.message}
        </p>
      )}
    </div>
  );
}

/* ── Audit Log ─────────────────────────────────────────────── */
function AuditLog({ adminAddress }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}/admin/audit-log?admin=${encodeURIComponent(adminAddress)}&limit=50`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => setEntries(data.entries ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [adminAddress]);

  if (loading) return <p aria-live="polite" className="ap__status">Loading audit log…</p>;
  if (error)   return <p role="alert" className="ap__error">Failed to load audit log: {error}</p>;

  return (
    <div>
      <h3 className="ap__section-title">Admin Audit Log</h3>
      {entries.length === 0 ? (
        <p className="ap__empty">No admin actions recorded yet.</p>
      ) : (
        <div className="ap__table-wrap">
          <table className="ap__table ap__audit-table" aria-label="Admin audit log">
            <thead>
              <tr>
                <th scope="col">Timestamp</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">Admin</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id ?? i}>
                  <td>{new Date(e.timestamp * 1000).toLocaleString()}</td>
                  <td><code className="ap__action-code">{e.action}</code></td>
                  <td className="ap__mono" title={e.target}>{e.target ? `${e.target.slice(0, 12)}…` : '—'}</td>
                  <td className="ap__mono" title={e.admin}>{e.admin ? `${e.admin.slice(0, 8)}…` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
