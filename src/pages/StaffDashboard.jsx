import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../App';
import Navbar from '../components/Navbar';
import { api } from '../utils/api';
import { isTimestampToday, formatDateInTargetTimezone, formatTimeInTargetTimezone, isPunctual, getNowInTargetTimezone } from '../utils/dateUtils';
import { MapPin, Clock, CheckCircle, XCircle, Users, Search, TrendingUp, BarChart as BarIcon, PieChart as PieIcon, LayoutDashboard, History, Activity, Award } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ResponsiveTable from '../components/ResponsiveTable';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, Popup } from 'react-leaflet';

// Fix Leaflet default marker icons broken by Vite's asset pipeline
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DEFAULT_MAP_CENTER = [4.1618, 114.0916]; // Sarawak, Malaysia

// Smoothly recenters the map whenever coords change (must live inside MapContainer)
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => { if (coords) map.flyTo(coords, 16); }, [coords]);
  return null;
}

// Draggable marker — calls onPositionChange([lat, lng]) after each drag
function DraggableMarker({ position, onPositionChange }) {
  const markerRef = useRef(null);
  return (
    <Marker
      position={position}
      draggable={true}
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const m = markerRef.current;
          if (m) {
            const { lat, lng } = m.getLatLng();
            onPositionChange([lat, lng]);
          }
        }
      }}
    />
  );
}

