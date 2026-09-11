'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight, Loader2, UserCheck, LogOut } from 'lucide-react';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    // Read email query param if prefilled via invitation link
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const prefillEmail = params.get('email');
      if (prefillEmail) {
        setEmail(decodeURIComponent(prefillEmail));
      }
      if (params.get('signout') === 'true' || params.get('logout') === 'true') {
        const supabase = createClient();
        supabase.auth.signOut().finally(() => {
          setCurrentUser(null);
          setChecking(false);
        });
        return;
      }
    }

    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }: { data: { user: any } }) => {
        if (data?.user) {
          setCurrentUser(data.user);
        }
        setChecking(false);
      })
      .catch(() => {
        setChecking(false);
      });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { invited: 'true' },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      // If user session is created immediately (email confirmation disabled or auto-confirmed)
      if (data.session) {
        setSuccessMessage('Account created successfully! Redirecting...');
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
      } else if (data.user) {
        // If Supabase requires email verification
        setSuccessMessage(
          'Account created! If email confirmation is enabled on your project, please check your inbox to confirm your account, then sign in.'
        );
        setLoading(false);
      } else {
        setError('Signup failed. Please try again.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during signup.');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md p-8 bg-white border border-border rounded-2xl shadow-elevated">
        <div className="mb-6 text-center">
          <div className="text-2xl font-black tracking-tight text-text-primary">
            QUON<span className="text-sky-500">NECT</span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Create Data System Account
          </p>
        </div>

        {/* Existing Session Alert */}
        {currentUser && !successMessage && (
          <div className="mb-6 p-3.5 rounded-xl bg-slate-50 border border-border text-left animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Currently signed in</span>
            </div>
            <p className="text-[11px] text-text-muted mt-1 truncate">
              {currentUser.email}
            </p>
            <div className="mt-3 flex gap-2">
              <Link
                href="/"
                className="flex-1 py-1.5 px-2.5 rounded-lg bg-accent text-white text-xs font-bold text-center hover:bg-accent-hover transition-colors inline-flex items-center justify-center gap-1 shadow-2xs"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="py-1.5 px-2.5 rounded-lg border border-border bg-white text-text-secondary text-xs font-medium hover:text-text-primary hover:bg-slate-100 transition-colors inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}

        {successMessage ? (
          <div className="space-y-5 animate-fade-in text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text-primary">Account Created</h3>
              <p className="text-xs text-text-secondary mt-2 leading-relaxed px-2">
                {successMessage}
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-accent text-white font-bold text-sm hover:bg-accent-hover transition-colors shadow-sm cursor-pointer"
              >
                <span>Go to Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-red-muted border border-red/30 text-xs text-red flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@quonnect.com"
                required
                autoComplete="email"
                className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  autoComplete="new-password"
                  className="w-full bg-bg-input border border-border rounded-lg pl-3 pr-10 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer p-0.5"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  autoComplete="new-password"
                  className="w-full bg-bg-input border border-border rounded-lg pl-3 pr-10 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors cursor-pointer p-0.5"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-border rounded-lg text-[11px] text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary">Note:</span> New accounts require administrator approval. You will receive role access once reviewed by an admin.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-accent text-white font-bold text-sm hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 pt-5 border-t border-border/60 text-center">
          <p className="text-xs text-text-secondary">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-bold text-accent hover:text-accent-hover hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-[10px] text-text-muted text-center mt-4">
          Access is restricted to authorized personnel only.
        </p>
      </div>
    </div>
  );
}
