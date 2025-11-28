'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { Alert } from '@/app/components/ui';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    polly_api_key: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        await login({
          username: formData.username,
          password: formData.password,
        });
        router.push('/dashboard');
      } else {
        await register({
          username: formData.username,
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          last_name: formData.last_name,
          polly_api_key: formData.polly_api_key,
        });
        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-400 to-[#8a86dc]">
      <div className="fixed top-6 left-6">
        <h1 className="text-2xl font-bold text-white drop-shadow-lg">
          Cohort Builder
        </h1>
      </div>

      <div className="w-full max-w-md mx-4 animate-slide-up">
        <div className="bg-white rounded-sm shadow-xl p-8 border border-primary">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-primary">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="mt-2 text-text-light">
              {isLogin ? 'Sign in to continue building cohorts' : 'Join us to start building cohorts'}
            </p>
          </div>

          {error && (
            <div className="mb-4">
              <Alert variant="error" dismissible={false}>
                {error}
              </Alert>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label htmlFor="username" className="form-label">
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="form-control"
                placeholder="Enter your username"
                disabled={isLoading}
              />
            </div>

            {!isLogin && (
              <>
                <div className="form-group">
                  <label htmlFor="email" className="form-label">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="form-control"
                    placeholder="Enter your email"
                    disabled={isLoading}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label htmlFor="first_name" className="form-label">
                      First Name
                    </label>
                    <input
                      type="text"
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="First name"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="last_name" className="form-label">
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      className="form-control"
                      placeholder="Last name"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="polly_api_key" className="form-label">
                    Polly API Key
                  </label>
                  <input
                    type="text"
                    id="polly_api_key"
                    name="polly_api_key"
                    value={formData.polly_api_key}
                    onChange={handleChange}
                    className="form-control"
                    placeholder="Enter your Polly API key"
                    disabled={isLoading}
                  />
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="password" className="form-label">
                Password
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="form-control"
                placeholder="Enter your password"
                disabled={isLoading}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-accent w-full py-3 text-white rounded-sm transition-all flex items-center justify-center gap-2 font-medium mt-6 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
              {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setFormData({
                  username: '',
                  email: '',
                  password: '',
                  first_name: '',
                  last_name: '',
                  polly_api_key: '',
                });
              }}
              className="text-sm font-medium transition-colors text-primary hover:text-primary-dark"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>

        <p className="text-center mt-6 text-sm text-white drop-shadow-md">
          Build powerful patient cohorts with natural language queries
        </p>
      </div>
    </div>
  );
}
