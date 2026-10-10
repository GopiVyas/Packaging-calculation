import { Warn, Star } from './Icons.jsx';

/** Shows an API error. Plan-limit errors (402) get an upgrade message instead of a red error. */
export default function ErrorNotice({ error }) {
  if (!error) return null;
  if (error.isUpgrade) {
    return (
      <p className="notice notice-upgrade" role="status">
        <Star />
        <span><b>Upgrade needed.</b> {error.message} Contact us to change your plan.</span>
      </p>
    );
  }
  return (
    <p className="notice" role="alert"><Warn /><span>{error.message}</span></p>
  );
}
