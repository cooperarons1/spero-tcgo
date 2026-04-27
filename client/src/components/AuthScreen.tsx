import { useEffect, useState } from 'react';

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
  // Diagnostic: probe whether the WKWebView can actually reach Firebase
  // Auth's REST endpoint. The Firebase JS SDK was timing out on iOS even
  // though `curl` from the host Mac worked, so this isolates whether the
  // problem is "WKWebView can't reach googleapis.com" vs "Firebase SDK
  // is stuck on init." Status is shown in the UI for quick triage.
  const [reachStatus, setReachStatus] = useState<'checking' | 'ok' | 'fail'>('checking');
  useEffect(() => {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 5000);
    fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyC_3fqVMEcwWAP29KOI90SCdvFOoUVozhA', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'probe@example.invalid', password: 'x', returnSecureToken: true }),
      signal: ctl.signal,
    })
      .then((r) => {
        // 400 with INVALID_LOGIN_CREDENTIALS is the expected, healthy response.
        // Anything that returns at all proves the network path works.
        setReachStatus(r.status > 0 ? 'ok' : 'fail');
        console.log('[auth-probe] status', r.status);
      })
      .catch((err) => {
        setReachStatus('fail');
        console.error('[auth-probe] failed', err);
      })
      .finally(() => clearTimeout(t));
    return () => { clearTimeout(t); ctl.abort(); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Race the auth call against a 15s timeout so a hung Firebase request
    // (network drop, CSP block, API-key restriction) surfaces an error
    // instead of leaving the button stuck on "Loading..." forever.
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
      } else {
        await Promise.race([onSignIn(email, password), timeout]);
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
      // Surface in the WKWebView console so the issue can be diagnosed via
      // Safari Web Inspector even when no email-readable error message
      // makes it onto the screen.
      console.error('[auth] sign-in failed', { code, err });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="bg-slate-800 rounded-2xl p-8 shadow-xl max-w-md w-full border border-slate-700 animate-slide-up">
        <h1 className="text-5xl font-extrabold text-white mb-1 text-center animate-bounce-in">MIRO</h1>
        <p className="text-spero-yellow font-bold text-lg mb-6 text-center animate-fade-in" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>TCG Online</p>

        <div className="flex mb-6">
          <button
            onClick={() => { setTab('signin'); setError(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-l-xl cursor-pointer transition-all ${
              tab === 'signin' ? 'bg-spero-blue text-white' : 'bg-slate-700 text-gray-400'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => { setTab('signup'); setError(null); }}
            className={`flex-1 py-2 text-sm font-bold rounded-r-xl cursor-pointer transition-all ${
              tab === 'signup' ? 'bg-spero-blue text-white' : 'bg-slate-700 text-gray-400'
            }`}
          >
            Create Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'signup' && (
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              maxLength={15}
              className="w-full bg-slate-700 border border-gray-600 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-slate-700 border border-gray-600 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-slate-700 border border-gray-600 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-spero-yellow focus:outline-none"
          />

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
          {/* One-shot diagnostic — visible right above the submit button. */}
          <p className={`text-xs text-center ${reachStatus === 'ok' ? 'text-emerald-400' : reachStatus === 'fail' ? 'text-red-400' : 'text-gray-500'}`}>
            {reachStatus === 'checking' && '· checking auth server reachability…'}
            {reachStatus === 'ok' && '✓ auth server reachable'}
            {reachStatus === 'fail' && '✗ auth server unreachable from this device — sign-in will time out'}
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-spero-blue text-white font-bold py-3 px-6 rounded-xl text-lg hover:brightness-110 active:scale-95 transition-all shadow-lg disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            {loading ? 'Loading...' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>
      </div>
    </div>
  );
}
