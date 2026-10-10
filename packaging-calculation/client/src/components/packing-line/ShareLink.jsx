import React, { useState } from 'react';
import { Copy, Check, Share2, Globe, ShieldAlert } from 'lucide-react';
import ErrorNotice from '../ErrorNotice.jsx';

export default function ShareLink({
  run,
  canEdit = false,
  canShare = false,
  entitlementsLabel = 'Pro',
  onToggleShare = () => {}
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const link = `${window.location.origin}/s/${run.shareToken}`;

  const copyToClipboard = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    }
  };

  const handleToggle = async () => {
    setBusy(true);
    setError(null);
    try {
      await onToggleShare(!run.shareOn);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="sh-share-card">
      <div className="sh-share-status-bar">
        <div>
          <h4 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>
            Calculation Share Link
          </h4>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>
            Read-only external snapshot link. Anyone with this link can view the exact 3D models,
            specifications, and freight figures.
          </p>
        </div>

        <div className={`sh-status-pill ${run.shareOn ? 'shared' : 'not-shared'}`}>
          {run.shareOn ? (
            <>
              <Globe size={13} />
              <span>Publicly Shared</span>
            </>
          ) : (
            <>
              <ShieldAlert size={13} />
              <span>Not Shared (Private)</span>
            </>
          )}
        </div>
      </div>

      <div className="sh-copy-box">
        <div className="sh-copy-text" title={link}>
          {link}
        </div>
        <button
          type="button"
          className={`sh-copy-btn ${copied ? 'copied' : ''}`}
          onClick={copyToClipboard}
          title="Copy Link to Clipboard"
        >
          {copied ? (
            <>
              <Check size={15} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={15} />
              <span>Copy link</span>
            </>
          )}
        </button>
      </div>

      <ErrorNotice error={error} />

      {canEdit && (
        <div>
          {canShare ? (
            <button
              type="button"
              className={`btn ${run.shareOn ? 'btn-ghost' : 'btn-primary'}`}
              style={{
                minHeight: 40,
                ...(run.shareOn ? {} : { background: 'var(--sh-primary)', borderColor: 'var(--sh-primary)' })
              }}
              disabled={busy}
              onClick={handleToggle}
            >
              <Share2 size={15} />
              <span>
                {busy
                  ? 'Updating Share Status…'
                  : run.shareOn
                  ? 'Revoke Link / Stop Sharing'
                  : 'Activate & Share This Calculation'}
              </span>
            </button>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: 13 }}>
              Public share links are included in the Business plan (current plan: {entitlementsLabel}).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
