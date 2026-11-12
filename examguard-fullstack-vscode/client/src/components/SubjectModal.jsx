import React, { useState, useEffect } from 'react';
import { apiRequest } from '../services/api';
import './SubjectModal.css';

export default function SubjectModal({ isOpen, subject, onClose, token, onSubjectSaved }) {
  const isEditing = Boolean(subject && subject.id);

  const [subjectCode, setSubjectCode] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [description, setDescription] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (subject) {
        setSubjectCode(subject.subject_code || '');
        setSubjectName(subject.subject_name || '');
        setDescription(subject.description || '');
      } else {
        setSubjectCode('');
        setSubjectName('');
        setDescription('');
      }
      setErrorMsg('');
    }
  }, [isOpen, subject]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subjectCode.trim()) {
      setErrorMsg('Vui lòng nhập mã môn học / chủ đề (VD: IT4010).');
      return;
    }
    if (!subjectName.trim()) {
      setErrorMsg('Vui lòng nhập tên môn học / chủ đề.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const payload = {
        subject_code: subjectCode.trim().toUpperCase(),
        subject_name: subjectName.trim(),
        description: description.trim()
      };

      let response;
      if (isEditing) {
        response = await apiRequest(`/teacher/subjects/${subject.id}`, {
          method: 'PUT',
          token,
          body: payload
        });
      } else {
        response = await apiRequest('/teacher/subjects', {
          method: 'POST',
          token,
          body: payload
        });
      }

      const saved = response.subject || {
        id: subject?.id || Date.now(),
        ...payload
      };

      onSubjectSaved(saved);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Có lỗi xảy ra khi lưu môn học.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="eg-modal-overlay" onClick={onClose}>
      <div className="eg-modal-container eg-subject-modal" onClick={(e) => e.stopPropagation()}>
        <div className="eg-modal-header">
          <div>
            <h3 className="eg-modal-title">
              {isEditing ? 'Sửa thông tin môn học / chủ đề' : 'Thêm môn học / chủ đề khảo thí mới'}
            </h3>
            <p className="eg-modal-subtitle">
              Môn học được sử dụng để phân loại ngân hàng câu hỏi và tạo bộ đề thi.
            </p>
          </div>
          <button type="button" className="eg-modal-close" onClick={onClose} title="Đóng">✕</button>
        </div>

        {errorMsg && <div className="eg-modal-alert-error" role="alert">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="eg-modal-form">
          <div className="eg-modal-grid-2">
            <div className="eg-form-group">
              <label className="eg-form-label">
                Mã môn học / chủ đề <span className="eg-required">*</span>
              </label>
              <input
                type="text"
                className="eg-input eg-monospace-input"
                placeholder="VD: IT4010, CS101..."
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                autoFocus
              />
            </div>

            <div className="eg-form-group">
              <label className="eg-form-label">
                Tên môn học / chủ đề <span className="eg-required">*</span>
              </label>
              <input
                type="text"
                className="eg-input"
                placeholder="VD: An toàn & Bảo mật Hệ thống..."
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
              />
            </div>
          </div>

          <div className="eg-form-group">
            <label className="eg-form-label">Mô tả hoặc ghi chú môn học</label>
            <textarea
              className="eg-textarea"
              rows={3}
              placeholder="VD: Phạm vi kiểm tra giữa kỳ, các chương mục kiến thức trọng tâm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="eg-modal-actions">
            <button type="button" className="eg-btn-cancel" onClick={onClose} disabled={loading}>
              Hủy bỏ
            </button>
            <button type="submit" className="eg-btn-submit" disabled={loading}>
              {loading ? 'Đang lưu...' : isEditing ? 'Cập nhật môn học' : '+ Thêm môn học'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
