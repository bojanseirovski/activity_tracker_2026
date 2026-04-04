import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { API } from '../../constants/api';
import ErrorMessage from '../common/ErrorMessage';
import ModalMessage from '../common/ModalMessage';
import { useAuth } from '../../context/AuthContext';

interface UserProfile {
    username: string;
    total_entries: number;
    position: number;
    last_activity_types: string[];
    image_url?: string | null;
}
interface UserChallenge { id: number; title: string; start_date: string; end_date: string; activity_type_name: string | null; user_points: number; }
interface UserTeam { id: number; title: string; activity_type_name: string | null; user_points: number; }

const UserProfilePage: React.FC = () => {
    const { user } = useAuth();
    const { id } = useParams<{ id: string }>();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [challenges, setChallenges] = useState<UserChallenge[]>([]);
    const [teams, setTeams] = useState<UserTeam[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' } | null>(null);

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setModal({ isOpen: true, message: 'Profile link copied to clipboard!', type: 'success' });
        });
    };

    const fetchProfile = () => {
        setLoading(true);
        setError(null);
        const uid = Number(id);
        Promise.all([
            apiClient.get(API.USER_PROFILE(uid)),
            apiClient.get(API.USER_CHALLENGES(uid)),
            apiClient.get(API.USER_TEAMS(uid)),
        ])
            .then(([profileRes, challengesRes, teamsRes]) => {
                setProfile(profileRes.data);
                setChallenges(challengesRes.data);
                setTeams(teamsRes.data);
            })
            .catch(() => setError('Could not load user profile.'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchProfile();
    }, [id]);

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-12">
            <ModalMessage
                isOpen={modal?.isOpen || false}
                message={modal?.message || ''}
                type={modal?.type || 'success'}
                onClose={() => setModal(null)}
            />
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
                            {profile.image_url ? (
                                <img
                                    src={profile.image_url}
                                    alt={profile.username}
                                    className="w-16 h-16 rounded-full object-cover mx-auto mb-3 border-2 border-white border-opacity-30"
                                />
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-white bg-opacity-20 flex items-center justify-center mx-auto mb-3">
                                    <span className="text-2xl font-bold text-white">
                                        {profile.username.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                            )}
                            <div className="flex items-center gap-2 justify-center">
                                <h2 className="text-2xl font-bold text-white">{profile.username}</h2>
                                <button onClick={handleShare} title="Share" className="text-white/80 hover:text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                </button>
                            </div>
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

                            {challenges.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3">Challenges</h3>
                                    <div className="space-y-2">
                                        {challenges.map(c => (
                                            <Link key={c.id} to={`/challenges/${c.id}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 transition duration-150">
                                                <div>
                                                    <span className="text-sm font-medium text-gray-800">{c.title}</span>
                                                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                        {c.activity_type_name && (
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">{c.activity_type_name}</span>
                                                        )}
                                                        <span className="text-xs text-gray-400">{c.start_date} – {c.end_date}</span>
                                                    </div>
                                                </div>
                                                <span className="text-sm font-bold text-blue-600 ml-3">{c.user_points} pts</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {teams.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-3">Teams</h3>
                                    <div className="space-y-2">
                                        {teams.map(t => (
                                            <Link key={t.id} to={`/teams/${t.id}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-blue-50 transition duration-150">
                                                <div>
                                                    <span className="text-sm font-medium text-gray-800">{t.title}</span>
                                                    {t.activity_type_name && (
                                                        <div className="mt-0.5">
                                                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">{t.activity_type_name}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="text-sm font-bold text-blue-600 ml-3">{t.user_points} pts</span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-6 text-center">
                    {user ? (
                        <Link
                            to="/"
                            className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                            </svg>
                            Back to Leaderboard
                        </Link>
                    ) : (
                        <Link
                            to="/login"
                            className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                            </svg>
                            Login
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserProfilePage;
