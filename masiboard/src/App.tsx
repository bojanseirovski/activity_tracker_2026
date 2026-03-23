import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AuthProvider } from './context/AuthContext';
import LeaderboardPage from './components/pages/LeaderboardPage';
import SearchFilterPage from './components/pages/SearchFilterPage';
import AddEntryPage from './components/pages/AddEntryPage';
import Navbar from './components/common/Navbar';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Logout from './components/auth/Logout';
import PrivateRoute from './components/auth/PrivateRoute';
import ProfilePage from './components/pages/ProfilePage';
import ActivityTypesPage from './components/pages/ActivityTypesPage';
import UserProfilePage from './components/pages/UserProfilePage';
import TermsPage from './components/pages/TermsPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import ChallengesPage from './components/pages/ChallengesPage';
import ChallengePage from './components/pages/ChallengePage';
import TeamsPage from './components/pages/TeamsPage';
import TeamPage from './components/pages/TeamPage';

const CatchAllRedirect: React.FC = () => {
    const { user, isLoading } = useAuth();
    if (isLoading) return null;
    return <Navigate to={user ? '/' : '/login'} replace />;
};

const App: React.FC = () => {
    return (
        <Router>
            <AuthProvider>
                <div className="bg-white min-h-screen">
                    <Navbar />

                    <main>
                        <Routes>
                            <Route path="/" element={<PrivateRoute><LeaderboardPage /></PrivateRoute>} />
                            <Route path="/search" element={<PrivateRoute><SearchFilterPage /></PrivateRoute>} />
                            <Route path="/entries/add" element={<PrivateRoute><AddEntryPage /></PrivateRoute>} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/logout" element={<PrivateRoute><Logout /></PrivateRoute>} />
                            <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
                            <Route path="/activity-types" element={<PrivateRoute><ActivityTypesPage /></PrivateRoute>} />
                            <Route path="/users/:id" element={<UserProfilePage />} />
                            <Route path="/terms" element={<TermsPage />} />
                            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                            <Route path="/reset-password" element={<ResetPasswordPage />} />
                            <Route path="/challenges" element={<PrivateRoute><ChallengesPage /></PrivateRoute>} />
                            <Route path="/challenges/:id" element={<ChallengePage />} />
                            <Route path="/teams" element={<PrivateRoute><TeamsPage /></PrivateRoute>} />
                            <Route path="/teams/:id" element={<TeamPage />} />
                            <Route path="*" element={<CatchAllRedirect />} />
                        </Routes>
                    </main>
                </div>
            </AuthProvider>
        </Router>
    );
};

export default App;