// frontend/src/App.js
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Login from './Login';
import SignUp from './SignUp';
import SharedView from './SharedView';
import AdminDashboard from './AdminDashboard';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';

// ---------- Dashboard (user) ----------
function Dashboard({ token, user, setUser }) {
  const [formData, setFormData] = useState({ title: '', description: '', link: '' });
  const [file, setFile] = useState(null);
  const [uploadedData, setUploadedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [notification, setNotification] = useState(null);
  const wsRef = useRef();
  const navigate = useNavigate();

  useEffect(() => {
    wsRef.current = new WebSocket(WS_URL);
    wsRef.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'update') {
        if (msg.data.userId === user.id) {
          setUploadedData(prev => [msg.data, ...prev.filter(item => item._id !== msg.data._id)]);
          setNotification({ message: `New: ${msg.data.title}`, type: 'success' });
          setTimeout(() => setNotification(null), 3000);
        }
      }
    };
    return () => wsRef.current.close();
  }, [user.id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/data', { headers: { 'Authorization': `Bearer ${token}` } });
        const result = await res.json();
        if (result.success) setUploadedData(result.data);
      } catch (err) { console.error(err); }
    };
    if (token) fetchData();
  }, [token]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) {
      setNotification({ message: 'Title is required', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    if (!file) {
      setNotification({ message: 'Please select a file', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    setLoading(true);
    setUploadProgress(0);
    const formDataToSend = new FormData();
    formDataToSend.append('title', formData.title);
    formDataToSend.append('description', formData.description);
    formDataToSend.append('link', formData.link);
    formDataToSend.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) setUploadProgress(Math.round((ev.loaded / ev.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        setFormData({ title: '', description: '', link: '' });
        setFile(null);
        setUploadProgress(0);
        setNotification({ message: 'Upload successful!', type: 'success' });
        setTimeout(() => setNotification(null), 3000);
      } else {
        setNotification({ message: 'Upload failed', type: 'error' });
        setTimeout(() => setNotification(null), 3000);
      }
      setLoading(false);
    };
    xhr.onerror = () => {
      setNotification({ message: 'Network error', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      setLoading(false);
    };
    xhr.send(formDataToSend);
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`/api/data/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        setUploadedData(prev => prev.filter(item => item._id !== id));
        setNotification({ message: 'Deleted', type: 'success' });
        setTimeout(() => setNotification(null), 3000);
      }
    } catch (err) { console.error(err); }
  };

  const handleCopyLink = (id) => {
    const url = `${window.location.origin}/shared/${id}`;
    navigator.clipboard.writeText(url);
    setNotification({ message: 'Link copied!', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    navigate('/login');
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  return (
    <div className="app">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Data Upload Platform</h1>
        <div>
          <span>Welcome, {user?.username}!</span>
          {user?.isAdmin && (
            <button onClick={() => navigate('/admin')} style={{ marginLeft: '10px', background: '#e67e22' }}>
              Admin Dashboard
            </button>
          )}
          <button onClick={handleLogout} style={{ marginLeft: '10px' }}>Logout</button>
        </div>
      </div>
      {notification && <div className={`notification ${notification.type}`}>{notification.message}</div>}
      <div className="upload-section">
        <h2>Upload New Data</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Title *</label>
            <input type="text" name="title" value={formData.title} onChange={handleInputChange} required />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea name="description" value={formData.description} onChange={handleInputChange} rows="3" />
          </div>
          <div className="form-group">
            <label>Link</label>
            <input type="url" name="link" value={formData.link} onChange={handleInputChange} placeholder="https://example.com" />
          </div>
          <div className="form-group">
            <label>File * (required)</label>
            <input type="file" onChange={handleFileChange} accept="*/*" required />
            {file && <small>Selected: {file.name}</small>}
          </div>
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }}>{uploadProgress}%</div>
            </div>
          )}
          <button type="submit" disabled={loading}>{loading ? 'Uploading...' : 'Upload Data'}</button>
        </form>
      </div>
      <div className="data-section">
        <h2>Your Uploaded Data ({uploadedData.length})</h2>
        <div className="data-grid">
          {uploadedData.length === 0 ? (
            <p className="no-data">No data uploaded yet</p>
          ) : (
            uploadedData.map(item => (
              <div key={item._id} className="data-card">
                <div className="data-header">
                  <h3>{item.title}</h3>
                  <div>
                    <button className="share-btn" onClick={() => handleCopyLink(item._id)}>🔗 Share</button>
                    <button className="delete-btn" onClick={() => handleDelete(item._id)}>✕</button>
                  </div>
                </div>
                {item.description && <p className="description">{item.description}</p>}
                {item.link && <div className="link-container"><a href={item.link} target="_blank" rel="noopener noreferrer">🔗 {item.link}</a></div>}
                {item.filePath && (
                  <div className="file-container">
                    <a href={`${API_URL}${item.filePath}`} target="_blank" rel="noopener noreferrer">📄 {item.originalName}</a>
                    <span className="file-size">{formatFileSize(item.fileSize)}</span>
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

// ---------- Main App ----------
function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const id = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    return id && username ? { id, username, isAdmin } : null;
  });

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login setToken={setToken} setUser={setUser} />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/shared/:id" element={<SharedView />} />
        <Route path="/admin" element={<AdminDashboard token={token} user={user} />} />
        <Route path="/" element={
          token && user ? (
            <Dashboard token={token} user={user} setUser={setUser} />
          ) : (
            <Navigate to="/login" replace />
          )
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;