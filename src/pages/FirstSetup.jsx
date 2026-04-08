import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { api } from '../utils/api';
import { Lock, AlertCircle } from 'lucide-react';

export default function FirstSetup() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, loginWithToken, logout } = useAuth();
  const navigate = useNavigate();

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      return setError('Password must be at least 6 characters long');
    }
    if (password !== confirmPassword) {
      return setError('Passwords do not match');
    }

    setLoading(true);
    try {
      const res = await api.changePassword({ newPassword: password });
      // Update global auth context by rehydrating the new token
      await loginWithToken(res.token);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-center" style={{ minHeight: '100vh', padding: '1rem', background: 'var(--bg-primary)' }}>
      <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem', width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column' }}>
        
        <div className="flex-center" style={{ marginBottom: '1.5rem' }}>
          <div style={{ background: 'var(--accent-glow)', padding: '1rem', borderRadius: '50%' }}>
            <Lock size={32} color="var(--accent-primary)" />
          </div>
        </div>

        <h1 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Welcome to Attendance</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Since this is your first time logging in, you are required to set a new, secure password for your account.
        </p>

        {error && (
          <div className="badge danger" style={{ width: '100%', marginBottom: '1.5rem', padding: '0.75rem', justifyContent: 'center' }}>
            <AlertCircle size={16} style={{ marginRight: '0.5rem' }} /> {error}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit}>
          <div className="form-group">
            <label>New Password</label>
            <input 
              type="password" 
              placeholder="Enter new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: '2rem' }}>
            <label>Confirm Password</label>
            <input 
              type="password" 
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ 
              width: '100%', padding: '0.85rem', background: 'var(--accent-primary)', 
              color: 'white', border: 'none', borderRadius: 'var(--radius-md)', 
              fontWeight: '600', cursor: loading ? 'wait' : 'pointer' 
            }}
          >
            {loading ? 'Updating Password...' : 'Save and Continue'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); }}>Log out and complete later</a>
        </p>
      </div>
    </div>
  );
}
