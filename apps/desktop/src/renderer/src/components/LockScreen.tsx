import { useState } from 'react';

interface Props {
  onUnlock: () => void;
}

// Phase 1.3: replace with bcrypt-hashed PIN check against local settings table.
const TEMP_PIN = '1234';

export function LockScreen({ onUnlock }: Props): JSX.Element {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (pin === TEMP_PIN) {
      setError(false);
      setPin('');
      onUnlock();
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="lock-screen">
      <div className="lock-card">
        <div className="lock-icon">🔒</div>
        <h2>الشاشة مقفلة</h2>
        <p className="lock-hint">أدخل PIN المكتبة للفتح</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError(false);
            }}
            placeholder="••••"
            className={error ? 'input error' : 'input'}
          />
          <button type="submit" className="btn btn-unlock" disabled={pin.length === 0}>
            فتح
          </button>
        </form>
        {error && <p className="error-msg">PIN خاطئ</p>}
        <p className="dev-hint">[dev] PIN مؤقت: <code>1234</code></p>
      </div>
    </div>
  );
}
