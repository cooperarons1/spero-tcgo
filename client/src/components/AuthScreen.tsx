import { useState } from 'react';

interface AuthScreenProps {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string, displayName: string) => Promise<void>;
}

export function AuthScreen({ onSignIn, onSignUp }: AuthScreenProps) {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setError('· submit pressed, calling auth…');
    const TIMEOUT_MS = 15000;
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error('Network timeout — check your connection and try again.')), TIMEOUT_MS)
    );
    try {
      if (tab === 'signup') {
        if (!displayName.trim()) {
          setError('Display name is required');
          setLoading(false);
          return;
        }
        await Promise.race([onSignUp(email, password, displayName.trim()), timeout]);
        setError('✓ signup returned, waiting for app…');
      } else {
        await Promise.race([onSignIn(email, password), timeout]);
        setError('✓ signin returned, waiting for app…');
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/email-already-in-use') setError('Email already in use');
      else if (code === 'auth/weak-password') setError('Password must be at least 6 characters');
      else if (code === 'auth/invalid-email') setError('Invalid email address');
      else if (code === 'auth/invalid-credential') setError('Invalid email or password');
      else if (code === 'auth/user-not-found') setError('No account with that email');
      else if (code === 'auth/wrong-password') setError('Wrong password');
      else if (code === 'auth/network-request-failed') setError('Network request failed — check connectivity.');
      else if (code === 'auth/too-many-requests') setError('Too many attempts — wait a minute and try again.');
      else setError(err?.message || `Something went wrong${code ? ` (${code})` : ''}`);
      console.error('[auth] sign-in failed', { code, err });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="bg-gradient-to-b from-[#0b0613] via-[#150821] to-[#07030d]"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
    >
      <div
        className="bg-slate-800/95 backdrop-blur rounded-2xl p-5 shadow-xl border border-slate-700 animate-slide-up"
        style={{
          position: 'absolute',
          top: '1.5rem',
          left: 0,
          right: 0,
          marginLeft: 'auto',
          marginRight: 'auto',
          width: 'min(28rem, calc(100vw - 1.5rem))',
        }}
      >
        <h1 className="text-3xl font-extrabold text-white text-center animate-bounce-in">MIRO</h1>
        <p className="text-spero-yellow font-bold text-sm mb-4 text-center animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>TCG Online</p>

        <div className="flex mb-3">
          <button
            onClick={() => { setTab('signin'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-l-lg cursor-pointer transition-all ${
              tab === 'signin' ? 'bg-spero-blue text-white' : 'bg-slate-700 text-gray-400'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setError(null); }}
            className={`flex-1 py-1.5 text-xs font-bold rounded-r-lg cursor-pointer transition-all ${
              tab === 'signup' ? 'bg-spero-blue text-white' : 'bg-slate-700 text-gray-400'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {tab === 'signup' && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              maxLength={15}
              className="w-full bg-slate-700 border border-gray-600 rounded-lg py-2 px-3 text-base text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-slate-700 border border-gray-600 rounded-lg py-2 px-3 text-base text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-slate-700 border border-gray-600 rounded-lg py-2 px-3 text-base text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-spero-blue text-white font-bold py-2 px-4 rounded-lg text-base hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
