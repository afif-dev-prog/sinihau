import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../utils/api';
import { Users, UserCheck, UserX, Search, Map as MapIcon, Calendar as CalendarIcon, AlertTriangle, Star, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import ResponsiveTable from '../components/ResponsiveTable';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function HRDashboard() {
  const [stats, setStats] = useState({ totalStaff: 0, clockedIn: 0, clockedOut: 0, notClockedIn: 0 });
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [loading, setLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

  useEffect(() => {
    fetchDashboard();
    
    if (window.Notification && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchStaff();
    }, 300);
    return () => clearTimeout(handler);
  }, [search, date]);

  const fetchDashboard = async () => {
    try {
      const data = await api.getHrDashboard();
      setStats(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const data = await api.getHrStaff(`?search=${search}&date=${date}`);
      setStaff(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Extract valid marker spots (who clocked in/have locations)
  const mapMarkers = staff.filter(user => user.home_lat && user.home_lng);
  const defaultCenter = mapMarkers.length > 0 ? [mapMarkers[0].home_lat, mapMarkers[0].home_lng] : [51.505, -0.09];

  const calculateTotalTime = (inTime, outTime) => {
    if (!inTime || !outTime) return '--';
    const diff = new Date(outTime * 1000) - new Date(inTime * 1000);
    if (diff <= 0) return '--';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getRatingStars = (rating) => {
    if (rating === null || rating === undefined) return <span style={{color: 'var(--text-muted)'}}>--</span>;
    return (
      <div style={{ display: 'flex', gap: '2px', color: rating >= 4 ? 'var(--warning)' : 'var(--danger)' }}>
        {[1, 2, 3, 4, 5].map(star => (
          <Star key={star} size={14} fill={star <= rating ? "currentColor" : "none"} />
        ))}
      </div>
    );
  };

  const columns = [
    {
      name: '#',
      selector: (row, index) => index + 1,
      width: '60px',
      sortable: false
    },
    {
      name: 'Staff Member',
      selector: row => row.name,
      sortable: true,
      minWidth: '250px',
      grow: 2,
      cell: row => (
        <div>
          <div style={{ fontWeight: '500' }}>{row.name}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.email}</div>
        </div>
      )
    },
    {
      name: 'Status',
      selector: row => row.todayStatus,
      sortable: true,
      cell: row => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
          {row.todayStatus === 'Clocked In' && <UserCheck size={18} color="var(--success)" />}
          {row.todayStatus === 'Not Clocked In' && <UserX size={18} color="var(--danger)" />}
          {row.todayStatus === 'Clocked Out' && <Clock size={18} color="var(--warning)" />}
          <span style={{ 
            color: row.todayStatus === 'Clocked In' ? 'var(--success)' : 
                   row.todayStatus === 'Not Clocked In' ? 'var(--danger)' : 
                   'var(--warning)' 
          }}>
            {row.todayStatus}
          </span>
        </div>
      )
    },
    {
      name: 'Clock In',
      selector: row => row.clockInTime,
      sortable: true,
      cell: row => row.clockInTime ? format(new Date(row.clockInTime * 1000), 'hh:mm a') : '--'
    },
    {
      name: 'Valid/Bypassed',
      selector: row => row.isBypassed,
      sortable: true,
      cell: row => row.isBypassed ? (
        <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 'bold' }}>
          <AlertTriangle size={16} /> BYPASSED
        </span>
      ) : (
        <span style={{ color: 'var(--success)' }}>Valid GPS</span>
      )
    },
    {
      name: 'Rating',
      selector: row => row.rating,
      sortable: true,
      cell: row => getRatingStars(row.rating)
    },
    {
      name: 'Clock Out',
      selector: row => row.clockOutTime,
      sortable: true,
      cell: row => row.clockOutTime ? format(new Date(row.clockOutTime * 1000), 'hh:mm a') : '--'
    },
    {
      name: 'Total Hours',
      selector: row => calculateTotalTime(row.clockInTime, row.clockOutTime),
      sortable: true
    }
  ];

  return (
    <div>
      <Navbar />
      
      <div className="app-container">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '50%' }}>
              <Users size={24} color="var(--text-primary)" />
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Total Staff</p>
              <h2 style={{ margin: 0 }}>{stats.totalStaff}</h2>
            </div>
          </div>
          
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', animationDelay: '0.1s', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--success-glow)', padding: '1rem', borderRadius: '50%' }}>
              <UserCheck size={24} color="var(--success)" />
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Clocked In (Active)</p>
              <h2 style={{ margin: 0 }}>{stats.clockedIn}</h2>
            </div>
          </div>

          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', animationDelay: '0.2s', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--danger-glow)', padding: '1rem', borderRadius: '50%' }}>
              <UserX size={24} color="var(--danger)" />
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Not Arrived</p>
              <h2 style={{ margin: 0 }}>{stats.notClockedIn}</h2>
            </div>
          </div>
        </div>

        <div className="glass-panel animate-fade-in" style={{ padding: '2rem', animationDelay: '0.3s' }}>
          <div className="flex-between" style={{ 
            marginBottom: '2rem', 
            flexDirection: isMobile ? 'column' : 'row', 
            alignItems: isMobile ? 'stretch' : 'center',
            gap: '1rem'
          }}>
            <h2 style={{ margin: 0 }}>Attendance Ledger</h2>
            
            <div style={{ 
              display: 'flex', 
              gap: '1rem', 
              alignItems: 'center', 
              flexWrap: isMobile ? 'wrap' : 'nowrap', 
              width: isMobile ? '100%' : 'auto',
              justifyContent: isMobile ? 'flex-start' : 'flex-end'
            }}>
              <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  placeholder="Search staff..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.5rem', width: isMobile ? '100%' : '200px' }}
                />
              </div>
              
              <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
                <CalendarIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ paddingLeft: '2.5rem', width: isMobile ? '100%' : 'auto' }}
                />
              </div>
              
              <div style={{ 
                display: 'flex', 
                background: 'var(--bg-secondary)', 
                borderRadius: 'var(--radius-md)', 
                border: '1px solid var(--border-glass)', 
                overflow: 'hidden',
                marginLeft: isMobile ? 0 : 'auto',
                width: isMobile ? '100%' : 'auto',
                justifyContent: isMobile ? 'center' : 'flex-start'
              }}>
                <button 
                  onClick={() => setViewMode('list')}
                  style={{ 
                    padding: '0.75rem 1.5rem', 
                    background: viewMode === 'list' ? 'var(--accent-glow)' : 'transparent',
                    border: 'none', 
                    color: viewMode === 'list' ? 'var(--accent-primary)' : 'var(--text-muted)', 
                    cursor: 'pointer',
                    flex: isMobile ? 1 : 'none'
                  }}
                >
                  <Users size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('map')}
                  style={{ 
                    padding: '0.75rem 1.5rem', 
                    background: viewMode === 'map' ? 'var(--accent-glow)' : 'transparent',
                    border: 'none', 
                    color: viewMode === 'map' ? 'var(--accent-primary)' : 'var(--text-muted)', 
                    cursor: 'pointer',
                    flex: isMobile ? 1 : 'none'
                  }}
                >
                  <MapIcon size={18} />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <p>Loading records...</p>
          ) : viewMode === 'list' ? (
            <ResponsiveTable
              columns={columns}
              data={staff}
              pagination
            />
          ) : (
            <div style={{ height: '500px', width: '100%', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <MapContainer center={defaultCenter} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                {mapMarkers.map(user => (
                  <Marker key={user.id} position={[user.home_lat, user.home_lng]}>
                    <Popup>
                      <strong>{user.name}</strong><br/>
                      Status: {user.todayStatus}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
