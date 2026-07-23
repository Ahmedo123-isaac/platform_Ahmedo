// frontend/src/AdminDashboard.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminDashboard({ token, user }) {
  const [users, setUsers] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const wsRef = useRef();

  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/');
      return;
    }

    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';
    wsRef.current = new WebSocket(wsUrl);
    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'update') {
        setUploads(prev => [msg.data, ...prev]);
      }
    };

    fetchData();
    return () => wsRef.current.close();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, uploadsRes] = await Promise.all([
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/uploads', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const usersData = await usersRes.json();
      const uploadsData = await uploadsRes.json();
      if (usersData.success) setUsers(usersData.users);
      if (uploadsData.success) setUploads(uploadsData.data);
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this upload?')) return;
    const res = await fetch(`/api/admin/uploads/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      setUploads(prev => prev.filter(u => u._id !== id));
    }
  };

  if (loading) return <div className="auth-container"><h2>Loading admin data...</h2></div>;

  return (
    <div className="app">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Admin Dashboard</h1>
        <button onClick={() => navigate('/')}>← Back</button>
      </div>
      <div className="data-section" style={{ marginBottom: '30px' }}>
        <h2>All Users ({users.length})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Username</th>
              <th>Joined</th>
              <th>Upload Count</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id}>
                <td>{u.username}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>{uploads.filter(up => up.userId === u._id).length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="data-section">
        <h2>All Uploads ({uploads.length})</h2>
        <div className="data-grid">
          {uploads.length === 0 ? (
            <p className="no-data">No uploads yet</p>
          ) : (
            uploads.map(item => (
              <div key={item._id} className="data-card">
                <div className="data-header">
                  <h3>{item.title}</h3>
                  <button className="delete-btn" onClick={() => handleDelete(item._id)}>✕</button>
                </div>
                <p><strong>User:</strong> {item.username || item.userId}</p>
                {item.description && <p className="description">{item.description}</p>}
                {item.link && <div className="link-container"><a href={item.link} target="_blank" rel="noopener noreferrer">🔗 {item.link}</a></div>}
                {item.filePath && (
                  <div className="file-container">
                    <a href={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${item.filePath}`} target="_blank" rel="noopener noreferrer">
                      📄 {item.originalName}
                    </a>
                  </div>
                )}
                <div className="data-footer">
                  <span className="status">{item.status}</span>
                  <span className="date">{new Date(item.uploadDate).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;