// frontend/src/SharedView.js
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function SharedView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/shared/${id}`)
      .then(res => res.json())
      .then(res => {
        if (res.success) setData(res.data);
        else setError('Item not found or has been deleted');
      })
      .catch(() => setError('Error loading item'));
  }, [id]);

  if (error) return <div className="auth-container"><h2>{error}</h2></div>;
  if (!data) return <div className="auth-container"><h2>Loading...</h2></div>;

  return (
    <div className="shared-container">
      <h2>{data.title}</h2>
      {data.description && <p>{data.description}</p>}
      {data.link && <a href={data.link} target="_blank" rel="noopener noreferrer">🔗 {data.link}</a>}
      {data.filePath && (
        <div>
          <a href={`${API_URL}${data.filePath}`} download>📄 Download {data.originalName}</a>
          <span> ({Math.round(data.fileSize/1024)} KB)</span>
        </div>
      )}
      <p><small>Uploaded: {new Date(data.uploadDate).toLocaleString()}</small></p>
    </div>
  );
}

export default SharedView;