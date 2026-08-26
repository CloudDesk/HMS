import { useEffect, useState } from 'react';
import { ApiError } from '../../api/api-error';
import { settingsApi, type AuditAction, type AuditLogItem } from '../../api/settings';
import { EmptyState } from '../ui/EmptyState';
import { downloadBlob } from '../../utils/download';
import { formatRegionalDateTime } from '../../utils/localization-utils';
import { useTimezone } from '../../api/useSettings';

type AuditLogPanelProps = {
  onTotalChange: (total: number) => void;
  onMessage: (message: string) => void;
};


export function AuditLogPanel({ onTotalChange, onMessage }: AuditLogPanelProps) {
  const timezone = useTimezone();
  const formatDate = (value: string) => formatRegionalDateTime(value, timezone);
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [search, setSearch] = useState('');
  const [action, setAction] = useState<AuditAction | ''>('');
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError('');
      void settingsApi
        .listAuditLogs({ search: search || undefined, action: action || undefined, page, limit: 20 })
        .then((result) => {
          if (!active) return;
          setItems(result.items);
          setPageCount(result.meta.totalPages);
          onTotalChange(result.meta.total);
          if (page > result.meta.totalPages) setPage(result.meta.totalPages);
        })
        .catch((requestError: unknown) => {
          if (!active) return;
          const message =
            requestError instanceof ApiError && requestError.status === 403
              ? 'You do not have permission to view audit logs.'
              : requestError instanceof Error
                ? requestError.message
                : 'Audit logs could not be loaded.';
          setError(message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });

    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [action, onTotalChange, page, search]);

  const exportLogs = async () => {
    if (!items.length) return;
    try {
      const blob = await settingsApi.exportAuditLogs({ search: search || undefined, action: action || undefined });
      downloadBlob(blob, 'hms-audit-logs.csv');
      onMessage('All filtered audit logs exported.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Audit logs could not be exported.');
    }
  };

  return (
    <section className="ss-tab-panel active" aria-labelledby="audit-settings-title">
      <div className="ss-panel-header">
        <div className="ss-panel-title" id="audit-settings-title">
          <i className="ph ph-clipboard-text" aria-hidden="true" /> Audit Logs
        </div>
        <p className="ss-panel-desc">Track all system actions and user activity.</p>
      </div>
      <div className="ss-form-body">
        <div className="ss-audit-toolbar">
          <label className="ss-audit-search">
            <i className="ph ph-magnifying-glass" aria-hidden="true" />
            <input
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search logs by user or action..."
              type="search"
              value={search}
            />
          </label>
          <select
            aria-label="Filter audit logs by action"
            className="ss-filter"
            onChange={(event) => {
              setAction(event.target.value as AuditAction | '');
              setPage(1);
            }}
            value={action}
          >
            <option value="">All Actions</option>
            <option value="login">Login</option>
            <option value="create">Create</option>
            <option value="edit">Edit</option>
            <option value="delete">Delete</option>
            <option value="export">Export</option>
          </select>
          <button className="ss-export-btn" disabled={!items.length} onClick={() => void exportLogs()} type="button">
            <i className="ph ph-download-simple" aria-hidden="true" /> Export Logs
          </button>
        </div>

        {loading ? (
          <div className="ss-state" role="status">
            <span className="loading-spinner" /> Loading audit logs...
          </div>
        ) : error ? (
          <div className="ss-state ss-state--error" role="alert">
            <i className="ph ph-warning-circle" aria-hidden="true" /> {error}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="ph-clipboard-text" title="No logs found" message="No activity matches the current search and filter." />
        ) : (
          <div className="ss-audit-list">
            {items.map((item) => (
              <article className="ss-audit-row" key={item.id}>
                {item.actor.profilePhotoUrl ? (
                  <img alt="" className="ss-audit-avatar" src={item.actor.profilePhotoUrl} />
                ) : (
                  <span className="ss-audit-avatar ss-audit-avatar--fallback" aria-hidden="true">
                    {item.actor.name.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className="ss-audit-info">
                  <div className="ss-audit-action">
                    <strong>{item.actor.name}</strong> · {item.description}
                  </div>
                  <div className="ss-audit-meta">{item.module} · {formatDate(item.createdAt)}</div>
                </div>
                <span className={`ss-audit-tag ${item.action}`}>{item.action}</span>
              </article>
            ))}
          </div>
        )}
      </div>
      {pageCount > 1 ? (
        <div className="ss-panel-footer ss-audit-pagination">
          <button className="btn-secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)} type="button">
            <i className="ph ph-caret-left" aria-hidden="true" /> Previous
          </button>
          <span>Page {page} of {pageCount}</span>
          <button className="btn-secondary" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)} type="button">
            Next <i className="ph ph-caret-right" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
