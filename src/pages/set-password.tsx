import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

/**
 * Where an invitation link lands.
 *
 * Kept separate from the main app: the person arriving here has no session
 * and no password yet, so none of the app's state or data fetching applies.
 * The token is validated before the form is shown, so an expired link says so
 * up front rather than after someone has typed a password twice.
 */
export default function SetPassword() {
  const [token, setToken] = useState('');
  const [checking, setChecking] = useState(true);
  const [valid, setValid] = useState(false);
  const [name, setName] = useState('');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Read the token from the URL rather than a router hook so this page has
    // no dependency on how it was navigated to.
    const t = new URLSearchParams(window.location.search).get('token') ?? '';
    setToken(t);
    if (!t) { setChecking(false); return; }
    fetch(`/api/auth/set-password?token=${encodeURIComponent(t)}`)
      .then(r => r.json())
      .then(d => { setValid(Boolean(d?.valid)); setName(d?.name ?? ''); })
      .catch(() => setValid(false))
      .finally(() => setChecking(false));
  }, []);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm && !saving;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Could not save that password.');
        // A spent or expired token cannot be retried, so drop the form.
        if (res.status === 400) setValid(false);
        return;
      }
      setDone(true);
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  const field = 'w-full h-12 px-4 bg-white border border-gray-200 rounded-xl text-base text-gray-900 focus:border-emerald-700 focus:outline-none shadow-xs';

  return (
    <>
      <Head>
        <title>Set your password · Healthy Home Field Guide</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-6">
            <img src="/logo.svg?v=4" alt="" className="w-14 h-14 mx-auto mb-3" />
            <p className="text-lg font-black text-gray-900 leading-none">Healthy Home</p>
            <p className="text-sm text-gray-500 font-bold mt-1">Field Guide</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            {checking && (
              <p className="text-base text-gray-600 font-semibold text-center py-6">Checking your invitation…</p>
            )}

            {!checking && !valid && !done && (
              <div className="space-y-3">
                <h1 className="text-xl font-black text-gray-900">This link is no longer valid</h1>
                <p className="text-base text-gray-600 leading-relaxed">
                  Invitations can only be used once and expire after seven days.
                  {error ? ` ${error}` : ''}
                </p>
                <p className="text-base text-gray-600 leading-relaxed">
                  Ask an administrator to send you a new one, then open the link in that email.
                </p>
                <Link href="/" className="block w-full h-12 leading-[3rem] text-center bg-gray-100 hover:bg-gray-200 rounded-xl text-base font-black text-gray-700 transition-colors">
                  Go to sign in
                </Link>
              </div>
            )}

            {!checking && valid && !done && (
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <h1 className="text-xl font-black text-gray-900">Choose your password</h1>
                  <p className="text-base text-gray-600 leading-relaxed mt-1">
                    You will sign in as <strong className="text-gray-900">{name}</strong>.
                  </p>
                </div>

                {/* Present so password managers offer to save the right entry. */}
                <input type="text" name="username" autoComplete="username" value={name} readOnly hidden />

                <div>
                  <label htmlFor="pw" className="block text-xs font-black text-gray-600 uppercase tracking-wider mb-1">
                    New password
                  </label>
                  <input
                    id="pw"
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className={field}
                  />
                  <p className={`text-xs font-bold mt-1 ${tooShort ? 'text-red-600' : 'text-gray-400'}`}>
                    At least 8 characters.
                  </p>
                </div>

                <div>
                  <label htmlFor="pw2" className="block text-xs font-black text-gray-600 uppercase tracking-wider mb-1">
                    Confirm password
                  </label>
                  <input
                    id="pw2"
                    type={show ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    className={field}
                  />
                  {mismatch && <p className="text-xs font-bold mt-1 text-red-600">The two passwords do not match.</p>}
                </div>

                <label className="flex items-center gap-2 text-sm font-bold text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} className="w-4 h-4 accent-emerald-700" />
                  Show password
                </label>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-800 font-semibold">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="w-full h-12 bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-base font-black disabled:opacity-40 transition-colors"
                >
                  {saving ? 'Saving…' : 'Set password'}
                </button>
              </form>
            )}

            {done && (
              <div className="space-y-3 text-center">
                <div className="w-12 h-12 mx-auto bg-emerald-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-emerald-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 className="text-xl font-black text-gray-900">You are all set</h1>
                <p className="text-base text-gray-600 leading-relaxed">
                  Sign in as <strong className="text-gray-900">{name}</strong> with the password you just chose.
                </p>
                <Link href="/" className="block w-full h-12 leading-[3rem] text-center bg-emerald-800 hover:bg-emerald-900 text-white rounded-xl text-base font-black transition-colors">
                  Sign in
                </Link>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400 font-bold text-center mt-5 leading-relaxed">
            If you did not expect this invitation, you can ignore it — the link expires on its own.
          </p>
        </div>
      </div>
    </>
  );
}
