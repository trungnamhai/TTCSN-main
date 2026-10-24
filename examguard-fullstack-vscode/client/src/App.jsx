import React, { useState } from 'react';
import ExamLogin from './pages/Auth/ExamLogin';
import StudentDashboard from './pages/Student/Dashboard';
import FaceVerification from './pages/Student/FaceVerification';
import ExamRoom from './pages/Student/ExamRoom';

export default function App() {
  // Các bước: 'login' -> 'dashboard' -> 'verify' -> 'exam'
  const [step, setStep] = useState('login');
  const [authData, setAuthData] = useState(null);

  const handleLoginSuccess = (data) => {
    setAuthData(data);
    setStep('dashboard');
  };

  const handleStartExamFromDashboard = (selectedExam) => {
    setAuthData((prev) => ({
      ...prev,
      selectedExam,
      session: {
        ...(prev?.session || {}),
        id: selectedExam.session_id,
        session_code: selectedExam.session_code,
        title: selectedExam.title
      }
    }));
    setStep('verify');
  };

  const handleLogout = () => {
    setAuthData(null);
    setStep('login');
  };

  if (step === 'login') {
    return <ExamLogin onLoginSuccess={handleLoginSuccess} />;
  }

  if (step === 'dashboard') {
    return (
      <StudentDashboard
        authData={authData}
        onStartExam={handleStartExamFromDashboard}
        onLogout={handleLogout}
      />
    );
  }

  if (step === 'verify') {
    return (
      <FaceVerification
        authData={authData}
        sessionData={authData}
        onVerified={() => setStep('exam')}
        onVerifySuccess={() => setStep('exam')}
        onBack={() => setStep('dashboard')}
      />
    );
  }

  return (
    <ExamRoom
      authData={authData}
      sessionData={authData}
      onExit={() => setStep('dashboard')}
    />
  );
}