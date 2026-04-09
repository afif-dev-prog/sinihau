import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Navbar from '../components/Navbar';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { ShieldAlert, Trash2, MapPinOff, RefreshCw, UploadCloud, Key, Search, Lock, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import ResponsiveTable from '../components/ResponsiveTable';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredLocation, setHoveredLocation] = useState(null);
  const [hoverStyle, setHoverStyle] = useState({});
  
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'staff id': 'SK001',
        'name': 'John Doe',
        'email': 'john@example.com',
        'role': 'Staff',
        'superior email': 'manager@example.com',
        'superior name': 'Manager Alice'
      },
      {
        'staff id': 'SK002',
        'name': 'Jane Smith',
        'email': 'jane@example.com',
        'role': 'HR',
        'superior email': 'admin@example.com',
        'superior name': 'Admin Bob'
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sample Users');
    XLSX.writeFile(workbook, 'SiniHau_User_Import_Sample.xlsx');
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.updateRole(userId, newRole);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleResetLocation = async (userId) => {
    if (!window.confirm("Are you sure you want to reset this user's home location lock?")) return;
    try {
      await api.resetLocation(userId);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to reset location');
    }
  };

  const handleResetPassword = async (userId) => {
    if (!window.confirm("Are you sure you want to reset this user's password to their Staff ID?")) return;
    try {
      await api.resetPassword(userId);
      alert('Password reset successfully to Staff ID.');
    } catch (err) {
      alert(err.message || 'Failed to reset password');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to permanently delete this user?")) return;
    try {
      await api.deleteUser(userId);
      fetchUsers();
    } catch (err) {
      alert(err.message || 'Failed to delete user');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportResult('');

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        let data = XLSX.utils.sheet_to_json(ws, { raw: false });
        
        const parsedUsers = data.map(row => {
            const keys = Object.keys(row);
            const findKey = (candidates) => keys.find(k => {
                const normalized = k.toLowerCase().replace(/[\s_]/g, '');
                return candidates.some(c => normalized === c.toLowerCase().replace(/[\s_]/g, ''));
            });

            let emailKey = findKey(['email']);
            let nameKey = findKey(['name', 'fullname', 'staffname']);
            let roleKey = findKey(['role']);
            let superiorEmailKey = findKey(['superioremail', 'superior']);
            let superiorNameKey = findKey(['superiorname', 'managername']);
            let staffIdKey = findKey(['staffid', 'id', 'employeeid']);
            
            let role = 'Staff';
            if (roleKey && row[roleKey]) {
                const val = row[roleKey].toString().trim().toLowerCase();
                if (val === 'hr') role = 'HR';
                else if (val === 'admin') role = 'Admin';
            }

            return {
                email: emailKey ? row[emailKey]?.toString().trim() : null,
                name: nameKey ? row[nameKey]?.toString().trim() : null,
                role: role,
                superiorEmail: superiorEmailKey ? row[superiorEmailKey]?.toString().trim() : null,
                superiorName: superiorNameKey ? row[superiorNameKey]?.toString().trim() : null,
                staffId: (staffIdKey && row[staffIdKey]) ? row[staffIdKey].toString().trim() : null,
                no: row['no'] || row['No'] || row['NO'] || null
            }
        }).filter(u => u.email && u.staffId);

        if (parsedUsers.length === 0) {
          setImportResult('Error: No valid users with emails found in the Excel/CSV file.');
          return;
        }

        const res = await api.bulkImport(parsedUsers);
        setImportResult(res.message);
        fetchUsers();
      } catch (err) {
        console.error(err);
        const detail = err.inner ? ` (${err.inner})` : '';
        setImportResult(`Error processing document: ${err.message}${detail}`);
      } finally {
        setImporting(false);
        e.target.value = null;
      }
    };
    reader.onerror = () => {
        setImportResult('Error reading file.');
        setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const columns = [
    {
      name: '#',
      selector: (row, index) => index + 1,
      width: '60px',
      sortable: false
    },
    {
      name: 'User',
      selector: row => row.name,
      sortable: true,
      minWidth: '220px',
      grow: 2,
      cell: row => (
        <div>
          <div style={{ fontWeight: '500' }}>{row.name}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{row.email}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: '0.25rem' }}>ID: {row.staffId}</div>
        </div>
      )
    },
    {
      name: 'Manager',
      selector: row => row.superior_email || row.superiorEmail || row.superior?.email || row.manager_email || row.managerEmail || row.manager?.email,
      sortable: true,
      minWidth: '200px',
      cell: row => {
        const email = row.superior_email || row.superiorEmail || row.superior?.email || row.manager_email || row.managerEmail || row.manager?.email;
        const name = row.superior_name || row.superiorName || row.superior?.name || row.manager_name || row.managerName || row.manager?.name;
        return (
          <div style={{ fontSize: '0.85rem' }}>
            {email ? (
              <>
                <div style={{ fontWeight: '500' }}>{name || 'N/A'}</div>
                <div style={{ color: 'var(--text-muted)' }}>{email}</div>
              </>
            ) : (
              <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
            )}
          </div>
        );
      }
    },
    {
      name: 'Role',
      selector: row => row.role,
      sortable: true,
      width: '120px',
      cell: row => (
        <select 
          value={row.role} 
          onChange={(e) => handleRoleChange(row.id, e.target.value)}
          style={{ width: 'auto', padding: '0.5rem', background: 'var(--bg-primary)' }}
        >
          <option value="Staff">Staff</option>
          <option value="HR">HR</option>
          <option value="Admin">Admin</option>
        </select>
      )
    },
    {
      name: 'Joined',
      selector: row => row.createdAt,
      sortable: true,
      cell: row => format(new Date(row.createdAt * 1000), 'MMM dd, yyyy')
    },
    {
      name: 'Location Status',
      selector: row => row.home_locked,
      sortable: true,
      allowOverflow: true,
      cell: row => (
        <div 
          onMouseEnter={(e) => {
            if (row.home_lat && row.home_lng) {
              const rect = e.currentTarget.getBoundingClientRect();
              const mapHeight = 160;
              const renderAbove = (rect.bottom + mapHeight) > window.innerHeight;
              
              setHoverStyle({
                top: renderAbove ? (rect.top + window.scrollY - mapHeight - 8) : (rect.bottom + window.scrollY + 8),
                left: rect.left + window.scrollX
              });
              setHoveredLocation({ id: row.id, lat: row.home_lat, lng: row.home_lng });
            }
          }}
          onMouseLeave={() => setHoveredLocation(null)}
        >
          {row.home_locked ? (
            <span className="badge success" style={{ cursor: row.home_lat ? 'pointer' : 'default' }}>Locked</span>
          ) : (
            <span className="badge" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>Pending</span>
          )}
        </div>
      )
    },
    {
      name: 'Actions',
      cell: row => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => handleResetLocation(row.id)}
            disabled={!row.home_locked}
            title="Reset Home Location"
            style={{
              background: 'transparent', border: '1px solid var(--warning)', color: 'var(--warning)',
              padding: '0.4rem', borderRadius: ' var(--radius-sm)', cursor: 'pointer', display: 'flex'
            }}
          >
            <MapPinOff size={16} />
          </button>
          <button 
            onClick={() => handleResetPassword(row.id)}
            title="Reset Password to Staff ID"
            style={{
              background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)',
              padding: '0.4rem', borderRadius: ' var(--radius-sm)', cursor: 'pointer', display: 'flex'
            }}
          >
            <Lock size={16} />
          </button>
          <button 
            onClick={() => handleDelete(row.id)}
            title="Delete User"
            style={{
              background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)',
              padding: '0.4rem', borderRadius: ' var(--radius-sm)', cursor: 'pointer', display: 'flex'
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
      ignoreRowClick: true,
      allowOverflow: true,
      button: true,
    }
  ];

  return (
    <div>
      <Navbar />
      
      <div className="app-container">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <div style={{ background: 'var(--danger-glow)', padding: '1rem', borderRadius: 'var(--radius-lg)' }}>
            <ShieldAlert size={32} color="var(--danger)" />
          </div>
          <div>
            <h1 style={{ margin: 0 }}>System Administration</h1>
            <p className="subtitle">Manage user access, roles, and GPS constraints.</p>
          </div>
        </div>

        {/* Import Tool Section */}
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <UploadCloud size={20} color="var(--accent-primary)" />
            <h3 style={{ margin: 0 }}>Bulk Import Users from Excel/CSV</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.6' }}>
            Upload an Excel (.xlsx) or CSV file containing user records. The system looks for columns like 'name', 'email', 'role', 'superior email', 'superior name', and <strong>'staff id' (REQUIRED)</strong>. If the staff ID is missing, the row will be skipped.
            <br />
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); handleDownloadSample(); }}
              style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.4rem', 
                color: 'var(--accent-primary)', 
                textDecoration: 'none', 
                fontWeight: 'bold',
                marginTop: '0.75rem',
                fontSize: '0.85rem'
              }}
            >
              <Download size={16} />
              Download sample Excel template
            </a>
          </p>
          
          <div style={{ position: 'relative' }}>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              disabled={importing}
              id="bulk-import-input"
              style={{ display: 'none' }}
            />
            <label 
              htmlFor="bulk-import-input"
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem 2rem',
                border: '2px dashed var(--border-glass)',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(255, 255, 255, 0.02)',
                cursor: importing ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                width: '100%',
                gap: '1rem',
                opacity: importing ? 0.6 : 1,
                transform: 'translateZ(0)',
              }}
              onMouseEnter={(e) => {
                if (!importing) {
                  e.currentTarget.style.border = '2px dashed var(--accent-primary)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.boxShadow = '0 0 20px rgba(99, 102, 241, 0.1)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '2px dashed var(--border-glass)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{
                background: importing ? 'var(--bg-secondary)' : 'var(--accent-glow)',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '0.5rem',
                transition: 'transform 0.3s'
              }}>
                <UploadCloud 
                  size={32} 
                  color={importing ? 'var(--text-muted)' : 'var(--accent-primary)'} 
                  className={importing ? 'animate-bounce' : ''} 
                />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1.1rem' }}>
                  {importing ? 'Processing File...' : 'Click to Browse or Drag & Drop'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Excel (.xlsx, .xls) or CSV files supported
                </p>
              </div>
            </label>
          </div>

          {importResult && (
            <div className={`badge ${importResult.startsWith('Error') ? 'danger' : 'success'}`} style={{ marginTop: '1rem', display: 'inline-block' }}>
              {importResult}
            </div>
          )}
        </div>

        {/* Users Table Section */}
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem', animationDelay: '0.1s' }}>
          <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 style={{ margin: 0 }}>User Management List</h3>
            <div style={{ position: 'relative', width: isMobile ? '100%' : 'auto' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search staff details..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '0.65rem 1rem 0.65rem 2.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', width: isMobile ? '100%' : '250px', outline: 'none' }}
              />
            </div>
          </div>
          <ResponsiveTable
            columns={columns}
            data={users.filter(user => 
              user.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
              user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.staffId?.toLowerCase().includes(searchQuery.toLowerCase())
            )}
            progressPending={loading}
            pagination
          />
        </div>
      </div>

      {/* Global Hover Map Portal */}
      {hoveredLocation && createPortal(
        <div style={{
          position: 'absolute', zIndex: 9999,
          ...hoverStyle,
          width: '200px', height: '150px', borderRadius: '8px', 
          overflow: 'hidden', border: '2px solid var(--border-glass)',
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
        }}>
          <MapContainer center={[hoveredLocation.lat, hoveredLocation.lng]} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={false} dragging={false} scrollWheelZoom={false}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[hoveredLocation.lat, hoveredLocation.lng]} />
          </MapContainer>
        </div>,
        document.body
      )}

    </div>
  );
}
