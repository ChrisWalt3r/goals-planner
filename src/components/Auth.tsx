import React, { useEffect, useState } from 'react';
import { usePlannerStore } from '../store';
import { cn } from '../lib/utils';
import { Cloud, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { signInWithPassword, signUpWithPassword } from '../lib/plannerApi';

type AuthFeedback = {
  tone: 'error' | 'success';
  message: string;
};

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
  placeholder: string;
}

function PasswordField({
  label,
  value,
  onChange,
  isVisible,
  onToggleVisibility,
  placeholder,
}: PasswordFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-white/40 mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <input
          type={isVisible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          aria-label={isVisible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/40 hover:text-white/80 transition-colors"
        >
          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

export default function Auth() {
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'forgot_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [feedback, setFeedback] = useState<AuthFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const setAuth = usePlannerStore((state) => state.setAuth);

  useEffect(() => {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFeedback(null);
  }, [authMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);

    const normalizedEmail = email.trim().toLowerCase();

    try {
      if (authMode === 'forgot_password') {
        const { resetPasswordForEmail } = await import('../lib/plannerApi');
        await resetPasswordForEmail(normalizedEmail);
        setFeedback({ tone: 'success', message: 'If an account exists, a password reset email has been sent.' });
        setIsSubmitting(false);
        return;
      }

      if (authMode === 'signup' && password !== confirmPassword) {
        setFeedback({ tone: 'error', message: 'Passwords do not match.' });
        setIsSubmitting(false);
        return;
      }

      const result = authMode === 'login'
        ? await signInWithPassword(normalizedEmail, password)
        : await signUpWithPassword(normalizedEmail, password);

      if (authMode === 'signup' && result.requiresEmailConfirmation) {
        setFeedback({
          tone: 'success',
          message: 'Account created. Check your email to confirm it, then sign in.',
        });
        setAuthMode('login');
        setIsSubmitting(false);
        return;
      }

      setAuth({ user: result.user, token: result.token });
    } catch (err: any) {
      let errorMessage = err instanceof Error ? err.message : 'Failed to authenticate';
      
      // Friendly message for rate limits
      if (errorMessage.toLowerCase().includes('rate limit')) {
        errorMessage = 'Email rate limit exceeded. Please wait a bit before trying again, or check your Supabase rate limit settings.';
      }

      setFeedback({
        tone: 'error',
        message: errorMessage,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLogin = authMode === 'login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md p-6 lg:p-8 rounded-2xl bg-[#1a1a1a] border border-white/10 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 border border-white/10">
            <Cloud className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Goal Digger</h1>
          <p className="text-white/50 text-sm mt-2">Visual Planning System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-white/40 mb-1.5 ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
              placeholder="name@example.com"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </div>

          {authMode !== 'forgot_password' && (
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              isVisible={showPassword}
              onToggleVisibility={() => setShowPassword((current) => !current)}
              placeholder="••••••••"
            />
          )}

          {authMode === 'signup' && (
            <PasswordField
              label="Confirm Password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              isVisible={showConfirmPassword}
              onToggleVisibility={() => setShowConfirmPassword((current) => !current)}
              placeholder="••••••••"
            />
          )}

          {authMode === 'login' && (
            <div className="flex justify-end px-1 mt-1">
              <button
                type="button"
                onClick={() => setAuthMode('forgot_password')}
                className="text-xs text-white/50 hover:text-white transition-colors"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {feedback && (
            <p
              className={cn(
                'text-sm text-center py-2 rounded-lg border shrink-0',
                feedback.tone === 'error'
                  ? 'text-red-300 bg-red-400/10 border-red-400/20'
                  : 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20'
              )}
            >
              {feedback.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-white/90 transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50"
          >
            {authMode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {authMode === 'login' ? 'Sign In' : authMode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          {authMode !== 'login' && (
            <button
              onClick={() => setAuthMode('login')}
              type="button"
              className="block w-full text-sm text-white/50 hover:text-white transition-colors"
            >
              Back to Sign in
            </button>
          )}
          {authMode === 'login' && (
            <button
              onClick={() => setAuthMode('signup')}
              type="button"
              className="text-sm text-white/50 hover:text-white transition-colors"
            >
              Don't have an account? Sign up
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
