import React, { useEffect } from 'react';
import apiClient from '../../api/client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';

interface LogoutProps {
    onLogout?: () => void;
}

const Logout: React.FC<LogoutProps> = ({ onLogout }) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    useEffect(() => {
        handleLogout();
    }, []); // Run only once when component mounts

    const handleLogout = async () => {
        try {
            await apiClient.post(API.LOGOUT, { user_id: user?.id });
        } catch (error) {
            console.error('Error during logout:', error);
            logout();
        } finally {
            logout();
            if (onLogout) onLogout();
            navigate('/login');
        }
    };

    return (
        <div className="flex justify-center items-center h-screen">
            <p>Logging out...</p>
        </div>
    );
};

export default Logout;
