import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../utils/api';
import { Users, UserCheck, UserX, Search, Map as MapIcon, Calendar as CalendarIcon, AlertTriangle, Star, Clock, FileSpreadsheet, FileText, PieChart, Download, ChevronDown, ChevronRight, BarChart as BarIcon, TrendingUp } from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { format } from 'date-fns';
import { getNowInTargetTimezone, formatTimeInTargetTimezone, isPunctual } from '../utils/dateUtils';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import ResponsiveTable from '../components/ResponsiveTable';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [date, setDate] = useState(format(getNowInTargetTimezone(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'map'
  const [activeTab, setActiveTab] = useState('ledger');
  const [loading, setLoading] = useState(true);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [showExport, setShowExport] = useState(false);
  const [hoveredExport, setHoveredExport] = useState(null); // 'date' | 'all'
  const exportRef = React.useRef(null);

  // Real trend data state
  const [timeRange, setTimeRange] = useState('7d');
  const [historicalTrends, setHistoricalTrends] = useState([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (exportRef.current && !exportRef.current.contains(event.target)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  useEffect(() => {
    if (activeTab === 'interactive') {
      fetchHistoricalTrends(timeRange === '7d' ? 7 : 30);
    }
  }, [activeTab, timeRange]);

  const fetchHistoricalTrends = async (days) => {
    setIsLoadingTrends(true);
    try {
      const now = getNowInTargetTimezone();
      const results = [];
      
      // Batch requests into groups of 5 to avoid browser blocking
      const batchSize = 5;
      for (let i = 0; i < days; i += batchSize) {
        const batchPromises = [];
        for (let j = i; j < Math.min(i + batchSize, days); j++) {
           const targetDate = new Date(now.getTime() - (j * 86400 * 1000));
           const year = targetDate.getFullYear();
           const month = targetDate.getMonth();
           const day = targetDate.getDate();
           
           // Match the TZ calculation from fetchStaff
           const tsDay2 = Math.floor(Date.UTC(year, month, day, 0, 0, 0) / 1000);
           const startOfMYT = (tsDay2 - 86400) + (16 * 3600);
           const endOfMYT = startOfMYT + 86400;

           batchPromises.push(
             api.getHrStaff(`?date=${tsDay2}`).then(data => {
               const presentCount = data.filter(r => 
                 (r.clockInTime >= startOfMYT && r.clockInTime < endOfMYT) || 
                 (r.clockOutTime >= startOfMYT && r.clockOutTime < endOfMYT)
               ).length;
               
               return {
                 date: format(targetDate, 'dd/MM'),
                 fullDate: format(targetDate, 'yyyy-MM-dd'),
                 present: presentCount,
                 dayName: format(targetDate, 'EEE')
               };
             }).catch(() => ({ date: format(targetDate, 'dd/MM'), present: 0 }))
           );
        }
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
      }
      
      setHistoricalTrends(results.reverse());
    } catch (err) {
      console.error('Failed to fetch historical trends:', err);
    } finally {
      setIsLoadingTrends(false);
    }
  };

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
      if (date) {
        const [year, month, day] = date.split('-').map(Number);
        
        // The backend groups data by exact UTC days. To reconstruct a GMT+8 (Malaysia) day,
        // we must pull both the selected UTC day and the preceeding UTC day, then strictly 
        // filter the records on the frontend to exactly match the 00:00 -> 23:59 MYT window.
        const tsDay2 = Math.floor(Date.UTC(year, month - 1, day, 0, 0, 0) / 1000);
        const tsDay1 = tsDay2 - 86400;

        const [res1, res2] = await Promise.all([
          api.getHrStaff(`?search=${search}&date=${tsDay1}`).catch(() => []),
          api.getHrStaff(`?search=${search}&date=${tsDay2}`).catch(() => [])
        ]);

        const startOfMYT = tsDay1 + (16 * 3600); // 16:00 UTC previous day -> 00:00 MYT
        const endOfMYT = startOfMYT + 86400;     // 16:00 UTC current day -> 24:00 MYT

        const userMap = new Map();

        const processRecord = (rec) => {
            const validIn = rec.clockInTime >= startOfMYT && rec.clockInTime < endOfMYT;
            const validOut = rec.clockOutTime >= startOfMYT && rec.clockOutTime < endOfMYT;
            
            if (validIn || validOut) {
                const existing = userMap.get(rec.id);
                const effectiveRec = { ...rec };
                if (!validIn) effectiveRec.clockInTime = existing?.clockInTime || null;
                if (!validOut) effectiveRec.clockOutTime = existing?.clockOutTime || null;
                
                if (effectiveRec.clockInTime && effectiveRec.clockOutTime) {
                    effectiveRec.todayStatus = 'Clocked Out';
                } else if (effectiveRec.clockInTime) {
                    effectiveRec.todayStatus = 'Clocked In';
                }
                
                userMap.set(rec.id, effectiveRec);
            } else if (!userMap.has(rec.id)) {
                userMap.set(rec.id, { 
                    ...rec, 
                    clockInTime: null, 
                    clockOutTime: null, 
                    todayStatus: 'Not Clocked In',
                    isBypassed: false,
                    rating: null
                });
            }
        };

        res1.forEach(processRecord);
        res2.forEach(processRecord);

        setStaff(Array.from(userMap.values()));
      } else {
        const data = await api.getHrStaff(`?search=${search}&date=`);
        setStaff(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllStaff = async () => {
    try {
      return await api.getHrStaff('?search=&date=');
    } catch {
      return [];
    }
  };

  const calculateTotalTime = (inTime, outTime) => {
    if (!inTime || !outTime) return '--';
    const diff = (outTime * 1000) - (inTime * 1000);
    if (diff <= 0) return '--';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const exportExcelData = (data, filename) => {
    if (data.length === 0) return;
    const exportData = data.map((s, index) => ({
      No: index + 1,
      Name: s.name,
      Email: s.email,
      Status: s.todayStatus,
      'Clock In': formatTimeInTargetTimezone(s.clockInTime),
      'Clock Out': formatTimeInTargetTimezone(s.clockOutTime),
      'Total Hours': calculateTotalTime(s.clockInTime, s.clockOutTime),
      Bypassed: s.isBypassed ? 'Yes' : 'No',
      Rating: s.rating || '--'
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
    XLSX.writeFile(workbook, filename);
  };

  const exportPDFData = (data, filename, reportTitle) => {
    if (data.length === 0) return;
    const doc = new jsPDF();
    doc.text(reportTitle, 14, 15);
    const tableColumn = ["ID", "Name", "Status", "Clock In", "Clock Out", "Total Hours", "Bypassed"];
    const tableRows = [];
    data.forEach((s, index) => {
      tableRows.push([
        index + 1, s.name, s.todayStatus,
        s.clockInTime ? format(new Date(s.clockInTime * 1000), 'hh:mm a') : '--',
        s.clockOutTime ? format(new Date(s.clockOutTime * 1000), 'hh:mm a') : '--',
        calculateTotalTime(s.clockInTime, s.clockOutTime),
        s.isBypassed ? 'Yes' : 'No'
      ]);
    });
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 20 });
    doc.save(filename);
  };

  const handleExportExcel = () => exportExcelData(staff, `Attendance_Ledger_${date}.xlsx`);
  const handleExportPDF = () => exportPDFData(staff, `Attendance_Ledger_${date}.pdf`, `Attendance Summary Report - ${date}`);
  
  const handleExportAllExcel = async () => {
    const allData = await fetchAllStaff();
    exportExcelData(allData, `Attendance_Ledger_All.xlsx`);
  };
  
  const handleExportAllPDF = async () => {
    const allData = await fetchAllStaff();
    exportPDFData(allData, `Attendance_Ledger_All.pdf`, `Attendance Summary Report - All Records`);
  };

  const calculatePunctuality = () => {
    if (staff.length === 0) return 0;
    const present = staff.filter(s => s.todayStatus === 'Clocked In' || s.todayStatus === 'Clocked Out');
    if (present.length === 0) return 0;
    const punctualCount = present.filter(s => isPunctual(s.clockInTime, 8, 0)).length;
    return Math.round((punctualCount / present.length) * 100);
  };
  const punctualityRate = calculatePunctuality();
  const totalBypasses = staff.filter(s => s.isBypassed).length;

  const distributionStats = {
    totalStaff: staff.length,
    clockedIn: staff.filter(s => s.todayStatus === 'Clocked In').length,
    clockedOut: staff.filter(s => s.todayStatus === 'Clocked Out').length,
    notClockedIn: staff.filter(s => s.todayStatus === 'Not Clocked In').length
  };

  const top10Punctual = staff
    .filter(s => s.clockInTime && s.todayStatus !== 'Not Clocked In')
    .sort((a, b) => a.clockInTime - b.clockInTime)
    .slice(0, 10);

  // Extract valid marker spots (who clocked in/have locations)
  const mapMarkers = staff.filter(user => user.home_lat && user.home_lng && user.todayStatus !== 'Not Clocked In');
  const defaultCenter = mapMarkers.length > 0 ? [mapMarkers[0].home_lat, mapMarkers[0].home_lng] : [51.505, -0.09];

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
      cell: row => formatTimeInTargetTimezone(row.clockInTime)
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
      cell: row => formatTimeInTargetTimezone(row.clockOutTime)
    },
    {
      name: 'Total Hours',
      selector: row => calculateTotalTime(row.clockInTime, row.clockOutTime),
      sortable: true
    },
    {
      name: 'Remark',
      selector: row => row.remark,
      sortable: true,
      cell: row => <span style={{ color: row.remark ? 'inherit' : 'var(--text-muted)' }}>{row.remark || '--'}</span>
    },
    {
      name: 'Today\'s Job',
      selector: row => row.todaysjob,
      sortable: true,
      cell: row => <span style={{ color: row.todaysjob ? 'inherit' : 'var(--text-muted)' }}>{row.todaysjob || '--'}</span>
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

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <button
            onClick={() => setActiveTab('ledger')}
            style={{
              padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', border: 'none', fontWeight: 'bold', fontSize: '0.95rem',
              background: activeTab === 'ledger' ? 'var(--accent-glow)' : 'var(--bg-secondary)',
              color: activeTab === 'ledger' ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.2s', flex: isMobile ? 1 : 'none',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
             <FileText size={18} /> Attendance Ledger
          </button>
          <button
            onClick={() => setActiveTab('interactive')}
            style={{
              padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', border: 'none', fontWeight: 'bold', fontSize: '0.95rem',
              background: activeTab === 'interactive' ? 'var(--accent-glow)' : 'var(--bg-secondary)',
              color: activeTab === 'interactive' ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.2s', flex: isMobile ? 1 : 'none',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
             <TrendingUp size={18} /> Interactive Dashboard
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            style={{
              padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)', border: 'none', fontWeight: 'bold', fontSize: '0.95rem',
              background: activeTab === 'analytics' ? 'var(--accent-glow)' : 'var(--bg-secondary)',
              color: activeTab === 'analytics' ? 'var(--accent-primary)' : 'var(--text-muted)',
              cursor: 'pointer', transition: 'all 0.2s', flex: isMobile ? 1 : 'none',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
             <BarIcon size={18} /> Analytics
          </button>
        </div>

        {activeTab === 'ledger' ? (
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
                
                <div ref={exportRef} style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
                  <button 
                    onClick={() => setShowExport(!showExport)}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.6rem', 
                      padding: '0.75rem 1.25rem', 
                      background: 'var(--bg-secondary)', 
                      border: '1px solid var(--border-glass)', 
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      width: isMobile ? '100%' : 'auto',
                      justifyContent: 'center'
                    }}
                  >
                    <Download size={18} />
                    <span>Export</span>
                    <ChevronDown size={16} style={{ transform: showExport ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                  </button>

                  {showExport && (
                    <div className="dropdown-menu">
                      <div 
                        onMouseEnter={() => setHoveredExport('date')}
                        onMouseLeave={() => setHoveredExport(null)}
                        className="dropdown-item"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <CalendarIcon size={14} />
                           <span>By Date ({date})</span>
                        </div>
                        <ChevronRight size={14} />
                        
                        {hoveredExport === 'date' && (
                          <div className="nested-menu" onMouseEnter={() => setHoveredExport('date')}>
                            <button onClick={() => { handleExportExcel(); setShowExport(false); }} className="dropdown-item">
                              <FileSpreadsheet size={14} color="var(--success)" /> Excel File
                            </button>
                            <button onClick={() => { handleExportPDF(); setShowExport(false); }} className="dropdown-item">
                              <FileText size={14} color="var(--danger)" /> PDF Report
                            </button>
                          </div>
                        )}
                      </div>

                      <div style={{ height: '1px', background: 'var(--border-glass)', margin: '0.25rem 0.5rem' }} />

                      <div 
                        onMouseEnter={() => setHoveredExport('all')}
                        onMouseLeave={() => setHoveredExport(null)}
                        className="dropdown-item"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <Users size={14} />
                           <span>All History</span>
                        </div>
                        <ChevronRight size={14} />
                        
                        {hoveredExport === 'all' && (
                          <div className="nested-menu" onMouseEnter={() => setHoveredExport('all')}>
                            <button onClick={() => { handleExportAllExcel(); setShowExport(false); }} className="dropdown-item">
                              <FileSpreadsheet size={14} color="var(--success)" /> Excel File
                            </button>
                            <button onClick={() => { handleExportAllPDF(); setShowExport(false); }} className="dropdown-item">
                              <FileText size={14} color="var(--danger)" /> PDF Report
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
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
        ) : activeTab === 'interactive' ? (
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', animationDelay: '0.3s' }}>
             <div className="flex-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <TrendingUp size={24} color="var(--accent-primary)" /> Interactive Analytics Dashboard
                </h2>
                
                <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '0.25rem' }}>
                    <button 
                       onClick={() => setTimeRange('7d')}
                       style={{ 
                          padding: '0.5rem 1rem', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                          background: timeRange === '7d' ? 'var(--accent-primary)' : 'transparent',
                          color: timeRange === '7d' ? 'white' : 'var(--text-muted)',
                          fontWeight: 'bold', transition: 'all 0.2s'
                       }}
                    >
                       Last 7 Days
                    </button>
                    <button 
                       onClick={() => setTimeRange('30d')}
                       style={{ 
                          padding: '0.5rem 1rem', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                          background: timeRange === '30d' ? 'var(--accent-primary)' : 'transparent',
                          color: timeRange === '30d' ? 'white' : 'var(--text-muted)',
                          fontWeight: 'bold', transition: 'all 0.2s'
                       }}
                    >
                       Last 30 Days
                    </button>
                </div>
             </div>

             {isLoadingTrends ? (
                <div style={{ height: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                   <div className="animate-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '3px solid var(--accent-primary)', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }}></div>
                   <p style={{ color: 'var(--text-muted)' }}>Aggregating 30-day historical logs...</p>
                </div>
             ) : (
                /* Chart Grid */
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                   {/* 1. Presence Overview (Pie Chart) - REAL DATA */}
                   <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', minHeight: '350px' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Daily Presence Distribution</h3>
                      <div style={{ height: '250px' }}>
                         <ResponsiveContainer width="100%" height="100%">
                            <RePieChart>
                               <Pie
                                  data={[
                                     { name: 'Present', value: distributionStats.clockedIn + distributionStats.clockedOut },
                                     { name: 'Not Arrived', value: distributionStats.notClockedIn }
                                  ]}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                               >
                                  <Cell fill="var(--success)" />
                                  <Cell fill="var(--danger)" />
                               </Pie>
                               <Tooltip 
                                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)' }}
                               />
                               <Legend verticalAlign="bottom" height={36}/>
                            </RePieChart>
                         </ResponsiveContainer>
                      </div>
                   </div>

                   {/* 2. Real Attendance Trends (Area Chart) - REAL LOADED DATA */}
                   <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', minHeight: '350px' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Presence Trends ({timeRange})</h3>
                      <div style={{ height: '250px' }}>
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historicalTrends}>
                               <defs>
                                  <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                                     <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.8}/>
                                     <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
                                  </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                               <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                               <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                               <Tooltip 
                                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)' }}
                               />
                               <Area type="monotone" dataKey="present" stroke="var(--accent-primary)" fillOpacity={1} fill="url(#colorPresent)" strokeWidth={2} />
                            </AreaChart>
                         </ResponsiveContainer>
                      </div>
                   </div>

                   {/* 3. Daily Breakdown (Bar Chart) - REAL LOADED DATA */}
                   <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', gridColumn: isMobile ? 'span 1' : 'span 2' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Daily Attendance Volume</h3>
                      <div style={{ height: '300px' }}>
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={historicalTrends}>
                               <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                               <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                               <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                               <Tooltip 
                                  cursor={{fill: 'rgba(255,255,255,0.02)'}}
                                  contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)', borderRadius: 'var(--radius-sm)' }}
                               />
                               <Bar dataKey="present" fill="var(--success)" radius={[4, 4, 0, 0]} barSize={timeRange === '7d' ? 40 : 15} />
                            </BarChart>
                         </ResponsiveContainer>
                      </div>
                   </div>
                </div>
             )}
          </div>
        ) : (
          <div className="glass-panel animate-fade-in" style={{ padding: '2rem', animationDelay: '0.3s' }}>
             <div className="flex-between" style={{ marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
               <h2 style={{ margin: 0 }}>Attendance Analytics</h2>
               <div style={{ 
                 display: 'flex', 
                 gap: '1rem', 
                 alignItems: 'center', 
                 flexWrap: isMobile ? 'wrap' : 'nowrap', 
                 width: isMobile ? '100%' : 'auto',
                 justifyContent: isMobile ? 'flex-start' : 'flex-end'
               }}>
                 <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
                   <CalendarIcon size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                   <input 
                     type="date" 
                     value={date}
                     onChange={(e) => setDate(e.target.value)}
                     style={{ paddingLeft: '2.5rem', width: isMobile ? '100%' : 'auto' }}
                   />
                 </div>

                 <div ref={exportRef} style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
                   <button 
                     onClick={() => setShowExport(!showExport)}
                     style={{ 
                       display: 'flex', 
                       alignItems: 'center', 
                       gap: '0.6rem', 
                       padding: '0.75rem 1.25rem', 
                       background: 'var(--bg-secondary)', 
                       border: '1px solid var(--border-glass)', 
                       borderRadius: 'var(--radius-md)',
                       color: 'var(--text-primary)',
                       fontWeight: 'bold',
                       cursor: 'pointer',
                       width: isMobile ? '100%' : 'auto',
                       justifyContent: 'center'
                     }}
                   >
                     <Download size={18} />
                     <span>Export</span>
                     <ChevronDown size={16} style={{ transform: showExport ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                   </button>

                   {showExport && (
                     <div className="dropdown-menu">
                       <div 
                         onMouseEnter={() => setHoveredExport('date')}
                         onMouseLeave={() => setHoveredExport(null)}
                         className="dropdown-item"
                         style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                       >
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <CalendarIcon size={14} />
                            <span>By Date ({date})</span>
                         </div>
                         <ChevronRight size={14} />
                         
                         {hoveredExport === 'date' && (
                           <div className="nested-menu" onMouseEnter={() => setHoveredExport('date')}>
                             <button onClick={() => { handleExportExcel(); setShowExport(false); }} className="dropdown-item">
                               <FileSpreadsheet size={14} color="var(--success)" /> Excel File
                             </button>
                             <button onClick={() => { handleExportPDF(); setShowExport(false); }} className="dropdown-item">
                               <FileText size={14} color="var(--danger)" /> PDF Report
                             </button>
                           </div>
                         )}
                       </div>

                       <div style={{ height: '1px', background: 'var(--border-glass)', margin: '0.25rem 0.5rem' }} />

                       <div 
                         onMouseEnter={() => setHoveredExport('all')}
                         onMouseLeave={() => setHoveredExport(null)}
                         className="dropdown-item"
                         style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                       >
                         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Users size={14} />
                            <span>All History</span>
                         </div>
                         <ChevronRight size={14} />
                         
                         {hoveredExport === 'all' && (
                           <div className="nested-menu" onMouseEnter={() => setHoveredExport('all')}>
                             <button onClick={() => { handleExportAllExcel(); setShowExport(false); }} className="dropdown-item">
                               <FileSpreadsheet size={14} color="var(--success)" /> Excel File
                             </button>
                             <button onClick={() => { handleExportAllPDF(); setShowExport(false); }} className="dropdown-item">
                               <FileText size={14} color="var(--danger)" /> PDF Report
                             </button>
                           </div>
                         )}
                       </div>
                     </div>
                   )}
                 </div>
               </div>
             </div>

             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
               <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <PieChart size={36} color="var(--accent-primary)" style={{ marginBottom: '1rem' }} />
                 <h3 style={{ margin: '0 0 0.5rem 0' }}>Punctuality Rate</h3>
                 <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--success)' }}>{punctualityRate}%</div>
                 <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center', fontSize: '0.9rem' }}>Clocked in before or at 8:00 AM</p>
               </div>

               <div style={{ background: 'var(--bg-secondary)', padding: '2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                 <AlertTriangle size={36} color="var(--warning)" style={{ marginBottom: '1rem' }} />
                 <h3 style={{ margin: '0 0 0.5rem 0' }}>Total Bypasses</h3>
                 <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--warning)' }}>{totalBypasses}</div>
                 <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center', fontSize: '0.9rem' }}>Force bypassed today</p>
               </div>
             </div>

             <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>Presence Distribution</h3>
             <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--border-glass)', marginBottom: '3rem' }}>
                {staff.length === 0 ? <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No data to display.</p> : (
                  <>
                    <div style={{ display: 'flex', height: '40px', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '1rem' }}>
                      {distributionStats.clockedIn > 0 && <div style={{ width: `${(distributionStats.clockedIn / distributionStats.totalStaff)*100}%`, background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }} title="Clocked In">{distributionStats.clockedIn}</div>}
                      {distributionStats.clockedOut > 0 && <div style={{ width: `${(distributionStats.clockedOut / distributionStats.totalStaff)*100}%`, background: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }} title="Clocked Out">{distributionStats.clockedOut}</div>}
                      {distributionStats.notClockedIn > 0 && <div style={{ width: `${(distributionStats.notClockedIn / distributionStats.totalStaff)*100}%`, background: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.8rem' }} title="Not Arrived">{distributionStats.notClockedIn}</div>}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}><div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--success)' }}></div> Clocked In ({distributionStats.clockedIn})</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}><div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--warning)' }}></div> Clocked Out ({distributionStats.clockedOut})</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}><div style={{ width: 12, height: 12, borderRadius: 2, background: 'var(--danger)' }}></div> Not Arrived ({distributionStats.notClockedIn})</span>
                    </div>
                  </>
                )}
             </div>

             {/* Podium View */}
             <div style={{ marginBottom: '3rem' }}>
               <h3 style={{ textAlign: 'center', marginBottom: '2rem' }}>Today's Early Comers (Podium)</h3>
               <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1rem', minHeight: '240px', flexWrap: 'wrap', paddingBottom: '1rem' }}>
                 {/* 2nd Place */}
                 {top10Punctual[1] && (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                     <div style={{ position: 'relative' }}>
                       <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #bdc3c7, #2c3e50)', border: '3px solid #dfe6e9', overflow: 'hidden' }}>
                          <img src={`https://ui-avatars.com/api/?name=${top10Punctual[1].name}&background=random`} alt="avatar" style={{ width: '100%', height: '100%' }} />
                       </div>
                       <div style={{ position: 'absolute', bottom: -5, right: -5, width: '24px', height: '24px', borderRadius: '50%', background: '#dfe6e9', color: '#636e72', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', border: '2px solid var(--bg-secondary)' }}>2</div>
                     </div>
                     <div style={{ fontWeight: '500', textAlign: 'center' }}>{top10Punctual[1].name.split(' ')[0]}</div>
                     <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatTimeInTargetTimezone(top10Punctual[1].clockInTime)}</div>
                     <div style={{ width: '80px', height: '100px', background: 'linear-gradient(to top, rgba(255,255,255,0.05), rgba(255,255,255,0.1))', borderRadius: 'var(--radius-md) var(--radius-md) 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Clock size={20} color="rgba(255,255,255,0.2)" />
                     </div>
                   </div>
                 )}

                 {/* 1st Place */}
                 {top10Punctual[0] && (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                     <Star size={24} color="#ffd700" fill="#ffd700" style={{ marginBottom: '4px' }} />
                     <div style={{ position: 'relative' }}>
                       <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, #f1c40f, #f39c12)', border: '4px solid #ffd700', overflow: 'hidden' }}>
                          <img src={`https://ui-avatars.com/api/?name=${top10Punctual[0].name}&background=random`} alt="avatar" style={{ width: '100%', height: '100%' }} />
                       </div>
                       <div style={{ position: 'absolute', bottom: -5, right: -5, width: '28px', height: '28px', borderRadius: '50%', background: '#ffd700', color: '#d35400', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', border: '2px solid var(--bg-secondary)' }}>1</div>
                     </div>
                     <div style={{ fontWeight: 'bold', textAlign: 'center', fontSize: '1.1rem' }}>{top10Punctual[0].name.split(' ')[0]}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 'bold' }}>{formatTimeInTargetTimezone(top10Punctual[0].clockInTime)}</div>
                     <div style={{ width: '100px', height: '140px', background: 'linear-gradient(to top, var(--accent-glow), rgba(99, 102, 241, 0.2))', borderRadius: 'var(--radius-md) var(--radius-md) 0 0', border: '1px solid var(--accent-primary)', borderBottom: 'none' }}></div>
                   </div>
                 )}

                 {/* 3rd Place */}
                 {top10Punctual[2] && (
                   <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                     <div style={{ position: 'relative' }}>
                       <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #cd7f32, #a0522d)', border: '3px solid #cd7f32', overflow: 'hidden' }}>
                          <img src={`https://ui-avatars.com/api/?name=${top10Punctual[2].name}&background=random`} alt="avatar" style={{ width: '100%', height: '100%' }} />
                       </div>
                       <div style={{ position: 'absolute', bottom: -5, right: -5, width: '24px', height: '24px', borderRadius: '50%', background: '#cd7f32', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', border: '2px solid var(--bg-secondary)' }}>3</div>
                     </div>
                     <div style={{ fontWeight: '500', textAlign: 'center' }}>{top10Punctual[2].name.split(' ')[0]}</div>
                     <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatTimeInTargetTimezone(top10Punctual[2].clockInTime)}</div>
                     <div style={{ width: '80px', height: '70px', background: 'linear-gradient(to top, rgba(255,255,255,0.03), rgba(255,255,255,0.07))', borderRadius: 'var(--radius-md) var(--radius-md) 0 0' }}></div>
                   </div>
                 )}
               </div>
             </div>

             {/* Leaderboard Table */}
             <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-glass)', padding: '1.5rem' }}>
               <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <Star size={20} color="var(--warning)" /> Top 10 Punctual Staff
               </h3>
               <div style={{ overflowX: 'auto' }}>
                 <table style={{ minWidth: '100%' }}>
                   <thead>
                     <tr>
                       <th style={{ width: '60px' }}>Rank</th>
                       <th>Name</th>
                       <th>Clock In</th>
                       <th>Clock Out</th>
                       <th>Status</th>
                     </tr>
                   </thead>
                   <tbody>
                     {top10Punctual.map((person, idx) => (
                       <tr key={person.id} style={{ opacity: idx < 3 ? 1 : 0.8 }}>
                         <td>
                            <span style={{ 
                               display: 'inline-flex', width: '28px', height: '28px', borderRadius: '50%', 
                               background: idx === 0 ? '#ffd70033' : idx === 1 ? '#dfe6e933' : idx === 2 ? '#cd7f3233' : 'rgba(255,255,255,0.05)',
                               color: idx === 0 ? '#ffd700' : idx === 1 ? '#dfe6e9' : idx === 2 ? '#cd7f32' : 'var(--text-muted)',
                               alignItems: 'center', justifyContent: 'center', fontWeight: 'bold'
                            }}>
                               {idx + 1}
                            </span>
                         </td>
                         <td>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                             <img src={`https://ui-avatars.com/api/?name=${person.name}&background=random`} alt="av" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                             <div>
                               <div style={{ fontWeight: '500' }}>{person.name}</div>
                               <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{person.email}</div>
                             </div>
                           </div>
                         </td>
                         <td style={{ fontWeight: 'bold', color: idx === 0 ? 'var(--success)' : 'inherit' }}>
                           {formatTimeInTargetTimezone(person.clockInTime)}
                         </td>
                         <td style={{ color: 'var(--text-muted)' }}>
                           {formatTimeInTargetTimezone(person.clockOutTime)}
                         </td>
                         <td>
                            {isPunctual(person.clockInTime, 8, 0) ? (
                              <span className="badge success" style={{ fontSize: '0.7rem' }}>Punctual</span>
                            ) : (
                              <span className="badge danger" style={{ fontSize: '0.7rem' }}>Late</span>
                            )}
                         </td>
                       </tr>
                     ))}
                     {top10Punctual.length === 0 && (
                       <tr>
                         <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No punctuality records for this date.</td>
                       </tr>
                     )}
                   </tbody>
                 </table>
               </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
