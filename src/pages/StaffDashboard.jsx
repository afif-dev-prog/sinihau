import React, { useState, useEffect } from 'react';
import { useAuth } from '../App';
import Navbar from '../components/Navbar';
import { api } from '../utils/api';
import { MapPin, Clock, CheckCircle, XCircle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ResponsiveTable from '../components/ResponsiveTable';

export default function StaffDashboard() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [bypassPrompt, setBypassPrompt] = useState(null);
  const [isSuperior, setIsSuperior] = useState(false);
  const navigate = useNavigate();
  
  // Modal state
  const [showHomeModal, setShowHomeModal] = useState(!user?.home_locked);
  const [locationStatus, setLocationStatus] = useState('');
  
  useEffect(() => {
    fetchStatus();
    fetchHistory();
    checkIfSuperior();
  }, []);

  const checkIfSuperior = async () => {
    try {
      const res = await api.checkSuperior();
      setIsSuperior(res.isSuperior);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await api.getStatus();
      setStatus(res);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.getHistory();
      setHistory(res.logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  const getCurrentPosition = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
      } else {
        setLocationStatus('Fetching GPS location...');
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }),
          () => reject(new Error("Unable to retrieve your location. Please allow location access.")),
          { enableHighAccuracy: true }
        );
      }
    });
  };

  const handleSetHome = async () => {
    setError('');
    setLoading(true);
    try {
      const coords = await getCurrentPosition();
      setLocationStatus('Saving home location...');
      const updated = await api.setHome(coords);
      setUser(prev => ({ ...prev, home_locked: true, home_lat: coords.lat, home_lng: coords.lng }));
      setShowHomeModal(false);
    } catch (err) {
      setError(err.message || 'Failed to set home location');
    } finally {
      setLoading(false);
      setLocationStatus('');
    }
  };

  const handleClockAction = async (action) => {
    setError('');
    setLoading(true);
    try {
      let coords = { lat: null, lng: null };
      
      coords = await getCurrentPosition();
      
      setLocationStatus(`Clocking ${action}...`);
      
      const payload = { lat: coords.lat, lng: coords.lng };
      
      if (action === 'in') {
        await api.clockIn(payload);
      } else {
        await api.clockOut(payload);
      }
      
      setBypassPrompt(null);
      await fetchStatus();
      await fetchHistory();
    } catch (err) {
      setError(err.message || 'Action failed');
      if (err.message && err.message.includes('from home')) {
        setBypassPrompt(action);
      } else {
        setBypassPrompt(null);
      }
    } finally {
      setLoading(false);
      setLocationStatus('');
    }
  };

  const handleForceBypass = async () => {
    if (!window.confirm("This will log an invalid GPS rating and immediately notify your manager. Continue?")) return;
    
    setError('');
    setLoading(true);
    try {
      setLocationStatus(`Clocking ${bypassPrompt} (Bypass)...`);
      const payload = { lat: 0, lng: 0, forceBypass: true };
      
      if (bypassPrompt === 'in') {
        await api.clockIn(payload);
      } else {
        await api.clockOut(payload);
      }
      
      setBypassPrompt(null);
      await fetchStatus();
      await fetchHistory();
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
      setLocationStatus('');
    }
  };

  const isClockedIn = status?.clockedIn;
  const isClockedOut = status?.clockedOut;

  const columns = [
    {
      name: '#',
      selector: (row, index) => index + 1,
      width: '60px'
    },
    {
      name: 'Date',
      selector: row => row.timestamp,
      sortable: true,
      cell: row => format(new Date(row.timestamp * 1000), 'MMM dd, yyyy')
    },
    {
      name: 'Time',
      selector: row => row.timestamp,
      sortable: true,
      cell: row => format(new Date(row.timestamp * 1000), 'hh:mm a')
    },
    {
      name: 'Action',
      selector: row => row.type,
      sortable: true,
      cell: row => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
          {row.type === 'CLOCK_IN' ? <CheckCircle size={14} color="var(--success)" /> : <XCircle size={14} color="var(--warning)" />}
          <span style={{ color: row.type === 'CLOCK_IN' ? 'var(--success)' : 'var(--warning)' }}>
            {row.type.replace('_', ' ')}
          </span>
        </div>
      )
    },
    {
      name: 'Validation',
      selector: row => row.isWithinRadius,
      sortable: true,
      cell: row => (
        row.isWithinRadius ? (
          <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle size={14} /> Valid (~{row.distanceRadius}m)
          </span>
        ) : (
          <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <XCircle size={14} /> Invalid ({row.distanceRadius}m)
          </span>
        )
      )
    }
  ];

  return (
    <div>
      <Navbar />
      
      {showHomeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', maxWidth: '400px', width: '90%' }}>
            <div className="flex-center" style={{ marginBottom: '1rem', color: 'var(--warning)' }}>
              <MapPin size={48} />
            </div>
            <h3 style={{ textAlign: 'center', marginBottom: '1rem' }}>Set Home Location</h3>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '2rem', fontSize: '0.9rem' }}>
              Welcome! Before you can clock in, you must set your home location. 
              This will lock your GPS coordinates and cannot be changed later.
            </p>
            
            {error && <div className="badge danger" style={{ width: '100%', marginBottom: '1rem', justifyContent: 'center' }}>{error}</div>}
            
            <button 
              onClick={handleSetHome}
              disabled={loading}
              style={{
                width: '100%', padding: '1rem', background: 'var(--success)', 
                color: 'white', border: 'none', borderRadius: 'var(--radius-md)',
                fontWeight: 'bold', fontSize: '1.1rem', cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)'
              }}
            >
              {loading ? locationStatus : 'Lock Current GPS as Home'}
            </button>
          </div>
        </div>
      )}

      <div className="app-container dashboard-layout">
        {/* Left Column: Actions */}
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          

          <h2 style={{ marginBottom: '2rem' }}>Today's Status</h2>
          
          <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
            {isClockedOut ? (
              <div className="badge" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', padding: '1rem 2rem', fontSize: '1.2rem' }}>
                <CheckCircle color="var(--success)" style={{ marginRight: '0.5rem' }}/> Shift Completed
              </div>
            ) : isClockedIn ? (
              <div className="badge success" style={{ padding: '1rem 2rem', fontSize: '1.2rem' }}>
                <Clock style={{ marginRight: '0.5rem' }}/> Clocked In
              </div>
            ) : (
              <div className="badge danger" style={{ padding: '1rem 2rem', fontSize: '1.2rem' }}>
                <XCircle style={{ marginRight: '0.5rem' }}/> Not Clocked In
              </div>
            )}
          </div>

          {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}
          {locationStatus && <div style={{ color: 'var(--accent-primary)', marginBottom: '1rem', textAlign: 'center' }}>{locationStatus}</div>}

          {!isClockedOut && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
              <button
                onClick={() => handleClockAction(isClockedIn ? 'out' : 'in')}
                disabled={loading || showHomeModal}
                className={loading ? '' : 'animate-pulse-subtle'}
                style={{
                  width: '200px', height: '200px', borderRadius: '50%',
                  background: isClockedIn ? 'linear-gradient(135deg, var(--warning), #D97706)' : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  border: 'none', color: 'white', fontSize: '1.5rem', fontWeight: 'bold',
                  cursor: (loading || showHomeModal) ? 'not-allowed' : 'pointer',
                  boxShadow: isClockedIn ? '0 0 30px rgba(245, 158, 11, 0.4)' : 'var(--shadow-glow)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}
              >
                <MapPin size={32} />
                {loading ? 'Wait...' : isClockedIn ? 'CLOCK OUT' : 'CLOCK IN'}
              </button>

              {bypassPrompt && (
                <div style={{ marginTop: '2rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                  <div className="badge warning" style={{ padding: '0.75rem', width: '100%', justifyContent: 'center', textAlign: 'center' }}>
                    You are outside the permitted area. Do you want to force bypass?
                  </div>
                  <button
                    onClick={handleForceBypass}
                    disabled={loading}
                    style={{
                      width: '100%', maxWidth: '250px', padding: '1rem', borderRadius: 'var(--radius-md)',
                      background: 'var(--danger)', color: 'white', border: 'none', fontWeight: 'bold',
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Force Bypass Validation
                  </button>
                </div>
              )}
            </div>
          )}

          <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
            Make sure you are within 200m of your locked home location.
          </p>
        </div>

        {/* Right Column: History */}
        <div className="glass-panel animate-fade-in" style={{ padding: '2.5rem', animationDelay: '0.1s' }}>
          {history.length === 0 ? (
            <div>
              <h2 style={{ margin: 0, marginBottom: '2.5rem' }}>Attendance History</h2>
              <p style={{ color: 'var(--text-muted)' }}>No attendance records found.</p>
            </div>
          ) : (
            <ResponsiveTable
              title={<h2 style={{ margin: 0, paddingBottom: '1rem' }}>Attendance History</h2>}
              columns={columns}
              data={history}
              pagination
            />
          )}
        </div>
      </div>
    </div>
  );
}
