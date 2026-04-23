import { useEffect, useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { LockScreen } from './components/LockScreen';
import { IDLE_LOCK_MINUTES } from '@uoadrop/shared';

export function App(): JSX.Element {
  const [locked, setLocked] = useState(true);
  const [lastActivity, setLastActivity] = useState(Date.now());

  // Track user activity
  useEffect(() => {
    const update = (): void => setLastActivity(Date.now());
    const events = ['mousedown', 'keydown', 'mousemove', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, update));
    return () => events.forEach((e) => window.removeEventListener(e, update));
  }, []);

  // Idle check every 10s
  useEffect(() => {
    const id = setInterval(() => {
      const idleMs = Date.now() - lastActivity;
      if (idleMs > IDLE_LOCK_MINUTES * 60 * 1000) setLocked(true);
    }, 10_000);
    return () => clearInterval(id);
  }, [lastActivity]);

  if (locked) {
    return (
      <LockScreen
        onUnlock={() => {
          setLocked(false);
          setLastActivity(Date.now());
        }}
      />
    );
  }

  return <Dashboard />;
}
