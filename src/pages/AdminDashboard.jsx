import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { ShieldAlert, Trash2, MapPinOff, RefreshCw, UploadCloud, Key } from 'lucide-react';
import * as XLSX from 'xlsx';
import ResponsiveTable from '../components/ResponsiveTable';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

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
      selector: row => row.superiorEmail,
      sortable: true,
      minWidth: '200px',
      cell: row => (
        <div style={{ fontSize: '0.85rem' }}>
          {row.superiorEmail ? (
            <>
              <div style={{ fontWeight: '500' }}>{row.superiorName}</div>
              <div style={{ color: 'var(--text-muted)' }}>{row.superiorEmail}</div>
            </>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>None</span>
          )}
        </div>
      )
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
      cell: row => (
        row.home_locked ? (
          <span className="badge success">Locked</span>
        ) : (
          <span className="badge" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }}>Pending</span>
        )
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
              padding: '0.5rem', borderRadius: 'var(--radius-md)', cursor: row.home_locked ? 'pointer' : 'not-allowed',
              opacity: row.home_locked ? 1 : 0.3
            }}
          >
            <MapPinOff size={16} />
          </button>
          
          <button 
            onClick={() => handleDelete(row.id)}
            title="Delete User"
            style={{
              background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)',
              padding: '0.5rem', borderRadius: 'var(--radius-md)', cursor: 'pointer'
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
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            Upload an Excel (.xlsx) or CSV file containing user records. The system looks for columns like 'name', 'email', 'role', 'superior email', 'superior name', and <strong>'staff id' (REQUIRED)</strong>. If the staff ID is missing, the row will be skipped.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv"
              onChange={handleFileUpload}
              disabled={importing}
              style={{
                fontFamily: 'inherit',
                border: '1px solid var(--border-glass)',
                padding: '0.5rem',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                background: 'rgba(255, 255, 255, 0.05)'
              }}
            />
            {importing && (
              <span style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <RefreshCw size={18} className="animate-spin" />
                Importing...
              </span>
            )}
          </div>

          {importResult && (
            <div className={`badge ${importResult.startsWith('Error') ? 'danger' : 'success'}`} style={{ marginTop: '1rem', display: 'inline-block' }}>
              {importResult}
            </div>
          )}
        </div>

        {/* Users Table Section */}
        <div className="glass-panel animate-fade-in" style={{ padding: '2rem', animationDelay: '0.1s' }}>
          <ResponsiveTable
            title={<h3 style={{ margin: 0 }}>User Management List</h3>}
            columns={columns}
            data={users}
            progressPending={loading}
            pagination
          />
        </div>
      </div>
    </div>
  );
}
