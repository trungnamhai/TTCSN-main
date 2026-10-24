import React from 'react';
import './Navbar.css';

export default function Navbar({ activeRole, onChangeRole }) {
  return (
    <header className="eg-navbar">
      <div className="eg-brand">
        <div className="eg-brand-icon" title="ExamGuard AI">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div className="eg-brand-title">Khảo thí an toàn</div>
          <div className="eg-brand-subtitle">Thi trắc nghiệm trực tuyến có giám sát AI</div>
        </div>
      </div>

      <div className="eg-role-switch">
        <button
          type="button"
          className={`eg-role-btn ${activeRole === 'STUDENT' ? 'active' : ''}`}
          onClick={() => onChangeRole('STUDENT')}
        >
          Thí sinh
        </button>
        <button
          type="button"
          className={`eg-role-btn ${activeRole === 'TEACHER' ? 'active' : ''}`}
          onClick={() => onChangeRole('TEACHER')}
        >
          Giám thị
        </button>
      </div>
    </header>
  );
}
