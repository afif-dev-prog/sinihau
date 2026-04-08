import React, { useState, useEffect } from 'react';
import DataTableRaw from 'react-data-table-component';

const DataTable = DataTableRaw.default || DataTableRaw;

const customStyles = {
  table: { style: { backgroundColor: 'transparent' } },
  headRow: { style: { backgroundColor: 'transparent', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-glass)' } },
  headCells: { style: { fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '500' } },
  rows: { style: { backgroundColor: 'transparent', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-glass)', '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.02)' } } },
  pagination: { style: { backgroundColor: 'transparent', color: 'var(--text-secondary)', borderTop: 'none' } },
  tableWrapper: { style: { backgroundColor: 'transparent' } }
};

export default function ResponsiveTable(props) {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth <= 768;
  const { data, columns, title, progressPending, noDataComponent } = props;

  const TitleHeader = title && (
    <div style={{ marginBottom: isMobile ? '1.5rem' : '2.5rem' }}>
      {title}
    </div>
  );

  // Render Mobile View
  if (isMobile) {
    if (progressPending) {
      return (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading data...
        </div>
      );
    }

    return (
      <div className="responsive-mobile-table">
        {TitleHeader}
        {(!data || data.length === 0) ? (
          noDataComponent || <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>There are no records to display</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {data.map((row, rowIndex) => (
              <div key={rowIndex} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.2)' }}>
                {columns.map((col, colIndex) => {
                  if (col.omit) return null;
                  return (
                    <div key={colIndex} style={{ display: 'flex', justifyContent: 'space-between', alignItems: col.button ? 'center' : 'flex-start', borderBottom: colIndex === columns.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.05)', paddingBottom: colIndex === columns.length - 1 ? 0 : '0.5rem', gap: '1rem' }}>
                      {col.name && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: '500', width: '35%', flexShrink: 0 }}>
                          {col.name}
                        </span>
                      )}
                      <div style={{ textAlign: col.name ? 'right' : 'left', flex: 1, wordBreak: 'break-word', display: 'flex', justifyContent: col.name ? 'flex-end' : 'flex-start' }}>
                        {col.cell ? col.cell(row, rowIndex, col, colIndex) : (col.selector ? col.selector(row, rowIndex) : null)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Render Standard React DataTable Component for Desktop
  return (
    <div className="responsive-desktop-table">
      {TitleHeader}
      <DataTable 
        customStyles={props.customStyles || customStyles} 
        theme="dark" 
        {...props} 
        title={null}
        noDataComponent={noDataComponent || <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>There are no records to display</div>}
      />
    </div>
  );
}
