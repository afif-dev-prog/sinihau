import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { api, setAuthToken, removeAuthToken } from './utils/api';
import './index.css';

// Pages
import Login from './pages/Login';
import StaffDashboard from './pages/StaffDashboard';
import HRDashboard from './pages/HRDashboard';
import AdminDashboard from './pages/AdminDashboard';
import SuperiorDashboard from './pages/SuperiorDashboard';
import OidcCallback from './pages/OidcCallback';
import FirstSetup from './pages/FirstSetup';

// Auth Context
const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      console.log('[Auth] Initializing auth...');
      try {
        if (localStorage.getItem('token')) {
          console.log('[Auth] Token found, fetching user profile...');
          const userData = await api.getMe();
          console.log('[Auth] Profile fetched successfully:', userData.email);
          setUser(userData);
        } else {
          console.log('[Auth] No token found in localStorage.');
        }
      } catch (err) {
        console.error('[Auth] Init auth failing:', err.message);
        removeAuthToken();
      } finally {
        setLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (credentials) => {
    const data = await api.login(credentials);
    setAuthToken(data.token);
    setUser(data.user);
  };

  const loginWithToken = async (token) => {
    setAuthToken(token);
    const userData = await api.getMe();
    setUser(userData);
  }

  const logout = () => {
    removeAuthToken();
    setUser(null);
  };

  if (loading) return <div className="flex-center" style={{ height: '100vh' }}>Initializing...</div>;

  return (
    <AuthContext.Provider value={{ user, setUser, login, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Route Guards
const ProtectedRoute = ({ children, roles }) => {
  const { user } = useAuth();

  if (!user) {
    console.log('[Auth] ProtectedRoute: User not loggged in, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
  if (user.firstLogin) {
    console.log('[Auth] ProtectedRoute: First login detected, redirecting to /first-setup');
    return <Navigate to="/first-setup" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    console.log('[Auth] ProtectedRoute: Role mismatch, redirecting to /');
    return <Navigate to="/" replace />;
  }

  return children;
};

// First Setup Guard
const FirstSetupRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!user.firstLogin) return <Navigate to="/" replace />; // already setup

  return children;
};

// Home Redirect
const HomeRedirect = () => {
  const { user } = useAuth();
  if (!user) {
    console.log('[Auth] HomeRedirect: No user, redirecting /login');
    return <Navigate to="/login" replace />;
  }
  if (user.firstLogin) {
    console.log('[Auth] HomeRedirect: First login, redirecting /first-setup');
    return <Navigate to="/first-setup" replace />;
  }

  console.log('[Auth] HomeRedirect: Routing based on role:', user.role);
  if (user.role === 'Admin') return <Navigate to="/admin" replace />;
  if (user.role === 'HR') return <Navigate to="/hr" replace />;
  return <Navigate to="/staff" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<OidcCallback />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route path="/first-setup" element={
            <FirstSetupRoute>
              <FirstSetup />
            </FirstSetupRoute>
          } />

          <Route path="/staff" element={
            <ProtectedRoute roles={['Staff', 'HR', 'Admin']}>
              <StaffDashboard />
            </ProtectedRoute>
          } />

          <Route path="/hr" element={
            <ProtectedRoute roles={['HR', 'Admin']}>
              <HRDashboard />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute roles={['Admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/superior" element={
            <ProtectedRoute roles={['Staff', 'HR', 'Admin']}>
              <SuperiorDashboard />
            </ProtectedRoute>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
