import React, { useEffect, useState, useMemo } from 'react';
import { apiRequest } from '../../services/api';
import { socket } from '../../services/socket';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import AddStudentModal from '../../components/AddStudentModal';
import EditStudentModal from '../../components/EditStudentModal';
import DeleteStudentModal from '../../components/DeleteStudentModal';
import QuestionModal from '../../components/QuestionModal';
import DeleteQuestionModal from '../../components/DeleteQuestionModal';
import SubjectModal from '../../components/SubjectModal';
import DeleteSubjectModal from '../../components/DeleteSubjectModal';
import ExamModal from '../../components/ExamModal';
import DeleteExamModal from '../../components/DeleteExamModal';
import SessionModal from '../../components/SessionModal';
import CloseOrCancelSessionModal from '../../components/CloseOrCancelSessionModal';
import './ProctoringDashboard.css';

export default function ProctoringDashboard({ token, teacher, onLogout }) {
  // Navigation active tab: 'proctoring' | 'sessions' | 'exams' | 'questions' | 'subjects'
  const [activeTab, setActiveTab] = useState('proctoring');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 960) {
      return true;
    }
    return false;
  });

  // Proctoring & Students state
  const [dashboard, setDashboard] = useState({
    logs: [],
    attempts: [],
    students: [],
    questions: [],
    session: {}
  });

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('ALL');
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [statusManagingSession, setStatusManagingSession] = useState(null);

  // Subjects state
  const [subjects, setSubjects] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState('');
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [deletingSubject, setDeletingSubject] = useState(null);

  // Exams & Matrices state
  const [exams, setExams] = useState([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examSearch, setExamSearch] = useState('');
  const [examStatusFilter, setExamStatusFilter] = useState('ALL');
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [deletingExam, setDeletingExam] = useState(null);

  // Questions state
  const [questions, setQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionDifficultyFilter, setQuestionDifficultyFilter] = useState('ALL');
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [deletingQuestion, setDeletingQuestion] = useState(null);

  // General state
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Check-in Approval state
  const [checkinRequests, setCheckinRequests] = useState([]);
  const [loadingCheckin, setLoadingCheckin] = useState(false);
  const [checkinFilter, setCheckinFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  const [viewingSnapshot, setViewingSnapshot] = useState(null);

  // Support & Re-entry Requests state
  const [supportRequests, setSupportRequests] = useState([]);
  const [loadingSupport, setLoadingSupport] = useState(false);
  const [supportFilter, setSupportFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

  // Live Camera Proctoring state
  const [liveFeeds, setLiveFeeds] = useState({});
  const [selectedLiveCam, setSelectedLiveCam] = useState(null);

  // Modals state for Students & Password
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);

  // Modals for Force Submit (Thu bài) & Resume Network (Duyệt thi lại sự cố mạng)
  const [forceSubmittingStudent, setForceSubmittingStudent] = useState(null);
  const [forceReasonOption, setForceReasonOption] = useState('FACE_MISMATCH');
  const [customForceReason, setCustomForceReason] = useState('');
  const [submittingForce, setSubmittingForce] = useState(false);

  // Search & filter for Students Roster
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('ALL');

  // Fetch proctoring overview
  const fetchOverview = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await apiRequest('/teacher/dashboard', { token });
      setDashboard(data);
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
      }
    } catch (error) {
      setErrorMsg(error.message || 'Không thể tải dữ liệu dashboard.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch assigned sessions
  const fetchAssignedSessions = async () => {
    setLoadingSessions(true);
    try {
      const data = await apiRequest('/teacher/sessions', { token });
      if (Array.isArray(data)) {
        setSessions(data);
      } else if (data && Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách ca thi:', err.message);
    } finally {
      setLoadingSessions(false);
    }
  };

  // Fetch subjects list
  const fetchSubjectsList = async () => {
    setLoadingSubjects(true);
    try {
      const data = await apiRequest('/teacher/subjects', { token });
      if (Array.isArray(data)) {
        setSubjects(data);
      } else if (data && Array.isArray(data.subjects)) {
        setSubjects(data.subjects);
      }
    } catch (err) {
      console.warn('Lỗi tải danh mục môn học:', err.message);
    } finally {
      setLoadingSubjects(false);
    }
  };

  // Fetch exams list
  const fetchExamsList = async () => {
    setLoadingExams(true);
    try {
      const data = await apiRequest('/teacher/exams', { token });
      if (Array.isArray(data)) {
        setExams(data);
      } else if (data && Array.isArray(data.exams)) {
        setExams(data.exams);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách đề thi:', err.message);
    } finally {
      setLoadingExams(false);
    }
  };

  // Fetch questions bank
  const fetchQuestionsList = async () => {
    setLoadingQuestions(true);
    try {
      const data = await apiRequest('/teacher/questions', { token });
      if (Array.isArray(data)) {
        setQuestions(data);
      } else if (data && Array.isArray(data.questions)) {
        setQuestions(data.questions);
      }
    } catch (err) {
      console.warn('Lỗi tải ngân hàng câu hỏi:', err.message);
    } finally {
      setLoadingQuestions(false);
    }
  };

  // Fetch Check-in requests
  const fetchCheckinRequests = async () => {
    setLoadingCheckin(true);
    try {
      const data = await apiRequest('/teacher/checkin-requests', { token });
      if (Array.isArray(data?.requests)) {
        setCheckinRequests(data.requests);
      }
    } catch (err) {
      console.warn('Lỗi tải danh sách check-in:', err.message);
    } finally {
      setLoadingCheckin(false);
    }
  };

  // Duyệt check-in
  const handleApproveCheckin = async (id) => {
    try {
      const res = await apiRequest(`/teacher/checkin-requests/${id}/decision`, {
        method: 'POST',
        token,
        body: { decision: 'APPROVE' }
      });
      setStatusMsg(res.message || 'Đã duyệt thí sinh vào phòng thi!');
      setCheckinRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'APPROVED', decided_at: new Date().toISOString() } : r))
      );
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi duyệt check-in');
    }
  };

  // Từ chối check-in
  const handleRejectCheckin = async (id) => {
    const reason = window.prompt('Lý do từ chối check-in (ví dụ: Ảnh chân dung mờ, không rõ mặt):', 'Ảnh mờ hoặc không nhận diện được khuôn mặt');
    if (reason === null) return;
    try {
      const res = await apiRequest(`/teacher/checkin-requests/${id}/decision`, {
        method: 'POST',
        token,
        body: { decision: 'REJECT', reason }
      });
      setStatusMsg(res.message || 'Đã từ chối yêu cầu check-in.');
      setCheckinRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'REJECTED', reject_reason: reason, decided_at: new Date().toISOString() } : r))
      );
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi từ chối check-in');
    }
  };

  // Duyệt tất cả check-in
  const handleApproveAllCheckin = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn duyệt tất cả thí sinh đang chờ vào phòng thi?')) return;
    try {
      const res = await apiRequest('/teacher/checkin-requests/approve-all', {
        method: 'POST',
        token
      });
      setStatusMsg(res.message || 'Đã duyệt tất cả thí sinh!');
      setCheckinRequests((prev) =>
        prev.map((r) => (r.status === 'PENDING' ? { ...r, status: 'APPROVED', decided_at: new Date().toISOString() } : r))
      );
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi duyệt tất cả check-in');
    }
  };

  // Tải danh sách yêu cầu hỗ trợ kỹ thuật & xin vào lại
  const fetchSupportRequests = async () => {
    setLoadingSupport(true);
    try {
      const data = await apiRequest('/teacher/support-requests', { token });
      setSupportRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Lỗi tải danh sách yêu cầu hỗ trợ:', err.message);
    } finally {
      setLoadingSupport(false);
    }
  };

  // Xử lý phê duyệt / phản hồi yêu cầu hỗ trợ
  const handleDecideSupport = async (id, status, defaultReply = '') => {
    const promptLabel = status === 'APPROVED'
      ? 'Lời nhắn gửi thí sinh khi duyệt vào lại phòng thi (tùy chọn):'
      : 'Lý do từ chối hoặc phản hồi kỹ thuật gửi thí sinh:';
    const initialText = defaultReply || (status === 'APPROVED'
      ? 'Giám thị đã duyệt cho bạn tiếp tục làm bài thi. Chúc bạn làm bài tốt!'
      : 'Giám thị đã ghi nhận yêu cầu của bạn.');
    const replyMessage = window.prompt(promptLabel, initialText);
    if (replyMessage === null) return;

    try {
      const res = await apiRequest(`/teacher/support-requests/${id}/decision`, {
        method: 'POST',
        token,
        body: { status, replyMessage }
      });
      setStatusMsg(res.message || 'Đã cập nhật trạng thái yêu cầu hỗ trợ.');
      setSupportRequests((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, status, reply_message: replyMessage, decided_at: new Date().toISOString() } : r
        )
      );
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi xử lý yêu cầu hỗ trợ');
    }
  };

  // Duyệt cho phép tiếp tục thi lại khi thí sinh gặp sự cố mạng
  const handleAllowResume = async (studentCode, sessionCode, studentName) => {
    if (!window.confirm(`Xác nhận duyệt cho phép thí sinh ${studentName || studentCode} (${studentCode}) tiếp tục làm bài thi sau sự cố mạng?\n\nToàn bộ đáp án đã tự động lưu trước đó của thí sinh sẽ được giữ nguyên.`)) {
      return;
    }

    try {
      const res = await apiRequest(`/teacher/students/${studentCode}/allow-resume`, {
        method: 'POST',
        token,
        body: { sessionCode, note: 'Giám thị đã duyệt quyền tiếp tục thi sau sự cố mạng.' }
      });
      setStatusMsg(res.message || `Đã duyệt cho phép thí sinh ${studentCode} tiếp tục thi lại!`);
      // Cập nhật trạng thái thí sinh trong bảng
      setDashboard((prev) => ({
        ...prev,
        students: prev.students.map((s) =>
          s.student_code === studentCode ? { ...s, exam_status: 'IN_PROGRESS' } : s
        )
      }));
      fetchSupportRequests();
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi duyệt cho phép thi lại');
    }
  };

  // Cưỡng chế thu bài khi thí sinh vi phạm nặng
  const handleExecuteForceSubmit = async () => {
    if (!forceSubmittingStudent) return;
    setSubmittingForce(true);
    setErrorMsg('');

    const reasonMap = {
      FACE_MISMATCH: 'Gian lận thi cử: Phát hiện khuôn mặt không phù hợp với ảnh check-in ban đầu (Nghi vấn thi hộ)',
      MULTIPLE_FACES: 'Phát hiện nhiều người cùng xuất hiện trong phòng thi để hỗ trợ làm bài',
      TAB_SWITCH_EXCESSIVE: 'Cố tình thoát toàn màn hình và chuyển tab nhiều lần vi phạm quy chế',
      DISOBEY_RULES: 'Không tuân thủ hiệu lệnh phòng thi và quy chế khảo thí của Giám thị',
      OTHER: customForceReason.trim() || 'Vi phạm nghiêm trọng quy chế phòng thi'
    };

    const finalReason = forceReasonOption === 'OTHER' ? (customForceReason.trim() || 'Vi phạm quy chế phòng thi') : reasonMap[forceReasonOption];

    try {
      const res = await apiRequest(`/teacher/students/${forceSubmittingStudent.studentCode}/force-submit`, {
        method: 'POST',
        token,
        body: {
          sessionCode: forceSubmittingStudent.sessionCode || 'EXAM88',
          reason: finalReason
        }
      });

      setStatusMsg(res.message || `Đã cưỡng chế thu bài thi của thí sinh ${forceSubmittingStudent.studentCode}!`);

      // Cập nhật trạng thái thí sinh
      setDashboard((prev) => ({
        ...prev,
        students: prev.students.map((s) =>
          s.student_code === forceSubmittingStudent.studentCode ? { ...s, exam_status: 'SUBMITTED' } : s
        ),
        attempts: prev.attempts.map((a) =>
          a.student_code === forceSubmittingStudent.studentCode ? { ...a, status: 'SUBMITTED', total_score: res.totalScore } : a
        )
      }));

      // Cập nhật thẻ Live Feed
      setLiveFeeds((prev) => {
        if (!prev[forceSubmittingStudent.studentCode]) return prev;
        return {
          ...prev,
          [forceSubmittingStudent.studentCode]: {
            ...prev[forceSubmittingStudent.studentCode],
            faceStatus: 'VIOLATION',
            message: 'Đã cưỡng chế thu bài'
          }
        };
      });

      setForceSubmittingStudent(null);
      setSelectedLiveCam(null);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi khi cưỡng chế thu bài');
    } finally {
      setSubmittingForce(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchSupportRequests();
    fetchAssignedSessions();
    fetchSubjectsList();
    fetchExamsList();
    fetchQuestionsList();
    fetchCheckinRequests();

    socket.on('proctoring:violation_alert', (newLog) => {
      setDashboard((prev) => ({
        ...prev,
        logs: [newLog, ...prev.logs]
      }));
      if (newLog.student_code) {
        setLiveFeeds((prev) => ({
          ...prev,
          [newLog.student_code]: {
            ...(prev[newLog.student_code] || {}),
            studentCode: newLog.student_code,
            fullName: newLog.full_name,
            violationType: newLog.violation_type,
            faceStatus: 'VIOLATION',
            message: `Vi phạm mới: ${newLog.violation_type}`,
            lastSeen: Date.now()
          }
        }));
      }
    });

    const handleHeartbeat = (data) => {
      if (!data || !data.studentCode) return;
      setLiveFeeds((prev) => ({
        ...prev,
        [data.studentCode]: {
          ...data,
          lastSeen: Date.now()
        }
      }));
    };

    socket.on('proctoring:live_heartbeat', handleHeartbeat);

    const handleNewCheckin = (newReq) => {
      setCheckinRequests((prev) => {
        const filtered = prev.filter((r) => r.id !== newReq.id);
        return [newReq, ...filtered];
      });
      setStatusMsg(`Thí sinh ${newReq.full_name} (${newReq.student_code}) vừa gửi yêu cầu check-in ca thi ${newReq.session_code}!`);
    };

    socket.on('teacher:new_checkin_request', handleNewCheckin);

    const handleNewSupport = (newReq) => {
      setSupportRequests((prev) => {
        const filtered = prev.filter((r) => r.id !== newReq.id);
        return [newReq, ...filtered];
      });
      setStatusMsg(`Thí sinh ${newReq.full_name || newReq.student_code} vừa gửi yêu cầu hỗ trợ ca thi ${newReq.session_code || ''}!`);
    };

    socket.on('teacher:new_support_request', handleNewSupport);

    const handleStudentPresence = ({ username, isOnline }) => {
      setDashboard((prev) => ({
        ...prev,
        students: prev.students.map((student) =>
          student.student_code === username
            ? { ...student, is_online: isOnline }
            : student
        )
      }));
    };

    socket.on('teacher:student_presence', handleStudentPresence);

    return () => {
      socket.off('proctoring:violation_alert');
      socket.off('proctoring:live_heartbeat', handleHeartbeat);
      socket.off('teacher:new_checkin_request', handleNewCheckin);
      socket.off('teacher:new_support_request', handleNewSupport);
      socket.off('teacher:student_presence', handleStudentPresence);
    };
  }, [token]);

  // Student CRUD callbacks
  const handleStudentCreated = (newStudent) => {
    setDashboard((prev) => ({
      ...prev,
      students: [
        newStudent,
        ...prev.students.filter((s) => s.student_code !== newStudent.student_code)
      ]
    }));
    setStatusMsg(`Đã tạo thành công tài khoản học sinh: ${newStudent.full_name} (${newStudent.student_code})!`);
  };

  const handleStudentUpdated = (updatedStudent) => {
    setDashboard((prev) => ({
      ...prev,
      students: prev.students.map((s) =>
        s.id === updatedStudent.id || s.student_code === updatedStudent.student_code
          ? { ...s, ...updatedStudent }
          : s
      )
    }));
    setStatusMsg(`Đã cập nhật thông tin học sinh: ${updatedStudent.full_name} (${updatedStudent.student_code})!`);
  };

  const handleStudentDeleted = (deletedId) => {
    setDashboard((prev) => ({
      ...prev,
      students: prev.students.filter((s) => String(s.id) !== String(deletedId))
    }));
    setStatusMsg('Đã xóa tài khoản học sinh thành công khỏi hệ thống!');
  };

  // Session CRUD callbacks
  const handleSessionSaved = (savedSes) => {
    setSessions((prev) => {
      const exists = prev.some((s) => (s.id || s.session_id) === (savedSes.id || savedSes.session_id));
      if (exists) {
        return prev.map((s) =>
          (s.id || s.session_id) === (savedSes.id || savedSes.session_id) ? { ...s, ...savedSes } : s
        );
      }
      return [savedSes, ...prev];
    });
    setStatusMsg(`Đã lưu phòng thi "${savedSes.title}" [${savedSes.session_code}] thành công!`);
    setShowSessionModal(false);
    setEditingSession(null);
  };

  const handleSessionStatusChanged = (sessionId, newStatus, updatedSes) => {
    setSessions((prev) =>
      prev.map((s) =>
        (s.id || s.session_id) === sessionId
          ? {
              ...s,
              status: newStatus,
              status_label:
                newStatus === 'OPEN'
                  ? 'Đang mở / Đang thi'
                  : newStatus === 'CANCELLED'
                  ? 'Đã hủy'
                  : 'Đã kết thúc / Đóng',
              ...(updatedSes || {})
            }
          : s
      )
    );
    setStatusManagingSession(null);
    setStatusMsg(`Đã cập nhật trạng thái phòng thi sang "${newStatus}".`);
  };

  const handleSessionDeleted = (deletedId) => {
    setSessions((prev) => prev.filter((s) => (s.id || s.session_id) !== deletedId));
    setStatusManagingSession(null);
    setStatusMsg('Đã xóa bỏ phòng thi / ca thi thành công khỏi hệ thống!');
  };

  // Subject CRUD callbacks
  const handleSubjectSaved = (savedSubj) => {
    setSubjects((prev) => {
      const exists = prev.some((s) => s.id === savedSubj.id);
      if (exists) {
        return prev.map((s) => (s.id === savedSubj.id ? savedSubj : s));
      }
      return [savedSubj, ...prev];
    });
    setStatusMsg(`Đã lưu môn học "${savedSubj.subject_name}" (${savedSubj.subject_code}) thành công!`);
    setShowSubjectModal(false);
    setEditingSubject(null);
  };

  const handleSubjectDeleted = (deletedId) => {
    setSubjects((prev) => prev.filter((s) => s.id !== deletedId));
    setDeletingSubject(null);
    setStatusMsg('Đã xóa môn học / chủ đề thành công khỏi danh mục!');
  };

  // Exam CRUD callbacks
  const handleExamSaved = (savedExam) => {
    setExams((prev) => {
      const exists = prev.some((e) => e.id === savedExam.id);
      if (exists) {
        return prev.map((e) => (e.id === savedExam.id ? savedExam : e));
      }
      return [savedExam, ...prev];
    });
    setStatusMsg(`Đã lưu bộ đề thi "${savedExam.title}" (${savedExam.exam_code}) thành công!`);
    setShowExamModal(false);
    setEditingExam(null);
  };

  const handleExamDeleted = (deletedId) => {
    setExams((prev) => prev.filter((e) => e.id !== deletedId));
    setDeletingExam(null);
    setStatusMsg('Đã xóa bộ đề thi thành công khỏi hệ thống!');
  };

  // Question CRUD callbacks
  const handleQuestionSaved = (savedQ) => {
    setQuestions((prev) => {
      const exists = prev.some((q) => q.id === savedQ.id);
      if (exists) {
        return prev.map((q) => (q.id === savedQ.id ? savedQ : q));
      }
      return [savedQ, ...prev];
    });
    fetchSubjectsList();
    setStatusMsg(`Đã lưu câu hỏi "${savedQ.question_code || 'Mới'}" thành công!`);
    setShowQuestionModal(false);
    setEditingQuestion(null);
  };

  const handleQuestionDeleted = (deletedId) => {
    setQuestions((prev) => prev.filter((q) => q.id !== deletedId));
    fetchSubjectsList();
    setDeletingQuestion(null);
    setStatusMsg('Đã ngừng sử dụng và xóa câu hỏi khỏi ngân hàng đề thành công!');
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    let list = dashboard.students || [];

    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.trim().toLowerCase();
      list = list.filter((s) =>
        (s.student_code && s.student_code.toLowerCase().includes(q)) ||
        (s.full_name && s.full_name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q))
      );
    }

    if (studentStatusFilter !== 'ALL') {
      if (studentStatusFilter === 'ONLINE') {
        list = list.filter((s) => s.is_online);
      } else if (studentStatusFilter === 'OFFLINE') {
        list = list.filter((s) => !s.is_online);
      } else if (studentStatusFilter === 'IN_PROGRESS') {
        list = list.filter((s) => s.exam_status === 'IN_PROGRESS');
      } else if (studentStatusFilter === 'SUBMITTED') {
        list = list.filter((s) => s.exam_status === 'SUBMITTED');
      } else if (studentStatusFilter === 'NOT_TAKEN') {
        list = list.filter((s) => !s.exam_status || s.exam_status === 'Chưa thi');
      }
    }

    return list;
  }, [dashboard.students, studentSearchQuery, studentStatusFilter]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    let list = sessions || [];

    if (sessionSearch.trim()) {
      const q = sessionSearch.trim().toLowerCase();
      list = list.filter((s) =>
        (s.session_code && s.session_code.toLowerCase().includes(q)) ||
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.subject_name && s.subject_name.toLowerCase().includes(q)) ||
        (s.room && s.room.toLowerCase().includes(q))
      );
    }

    if (sessionStatusFilter !== 'ALL') {
      list = list.filter((s) => s.status === sessionStatusFilter);
    }

    return list;
  }, [sessions, sessionSearch, sessionStatusFilter]);

  // Filtered Subjects
  const filteredSubjects = useMemo(() => {
    let list = subjects || [];

    if (subjectSearch.trim()) {
      const q = subjectSearch.trim().toLowerCase();
      list = list.filter((s) =>
        (s.subject_code && s.subject_code.toLowerCase().includes(q)) ||
        (s.subject_name && s.subject_name.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [subjects, subjectSearch]);

  // Filtered Exams
  const filteredExams = useMemo(() => {
    let list = exams || [];

    if (examSearch.trim()) {
      const q = examSearch.trim().toLowerCase();
      list = list.filter((ex) =>
        (ex.exam_code && ex.exam_code.toLowerCase().includes(q)) ||
        (ex.title && ex.title.toLowerCase().includes(q)) ||
        (ex.subject_name && ex.subject_name.toLowerCase().includes(q)) ||
        (ex.subject_code && ex.subject_code.toLowerCase().includes(q))
      );
    }

    if (examStatusFilter !== 'ALL') {
      list = list.filter((ex) => ex.status === examStatusFilter);
    }

    return list;
  }, [exams, examSearch, examStatusFilter]);

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    let list = questions || [];

    if (questionSearch.trim()) {
      const q = questionSearch.trim().toLowerCase();
      list = list.filter((item) =>
        (item.question_code && item.question_code.toLowerCase().includes(q)) ||
        (item.content && item.content.toLowerCase().includes(q))
      );
    }

    if (questionDifficultyFilter !== 'ALL') {
      list = list.filter((item) => item.difficulty_level === questionDifficultyFilter);
    }

    return list;
  }, [questions, questionSearch, questionDifficultyFilter]);

  // Summary counts
  const inProgressCount = dashboard.attempts.filter((a) => a.status === 'IN_PROGRESS').length;
  const submittedCount = dashboard.attempts.filter((a) => a.status === 'SUBMITTED').length;
  const onlineCount = dashboard.students.filter((s) => s.is_online).length;

  // Check-in counts & filter
  const pendingCheckinCount = checkinRequests.filter((r) => r.status === 'PENDING').length;

  const filteredCheckinRequests = useMemo(() => {
    if (checkinFilter === 'ALL') return checkinRequests;
    return checkinRequests.filter((r) => r.status === checkinFilter);
  }, [checkinRequests, checkinFilter]);

  // Support & Re-entry counts & filter
  const pendingSupportCount = supportRequests.filter((r) => r.status === 'PENDING').length;

  const filteredSupportRequests = useMemo(() => {
    if (supportFilter === 'ALL') return supportRequests;
    return supportRequests.filter((r) => r.status === supportFilter);
  }, [supportRequests, supportFilter]);

  // Subjects tab summary
  const subjectQuestionTotal = subjects.reduce((sum, s) => sum + (Number(s.total_questions) || 0), 0);
  const subjectEmptyCount = subjects.filter((s) => !s.total_questions).length;

  // Sidebar navigation items
  const navItems = [
    {
      key: 'proctoring',
      label: 'Giám sát thi & Thí sinh',
      count: dashboard.students.length,
      icon: (
        <>
          <rect x="3" y="4" width="18" height="12" />
          <path d="M8 20h8M12 16v4" />
        </>
      )
    },
    {
      key: 'checkin',
      label: 'Duyệt Check-in Thí sinh',
      count: pendingCheckinCount,
      highlight: pendingCheckinCount > 0,
      icon: (
        <>
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="8.5" cy="7" r="4" />
          <polyline points="17 11 19 13 23 9" />
        </>
      )
    },
    {
      key: 'support',
      label: 'Hỗ trợ & Vào lại',
      count: pendingSupportCount,
      highlight: pendingSupportCount > 0,
      icon: (
        <>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </>
      )
    },
    {
      key: 'sessions',
      label: 'Ca thi phân công',
      count: sessions.length,
      icon: (
        <>
          <rect x="3" y="5" width="18" height="16" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </>
      )
    },
    {
      key: 'exams',
      label: 'Bộ đề thi & Ma trận',
      count: exams.length,
      icon: (
        <>
          <path d="M6 3h8l4 4v14H6z" />
          <path d="M14 3v4h4M9 12h6M9 16h6" />
        </>
      )
    },
    {
      key: 'questions',
      label: 'Ngân hàng câu hỏi',
      count: questions.length,
      icon: (
        <>
          <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
          <path d="M5 17a3 3 0 0 1 3-3h11" />
        </>
      )
    },
    {
      key: 'subjects',
      label: 'Môn học / Chủ đề',
      count: subjects.length,
      icon: <path d="M3 6h6l2 2h10v11H3z" />
    }
  ];

  return (
    <div className="eg-dashboard eg-shell">
      {/* Mobile Drawer Backdrop */}
      {!sidebarCollapsed && (
        <div
          className="eg-sidebar-backdrop"
          onClick={() => setSidebarCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* ===== Thanh điều hướng bên trái ===== */}
      <aside className={`eg-sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
        <div className="eg-brand">
          <span className="eg-brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
              <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
              <path d="M8.5 12l2.5 2.5 4.5-5" />
            </svg>
          </span>
          {!sidebarCollapsed && (
            <span className="eg-brand-text">
              <strong>Hệ thống quản lý thi</strong>
              <small>Khu vực giảng viên</small>
            </span>
          )}
          <button
            type="button"
            className="eg-btn-close-drawer-mobile"
            onClick={() => setSidebarCollapsed(true)}
            title="Đóng menu"
            aria-label="Đóng menu trên điện thoại"
          >
            ✕
          </button>
        </div>

        <nav className="eg-nav" aria-label="Chức năng chính">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`eg-nav-btn ${activeTab === item.key ? 'is-active' : ''}`}
              aria-current={activeTab === item.key ? 'page' : undefined}
              onClick={() => {
                setActiveTab(item.key);
                if (typeof window !== 'undefined' && window.innerWidth <= 960) {
                  setSidebarCollapsed(true);
                }
              }}
              title={sidebarCollapsed ? `${item.label} (${item.count})` : undefined}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
                {item.icon}
              </svg>
              {!sidebarCollapsed && <span className="eg-nav-label">{item.label}</span>}
              {!sidebarCollapsed && <span className="eg-nav-count">{item.count}</span>}
            </button>
          ))}
        </nav>

        <div className="eg-sidebar-bottom-actions">
          <button
            type="button"
            className="eg-sidebar-toggle-row"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Mở rộng thanh menu" : "Thu gọn thanh menu"}
            aria-label="Đóng mở thanh menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {sidebarCollapsed ? (
                <>
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </>
              ) : (
                <>
                  <polyline points="11 17 6 12 11 7" />
                  <polyline points="18 17 13 12 18 7" />
                </>
              )}
            </svg>
            {!sidebarCollapsed && <span>Thu gọn thanh menu</span>}
          </button>

          <button type="button" onClick={onLogout} className="eg-dashboard-logout" title={sidebarCollapsed ? "Đăng xuất" : undefined}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
              <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
            </svg>
            {!sidebarCollapsed && <span>Đăng xuất</span>}
          </button>

          <button
            type="button"
            className="eg-sidebar-close-mobile-row"
            onClick={() => setSidebarCollapsed(true)}
            title="Đóng menu trên điện thoại"
          >
            ✕ Đóng menu
          </button>
        </div>
      </aside>

      {/* ===== Khu vực nội dung ===== */}
      <main className="eg-main">
        {/* Top Header */}
        <header className="eg-dashboard-header">
          <div className="eg-dashboard-welcome-wrap">
            <div className="eg-dashboard-welcome">
              <span className="eg-dashboard-eyebrow">KHU VỰC GIẢNG VIÊN</span>
              <h1 className="eg-dashboard-title">Bảng điều khiển Giảng viên</h1>
              <p className="eg-dashboard-description">
                Xin chào <strong>{teacher?.full_name || teacher?.username}</strong>
              </p>
            </div>
          </div>

          <div className="eg-dashboard-actions">
            <button
              type="button"
              onClick={() => {
                fetchOverview();
                fetchAssignedSessions();
                fetchSubjectsList();
                fetchExamsList();
                fetchQuestionsList();
              }}
              className="eg-dashboard-refresh"
              disabled={loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
                <path d="M20 11a8 8 0 1 0-2.3 5.7" />
                <path d="M20 4v7h-7" />
              </svg>
              {loading ? 'Đang tải...' : 'Làm mới'}
            </button>
            <button
              type="button"
              onClick={() => setShowChangePassword(true)}
              className="eg-dashboard-pwd-btn"
              title="Đổi mật khẩu tài khoản"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
                <rect x="5" y="11" width="14" height="10" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
              </svg>
              Đổi mật khẩu
            </button>
          </div>
        </header>

        {/* Dải trạng thái giám sát AI */}
        <section className="eg-monitor-strip" aria-label="Trạng thái giám sát">
          <div className="eg-monitor-status">
            <span className="eg-monitor-badge">GIÁM SÁT AI</span>
            <span className="eg-live-dot" aria-hidden="true" />
            <p>Hệ thống AI phát hiện gian lận tự động hoạt động liên tục</p>
          </div>
          <div className="eg-monitor-session">
            <span>CA TRỰC HIỆN TẠI</span>
            <strong>{dashboard.session?.session_code || 'EXAM88'}</strong>
          </div>
        </section>

        {/* Thanh chuyển tab trực tiếp trên điện thoại (Không cần bấm menu 3 gạch) */}
        <div className="eg-mobile-nav-tabs">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`eg-mobile-tab-btn ${activeTab === item.key ? 'is-active' : ''}`}
              onClick={() => setActiveTab(item.key)}
            >
              <span className="eg-mobile-tab-label">{item.label}</span>
              {typeof item.count === 'number' && item.count > 0 && (
                <span className="eg-mobile-tab-count">({item.count})</span>
              )}
            </button>
          ))}
        </div>

        {/* Global alert notifications */}
        {statusMsg && (
          <div className="eg-dashboard-alert-banner is-success" role="status">
            <span>{statusMsg}</span>
            <button type="button" onClick={() => setStatusMsg('')} className="eg-banner-close" aria-label="Đóng thông báo">✕</button>
          </div>
        )}
        {errorMsg && (
          <div className="eg-dashboard-alert-banner is-error" role="alert">
            <span>{errorMsg}</span>
            <button type="button" onClick={() => setErrorMsg('')} className="eg-banner-close" aria-label="Đóng thông báo">✕</button>
          </div>
        )}

      {/* =========================================================================
          TAB 1: GIÁM SÁT THI & QUẢN LÝ THÍ SINH
          ========================================================================= */}
      {activeTab === 'proctoring' && (
        <div className="eg-tab-content">
          {pendingCheckinCount > 0 && (
            <div className="eg-dashboard-alert-banner is-warn eg-checkin-alert-banner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span className="eg-live-pulse-dot" />
                <span>
                  Có <strong>{pendingCheckinCount}</strong> yêu cầu check-in của thí sinh đang chờ bạn duyệt vào phòng thi!
                </span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="eg-primary-btn" style={{ padding: '6px 14px', fontSize: '13px' }} onClick={() => setActiveTab('checkin')}>
                  Xem & Duyệt ngay →
                </button>
                <button type="button" className="eg-btn-cancel" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={handleApproveAllCheckin}>
                  Duyệt tất cả
                </button>
              </div>
            </div>
          )}

          {/* Stats Bar */}
          <section className="eg-dashboard-stats" aria-label="Thống kê ca thi">
            <div className="eg-dashboard-stat eg-stat-total">
              <span className="eg-dashboard-stat-label">Tổng thí sinh</span>
              <strong>{dashboard.students.length}</strong>
            </div>
            <div className="eg-dashboard-stat eg-stat-online">
              <span className="eg-dashboard-stat-label">
                <span className="eg-live-pulse-dot" style={{ display: 'inline-block', marginRight: '6px' }} />
                Đang online
              </span>
              <strong style={{ color: '#059669' }}>{onlineCount}</strong>
            </div>
            <div className="eg-dashboard-stat eg-stat-offline">
              <span className="eg-dashboard-stat-label">Đang offline</span>
              <strong>{dashboard.students.length - onlineCount}</strong>
            </div>
            <div className="eg-dashboard-stat eg-stat-examining">
              <span className="eg-dashboard-stat-label">Thí sinh đang thi</span>
              <strong style={{ color: '#0284c7' }}>{inProgressCount}</strong>
            </div>
            <div className="eg-dashboard-stat eg-stat-submitted">
              <span className="eg-dashboard-stat-label">Bài đã nộp</span>
              <strong style={{ color: '#7c3aed' }}>{submittedCount}</strong>
            </div>
            <div className="eg-dashboard-stat eg-stat-violations eg-dashboard-stat-warning">
              <span className="eg-dashboard-stat-label">
                ⚠️ Cảnh báo vi phạm
              </span>
              <strong>{dashboard.logs.length}</strong>
            </div>
          </section>

          {/* =========================================================================
              KHU VỰC GIÁM SÁT CAMERA THẬT THỜI GIAN THỰC (LIVE PROCTORING FEEDS)
              ========================================================================= */}
          <section className="eg-panel eg-live-proctor-section">
            <div className="eg-live-proctor-header">
              <div className="eg-live-proctor-title-wrap">
                <span className="eg-live-pulse-dot" />
                <h2 className="eg-dashboard-section-title" style={{ margin: 0 }}>
                  Giám sát Camera Thật Thí sinh (Thời gian thực)
                </h2>
                <span className="eg-mini-badge is-easy" style={{ marginLeft: '10px' }}>
                  {Object.keys(liveFeeds).length > 0 ? `${Object.keys(liveFeeds).length} Camera đang kết nối` : 'Đang đợi camera thí sinh'}
                </span>
              </div>
              <p className="eg-dashboard-roster-description" style={{ margin: '4px 0 0 0' }}>
                Hệ thống truyền luồng webcam trực tiếp từ phòng thi. AI tự động phát hiện và cảnh báo tức thì: Khuôn mặt không phù hợp (thi hộ), Nhiều người trong khung hình, Rời camera hoặc Chuyển tab.
              </p>
            </div>

            <div className="eg-live-cam-grid">
              {(Object.values(liveFeeds).length > 0
                ? Object.values(liveFeeds)
                : (dashboard.students || []).slice(0, 4).map((st) => {
                    const req = (checkinRequests || []).find((r) => r.student_code === st.student_code);
                    return {
                      studentCode: st.student_code,
                      fullName: st.full_name,
                      sessionCode: st.session_code || dashboard.session?.session_code || 'EXAM88',
                      liveFrame: req?.snapshot_base64 || req?.snapshot_url || null,
                      faceStatus: 'OK',
                      violationType: null,
                      message: 'Sẵn sàng giám sát camera'
                    };
                  })
              ).map((feed) => {
                const isViolation = feed.faceStatus === 'VIOLATION' || Boolean(feed.violationType);
                const hasMismatch = feed.violationType === 'FACE_MISMATCH';
                const hasMulti = feed.violationType === 'MULTIPLE_FACES';
                const hasNoFace = feed.violationType === 'NO_FACE';

                return (
                  <div
                    key={feed.studentCode}
                    className={`eg-live-cam-card ${isViolation ? 'has-violation' : ''}`}
                    onClick={() => setSelectedLiveCam(feed)}
                  >
                    <div className="eg-cam-card-media">
                      {feed.liveFrame ? (
                        <img src={feed.liveFrame} alt={`Cam ${feed.studentCode}`} className="eg-cam-card-img" />
                      ) : (
                        <div className="eg-cam-card-placeholder">
                          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                            <path d="M23 7l-7 5 7 5V7z" />
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                          </svg>
                          <span>Đang chờ khung hình camera...</span>
                        </div>
                      )}

                      <div className="eg-cam-top-badges">
                        <span className="eg-live-badge-red" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff', animation: 'pulse 1.2s infinite' }} />
                          LIVE STREAM · {feed.fps || 60} FPS
                        </span>
                        {feed.sessionCode && (
                          <span className="eg-session-tag-badge">{feed.sessionCode}</span>
                        )}
                      </div>

                      <div className={`eg-cam-ai-overlay ${isViolation ? 'is-alert' : 'is-ok'}`}>
                        {hasMismatch ? (
                          <span>⚠️ KHUÔN MẶT KHÔNG PHÙ HỢP (NGHI THI HỘ)</span>
                        ) : hasMulti ? (
                          <span>⚠️ PHÁT HIỆN NHIỀU NGƯỜI ({feed.faceCount || 2})</span>
                        ) : hasNoFace ? (
                          <span>⚠️ KHÔNG CÓ THÍ SINH TRƯỚC CAMERA</span>
                        ) : (
                          <span>✓ KHUÔN MẶT HỢP LỆ (1 THÍ SINH)</span>
                        )}
                      </div>
                    </div>

                    <div className="eg-cam-card-footer">
                      <div className="eg-cam-user-info">
                        <strong>{feed.fullName || 'Thí sinh'}</strong>
                        <span className="eg-cam-user-code">{feed.studentCode}</span>
                      </div>
                      <div className="eg-cam-card-actions">
                        <button
                          type="button"
                          className="eg-btn-cam-action eg-btn-cam-resume"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAllowResume(feed.studentCode, feed.sessionCode, feed.fullName);
                          }}
                          title="Duyệt cho phép tiếp tục thi lại khi gặp sự cố mạng"
                        >
                          🔄 Duyệt thi lại
                        </button>
                        <button
                          type="button"
                          className="eg-btn-cam-action eg-btn-cam-force"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForceSubmittingStudent({
                              studentCode: feed.studentCode,
                              fullName: feed.fullName,
                              sessionCode: feed.sessionCode
                            });
                          }}
                          title="Cưỡng chế nộp bài hoặc đình chỉ thi khi vi phạm nặng"
                        >
                          🛑 Thu bài
                        </button>
                        <button
                          type="button"
                          className="eg-btn-cam-zoom"
                          onClick={(e) => { e.stopPropagation(); setSelectedLiveCam(feed); }}
                          title="Phóng to camera & xem chi tiết"
                        >
                          ⤢ Phóng to
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Roster Panel */}
          <section className="eg-panel eg-dashboard-roster">
            <div className="eg-dashboard-roster-header">
              <div>
                <h2 className="eg-dashboard-section-title">Danh sách thí sinh</h2>
                <p className="eg-dashboard-roster-description">
                  Quản lý tài khoản, tìm kiếm, chỉnh sửa và theo dõi trạng thái tham gia thi của thí sinh.
                </p>
              </div>
              <div className="eg-dashboard-roster-actions">
                <button
                  type="button"
                  className="eg-dashboard-add-student-btn"
                  onClick={() => setShowAddStudent(true)}
                  title="Thêm tài khoản học sinh mới"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="8.5" cy="7" r="4" />
                    <line x1="20" y1="8" x2="20" y2="14" />
                    <line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  <span>Thêm học sinh</span>
                </button>
                <span className="eg-dashboard-roster-count">{dashboard.students.length} thí sinh</span>
              </div>
            </div>

            {/* Toolbar for students */}
            <div className="eg-dashboard-roster-toolbar">
              <div className="eg-dashboard-search-wrap">
                <svg className="eg-dashboard-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="eg-dashboard-search-input"
                  placeholder="Tìm theo tên, mã sinh viên, email..."
                  value={studentSearchQuery}
                  onChange={(e) => setStudentSearchQuery(e.target.value)}
                />
                {studentSearchQuery && (
                  <button
                    type="button"
                    className="eg-dashboard-search-clear"
                    onClick={() => setStudentSearchQuery('')}
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="eg-dashboard-filter-wrap">
                <select
                  className="eg-dashboard-filter-select"
                  value={studentStatusFilter}
                  onChange={(e) => setStudentStatusFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả trạng thái ({dashboard.students.length})</option>
                  <option value="ONLINE">Đang Online ({onlineCount})</option>
                  <option value="OFFLINE">Đang Offline ({dashboard.students.length - onlineCount})</option>
                  <option value="IN_PROGRESS">Đang thi ({inProgressCount})</option>
                  <option value="SUBMITTED">Đã nộp bài ({submittedCount})</option>
                  <option value="NOT_TAKEN">Chưa thi</option>
                </select>
                {(studentSearchQuery || studentStatusFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="eg-dashboard-reset-filter"
                    onClick={() => { setStudentSearchQuery(''); setStudentStatusFilter('ALL'); }}
                  >
                    Đặt lại bộ lọc
                  </button>
                )}
                <span className="eg-dashboard-matched-count">
                  Hiển thị: <strong>{filteredStudents.length}</strong> / {dashboard.students.length}
                </span>
              </div>
            </div>

            {dashboard.students.length === 0 ? (
              <p className="eg-dashboard-empty">
                {loading ? 'Đang tải danh sách thí sinh...' : 'CSDL chưa có tài khoản thí sinh nào.'}
              </p>
            ) : (
              <div className="eg-dashboard-roster-scroll">
                <table className="eg-dashboard-roster-table">
                  <thead>
                    <tr>
                      <th>Mã thí sinh</th>
                      <th>Họ và tên</th>
                      <th>Email</th>
                      <th>Trạng thái</th>
                      <th>Lượt thi gần nhất</th>
                      <th>Điểm</th>
                      <th style={{ textAlign: 'center', minWidth: '130px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="eg-dashboard-empty-search">
                          Không tìm thấy thí sinh nào khớp với từ khóa "{studentSearchQuery}".
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.id}>
                          <td className="eg-dashboard-student-code">{student.student_code}</td>
                          <td><strong>{student.full_name}</strong></td>
                          <td>{student.email || '—'}</td>
                          <td>
                            <span className={`eg-dashboard-presence ${student.is_online ? 'is-online' : ''}`}>
                              <span className="eg-dashboard-presence-dot" />
                              {student.is_online ? 'Online' : 'Offline'}
                            </span>
                          </td>
                          <td>
                            {student.session_code || 'Chưa có lượt thi'}
                            {student.exam_status && ` · ${student.exam_status}`}
                          </td>
                          <td>{student.total_score ?? '—'}</td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="eg-student-actions">
                              <button
                                type="button"
                                className="eg-student-btn-resume"
                                onClick={() => handleAllowResume(student.student_code, student.session_code, student.full_name)}
                                title="Duyệt cho phép tiếp tục thi lại khi thí sinh gặp sự cố mạng"
                              >
                                🔄 Duyệt thi lại
                              </button>
                              <button
                                type="button"
                                className="eg-student-btn-force"
                                onClick={() =>
                                  setForceSubmittingStudent({
                                    studentCode: student.student_code,
                                    fullName: student.full_name,
                                    sessionCode: student.session_code || 'EXAM88'
                                  })
                                }
                                title="Cưỡng chế nộp bài hoặc đình chỉ thi khi vi phạm nặng"
                              >
                                🛑 Thu bài
                              </button>
                              <button
                                type="button"
                                className="eg-student-btn-edit"
                                onClick={() => setEditingStudent(student)}
                                title="Sửa thông tin học sinh"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Sửa
                              </button>
                              <button
                                type="button"
                                className="eg-student-btn-delete"
                                onClick={() => setDeletingStudent(student)}
                                title="Xóa tài khoản học sinh"
                              >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M3 6h18" />
                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                </svg>
                                Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Realtime violation logs & attempts */}
          <div className="eg-dashboard-grid">
            <div className="eg-panel">
              <h2 className="eg-dashboard-section-title eg-dashboard-log-title">
                Nhật ký vi phạm AI thời gian thực
              </h2>
              {dashboard.logs.length === 0 ? (
                <p className="eg-dashboard-empty">Chưa có vi phạm nào được ghi nhận trong phiên này.</p>
              ) : (
                <div className="eg-dashboard-log-list">
                  {dashboard.logs.map((log) => (
                    <div key={log.id} className="eg-dashboard-log">
                      <div>
                        <div className="eg-dashboard-log-student">
                          <span className={`eg-status-tag ${
                            log.violation_type === 'FACE_MISMATCH' || log.violation_type === 'MULTIPLE_FACES' ? 'is-danger' : 'is-warning'
                          }`} style={{ marginRight: '8px', fontWeight: 600 }}>
                            {log.violation_type === 'FACE_MISMATCH' ? '⚠️ Khuôn mặt khác (Nghi vấn thi hộ)' :
                             log.violation_type === 'MULTIPLE_FACES' ? '⚠️ Nhiều người trong khung hình' :
                             log.violation_type === 'NO_FACE' ? '⚠️ Không có mặt thí sinh' :
                             log.violation_type === 'TAB_SWITCH' ? '⚠️ Chuyển Tab làm bài' :
                             log.violation_type === 'WINDOW_BLUR' ? '⚠️ Mất tiêu điểm cửa sổ' :
                             log.violation_type === 'FULLSCREEN_EXIT' ? '⚠️ Thoát toàn màn hình' : `[${log.violation_type}]`}
                          </span>
                          <strong>{log.student_code || 'SV2026001'}</strong> ({log.full_name || log.student_code || 'Thí sinh'})
                        </div>
                        <div className="eg-dashboard-log-evidence">
                          Khoảng cách Euclidean:{' '}
                          <strong>
                            {log.euclidean_distance !== null && log.euclidean_distance !== undefined
                              ? log.euclidean_distance
                              : 'N/A'}
                          </strong>{' '}
                          · Bằng chứng: <code>{log.evidence_image_path}</code>
                        </div>
                      </div>
                      <span className="eg-dashboard-log-time">
                        {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="eg-panel">
              <h2 className="eg-dashboard-section-title">
                Thí sinh nộp bài trong ca thi (`exam_attempts`)
              </h2>
              {dashboard.attempts.length === 0 ? (
                <p className="eg-dashboard-empty">Chưa có bài thi nào đang thực hiện hoặc đã nộp.</p>
              ) : (
                <div className="eg-dashboard-attempt-list">
                  {dashboard.attempts.map((att) => (
                    <div key={att.id} className="eg-dashboard-attempt">
                      <div>
                        <strong>{att.student_code || 'SV2026001'}</strong> — {att.full_name || 'Thí sinh'}
                      </div>
                      <span className={`eg-dashboard-attempt-status ${
                        att.status === 'SUBMITTED' ? 'is-submitted' : ''
                      }`}>
                        {att.status === 'SUBMITTED' ? 'Đã nộp bài' : 'Đang làm bài'}
                        {att.total_score !== null && att.total_score !== undefined ? ` · ${att.total_score}đ` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: DUYỆT YÊU CẦU CHECK-IN VÀO PHÒNG THI CỦA THÍ SINH
          ========================================================================= */}
      {activeTab === 'checkin' && (
        <div className="eg-tab-content">
          <section className="eg-panel">
            <div className="eg-dashboard-roster-header">
              <div>
                <h2 className="eg-dashboard-section-title">Duyệt yêu cầu Check-in vào phòng thi</h2>
                <p className="eg-dashboard-roster-description">
                  Đối soát ảnh chân dung chụp thực tế từ camera của thí sinh, chỉ số nhận diện khuôn mặt AI và duyệt cấp quyền vào thi.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {pendingCheckinCount > 0 && (
                  <button type="button" className="eg-primary-btn" onClick={handleApproveAllCheckin}>
                    ✓ Duyệt tất cả ({pendingCheckinCount} thí sinh)
                  </button>
                )}
                <button type="button" className="eg-btn-cancel" onClick={fetchCheckinRequests} disabled={loadingCheckin}>
                  {loadingCheckin ? 'Đang tải...' : '↻ Làm mới'}
                </button>
              </div>
            </div>

            {/* Filter buttons */}
            <div className="eg-checkin-filter-bar">
              <button
                type="button"
                className={`eg-filter-pill ${checkinFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setCheckinFilter('ALL')}
              >
                Tất cả ({checkinRequests.length})
              </button>
              <button
                type="button"
                className={`eg-filter-pill ${checkinFilter === 'PENDING' ? 'active is-warn' : ''}`}
                onClick={() => setCheckinFilter('PENDING')}
              >
                Chờ duyệt ({pendingCheckinCount})
              </button>
              <button
                type="button"
                className={`eg-filter-pill ${checkinFilter === 'APPROVED' ? 'active is-ok' : ''}`}
                onClick={() => setCheckinFilter('APPROVED')}
              >
                Đã duyệt ({checkinRequests.filter((r) => r.status === 'APPROVED').length})
              </button>
              <button
                type="button"
                className={`eg-filter-pill ${checkinFilter === 'REJECTED' ? 'active is-danger' : ''}`}
                onClick={() => setCheckinFilter('REJECTED')}
              >
                Bị từ chối ({checkinRequests.filter((r) => r.status === 'REJECTED').length})
              </button>
            </div>

            {/* Grid of check-in request cards */}
            {filteredCheckinRequests.length === 0 ? (
              <p className="eg-dashboard-empty">Không có yêu cầu check-in nào trong danh mục này.</p>
            ) : (
              <div className="eg-checkin-cards-grid">
                {filteredCheckinRequests.map((req) => {
                  const isPending = req.status === 'PENDING';
                  const isApproved = req.status === 'APPROVED';
                  const isRejected = req.status === 'REJECTED';
                  const photoSrc = req.snapshot_base64 || req.snapshot_url;

                  return (
                    <div key={req.id} className={`eg-checkin-card ${isPending ? 'is-pending' : ''}`}>
                      <div className="eg-checkin-card-img-wrap" onClick={() => setViewingSnapshot(photoSrc)}>
                        <img src={photoSrc} alt={req.full_name} className="eg-checkin-card-img" />
                        <span className="eg-img-zoom-hint">🔍 Nhấn để phóng to</span>
                      </div>

                      <div className="eg-checkin-card-info">
                        <div className="eg-checkin-card-head">
                          <span className="eg-session-code-tag">{req.session_code}</span>
                          <span className={`eg-status-tag ${isPending ? 'is-upcoming' : isApproved ? 'is-completed' : 'is-closed'}`}>
                            {isPending ? '⏳ Chờ duyệt' : isApproved ? '✓ Đã duyệt' : '✕ Từ chối'}
                          </span>
                        </div>

                        <h3 className="eg-checkin-student-name">{req.full_name}</h3>
                        <div className="eg-table-subtext">Mã SV: <strong>{req.student_code}</strong></div>

                        <div className="eg-checkin-specs-list">
                          <div className="eg-spec-row">
                            <span>Phần cứng:</span>
                            <strong>Webcam ✓ · Mic ✓</strong>
                          </div>
                          <div className="eg-spec-row">
                            <span>AI Nhận diện:</span>
                            <span className={req.face_count === 1 ? 'ok-text' : 'err-text'}>
                              {req.face_count === 1 ? '✓ 1 người hợp lệ' : `⚠️ Phát hiện ${req.face_count} người`}
                            </span>
                          </div>
                          {req.euclidean_distance != null && (
                            <div className="eg-spec-row">
                              <span>Khoảng cách:</span>
                              <strong>{req.euclidean_distance} (Ngưỡng &le; 0.45)</strong>
                            </div>
                          )}
                          <div className="eg-spec-row">
                            <span>Thời gian:</span>
                            <span>{new Date(req.created_at).toLocaleTimeString('vi-VN')}</span>
                          </div>
                          {req.reject_reason && (
                            <div className="eg-spec-row is-reject-reason">
                              <span>Lý do từ chối:</span>
                              <strong>{req.reject_reason}</strong>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="eg-checkin-card-actions">
                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="eg-btn-approve-checkin"
                                onClick={() => handleApproveCheckin(req.id)}
                              >
                                ✓ Duyệt vào thi
                              </button>
                              <button
                                type="button"
                                className="eg-btn-reject-checkin"
                                onClick={() => handleRejectCheckin(req.id)}
                              >
                                ✕ Từ chối
                              </button>
                            </>
                          )}
                          {isApproved && (
                            <div className="eg-approved-mark">
                              <span style={{ color: '#16a34a', fontWeight: 600, fontSize: '13px' }}>✓ Đã cấp quyền vào phòng thi</span>
                              <button
                                type="button"
                                className="eg-btn-revert"
                                onClick={() => handleRejectCheckin(req.id)}
                              >
                                Thu hồi quyền
                              </button>
                            </div>
                          )}
                          {isRejected && (
                            <div className="eg-rejected-mark">
                              <button
                                type="button"
                                className="eg-btn-approve-checkin"
                                onClick={() => handleApproveCheckin(req.id)}
                              >
                                Duyệt lại
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB: YÊU CẦU HỖ TRỢ KỸ THUẬT & XIN VÀO LẠI PHÒNG THI
          ========================================================================= */}
      {activeTab === 'support' && (
        <div className="eg-tab-content">
          <section className="eg-panel">
            <div className="eg-dashboard-roster-header">
              <div>
                <h2 className="eg-dashboard-section-title">Yêu cầu Hỗ trợ Kỹ thuật & Xin vào lại phòng thi</h2>
                <p className="eg-dashboard-roster-description">
                  Tiếp nhận và xử lý sự cố thiết bị (Camera/Mic), ngắt kết nối mạng hoặc yêu cầu xin mở lại quyền thi của thí sinh trong thời gian thực.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="eg-btn-cancel"
                  onClick={fetchSupportRequests}
                  disabled={loadingSupport}
                >
                  {loadingSupport ? 'Đang tải...' : '↻ Làm mới'}
                </button>
              </div>
            </div>

            {/* Filter pills */}
            <div className="eg-checkin-filter-bar">
              <button
                type="button"
                className={`eg-filter-pill ${supportFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setSupportFilter('ALL')}
              >
                Tất cả ({supportRequests.length})
              </button>
              <button
                type="button"
                className={`eg-filter-pill ${supportFilter === 'PENDING' ? 'active is-warn' : ''}`}
                onClick={() => setSupportFilter('PENDING')}
              >
                Chờ xử lý ({pendingSupportCount})
              </button>
              <button
                type="button"
                className={`eg-filter-pill ${supportFilter === 'APPROVED' ? 'active is-ok' : ''}`}
                onClick={() => setSupportFilter('APPROVED')}
              >
                Đã duyệt ({supportRequests.filter((r) => r.status === 'APPROVED').length})
              </button>
              <button
                type="button"
                className={`eg-filter-pill ${supportFilter === 'REJECTED' ? 'active is-danger' : ''}`}
                onClick={() => setSupportFilter('REJECTED')}
              >
                Từ chối ({supportRequests.filter((r) => r.status === 'REJECTED').length})
              </button>
            </div>

            {/* Danh sách thẻ yêu cầu hỗ trợ */}
            {filteredSupportRequests.length === 0 ? (
              <p className="eg-dashboard-empty">Không có yêu cầu hỗ trợ hoặc xin vào lại nào trong danh mục này.</p>
            ) : (
              <div className="eg-checkin-cards-grid">
                {filteredSupportRequests.map((req) => {
                  const isPending = req.status === 'PENDING';
                  const isApproved = req.status === 'APPROVED';
                  const isRejected = req.status === 'REJECTED';

                  const categoryMeta = {
                    REENTRY_REQUEST: { label: 'Xin vào lại phòng thi', icon: '🔄', color: '#1a66e0' },
                    TECHNICAL_SUPPORT: { label: 'Sự cố Camera & Mic', icon: '📹', color: '#ea580c' },
                    QUESTION_ISSUE: { label: 'Lỗi câu hỏi / Đề thi', icon: '📝', color: '#8b5cf6' },
                    OTHER: { label: 'Vấn đề kỹ thuật khác', icon: '💬', color: '#64748b' }
                  }[req.category] || { label: 'Yêu cầu hỗ trợ', icon: '💬', color: '#1a66e0' };

                  return (
                    <div
                      key={req.id}
                      className={`eg-checkin-card ${isPending ? 'is-pending' : ''}`}
                      style={{
                        borderTop: isPending
                          ? '3px solid #f59e0b'
                          : isApproved
                          ? '3px solid #16a34a'
                          : '3px solid #dc2626'
                      }}
                    >
                      <div className="eg-checkin-card-info" style={{ padding: '20px' }}>
                        {/* Header của thẻ */}
                        <div className="eg-checkin-card-head">
                          <span
                            className="eg-mini-badge"
                            style={{
                              background: '#f1f5f9',
                              color: categoryMeta.color,
                              fontWeight: 700,
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span>{categoryMeta.icon}</span>
                            <span>{categoryMeta.label}</span>
                          </span>

                          <span
                            className={`eg-mini-badge ${
                              isApproved ? 'is-easy' : isPending ? 'is-medium' : 'is-hard'
                            }`}
                          >
                            {isApproved
                              ? '✓ Đã phê duyệt'
                              : isPending
                              ? '⏳ Đang chờ duyệt'
                              : '✕ Đã từ chối'}
                          </span>
                        </div>

                        {/* Thông tin Thí sinh */}
                        <div style={{ marginTop: '4px' }}>
                          <h3 className="eg-checkin-student-name" style={{ fontSize: '16px' }}>
                            {req.full_name || 'Thí sinh'}
                          </h3>
                          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                            Mã SV: <strong style={{ color: '#0f172a' }}>{req.student_code}</strong> · Ca thi: <strong style={{ color: '#0f172a' }}>{req.session_code || 'EXAM88'}</strong>
                          </div>
                        </div>

                        {/* Nội dung tin nhắn thí sinh gửi */}
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '12px 14px',
                            fontSize: '13px',
                            color: '#1e293b',
                            lineHeight: 1.5,
                            marginTop: '4px'
                          }}
                        >
                          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                            Nội dung yêu cầu từ thí sinh:
                          </div>
                          "{req.message || 'Xin giám thị hỗ trợ kỹ thuật / duyệt vào lại phòng thi.'}"
                        </div>

                        {/* Phản hồi của Giám thị (nếu có) */}
                        {req.reply_message && (
                          <div
                            style={{
                              background: isApproved ? '#f0fdf4' : '#fef2f2',
                              border: `1px solid ${isApproved ? '#bbf7d0' : '#fecaca'}`,
                              borderRadius: '4px',
                              padding: '10px 12px',
                              fontSize: '12.5px',
                              color: isApproved ? '#166534' : '#991b1b',
                              marginTop: '2px'
                            }}
                          >
                            <strong>↳ Giám thị phản hồi:</strong> {req.reply_message}
                          </div>
                        )}

                        <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px' }}>
                          Thời gian gửi: {new Date(req.created_at).toLocaleString('vi-VN')}
                        </div>

                        {/* Thao tác của Giám thị */}
                        <div className="eg-checkin-card-actions" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                          {isPending && (
                            <>
                              <button
                                type="button"
                                className="eg-btn-approve-checkin"
                                onClick={() =>
                                  handleDecideSupport(
                                    req.id,
                                    'APPROVED',
                                    'Giám thị đã duyệt cho bạn tiếp tục làm bài thi. Chúc bạn làm bài tốt!'
                                  )
                                }
                              >
                                ✓ Duyệt cho vào lại phòng thi
                              </button>
                              <button
                                type="button"
                                className="eg-btn-reject-checkin"
                                onClick={() =>
                                  handleDecideSupport(
                                    req.id,
                                    'REJECTED',
                                    'Yêu cầu chưa được duyệt. Vui lòng liên hệ hội đồng thi.'
                                  )
                                }
                              >
                                ✕ Từ chối
                              </button>
                              <button
                                type="button"
                                className="eg-btn-reject-checkin"
                                style={{ background: '#b91c1c', borderColor: '#991b1b', color: '#fff' }}
                                onClick={() =>
                                  setForceSubmittingStudent({
                                    studentCode: req.student_code,
                                    fullName: req.full_name,
                                    sessionCode: req.session_code
                                  })
                                }
                                title="Cưỡng chế thu bài khi phát hiện gian lận nghiêm trọng"
                              >
                                🛑 Cưỡng chế thu bài
                              </button>
                            </>
                          )}

                          {isApproved && (
                            <button
                              type="button"
                              className="eg-btn-cancel"
                              style={{ width: '100%', fontSize: '12.5px' }}
                              onClick={() =>
                                handleDecideSupport(
                                  req.id,
                                  'APPROVED',
                                  req.reply_message || 'Giám thị nhắc nhở thí sinh chú ý thời gian làm bài.'
                                )
                              }
                            >
                              💬 Gửi thêm phản hồi / lời nhắn
                            </button>
                          )}

                          {isRejected && (
                            <button
                              type="button"
                              className="eg-btn-approve-checkin"
                              style={{ width: '100%' }}
                              onClick={() =>
                                handleDecideSupport(
                                  req.id,
                                  'APPROVED',
                                  'Giám thị đã xem xét lại và duyệt cho bạn vào lại phòng thi.'
                                )
                              }
                            >
                              ✓ Duyệt lại cho vào phòng thi
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 2: CA THI ĐƯỢC PHÂN CÔNG & PHÒNG THI TRỰC TUYẾN
          ========================================================================= */}
      {activeTab === 'sessions' && (
        <div className="eg-tab-content">
          <section className="eg-panel">
            <div className="eg-dashboard-roster-header">
              <div>
                <h2 className="eg-dashboard-section-title">Danh sách ca thi & Phòng thi trực tuyến</h2>
                <p className="eg-dashboard-roster-description">
                  Khởi tạo phòng thi, thiết lập cấu hình giám sát AI chống gian lận, mở hoặc đóng ca thi.
                </p>
              </div>
              <div className="eg-dashboard-roster-actions">
                <button
                  type="button"
                  className="eg-dashboard-add-student-btn"
                  onClick={() => {
                    setEditingSession(null);
                    setShowSessionModal(true);
                  }}
                  title="Tạo phòng thi / ca thi trực tuyến mới"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>+ Tạo ca thi mới</span>
                </button>
                <span className="eg-dashboard-roster-count">{filteredSessions.length} ca thi</span>
              </div>
            </div>

            {/* Sessions search & filter toolbar */}
            <div className="eg-dashboard-roster-toolbar">
              <div className="eg-dashboard-search-wrap">
                <svg className="eg-dashboard-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="eg-dashboard-search-input"
                  placeholder="Tìm theo mã ca, tên môn, tiêu đề ca thi, phòng máy..."
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                />
                {sessionSearch && (
                  <button
                    type="button"
                    className="eg-dashboard-search-clear"
                    onClick={() => setSessionSearch('')}
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="eg-dashboard-filter-wrap">
                <select
                  className="eg-dashboard-filter-select"
                  value={sessionStatusFilter}
                  onChange={(e) => setSessionStatusFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả trạng thái ({sessions.length})</option>
                  <option value="OPEN">Đang diễn ra (OPEN)</option>
                  <option value="UPCOMING">Sắp diễn ra (UPCOMING)</option>
                  <option value="COMPLETED">Đã kết thúc / Đóng</option>
                  <option value="CANCELLED">Đã hủy</option>
                </select>
                {(sessionSearch || sessionStatusFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="eg-dashboard-reset-filter"
                    onClick={() => { setSessionSearch(''); setSessionStatusFilter('ALL'); }}
                  >
                    Đặt lại bộ lọc
                  </button>
                )}
              </div>
            </div>

            {/* Sessions table */}
            {loadingSessions ? (
              <p className="eg-dashboard-empty">Đang tải danh sách ca thi...</p>
            ) : filteredSessions.length === 0 ? (
              <p className="eg-dashboard-empty">Không tìm thấy ca thi nào khớp với điều kiện tìm kiếm.</p>
            ) : (
              <div className="eg-dashboard-roster-scroll">
                <table className="eg-dashboard-roster-table eg-sessions-table">
                  <thead>
                    <tr>
                      <th>Mã ca thi</th>
                      <th>Môn học & Tiêu đề ca thi</th>
                      <th>Thời gian thi</th>
                      <th>Thời lượng</th>
                      <th>Phòng máy</th>
                      <th>Bảo mật AI</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'center', minWidth: '180px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSessions.map((ses) => {
                      const isOpen = ses.status === 'OPEN';
                      const isUpcoming = ses.status === 'UPCOMING';
                      const isCancelled = ses.status === 'CANCELLED';

                      const formatTime = (iso) => {
                        if (!iso) return '—';
                        try {
                          const d = new Date(iso);
                          return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + d.toLocaleDateString('vi-VN');
                        } catch {
                          return iso;
                        }
                      };

                      const sec = ses.security_config || {};

                      return (
                        <tr key={ses.id || ses.session_id}>
                          <td>
                            <span className="eg-session-code-tag">{ses.session_code}</span>
                          </td>
                          <td>
                            <strong>{ses.title}</strong>
                            <div className="eg-table-subtext">{ses.subject_name || 'Công nghệ thông tin'}</div>
                          </td>
                          <td className="eg-table-time">
                            <div>{formatTime(ses.start_time)}</div>
                            <div className="eg-table-subtext">đến {formatTime(ses.end_time)}</div>
                          </td>
                          <td><strong>{ses.duration_minutes || 60} phút</strong></td>
                          <td>{ses.room || 'Phòng trực tuyến'}</td>
                          <td>
                            <div className="eg-session-sec-badges">
                              <span className={`eg-mini-badge ${sec.require_face_check !== false ? 'is-easy' : 'is-medium'}`} title="Nhận diện khuôn mặt AI">
                                {sec.require_face_check !== false ? 'AI Face' : 'No Face'}
                              </span>
                              <span className={`eg-mini-badge ${sec.detect_tab_switch !== false ? 'is-medium' : 'is-hard'}`} title="Khóa chuyển tab & ứng dụng ngoài">
                                {sec.detect_tab_switch !== false ? 'Tab Lock' : 'No Tab'}
                              </span>
                              <span className={`eg-mini-badge ${sec.require_fullscreen !== false ? 'is-hard' : 'is-medium'}`} title="Toàn màn hình">
                                {sec.require_fullscreen !== false ? 'Fullscreen' : 'Window'}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={`eg-status-tag ${
                              isOpen ? 'is-open' : isUpcoming ? 'is-upcoming' : isCancelled ? 'is-hard' : 'is-completed'
                            }`}>
                              {isOpen ? '● Đang mở' : isUpcoming ? '○ Sắp diễn ra' : isCancelled ? '✕ Đã hủy' : 'Đã kết thúc'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div className="eg-session-actions-wrap">
                              <button
                                type="button"
                                className="eg-btn-monitor-session"
                                onClick={() => {
                                  setDashboard((prev) => ({
                                    ...prev,
                                    session: ses
                                  }));
                                  setActiveTab('proctoring');
                                }}
                                title="Chuyển đến màn hình giám sát ca thi này"
                              >
                                Giám sát
                              </button>
                              <button
                                type="button"
                                className="eg-student-btn-edit"
                                onClick={() => {
                                  setEditingSession(ses);
                                  setShowSessionModal(true);
                                }}
                                title="Sửa thông tin phòng thi & Cấu hình bảo mật"
                              >
                                Sửa & Bảo mật
                              </button>
                              <button
                                type="button"
                                className="eg-student-btn-delete"
                                onClick={() => setStatusManagingSession(ses)}
                                title="Đóng hoặc hủy bỏ phòng thi"
                              >
                                {isOpen ? 'Đóng / Hủy' : 'Đổi trạng thái'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 3: BỘ ĐỀ THI GỐC & CẤU HÌNH MA TRẬN TRỘN ĐỀ
          ========================================================================= */}
      {activeTab === 'exams' && (
        <div className="eg-tab-content">
          <section className="eg-panel">
            <div className="eg-dashboard-roster-header">
              <div>
                <h2 className="eg-dashboard-section-title">Danh sách bộ đề thi gốc & Ma trận trộn đề</h2>
                <p className="eg-dashboard-roster-description">
                  Khởi tạo bộ đề thi, thiết lập thời gian làm bài, cấu hình ma trận tỷ lệ câu hỏi Dễ / Trung bình / Khó và cơ chế đảo câu hỏi / đảo đáp án.
                </p>
              </div>
              <div className="eg-dashboard-roster-actions">
                <button
                  type="button"
                  className="eg-dashboard-add-student-btn"
                  onClick={() => {
                    setEditingExam(null);
                    setShowExamModal(true);
                  }}
                  title="Tạo bộ đề thi gốc mới"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Tạo đề thi mới</span>
                </button>
                <span className="eg-dashboard-roster-count">{exams.length} bộ đề</span>
              </div>
            </div>

            {/* Exams search & filter toolbar */}
            <div className="eg-dashboard-roster-toolbar">
              <div className="eg-dashboard-search-wrap">
                <svg className="eg-dashboard-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="eg-dashboard-search-input"
                  placeholder="Tìm theo mã đề thi (VD: EX_SEC_MID), tên đề, môn học..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                />
                {examSearch && (
                  <button
                    type="button"
                    className="eg-dashboard-search-clear"
                    onClick={() => setExamSearch('')}
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="eg-dashboard-filter-wrap">
                <select
                  className="eg-dashboard-filter-select"
                  value={examStatusFilter}
                  onChange={(e) => setExamStatusFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả trạng thái ({exams.length})</option>
                  <option value="ACTIVE">Sẵn sàng (ACTIVE)</option>
                  <option value="DRAFT">Bản nháp (DRAFT)</option>
                </select>
                {(examSearch || examStatusFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="eg-dashboard-reset-filter"
                    onClick={() => { setExamSearch(''); setExamStatusFilter('ALL'); }}
                  >
                    Đặt lại bộ lọc
                  </button>
                )}
                <span className="eg-dashboard-matched-count">
                  Hiển thị: <strong>{filteredExams.length}</strong> / {exams.length}
                </span>
              </div>
            </div>

            {/* Exams list / table */}
            {loadingExams ? (
              <p className="eg-dashboard-empty">Đang tải danh sách bộ đề thi...</p>
            ) : filteredExams.length === 0 ? (
              <p className="eg-dashboard-empty">
                {exams.length === 0
                  ? 'Chưa có bộ đề thi nào. Nhấn "+ Tạo đề thi mới" để tạo đề và cấu hình ma trận trộn.'
                  : `Không tìm thấy bộ đề nào khớp với từ khóa "${examSearch}".`}
              </p>
            ) : (
              <div className="eg-dashboard-roster-scroll">
                <table className="eg-dashboard-roster-table eg-exams-table">
                  <thead>
                    <tr>
                      <th>Mã đề gốc</th>
                      <th>Tên bộ đề thi & Môn học</th>
                      <th>Thời gian</th>
                      <th>Quy mô đề</th>
                      <th>Ma trận độ khó</th>
                      <th>Cơ chế trộn đề</th>
                      <th>Trạng thái</th>
                      <th style={{ textAlign: 'center', minWidth: '130px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExams.map((ex) => (
                      <tr key={ex.id}>
                        <td>
                          <span className="eg-session-code-tag">{ex.exam_code}</span>
                        </td>
                        <td>
                          <strong>{ex.title}</strong>
                          <div className="eg-table-subtext">
                            {ex.subject_name ? `${ex.subject_code || ''} · ${ex.subject_name}` : 'Chưa phân môn'}
                          </div>
                        </td>
                        <td>
                          <strong>{ex.duration_minutes || 60} phút</strong>
                        </td>
                        <td>
                          <div>{ex.total_questions || 20} câu</div>
                          <div className="eg-table-subtext">Điểm đạt: {ex.passing_score ?? 5.0}đ</div>
                        </td>
                        <td>
                          <div className="eg-matrix-summary">
                            <span className="eg-mini-badge is-easy" title="Số câu dễ">{ex.easy_count ?? 8} Dễ</span>
                            <span className="eg-mini-badge is-medium" title="Số câu trung bình">{ex.medium_count ?? 8} Vừa</span>
                            <span className="eg-mini-badge is-hard" title="Số câu khó">{ex.hard_count ?? 4} Khó</span>
                          </div>
                        </td>
                        <td>
                          <div className="eg-shuffle-badges">
                            <span className={`eg-mini-tag ${ex.shuffle_questions ? 'is-on' : 'is-off'}`} title="Đảo thứ tự câu hỏi">
                              {ex.shuffle_questions ? '✓ Đảo câu' : '— Thứ tự cố định'}
                            </span>
                            <span className={`eg-mini-tag ${ex.shuffle_answers ? 'is-on' : 'is-off'}`} title="Đảo đáp án A, B, C, D">
                              {ex.shuffle_answers ? '✓ Đảo đáp án' : '— Đáp án cố định'}
                            </span>
                            <span className="eg-mini-tag is-variants">
                              {ex.variants_count || 4} mã đề
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`eg-status-tag ${ex.status === 'ACTIVE' ? 'is-open' : 'is-completed'}`}>
                            {ex.status === 'ACTIVE' ? 'Sẵn sàng' : 'Bản nháp'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="eg-student-actions">
                            <button
                              type="button"
                              className="eg-student-btn-edit"
                              onClick={() => setEditingExam(ex)}
                              title="Sửa cấu trúc đề thi & Ma trận"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="eg-student-btn-delete"
                              onClick={() => setDeletingExam(ex)}
                              title="Xóa bộ đề thi"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 4: NGÂN HÀNG CÂU HỎI (QUESTION BANK)
          ========================================================================= */}
      {activeTab === 'questions' && (
        <div className="eg-tab-content">
          <section className="eg-panel">
            <div className="eg-dashboard-roster-header">
              <div>
                <h2 className="eg-dashboard-section-title">Ngân hàng câu hỏi trắc nghiệm</h2>
                <p className="eg-dashboard-roster-description">
                  Thêm mới, sửa đổi phương án trả lời, mức độ khó và mã định danh câu hỏi trong ngân hàng đề.
                </p>
              </div>
              <div className="eg-dashboard-roster-actions">
                <button
                  type="button"
                  className="eg-dashboard-add-student-btn"
                  onClick={() => {
                    setEditingQuestion(null);
                    setShowQuestionModal(true);
                  }}
                  title="Thêm câu hỏi mới vào ngân hàng"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Thêm câu hỏi</span>
                </button>
                <span className="eg-dashboard-roster-count">{questions.length} câu hỏi</span>
              </div>
            </div>

            {/* Questions search & difficulty filter toolbar */}
            <div className="eg-dashboard-roster-toolbar">
              <div className="eg-dashboard-search-wrap">
                <svg className="eg-dashboard-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="eg-dashboard-search-input"
                  placeholder="Tìm theo mã câu hỏi (VD: CS101_Q01) hoặc nội dung..."
                  value={questionSearch}
                  onChange={(e) => setQuestionSearch(e.target.value)}
                />
                {questionSearch && (
                  <button
                    type="button"
                    className="eg-dashboard-search-clear"
                    onClick={() => setQuestionSearch('')}
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="eg-dashboard-filter-wrap">
                <select
                  className="eg-dashboard-filter-select"
                  value={questionDifficultyFilter}
                  onChange={(e) => setQuestionDifficultyFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả mức độ ({questions.length})</option>
                  <option value="EASY">Dễ (EASY)</option>
                  <option value="MEDIUM">Trung bình (MEDIUM)</option>
                  <option value="HARD">Khó (HARD)</option>
                </select>
                {(questionSearch || questionDifficultyFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="eg-dashboard-reset-filter"
                    onClick={() => { setQuestionSearch(''); setQuestionDifficultyFilter('ALL'); }}
                  >
                    Đặt lại bộ lọc
                  </button>
                )}
                <span className="eg-dashboard-matched-count">
                  Hiển thị: <strong>{filteredQuestions.length}</strong> / {questions.length}
                </span>
              </div>
            </div>

            {/* Questions List */}
            {loadingQuestions ? (
              <p className="eg-dashboard-empty">Đang tải ngân hàng câu hỏi...</p>
            ) : filteredQuestions.length === 0 ? (
              <p className="eg-dashboard-empty">
                {questions.length === 0
                  ? 'Chưa có câu hỏi nào trong ngân hàng đề. Nhấn nút "+ Thêm câu hỏi" để bắt đầu.'
                  : `Không tìm thấy câu hỏi nào khớp với từ khóa "${questionSearch}".`}
              </p>
            ) : (
              <div className="eg-questions-list">
                {filteredQuestions.map((q, index) => {
                  const difficultyMeta = {
                    EASY: { label: 'Dễ', class: 'is-easy' },
                    MEDIUM: { label: 'Trung bình', class: 'is-medium' },
                    HARD: { label: 'Khó', class: 'is-hard' }
                  }[q.difficulty_level] || { label: q.difficulty_level || 'Trung bình', class: 'is-medium' };

                  return (
                    <div key={q.id || index} className="eg-question-card">
                      <div className="eg-question-card-header">
                        <div className="eg-question-meta">
                          <span className="eg-question-index">#{index + 1}</span>
                          <span className="eg-question-code-badge">
                            {q.question_code || `CH${String(index + 1).padStart(3, '0')}`}
                          </span>
                          <span className={`eg-difficulty-tag ${difficultyMeta.class}`}>
                            {difficultyMeta.label}
                          </span>
                        </div>

                        <div className="eg-question-actions">
                          <button
                            type="button"
                            className="eg-question-btn-edit"
                            onClick={() => setEditingQuestion(q)}
                            title="Sửa câu hỏi và các phương án trả lời"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Sửa
                          </button>
                          <button
                            type="button"
                            className="eg-question-btn-delete"
                            onClick={() => setDeletingQuestion(q)}
                            title="Xóa / Ngừng sử dụng câu hỏi"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                            Xóa
                          </button>
                        </div>
                      </div>

                      <div className="eg-question-card-content">
                        {q.content}
                      </div>

                      {/* Answer Choices Grid */}
                      {Array.isArray(q.answers) && q.answers.length > 0 && (
                        <div className="eg-answers-grid">
                          {q.answers.map((ans, aIdx) => {
                            const letters = ['A', 'B', 'C', 'D'];
                            const isCorrect = Boolean(ans.is_correct);
                            return (
                              <div
                                key={ans.id || aIdx}
                                className={`eg-answer-item ${isCorrect ? 'is-correct' : ''}`}
                              >
                                <span className="eg-answer-letter">{letters[aIdx] || String(aIdx + 1)}</span>
                                <span className="eg-answer-text">{ans.answer_text}</span>
                                {isCorrect && (
                                  <span className="eg-correct-badge" title="Đáp án đúng">
                                    ✓ Đúng
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 5: MÔN HỌC & CHỦ ĐỀ KHẢO THÍ (SUBJECTS & TOPICS)
          ========================================================================= */}
      {activeTab === 'subjects' && (
        <div className="eg-tab-content">
          <section className="eg-dashboard-stats eg-dashboard-stats-3" aria-label="Thống kê môn học">
            <div className="eg-dashboard-stat">
              <span className="eg-dashboard-stat-label">Tổng số môn học</span>
              <strong>{subjects.length}</strong>
            </div>
            <div className="eg-dashboard-stat">
              <span className="eg-dashboard-stat-label">Tổng số câu hỏi</span>
              <strong>{subjectQuestionTotal}</strong>
            </div>
            <div className="eg-dashboard-stat eg-dashboard-stat-warning">
              <span className="eg-dashboard-stat-label">Môn chưa có câu hỏi</span>
              <strong>{subjectEmptyCount}</strong>
            </div>
          </section>

          <section className="eg-panel">
            <div className="eg-dashboard-roster-header">
              <div>
                <h2 className="eg-dashboard-section-title">Danh mục Môn học & Chủ đề khảo thí</h2>
                <p className="eg-dashboard-roster-description">
                  Quản lý danh mục môn học, chuyên đề đào tạo làm cơ sở để phân loại ngân hàng câu hỏi và tạo bộ đề thi.
                </p>
              </div>
              <div className="eg-dashboard-roster-actions">
                <button
                  type="button"
                  className="eg-dashboard-add-student-btn"
                  onClick={() => {
                    setEditingSubject(null);
                    setShowSubjectModal(true);
                  }}
                  title="Thêm môn học hoặc chủ đề mới"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Thêm môn học</span>
                </button>
                <span className="eg-dashboard-roster-count">{subjects.length} môn học</span>
              </div>
            </div>

            {/* Subjects search toolbar */}
            <div className="eg-dashboard-roster-toolbar">
              <div className="eg-dashboard-search-wrap">
                <svg className="eg-dashboard-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  className="eg-dashboard-search-input"
                  placeholder="Tìm theo mã môn (IT4010), tên môn học, mô tả..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                />
                {subjectSearch && (
                  <button
                    type="button"
                    className="eg-dashboard-search-clear"
                    onClick={() => setSubjectSearch('')}
                    title="Xóa tìm kiếm"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="eg-dashboard-filter-wrap">
                <span className="eg-dashboard-matched-count">
                  Hiển thị: <strong>{filteredSubjects.length}</strong> / {subjects.length} môn
                </span>
              </div>
            </div>

            {/* Subjects table */}
            {loadingSubjects ? (
              <p className="eg-dashboard-empty">Đang tải danh mục môn học...</p>
            ) : filteredSubjects.length === 0 ? (
              <p className="eg-dashboard-empty">
                {subjects.length === 0
                  ? 'Chưa có môn học nào. Nhấn "+ Thêm môn học" để tạo mới môn học hoặc chủ đề.'
                  : `Không tìm thấy môn học nào khớp với từ khóa "${subjectSearch}".`}
              </p>
            ) : (
              <div className="eg-dashboard-roster-scroll">
                <table className="eg-dashboard-roster-table eg-subjects-table">
                  <thead>
                    <tr>
                      <th>Mã môn học</th>
                      <th>Tên môn học / Chủ đề</th>
                      <th>Mô tả phạm vi khảo thí</th>
                      <th>Số câu hỏi</th>
                      <th style={{ textAlign: 'center', minWidth: '130px' }}>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubjects.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <span className="eg-session-code-tag">{s.subject_code}</span>
                        </td>
                        <td>
                          <strong>{s.subject_name}</strong>
                        </td>
                        <td className="eg-subject-desc-cell">
                          {s.description || <span className="eg-text-muted">— Chưa có mô tả —</span>}
                        </td>
                        <td>
                          <span className="eg-subject-question-count">
                            {s.total_questions || 0} câu hỏi
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="eg-student-actions">
                            <button
                              type="button"
                              className="eg-student-btn-edit"
                              onClick={() => setEditingSubject(s)}
                              title="Sửa môn học / chủ đề"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                              Sửa
                            </button>
                            <button
                              type="button"
                              className="eg-student-btn-delete"
                              onClick={() => setDeletingSubject(s)}
                              title="Xóa môn học / chủ đề"
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                              Xóa
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================================
          MODALS
          ========================================================================= */}
      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={showChangePassword}
        onClose={() => setShowChangePassword(false)}
        token={token}
        userType="TEACHER"
        userInfo={{
          username: teacher?.username,
          full_name: teacher?.full_name,
          role_name: "Giáo viên"
        }}
      />

      {/* Add Student Modal */}
      <AddStudentModal
        isOpen={showAddStudent}
        onClose={() => setShowAddStudent(false)}
        token={token}
        onStudentCreated={handleStudentCreated}
      />

      {/* Edit Student Modal */}
      <EditStudentModal
        isOpen={Boolean(editingStudent)}
        student={editingStudent}
        onClose={() => setEditingStudent(null)}
        token={token}
        onStudentUpdated={handleStudentUpdated}
      />

      {/* Delete Student Modal */}
      <DeleteStudentModal
        isOpen={Boolean(deletingStudent)}
        student={deletingStudent}
        onClose={() => setDeletingStudent(null)}
        token={token}
        onStudentDeleted={handleStudentDeleted}
      />

      {/* Question Add/Edit Modal */}
      <QuestionModal
        isOpen={showQuestionModal || Boolean(editingQuestion)}
        question={editingQuestion}
        subjects={subjects}
        onClose={() => {
          setShowQuestionModal(false);
          setEditingQuestion(null);
        }}
        token={token}
        onQuestionSaved={handleQuestionSaved}
      />

      {/* Delete / Deactivate Question Modal */}
      <DeleteQuestionModal
        isOpen={Boolean(deletingQuestion)}
        question={deletingQuestion}
        onClose={() => setDeletingQuestion(null)}
        token={token}
        onQuestionDeleted={handleQuestionDeleted}
      />

      {/* Subject Add/Edit Modal */}
      <SubjectModal
        isOpen={showSubjectModal || Boolean(editingSubject)}
        subject={editingSubject}
        onClose={() => {
          setShowSubjectModal(false);
          setEditingSubject(null);
        }}
        token={token}
        onSubjectSaved={handleSubjectSaved}
      />

      {/* Delete Subject Modal */}
      <DeleteSubjectModal
        isOpen={Boolean(deletingSubject)}
        subject={deletingSubject}
        onClose={() => setDeletingSubject(null)}
        token={token}
        onSubjectDeleted={handleSubjectDeleted}
      />

      {/* Exam Add/Edit Modal with Shuffle Matrix */}
      <ExamModal
        isOpen={showExamModal || Boolean(editingExam)}
        exam={editingExam}
        subjects={subjects}
        onClose={() => {
          setShowExamModal(false);
          setEditingExam(null);
        }}
        token={token}
        onExamSaved={handleExamSaved}
      />

      {/* Delete Exam Modal */}
      <DeleteExamModal
        isOpen={Boolean(deletingExam)}
        exam={deletingExam}
        onClose={() => setDeletingExam(null)}
        token={token}
        onExamDeleted={handleExamDeleted}
      />

      {/* Session Add/Edit Modal */}
      <SessionModal
        isOpen={showSessionModal || Boolean(editingSession)}
        session={editingSession}
        exams={exams}
        onClose={() => {
          setShowSessionModal(false);
          setEditingSession(null);
        }}
        token={token}
        onSessionSaved={handleSessionSaved}
      />

      {/* Close or Cancel Session Modal */}
      <CloseOrCancelSessionModal
        isOpen={Boolean(statusManagingSession)}
        session={statusManagingSession}
        onClose={() => setStatusManagingSession(null)}
        token={token}
        onStatusChanged={handleSessionStatusChanged}
        onSessionDeleted={handleSessionDeleted}
      />

      {/* Snapshot Zoom Modal */}
      {viewingSnapshot && (
        <div className="eg-modal-overlay" onClick={() => setViewingSnapshot(null)}>
          <div className="eg-modal-card eg-snapshot-zoom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="eg-modal-header">
              <h2 className="eg-modal-title">Ảnh chụp xác thực khuôn mặt lúc check-in</h2>
              <button type="button" className="eg-modal-close" onClick={() => setViewingSnapshot(null)}>✕</button>
            </div>
            <div className="eg-modal-body" style={{ display: 'flex', justifyContent: 'center' }}>
              <img src={viewingSnapshot} alt="Ảnh chụp chân dung" style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', borderRadius: '4px' }} />
            </div>
          </div>
        </div>
      )}

      {/* Live Cam Zoom Modal */}
      {selectedLiveCam && (
        <div className="eg-modal-overlay" onClick={() => setSelectedLiveCam(null)}>
          <div className="eg-modal-card eg-cam-zoom-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="eg-modal-header">
              <div>
                <h2 className="eg-modal-title" style={{ margin: 0 }}>
                  Camera Giám sát Thí sinh: {selectedLiveCam.fullName} ({selectedLiveCam.studentCode})
                </h2>
                <span className="eg-dashboard-roster-description" style={{ fontSize: '12px' }}>
                  Ca thi: <strong>{selectedLiveCam.sessionCode || 'EXAM88'}</strong>
                </span>
              </div>
              <button type="button" className="eg-modal-close" onClick={() => setSelectedLiveCam(null)}>✕</button>
            </div>
            <div className="eg-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ position: 'relative', background: '#0b2545', borderRadius: '4px', overflow: 'hidden', minHeight: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedLiveCam.liveFrame ? (
                  <img src={selectedLiveCam.liveFrame} alt="Live Cam" style={{ width: '100%', maxHeight: '420px', objectFit: 'contain' }} />
                ) : (
                  <span style={{ color: '#94a3b8' }}>Chưa có khung hình</span>
                )}
                <div style={{ position: 'absolute', top: '12px', left: '12px', background: '#dc2626', color: '#fff', padding: '3px 8px', fontSize: '11px', fontWeight: 700, borderRadius: '2px' }}>
                  ● LIVE WEBCAM FEED
                </div>
              </div>

              <div className={`eg-dashboard-alert-banner ${selectedLiveCam.violationType ? 'is-error' : 'is-success'}`} style={{ margin: 0 }}>
                <span>
                  {selectedLiveCam.violationType === 'FACE_MISMATCH'
                    ? '⚠️ CẢNH BÁO: Phát hiện khuôn mặt không phù hợp với thí sinh đã check-in ban đầu (Nghi vấn thi hộ)!'
                    : selectedLiveCam.violationType === 'MULTIPLE_FACES'
                    ? '⚠️ CẢNH BÁO: Phát hiện nhiều người trong phòng thi cùng xuất hiện trước camera!'
                    : selectedLiveCam.violationType === 'NO_FACE'
                    ? '⚠️ CẢNH BÁO: Không có thí sinh trước màn hình hoặc camera bị che tối!'
                    : '✓ Trạng thái AI: Khuôn mặt hợp lệ, đang làm bài thi nghiêm túc.'}
                </span>
              </div>

              <div className="eg-confirm-stats" style={{ margin: 0 }}>
                <div className="eg-confirm-stat-line">
                  <span>Họ và tên:</span> <strong>{selectedLiveCam.fullName}</strong>
                </div>
                <div className="eg-confirm-stat-line">
                  <span>Mã sinh viên:</span> <strong>{selectedLiveCam.studentCode}</strong>
                </div>
                <div className="eg-confirm-stat-line">
                  <span>Trạng thái kết nối:</span> <strong style={{ color: '#16a34a' }}>Đang phát trực tiếp</strong>
                </div>
              </div>
            </div>
            <div className="eg-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="eg-student-btn-resume"
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                  onClick={() => handleAllowResume(selectedLiveCam.studentCode, selectedLiveCam.sessionCode, selectedLiveCam.fullName)}
                >
                  🔄 Duyệt tiếp tục thi (Sự cố mạng)
                </button>
                <button
                  type="button"
                  className="eg-student-btn-force"
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                  onClick={() => {
                    const target = { ...selectedLiveCam };
                    setSelectedLiveCam(null);
                    setForceSubmittingStudent(target);
                  }}
                >
                  🛑 Cưỡng chế nộp bài (Vi phạm nặng)
                </button>
              </div>
              <button type="button" className="eg-primary-btn" onClick={() => setSelectedLiveCam(null)}>
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cưỡng chế nộp bài (Thu bài) */}
      {forceSubmittingStudent && (
        <div className="eg-modal-overlay" onClick={() => !submittingForce && setForceSubmittingStudent(null)}>
          <div className="eg-modal-card eg-force-submit-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="eg-modal-header" style={{ borderBottom: '1px solid #fee2e2', background: '#fef2f2' }}>
              <div>
                <h2 className="eg-modal-title" style={{ color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  <span style={{ fontSize: '20px' }}>🛑</span> Xác nhận Cưỡng chế Thu bài thi
                </h2>
                <span style={{ fontSize: '12px', color: '#b91c1c' }}>
                  Áp dụng khi thí sinh vi phạm nghiêm trọng quy chế phòng thi hoặc gian lận
                </span>
              </div>
              <button
                type="button"
                className="eg-modal-close"
                onClick={() => !submittingForce && setForceSubmittingStudent(null)}
                disabled={submittingForce}
              >
                ✕
              </button>
            </div>

            <div className="eg-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '16px' }}>
              <div className="eg-force-target-card">
                <div style={{ fontSize: '12.5px', color: '#475569' }}>Thí sinh bị xử lý:</div>
                <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                  {forceSubmittingStudent.fullName || 'Thí sinh'} ({forceSubmittingStudent.studentCode})
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Ca thi: <strong>{forceSubmittingStudent.sessionCode || 'EXAM88'}</strong>
                </div>
              </div>

              <div className="eg-dashboard-alert-banner is-error" style={{ margin: 0, fontSize: '12.5px' }}>
                <strong>Lưu ý quan trọng:</strong> Hành động này sẽ lập tức dừng bài làm của thí sinh, khóa màn hình thi và tự động tính điểm dựa trên các đáp án thí sinh đã hoàn thành trước đó.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#1e293b', marginBottom: '8px' }}>
                  Chọn lý do cưỡng chế thu bài / đình chỉ thi:
                </label>
                <div className="eg-force-reasons-list">
                  <label className={`eg-force-reason-option ${forceReasonOption === 'FACE_MISMATCH' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="forceReason"
                      value="FACE_MISMATCH"
                      checked={forceReasonOption === 'FACE_MISMATCH'}
                      onChange={(e) => setForceReasonOption(e.target.value)}
                    />
                    <div>
                      <strong>Nghi vấn thi hộ (Face mismatch)</strong>
                      <p>Khuôn mặt trước camera không khớp với ảnh nhận diện check-in.</p>
                    </div>
                  </label>

                  <label className={`eg-force-reason-option ${forceReasonOption === 'MULTIPLE_FACES' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="forceReason"
                      value="MULTIPLE_FACES"
                      checked={forceReasonOption === 'MULTIPLE_FACES'}
                      onChange={(e) => setForceReasonOption(e.target.value)}
                    />
                    <div>
                      <strong>Nhiều người trong phòng thi</strong>
                      <p>Phát hiện có người thứ hai xuất hiện hỗ trợ làm bài.</p>
                    </div>
                  </label>

                  <label className={`eg-force-reason-option ${forceReasonOption === 'TAB_SWITCH_EXCESSIVE' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="forceReason"
                      value="TAB_SWITCH_EXCESSIVE"
                      checked={forceReasonOption === 'TAB_SWITCH_EXCESSIVE'}
                      onChange={(e) => setForceReasonOption(e.target.value)}
                    />
                    <div>
                      <strong>Cố tình chuyển tab / Thoát toàn màn hình liên tục</strong>
                      <p>Thí sinh phớt lờ cảnh báo của hệ thống và tiếp tục tra cứu ngoài màn hình thi.</p>
                    </div>
                  </label>

                  <label className={`eg-force-reason-option ${forceReasonOption === 'DISOBEY_RULES' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="forceReason"
                      value="DISOBEY_RULES"
                      checked={forceReasonOption === 'DISOBEY_RULES'}
                      onChange={(e) => setForceReasonOption(e.target.value)}
                    />
                    <div>
                      <strong>Không tuân thủ hiệu lệnh phòng thi</strong>
                      <p>Có hành vi chống đối, cố ý che khuất camera hoặc micro.</p>
                    </div>
                  </label>

                  <label className={`eg-force-reason-option ${forceReasonOption === 'OTHER' ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="forceReason"
                      value="OTHER"
                      checked={forceReasonOption === 'OTHER'}
                      onChange={(e) => setForceReasonOption(e.target.value)}
                    />
                    <div style={{ flex: 1 }}>
                      <strong>Lý do vi phạm khác</strong>
                      {forceReasonOption === 'OTHER' && (
                        <textarea
                          rows={2}
                          className="eg-textarea"
                          style={{ width: '100%', marginTop: '6px', fontSize: '13px' }}
                          placeholder="Nhập chi tiết lý do cưỡng chế thu bài..."
                          value={customForceReason}
                          onChange={(e) => setCustomForceReason(e.target.value)}
                          autoFocus
                        />
                      )}
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="eg-modal-footer" style={{ borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
              <button
                type="button"
                className="eg-btn-cancel"
                onClick={() => setForceSubmittingStudent(null)}
                disabled={submittingForce}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="eg-btn-delete"
                style={{ background: '#dc2626', borderColor: '#b91c1c', color: '#fff', fontWeight: 600, padding: '9px 16px' }}
                onClick={handleExecuteForceSubmit}
                disabled={submittingForce || (forceReasonOption === 'OTHER' && !customForceReason.trim())}
              >
                {submittingForce ? 'Đang xử lý...' : '🛑 Xác nhận cưỡng chế nộp bài'}
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}