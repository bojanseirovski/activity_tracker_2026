import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { API } from '../../constants/api';
import ErrorMessage from '../common/ErrorMessage';

interface UserProfile {
    username: string;
    total_entries: number;
    position: number;
    last_activity_types: string[];
}

const UserProfilePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = () => {
        setLoading(true);
        setError(null);
        apiClient.get(API.USER_PROFILE(Number(id)))
            .then(({ data }) => setProfile(data))
            .catch(() => setError('Could not load user profile.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchProfile();
    }, [id]);

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-12">
            <div className="container mx-auto px-4 max-w-md">
                {loading && (
                    <div className="flex justify-center items-center h-64 bg-white rounded-2xl shadow-xl">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}

                {error && <ErrorMessage message={error} onReload={fetchProfile} />}

                {!loading && !error && profile && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-center">
                            <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center mx-auto mb-3">
                                <span className="text-2xl font-bold text-white">
                                    {profile.username.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <h2 className="text-2xl font-bold text-white">{profile.username}</h2>
                            <p className="text-blue-100 mt-1">
                                {profile.position === 1 ? '🥇' : profile.position === 2 ? '🥈' : profile.position === 3 ? '🥉' : `#${profile.position}`}
                                {' '}Leaderboard Position
                            </p>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-bold text-gray-800">{profile.total_entries}</p>
                                    <p className="text-sm text-gray-500 mt-1">Total Entries</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-4 text-center">
                                    <p className="text-3xl font-bold text-gray-800">#{profile.position}</p>
                                    <p className="text-sm text-gray-500 mt-1">Rank</p>
                                </div>
                            </div>

                            {profile.last_activity_types.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Activities</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {profile.last_activity_types.map((type, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800"
                                            >
                                                {type}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <Link
                        to="/"
                        className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                        Back to Leaderboard
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default UserProfilePage;
