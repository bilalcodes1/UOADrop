import { useState } from 'react';

interface Props {
  onUnlock: () => void;
}

export function LockScreen({ onUnlock }: Props): JSX.Element {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (busy || locked) return;

    setBusy(true);
    try {
      const res = await window.api.unlock(pin);
      if (res.ok) {
        setError(null);
        setPin('');
        onUnlock();
        return;
      }
      if (res.locked) {
        setLocked(true);
        setError(`تم تجميد المحاولات لمدة ${res.lockoutMinutes ?? 30} دقيقة`);
      } else {
        setError('PIN خاطئ');
        setRemaining(res.remaining);
      }
      setPin('');
    } catch (err) {
      setError('فشل التحقق');
    } finally {
      setBusy(false);
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
              setError(null);
            }}
            placeholder="••••"
            className={error ? 'input error' : 'input'}
            disabled={locked || busy}
          />
          <button
            type="submit"
            className="btn btn-unlock"
            disabled={pin.length === 0 || locked || busy}
          >
            {busy ? '...' : 'فتح'}
          </button>
        </form>
        {error && <p className="error-msg">{error}</p>}
        {remaining !== null && !locked && (
          <p className="dev-hint">محاولات متبقية: <code>{remaining}</code></p>
        )}
        <p className="dev-hint">
          [dev] عند أول تشغيل تم توليد PIN عشوائي وطبعه في terminal. اضبط
          <code> LIBRARIAN_PIN_HASH </code>
          في البيئة لتجاوزه.
        </p>
      </div>
    </div>
  );
}
