'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Eye, EyeOff, LogOut, ArrowRight, UserCheck } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string; email?: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    if (params.get('signout') === 'true' || params.get('logout') === 'true') {
      supabase.auth.signOut().finally(() => {
        setCurrentUser(null);
        setChecking(false);
      });
      return;
    }

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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      await new Promise((r) => setTimeout(r, 200));
      window.location.href = '/';
    } else {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-bg">
        <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm p-8 bg-white border border-border rounded-2xl shadow-elevated">
        <div className="mb-6 text-center">
          <div className="text-2xl font-black tracking-tight text-text-primary">
            QUON<span className="text-sky-500">NECT</span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Data System Access
          </p>
        </div>

        {/* Existing Session Alert */}
        {currentUser && (
          <div className="mb-6 p-3.5 rounded-xl bg-slate-50 border border-border text-left animate-fade-in">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Already signed in</span>
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
                <span>Switch</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {error && (
            <div className="p-3 rounded-md bg-red-muted border border-red/30 text-xs text-red">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-text-tertiary uppercase tracking-wider mb-1.5">
              Email
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
                placeholder="Your password"
                required
                autoComplete="current-password"
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

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-accent text-white font-bold text-sm hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shadow-sm"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-border/60 text-center">
          <p className="text-xs text-text-secondary">
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-bold text-accent hover:text-accent-hover hover:underline transition-colors"
            >
              Create account
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
