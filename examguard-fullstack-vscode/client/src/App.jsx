import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import LandingPage from './pages/Landing/LandingPage';
import RegisterPage from './pages/Auth/RegisterPage';
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
    navigate('/', { replace: true });
  };

  const handleTeacherLogout = () => {
    disconnectSocket();
    sessionStorage.removeItem('examguard.teacher');
    setTeacherData(null);
    navigate('/', { replace: true });
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <LandingPage
            authData={authData}
            teacherData={teacherData}
            onStudentLogin={handleLoginSuccess}
            onTeacherLogin={handleTeacherLoginSuccess}
            onStudentLogout={handleStudentLogout}
            onTeacherLogout={handleTeacherLogout}
            onNavigateTo={navigate}
          />
        }
      />
      <Route
        path="/intro"
        element={
          <LandingPage
            authData={authData}
            teacherData={teacherData}
            onStudentLogin={handleLoginSuccess}
            onTeacherLogin={handleTeacherLoginSuccess}
            onStudentLogout={handleStudentLogout}
            onTeacherLogout={handleTeacherLogout}
            onNavigateTo={navigate}
          />
        }
      />
      <Route
        path="/register"
        element={<Navigate to="/" replace />}
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
          : <Navigate to="/" replace />}
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
          : <Navigate to="/" replace />}
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
          : <Navigate to="/" replace />}
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
          : <Navigate to="/" replace />}
      />
      <Route path="/student/login" element={<Navigate to="/" replace />} />
      <Route path="/teacher/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
