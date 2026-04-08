import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';

export default function OidcCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();
  
  useEffect(() => {
    const token = searchParams.get('token');
    if (token) {
      loginWithToken(token).then(() => {
        navigate('/');
      }).catch(err => {
        console.error('OIDC login failed:', err);
        navigate('/login?error=oidc_failed');
      });
    } else {
      navigate('/login?error=no_token');
    }
  }, [searchParams, navigate, loginWithToken]);

  return (
    <div className="flex-center" style={{ height: '100vh' }}>
      <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 className="animate-pulse-subtle">Authenticating...</h2>
        <p className="text-muted">Please wait while we verify your identity.</p>
      </div>
    </div>
  );
}
