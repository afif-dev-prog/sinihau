import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../utils/api';
import { Users, UserCheck, UserX, AlertTriangle, Star, Clock, Search } from 'lucide-react';
import { format } from 'date-fns';
import { formatTimeInTargetTimezone } from '../utils/dateUtils';
import ResponsiveTable from '../components/ResponsiveTable';

export default function SuperiorDashboard() {
  const [teamObj, setTeamObj] = useState({ team: [], stats: { totalTeam: 0, clockedIn: 0, clockedOut: 0, notClockedIn: 0, bypassesToday: 0 } });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTeam();
    
    // Poll for bypass notifications every 30 seconds
    const interval = setInterval(fetchTeam, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTeam = async () => {
    try {
      const data = await api.getSuperiorTeam();
      const previousBypasses = teamObj.stats?.bypassesToday || 0;
      
      setTeamObj(data);
      
      if (data.stats.bypassesToday > previousBypasses && previousBypasses > 0) {
         if (window.Notification && Notification.permission === "granted") {
            new Notification("Attendance Alert", { body: "A staff member on your team used a manual force bypass!" });
         } else {
            alert("Attendance Alert: A staff member on your team used a manual location bypass!");
         }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (window.Notification && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, []);

  const calculateTotalTime = (inTime, outTime) => {
    if (!inTime || !outTime) return '--';
    const diff = (outTime * 1000) - (inTime * 1000);
    if (diff <= 0) return '--';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getRatingStars = (rating) => {
    if (rating === null || rating === undefined) return <span style={{color: 'var(--text-muted)'}}>No Rating</span>;
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
      name: 'Notifications',
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
      name: 'Clock In',
      selector: row => row.clockInTime,
      sortable: true,
      cell: row => formatTimeInTargetTimezone(row.clockInTime)
    },
    {
      name: 'Clock Out',
      selector: row => row.clockOutTime,
      sortable: true,
      cell: row => formatTimeInTargetTimezone(row.clockOutTime)
    },
    {
      name: 'Total Hours',
      selector: row => calculateTotalTime(row.clockInTime, row.clockOutTime),
      sortable: true
    }
  ];

  const stats = teamObj.stats;

  return (
    <div>
      <Navbar />
      <div className="app-container">
        <h1 style={{ marginBottom: '2rem' }}>My Team Dashboard</h1>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '50%' }}>
              <Users size={24} color="var(--text-primary)" />
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Total Team</p>
              <h2 style={{ margin: 0 }}>{stats.totalTeam}</h2>
            </div>
          </div>
          
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--success-glow)', padding: '1rem', borderRadius: '50%' }}>
              <UserCheck size={24} color="var(--success)" />
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Clocked In</p>
              <h2 style={{ margin: 0 }}>{stats.clockedIn}</h2>
            </div>
          </div>

          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ background: 'var(--danger-glow)', padding: '1rem', borderRadius: '50%' }}>
              <AlertTriangle size={24} color="var(--danger)" />
            </div>
            <div>
              <p style={{ color: 'var(--danger)', fontSize: '0.9rem', margin: 0, fontWeight: 'bold' }}>Bypassed Today</p>
              <h2 style={{ margin: 0, color: 'var(--danger)' }}>{stats.bypassesToday}</h2>
            </div>
          </div>
        </div>

        <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
          <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ margin: 0 }}>Team Attendance Ledger</h2>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search team..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '2.8rem', width: '250px' }}
              />
            </div>
          </div>
          {loading ? (
            <p>Loading team records...</p>
          ) : (
            <ResponsiveTable
              columns={columns}
              data={teamObj.team.filter(m => 
                m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                m.email.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              pagination
            />
          )}
        </div>
      </div>
    </div>
  );
}
