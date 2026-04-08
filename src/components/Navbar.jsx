import React, { useState, useEffect } from 'react';
import { LogOut, User, Navigation, Home, Users, Briefcase, Database, Menu, X } from 'lucide-react';
import { useAuth } from '../App';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../utils/api';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSuperior, setIsSuperior] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.checkSuperior();
        setIsSuperior(res.isSuperior);
      } catch (err) {}
    };
    if (user) check();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const NavButton = ({ title, path, icon: Icon, isMobileMenu }) => {
    const isActive = location.pathname === path;
    const isVisible = isMobileMenu || windowWidth > 900;
    
    return (
      <button 
        onClick={() => { navigate(path); setIsMobileMenuOpen(false); }}
        style={{
          background: isActive ? 'var(--accent-glow)' : 'transparent',
          border: isActive ? '1px solid var(--accent-primary)' : '1px solid transparent',
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          padding: '0.6rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: isMobileMenu ? 'flex-start' : 'center',
          gap: '0.75rem',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          width: isMobileMenu ? '100%' : 'auto',
          fontSize: isMobileMenu ? '1.1rem' : '0.9rem',
          fontWeight: '500'
        }}
        onMouseOver={e => !isActive && (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseOut={e => !isActive && (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        <Icon size={isMobileMenu ? 22 : 18} /> <span style={{ display: isVisible ? 'block' : 'none' }}>{title}</span>
      </button>
    );
  };

  const NavLinks = ({ isMobileMenu }) => (
    <>
      <NavButton title="Attendance" path="/staff" icon={Home} isMobileMenu={isMobileMenu} />
      {isSuperior && <NavButton title="My Team" path="/superior" icon={Users} isMobileMenu={isMobileMenu} />}
      {['HR', 'Admin'].includes(user?.role) && <NavButton title="HR Dashboard" path="/hr" icon={Briefcase} isMobileMenu={isMobileMenu} />}
      {user?.role === 'Admin' && <NavButton title="Admin Settings" path="/admin" icon={Database} isMobileMenu={isMobileMenu} />}
    </>
  );

  return (
    <>
      {/* Sticky Top Navbar */}
      <nav className="glass-panel" style={{ 
        position: 'sticky',
        top: isMobile ? 0 : '1rem',
        left: 0,
        right: 0,
        margin: isMobile ? 0 : '1rem auto',
        maxWidth: isMobile ? '100%' : '1200px',
        padding: isMobile ? '0.75rem 1rem' : '0.75rem 2rem',
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderRadius: isMobile ? 0 : 'var(--radius-xl)',
        zIndex: 1000,
        borderTop: isMobile ? 'none' : '1px solid var(--border-glass)',
        borderLeft: isMobile ? 'none' : '1px solid var(--border-glass)',
        borderRight: isMobile ? 'none' : '1px solid var(--border-glass)',
        boxShadow: 'var(--shadow-lg)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => navigate('/')}>
          <div style={{ 
            background: 'var(--accent-glow)', 
            padding: '0.5rem', 
            borderRadius: 'var(--radius-md)' 
          }}>
            <Navigation size={isMobile ? 20 : 24} color="var(--accent-primary)" />
          </div>
          <h3 style={{ margin: 0, display: windowWidth > 640 ? 'block' : 'none', fontSize: isMobile ? '1.1rem' : '1.3rem' }}>
            Attendance<span style={{color: 'var(--accent-primary)'}}>Sync</span>
          </h3>
        </div>
        
        {/* Desktop Navigation Links */}
        <div style={{ display: isMobile ? 'none' : 'flex', gap: '0.5rem', flex: 1, justifyContent: 'center', padding: '0 1rem' }}>
          <NavLinks />
        </div>
        
        {/* Desktop User Logic */}
        <div style={{ display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            <User size={18} />
            <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</span>
          </div>
          
          <button 
            onClick={handleLogout}
            style={{
              background: 'transparent', border: '1px solid var(--border-glass)', color: 'var(--text-primary)',
              padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', display: 'flex',
              alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.85rem'
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--danger)'}
            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-glass)'}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>

        {/* Mobile Hamburger Icon */}
        <div style={{ display: isMobile ? 'block' : 'none' }}>
          <button 
            onClick={() => setIsMobileMenuOpen(true)} 
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid var(--border-glass)', 
              color: 'var(--text-primary)', 
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center'
            }}>
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* Spacing for sticky nav on mobile */}
      {isMobile && <div style={{ height: '0.5rem' }}></div>}

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div 
          onClick={() => setIsMobileMenuOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.6)', zIndex: 9998, backdropFilter: 'blur(4px)'
          }}
        />
      )}

      {/* Mobile Drawer Content */}
      <div style={{
        position: 'fixed', 
        top: 0, 
        right: 0, 
        width: '280px', 
        height: '100vh',
        background: 'var(--bg-secondary)', 
        zIndex: 9999, 
        padding: '2rem 1.5rem', 
        display: 'flex', 
        flexDirection: 'column',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
        transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        borderLeft: '1px solid var(--border-glass)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             <Navigation size={20} color="var(--accent-primary)" />
             <span style={{ fontWeight: 'bold' }}>Menu</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={28} />
          </button>
        </div>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <NavLinks isMobileMenu={true} />
          
          <div style={{ height: '1px', background: 'var(--border-glass)', margin: '1.5rem 0' }}></div>
          
          <div style={{ padding: '0 0.5rem' }}>
            <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              <User size={18} />
              <span>{user?.name}</span>
            </div>
            <div style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 'bold', marginLeft: '2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {user?.role}
            </div>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <button 
              onClick={handleLogout}
              style={{
                background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)',
                padding: '1rem', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'center',
                alignItems: 'center', gap: '0.75rem', cursor: 'pointer', width: '100%', fontSize: '1rem', fontWeight: '600'
              }}
            >
              <LogOut size={20} /> Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
