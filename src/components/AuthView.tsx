import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { FormEvent, useState } from 'react';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth } from '../firebase';

type AuthMode = 'login' | 'signup';

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Switch to Log In instead.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not enabled yet in Firebase Console.';
    default:
      return 'Authentication failed. Please try again.';
  }
}

export function AuthView() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsProviderEnable, setNeedsProviderEnable] = useState(false);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetNotice(null);
    setNeedsProviderEnable(false);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setErrorMsg('Please enter both your email and password.');
      return;
    }

    if (mode === 'signup') {
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );
        if (displayName.trim()) {
          await updateProfile(cred.user, {
            displayName: displayName.trim(),
          });
        }
      } else {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      }
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: string }).code)
          : '';
      if (code === 'auth/operation-not-allowed') {
        setNeedsProviderEnable(true);
      }
      setErrorMsg(mapAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setResetNotice(null);
    setNeedsProviderEnable(false);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: string }).code)
          : '';
      setErrorMsg(mapAuthError(code));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMsg(null);
    setResetNotice(null);
    if (!email.trim()) {
      setErrorMsg('Enter your email address above first to reset your password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetNotice('Password reset link sent to your email address.');
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: string }).code)
          : '';
      setErrorMsg(mapAuthError(code));
    }
  };

  const providersConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`;

  return (
    <div className="min-h-screen bg-[#F4F6FA] flex flex-col">
      {/* Top Header Brand */}
      <header className="bg-[#182756] text-white border-b border-[#111D42]">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="w-5 h-5 text-white/90" aria-hidden="true" />
            <span className="font-display font-bold text-lg tracking-tight text-white">
              K-5 Pacing Calendar
            </span>
          </div>
          <span className="text-xs text-white/80 hidden sm:inline">
            Milford Grade School
          </span>
        </div>
      </header>

      {/* Main Centered Auth Workspace */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[#EEF1F8] px-6 py-5 border-b border-slate-200/80">
            <h1 className="font-display text-xl font-bold text-[#182756]">
              {mode === 'login' ? 'Sign in to your pacing calendar' : 'Create your teacher account'}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              {mode === 'login'
                ? 'Access your K-5 daily schedules, lesson plans, and sub plans securely.'
                : 'Your K-5 curriculum pacing, bell schedule, and notes are saved privately to your account.'}
            </p>
          </div>

          <div className="p-6 space-y-5">
            {/* Segmented Login / Sign Up Switch */}
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#EAEFF7]">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setResetNotice(null);
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'login'
                    ? 'bg-[#1D2F6F] text-white shadow-xs'
                    : 'text-[#1D2F6F]/80 hover:text-[#1D2F6F]'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                  setResetNotice(null);
                }}
                className={`py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  mode === 'signup'
                    ? 'bg-[#1D2F6F] text-white shadow-xs'
                    : 'text-[#1D2F6F]/80 hover:text-[#1D2F6F]'
                }`}
              >
                Sign Up
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-800 space-y-2"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
                {needsProviderEnable && (
                  <div className="pl-6 text-[11px] text-red-900 space-y-1">
                    <p>
                      To enable Email/Password sign-in: open your Firebase Authentication providers, click{' '}
                      <strong>Email/Password</strong>, toggle <strong>Enable</strong>, and save.
                    </p>
                    <a
                      href={providersConsoleUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 text-red-950"
                    >
                      <span>Open Firebase Auth Providers</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {resetNotice && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{resetNotice}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-name"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Teacher Name
                  </label>
                  <div className="relative">
                    <User
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-name"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Ms. Clark"
                      maxLength={80}
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1D2F6F]/25 focus:border-[#1D2F6F]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@school.org"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1D2F6F]/25 focus:border-[#1D2F6F]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      className="text-[11px] font-semibold text-[#1D2F6F] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock
                    className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <input
                    id="auth-password"
                    type="password"
                    required
                    autoComplete={
                      mode === 'login' ? 'current-password' : 'new-password'
                    }
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      mode === 'signup' ? 'At least 6 characters' : 'Enter password'
                    }
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1D2F6F]/25 focus:border-[#1D2F6F]"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label
                    htmlFor="auth-confirm"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-confirm"
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1D2F6F]/25 focus:border-[#1D2F6F]"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-[#1D2F6F] text-white text-xs font-semibold hover:bg-[#152459] disabled:opacity-55 transition-colors cursor-pointer"
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                  ? 'Log In'
                  : 'Create Account'}
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="flex-grow border-t border-slate-200" />
              <span className="shrink mx-3 text-[11px] font-medium text-slate-400">
                or
              </span>
              <div className="flex-grow border-t border-slate-200" />
            </div>

            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
