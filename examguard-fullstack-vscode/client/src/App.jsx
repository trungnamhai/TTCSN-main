import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import ExamLogin from './pages/Auth/ExamLogin';
import TeacherLogin from './pages/Auth/TeacherLogin';
import StudentDashboard from './pages/Student/Dashboard';
import FaceVerification from './pages/Student/FaceVerification';
import ExamRoom from './pages/Student/ExamRoom';
import ProctoringDashboard from './pages/Teacher/ProctoringDashboard';
import { connectSocket, disconnectSocket } from './services/socket';

function readSessionData(key) {
  try {
    const data = sessionStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export default function App() {
  const navigate = useNavigate();
  const [authData, setAuthData] = useState(() => readSessionData('examguard.student'));
  const [teacherData, setTeacherData] = useState(() => readSessionData('examguard.teacher'));

  useEffect(() => {
    const token = teacherData?.token || authData?.token;
    if (token) {
      connectSocket(token);
    } else {
      disconnectSocket();
    }

    return disconnectSocket;
  }, [authData?.token, teacherData?.token]);

  const handleLoginSuccess = (data) => {
    sessionStorage.setItem('examguard.student', JSON.stringify(data));
    setAuthData(data);
    navigate('/student/dashboard');
  };

  const handleTeacherLoginSuccess = (data) => {
    sessionStorage.setItem('examguard.teacher', JSON.stringify(data));
    setTeacherData(data);
    navigate('/teacher/dashboard');
  };

  const handleStartExam = (selectedExam) => {
    const updatedAuthData = {
      ...authData,
      selectedExam,
      session: {
        ...(authData?.session || {}),
        id: selectedExam.session_id,
        session_code: selectedExam.session_code,
        title: selectedExam.title
      }
    };
    sessionStorage.setItem('examguard.student', JSON.stringify(updatedAuthData));
    setAuthData(updatedAuthData);
    navigate('/student/verify');
  };

  const handleVerifySuccess = (result) => {
    if (result) {
      const updated = {
        ...authData,
        verifiedFace: result
      };
      setAuthData(updated);
      sessionStorage.setItem('examguard.student', JSON.stringify(updated));
    }
    navigate('/student/exam');
  };

  const handleStudentLogout = () => {
    disconnectSocket();
    sessionStorage.removeItem('examguard.student');
    setAuthData(null);
    navigate('/student/login', { replace: true });
  };

  const handleTeacherLogout = () => {
    disconnectSocket();
    sessionStorage.removeItem('examguard.teacher');
    setTeacherData(null);
    navigate('/teacher/login', { replace: true });
  };

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/student/login" replace />} />
      <Route
        path="/student/login"
        element={authData
          ? <Navigate to="/student/dashboard" replace />
          : (
            <ExamLogin
              onLoginSuccess={handleLoginSuccess}
              onSwitchToTeacher={() => navigate('/teacher/login')}
            />
          )}
      />
      <Route
        path="/student/dashboard"
        element={authData
          ? (
            <StudentDashboard
              authData={authData}
              onStartExam={handleStartExam}
              onLogout={handleStudentLogout}
            />
          )
          : <Navigate to="/student/login" replace />}
      />
      <Route
        path="/student/verify"
        element={authData
          ? (
            <FaceVerification
              authData={authData}
              sessionData={authData}
              onVerifiedSuccess={handleVerifySuccess}
              onBack={() => navigate('/student/dashboard')}
            />
          )
          : <Navigate to="/student/login" replace />}
      />
      <Route
        path="/student/exam"
        element={authData
          ? (
            <ExamRoom
              authData={authData}
              sessionData={authData}
              onExit={() => navigate('/student/dashboard')}
              onLogout={handleStudentLogout}
            />
          )
          : <Navigate to="/student/login" replace />}
      />
      <Route
        path="/teacher/login"
        element={teacherData
          ? <Navigate to="/teacher/dashboard" replace />
          : (
            <TeacherLogin
              onLoginSuccess={handleTeacherLoginSuccess}
              onSwitchToStudent={() => navigate('/student/login')}
            />
          )}
      />
      <Route
        path="/teacher/dashboard"
        element={teacherData
          ? (
            <ProctoringDashboard
              token={teacherData.token}
              teacher={teacherData.teacher}
              onLogout={handleTeacherLogout}
            />
          )
          : <Navigate to="/teacher/login" replace />}
      />
      <Route path="*" element={<Navigate to="/student/login" replace />} />
    </Routes>
  );
}