export default function StaffDashboard() {
  const { user, setUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');
  const [bypassPrompt, setBypassPrompt] = useState(null);
  const [bypassCoords, setBypassCoords] = useState(null);
  const [remark, setRemark] = useState('');
  const [todaysJob, setTodaysJob] = useState('');
  const [isSuperior, setIsSuperior] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [activeTab, setActiveTab] = useState('logs');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const navigate = useNavigate();

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;
  
  // Modal state
  const [showHomeModal, setShowHomeModal] = useState(!user?.home_locked);
  const [locationStatus, setLocationStatus] = useState('');
  const [homeCoords, setHomeCoords] = useState(null);    // [lat, lng] chosen in the modal
  const [addressInput, setAddressInput] = useState('');
  const [addressSearching, setAddressSearching] = useState(false);
  const [gpsInitializing, setGpsInitializing] = useState(false);
  
  useEffect(() => {
    fetchStatus();
    fetchHistory();
    checkIfSuperior();

    // Auto-refresh data and check for day rollover every minute
    // This allows users who leave the tab open overnight to clock in when the new day arrives
    const interval = setInterval(() => {
      fetchStatus();
      fetchHistory();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto-fetch GPS to pre-position the map marker when the home modal opens
  useEffect(() => {
    if (showHomeModal) {
      setGpsInitializing(true);
      setHomeCoords(null);
      getCurrentPosition()
        .then(({ lat, lng }) => setHomeCoords([lat, lng]))
        .catch(() => {}) // user can still place pin manually
        .finally(() => setGpsInitializing(false));
    }
  }, [showHomeModal]);

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
    if (!homeCoords) { setError('Please select your home location on the map first.'); return; }
    setError('');
    setLoading(true);
    try {
      setLocationStatus('Saving home location...');
      const [lat, lng] = homeCoords;
      await api.setHome({ lat, lng });
      setUser(prev => ({ ...prev, home_locked: true, home_lat: lat, home_lng: lng }));
      setShowHomeModal(false);
    } catch (err) {
      setError(err.message || 'Failed to set home location');
    } finally {
      setLoading(false);
      setLocationStatus('');
    }
  };

  const handleAddressSearch = async () => {
    if (!addressInput.trim()) return;
    setAddressSearching(true);
    setError('');
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressInput)}&limit=1`
      );
      const data = await res.json();
      if (data.length > 0) {
        setHomeCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      } else {
        setError('Address not found. Try a more specific address.');
      }
    } catch {
      setError('Address search failed. Try dragging the pin on the map instead.');
    } finally {
      setAddressSearching(false);
    }
  };

  const handleClockAction = async (action) => {
    if (action === 'out' && !todaysJob.trim()) {
      setError('Please provide your job summary before clocking out.');
      return;
    }

    setError('');
    setLoading(true);
    let coords = { lat: null, lng: null };
    try {
      coords = await getCurrentPosition();
      
      setLocationStatus(`Clocking ${action}...`);
      
      const payload = { 
        lat: coords.lat, 
        lng: coords.lng,
        remark: action === 'in' ? remark : undefined,
        todaysjob: action === 'out' ? todaysJob : undefined
      };
      
      if (action === 'in') {
        await api.clockIn(payload);
      } else {
        await api.clockOut(payload);
      }
      
      setBypassPrompt(null);
      setBypassCoords(null);
      await fetchStatus();
      await fetchHistory();
    } catch (err) {
      setError(err.message || 'Action failed');
      if (err.message && err.message.includes('from home')) {
        setBypassPrompt(action);
        setBypassCoords(coords);
      } else {
        setBypassPrompt(null);
        setBypassCoords(null);
      }
    } finally {
      setLoading(false);
      setLocationStatus('');
    }
  };

  const handleForceBypass = async () => {
    if (bypassPrompt === 'in' && !remark.trim()) {
      setError('Please provide a remark for bypassing location constraints.');
      return;
    }
    if (bypassPrompt === 'out' && !todaysJob.trim()) {
      setError('Please provide your job summary before bypassing clock out.');
      return;
    }

    if (!window.confirm("This will log an invalid GPS rating and immediately notify your manager. Continue?")) return;
    
    setError('');
    setLoading(true);
    try {
      setLocationStatus(`Clocking ${bypassPrompt} (Bypass)...`);
      const payload = { 
        lat: bypassCoords?.lat || 0, 
        lng: bypassCoords?.lng || 0, 
        forceBypass: true,
        remark: bypassPrompt === 'in' ? remark : undefined,
        todaysjob: bypassPrompt === 'out' ? todaysJob : undefined
      };
      
      if (bypassPrompt === 'in') {
        await api.clockIn(payload);
      } else {
        await api.clockOut(payload);
      }
      
      setBypassPrompt(null);
      setBypassCoords(null);
      await fetchStatus();
      await fetchHistory();
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setLoading(false);
      setLocationStatus('');
    }
  };

  // Check if the most recent attendance record is from today.
  // If yesterday's shift was completed, status.clockedOut is still true —
  // so we verify against the latest history timestamp before trusting it.
  // Removed local isTimestampToday and replaced with utility call

  const latestTimestamp =
    history.length > 0 ? Math.max(...history.map((r) => r.timestamp)) : null;
  const hasActivityToday = isTimestampToday(latestTimestamp);

  const isClockedIn = hasActivityToday && status?.clockedIn;
  const isClockedOut = hasActivityToday && status?.clockedOut;

  // Extract today's logs for the mini-map
  const getLat = (log) => {
    if (!log) return null;
    if (log.lat !== undefined) return log.lat;
    if (log.location?.lat !== undefined) return log.location.lat;
    if (log.location?.coordinates) return log.location.coordinates[1];
    return null;
  };

  const getLng = (log) => {
    if (!log) return null;
    if (log.lng !== undefined) return log.lng;
    if (log.location?.lng !== undefined) return log.location.lng;
    if (log.location?.coordinates) return log.location.coordinates[0];
    return null;
  };

  const todayLogs = history.filter(r => isTimestampToday(r.timestamp));
  const clockInLog = todayLogs.find(r => r.type === 'CLOCK_IN');
  const clockOutLog = todayLogs.find(r => r.type === 'CLOCK_OUT');
  
  const cInLat = getLat(clockInLog);
  const cInLng = getLng(clockInLog);
  const cOutLat = getLat(clockOutLog);
  const cOutLng = getLng(clockOutLog);

  const mapCenter = (cInLat && cInLng) ? [cInLat, cInLng] : ((cOutLat && cOutLng) ? [cOutLat, cOutLng] : DEFAULT_MAP_CENTER);

  // Custom icons for the mini map markers
  const clockInIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  const clockOutIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

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
      cell: row => formatDateInTargetTimezone(row.timestamp)
    },
    {
      name: 'Time',
      selector: row => row.timestamp,
      sortable: true,
      cell: row => formatTimeInTargetTimezone(row.timestamp)
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

  // Calculate Personal Analytics
  const personalStats = React.useMemo(() => {
    if (history.length === 0) return null;

    const days = {};
    history.forEach(log => {
      const dateKey = formatDateInTargetTimezone(log.timestamp);
      if (!days[dateKey]) days[dateKey] = { in: null, out: null, isBypassed: false };
      if (log.type === 'CLOCK_IN') days[dateKey].in = log.timestamp;
      if (log.type === 'CLOCK_OUT') days[dateKey].out = log.timestamp;
      if (!log.isWithinRadius) days[dateKey].isBypassed = true;
    });

    const dayList = Object.values(days).filter(d => d.in);
    const totalDays = dayList.length;
    
    let totalPunctual = 0;
    let totalHours = 0;
    let avgClockInMinutes = 0;
    const workHoursTrend = [];

    dayList.forEach(day => {
      // Punctuality check (8:00 AM)
      if (isPunctual(day.in, 8, 0)) totalPunctual++;
      
      // Work hours
      if (day.out) {
        const hours = (day.out - day.in) / 3600;
        if (hours > 0) {
          totalHours += hours;
          workHoursTrend.push({
            date: formatDateInTargetTimezone(day.in).split(' ')[0], // Short date
            hours: parseFloat(hours.toFixed(2))
          });
        }
      }

      // Avg clock in
      const date = new Date(day.in * 1000);
      const malaysianDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Kuala_Lumpur"}));
      avgClockInMinutes += (malaysianDate.getHours() * 60) + malaysianDate.getMinutes();
    });

    const avgClockInRaw = totalDays > 0 ? avgClockInMinutes / totalDays : 0;
    const avgHH = Math.floor(avgClockInRaw / 60);
    const avgMM = Math.floor(avgClockInRaw % 60);

    return {
      totalDays,
      punctualityRate: totalDays > 0 ? Math.round((totalPunctual / totalDays) * 100) : 0,
      totalHours: totalHours.toFixed(1),
      avgHours: totalDays > 0 ? (totalHours / totalDays).toFixed(1) : 0,
      avgClockIn: `${avgHH.toString().padStart(2, '0')}:${avgMM.toString().padStart(2, '0')}`,
      workHoursTrend: workHoursTrend.slice(-10), // Last 10 days
      punctualityData: [
        { name: 'Punctual', value: totalPunctual },
        { name: 'Late', value: totalDays - totalPunctual }
      ]
    };
  }, [history]);

  return (
    <div>
      <Navbar />
      
      {showHomeModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            width: '100%', maxWidth: '620px', maxHeight: '92vh',
            overflowY: 'auto', padding: '2rem'
          }}>

            {/* Header */}
            <div className="flex-center" style={{ marginBottom: '0.75rem', color: 'var(--warning)' }}>
              <MapPin size={36} />
            </div>
            <h3 style={{ textAlign: 'center', marginBottom: '0.4rem' }}>Set Home Location</h3>
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginBottom: '1.25rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
              Search your address or drag the pin to mark your exact home location.<br />
              <strong style={{ color: 'var(--warning)' }}>This is permanent and cannot be changed later.</strong>
            </p>

            {/* Address Search */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <input
                type="text"
                placeholder="Search address (e.g. Jalan Pending, Kuching...)"
                value={addressInput}
                onChange={e => setAddressInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddressSearch()}
                style={{
                  flex: 1, padding: '0.7rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass)',
                  color: 'var(--text-primary)', fontSize: '0.9rem',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleAddressSearch}
                disabled={addressSearching}
                style={{
                  padding: '0.7rem 1.1rem',
                  background: 'var(--accent-primary)', color: 'white',
                  border: 'none', borderRadius: 'var(--radius-md)',
                  cursor: addressSearching ? 'wait' : 'pointer',
                  fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem'
                }}
              >
                <Search size={16} />
                {addressSearching ? '...' : 'Search'}
              </button>
            </div>

            {/* Map */}
            <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '0.75rem', border: '1px solid var(--border-glass)' }}>
              {gpsInitializing ? (
                <div style={{
                  height: '300px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexDirection: 'column', gap: '0.75rem',
                  background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '0.9rem'
                }}>
                  <MapPin size={28} style={{ opacity: 0.4 }} />
                  Fetching your GPS location...
                </div>
              ) : (
                <MapContainer
                  center={homeCoords || DEFAULT_MAP_CENTER}
                  zoom={homeCoords ? 16 : 12}
                  style={{ height: '300px', width: '100%' }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {homeCoords && (
                    <>
                      <DraggableMarker position={homeCoords} onPositionChange={setHomeCoords} />
                      <RecenterMap coords={homeCoords} />
                    </>
                  )}
                </MapContainer>
              )}
            </div>

            {/* Coordinates display */}
            {homeCoords ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '1rem' }}>
                📍 {homeCoords[0].toFixed(6)}, {homeCoords[1].toFixed(6)}&nbsp;—&nbsp;drag the pin to fine-tune
              </p>
            ) : !gpsInitializing && (
              <p style={{ fontSize: '0.78rem', color: 'var(--warning)', textAlign: 'center', marginBottom: '1rem' }}>
                ⚠️ GPS not available. Search an address or click the map to place the pin.
              </p>
            )}

            {/* Error */}
            {error && (
              <div className="badge danger" style={{
                width: '100%', display: 'block', textAlign: 'center',
                marginBottom: '1rem', padding: '0.75rem'
              }}>
                {error}
              </div>
            )}

            {/* Confirm Button */}
            <button
              onClick={handleSetHome}
              disabled={loading || !homeCoords}
              style={{
                width: '100%', padding: '1rem',
                background: homeCoords ? 'var(--success)' : 'var(--bg-secondary)',
                color: homeCoords ? 'white' : 'var(--text-muted)',
                border: homeCoords ? 'none' : '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 'bold', fontSize: '1rem',
                cursor: (loading || !homeCoords) ? 'not-allowed' : 'pointer',
                boxShadow: homeCoords ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              {loading ? locationStatus : homeCoords ? '📌 Lock This Location as Home' : 'Select a location on the map first'}
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
              
              {(isClockedIn && !isClockedOut) && (
                <div className="animate-fade-in" style={{ width: '100%', maxWidth: '300px', marginBottom: '1.5rem' }}>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Today's Job Summary *</label>
                  <textarea 
                    value={todaysJob} 
                    onChange={(e) => setTodaysJob(e.target.value)}
                    placeholder="What did you do today?"
                    maxLength={100}
                    rows={2}
                    style={{ width: '100%', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', resize: 'none' }} 
                  />
                </div>
              )}

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

                  {bypassPrompt === 'in' && (
                    <div className="animate-fade-in" style={{ width: '100%', maxWidth: '100%', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Reason for Late / Out of Bounds *</label>
                      <textarea 
                        value={remark} 
                        onChange={(e) => setRemark(e.target.value)}
                        placeholder="Enter bypass remark (max 100 chars)"
                        maxLength={100}
                        rows={2}
                        style={{ width: '100%', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none', resize: 'none' }} 
                      />
                    </div>
                  )}

                  {bypassCoords && bypassCoords.lat && bypassCoords.lng && (
                    <div style={{ width: '100%', marginBottom: '1rem', marginTop: '0.5rem' }}>
                      <p style={{ textAlign: 'center', fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 'bold' }}>
                        Your Current Location vs Locked Home
                      </p>
                      <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                        <MapContainer
                          center={[bypassCoords.lat, bypassCoords.lng]}
                          zoom={16}
                          style={{ height: '200px', width: '100%' }}
                          scrollWheelZoom={false}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          />
                          <Marker position={[bypassCoords.lat, bypassCoords.lng]} icon={clockOutIcon} />
                          {user?.home_lat && user?.home_lng && (
                              <Marker position={[user.home_lat, user.home_lng]} icon={clockInIcon} />
                          )}
                        </MapContainer>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <MapPin size={14} color="#cb8427" /> You Are Here
                        </div>
                        {user?.home_lat && user?.home_lng && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <MapPin size={14} color="#2aad27" /> Locked Home Location
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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

              <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center' }}>
                Make sure you are within 200m of your locked home location.
              </p>
            </div>
          )}


          {/* Today's Mini Map */}
          {hasActivityToday && (clockInLog || clockOutLog) && (
            <div style={{ marginTop: '2rem', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <button 
                onClick={() => setShowMiniMap(!showMiniMap)}
                style={{
                  background: 'transparent', border: '1px solid var(--border-glass)', 
                  color: 'var(--text-primary)', padding: '0.6rem 1.2rem', borderRadius: 'var(--radius-md)', 
                  cursor: 'pointer', fontSize: '0.9rem', marginBottom: showMiniMap ? '1rem' : '0'
                }}
              >
                {showMiniMap ? 'Hide Minimap Location' : 'Show Minimap Location'}
              </button>

              {showMiniMap && (
                <div className="animate-fade-in" style={{ width: '100%' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', textAlign: 'center' }}>Today's Location</h3>
              <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-glass)' }}>
                <MapContainer
                  center={mapCenter}
                  zoom={15}
                  style={{ height: '250px', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />
                  {(cInLat !== null && cInLng !== null) && (
                    <Marker position={[cInLat, cInLng]} icon={clockInIcon} />
                  )}
                  {(cOutLat !== null && cOutLng !== null) && (
                    <Marker position={[cOutLat, cOutLng]} icon={clockOutIcon} />
                  )}
                </MapContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <MapPin size={14} color="#2aad27" /> Clock In Location
                </div>
                {clockOutLog && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <MapPin size={14} color="#cb8427" /> Clock Out Location
                  </div>
                )}
              </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: History & Analytics Tabs */}
        <div className="glass-panel animate-fade-in" style={{ padding: '0', animationDelay: '0.1s', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          
          {/* Tab Navigation */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-glass)' }}>
            <button 
              onClick={() => setActiveTab('logs')}
              style={{
                flex: 1, padding: '1.25rem', border: 'none', background: activeTab === 'logs' ? 'var(--accent-glow)' : 'transparent',
                color: activeTab === 'logs' ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <History size={18} /> Attendance Logs
            </button>
            <button 
              onClick={() => setActiveTab('analytics')}
              style={{
                flex: 1, padding: '1.25rem', border: 'none', background: activeTab === 'analytics' ? 'var(--accent-glow)' : 'transparent',
                color: activeTab === 'analytics' ? 'var(--accent-primary)' : 'var(--text-muted)', fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <TrendingUp size={18} /> My Analytics
            </button>
          </div>

          <div style={{ padding: '2rem', flex: 1, overflowY: 'auto' }}>
            {activeTab === 'logs' ? (
              history.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <History size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.3 }} />
                  <p style={{ color: 'var(--text-muted)' }}>No attendance records found.</p>
                </div>
              ) : (
                <ResponsiveTable
                  title={<h2 style={{ margin: 0, paddingBottom: '1.5rem' }}>Recent Attendance</h2>}
                  columns={columns}
                  data={history}
                  pagination
                />
              )
            ) : (
              /* Analytics Tab Content */
              <div className="animate-fade-in">
                <h2 style={{ margin: 0, marginBottom: '2rem' }}>Personal Stats Overview</h2>
                
                {!personalStats ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <Activity size={48} color="var(--text-muted)" style={{ marginBottom: '1rem', opacity: 0.3 }} />
                    <p style={{ color: 'var(--text-muted)' }}>Not enough data to generate analytics yet.</p>
                  </div>
                ) : (
                  <>
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2.5rem' }}>
                       <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)' }}>
                          <Award size={24} color="var(--warning)" />
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{personalStats.punctualityRate}%</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Punctuality</div>
                       </div>
                       <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)' }}>
                          <Clock size={24} color="var(--accent-primary)" />
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{personalStats.avgClockIn}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Avg Clock In</div>
                       </div>
                       <div className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)' }}>
                          <LayoutDashboard size={24} color="var(--success)" />
                          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{personalStats.avgHours}h</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Avg Daily Work</div>
                       </div>
                    </div>

                    {/* Charts */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2rem' }}>
                       {/* Punctuality Pie */}
                       <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', minHeight: '300px' }}>
                          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Attendance Reliability</h3>
                          <div style={{ height: '200px' }}>
                             <ResponsiveContainer width="100%" height="100%">
                                <RePieChart>
                                   <Pie
                                      data={personalStats.punctualityData}
                                      cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value"
                                   >
                                      <Cell fill="var(--success)" />
                                      <Cell fill="var(--danger)" />
                                   </Pie>
                                   <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)' }} />
                                   <Legend verticalAlign="bottom" height={36}/>
                                </RePieChart>
                             </ResponsiveContainer>
                          </div>
                       </div>

                       {/* Hours Trend */}
                       <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', minHeight: '300px' }}>
                          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>Work Hours (Last 10 Logs)</h3>
                          <div style={{ height: '200px' }}>
                             <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={personalStats.workHoursTrend}>
                                   <defs>
                                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                                         <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.8}/>
                                         <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                                      </linearGradient>
                                   </defs>
                                   <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                   <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                                   <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                                   <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }} />
                                   <Area type="monotone" dataKey="hours" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorHours)" />
                                </AreaChart>
                             </ResponsiveContainer>
                          </div>
                       </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
