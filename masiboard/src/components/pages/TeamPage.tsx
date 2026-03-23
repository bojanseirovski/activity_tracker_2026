import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';
import ErrorMessage from '../common/ErrorMessage';
import ModalMessage from '../common/ModalMessage';

interface TeamDetail {
    id: number;
    title: string;
    activity_type_name: string | null;
    member_count: number;
    total_points: number;
    is_member: boolean;
}
interface LeaderboardEntry { id: number; username: string; total_points: number; rank: number; }
type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' } | null;

const TeamPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [team, setTeam] = useState<TeamDetail | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);
    const [modal, setModal] = useState<ModalState>(null);

    const fetchData = () => {
        setLoading(true);
        setError(null);
        Promise.all([
            apiClient.get(API.TEAM(Number(id))),
            apiClient.get(API.TEAM_LEADERBOARD(Number(id))),
        ])
            .then(([tRes, lRes]) => {
                setTeam(tRes.data);
                setLeaderboard(lRes.data);
            })
            .catch(() => setError(MESSAGES.TEAM_LOAD_ERROR))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, [id]);

    const handleJoin = async () => {
        if (!team) return;
        setJoining(true);
        try {
            await apiClient.post(API.TEAM_JOIN(team.id));
            setTeam(prev => prev ? { ...prev, is_member: true, member_count: Number(prev.member_count) + 1 } : prev);
        } catch {
            setModal({ isOpen: true, message: MESSAGES.TEAM_JOIN_ERROR, type: 'error' });
        } finally {
            setJoining(false);
        }
    };

    const handleLeave = async () => {
        if (!team) return;
        setJoining(true);
        try {
            await apiClient.delete(API.TEAM_JOIN(team.id));
            setTeam(prev => prev ? { ...prev, is_member: false, member_count: Math.max(0, Number(prev.member_count) - 1) } : prev);
        } catch {
            setModal({ isOpen: true, message: MESSAGES.TEAM_LEAVE_ERROR, type: 'error' });
        } finally {
            setJoining(false);
        }
    };

    const rankBadge = (rank: number) =>
        rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-12">
            <ModalMessage
                isOpen={modal?.isOpen || false}
                message={modal?.message || ''}
                type={modal?.type || 'error'}
                onClose={() => setModal(null)}
            />

            <div className="container mx-auto px-4 max-w-2xl">
                {loading && (
                    <div className="flex justify-center items-center h-64 bg-white rounded-2xl shadow-xl">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}
                {error && <ErrorMessage message={error} onReload={fetchData} />}

                {!loading && !error && team && (
                    <div className="space-y-6">
                        {/* Header card */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
                                <h1 className="text-3xl font-bold text-white mb-1">{team.title}</h1>
                                {team.activity_type_name && (
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white bg-opacity-20 text-white mt-2">
                                        {team.activity_type_name}
                                    </span>
                                )}
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-gray-800">{team.member_count}</p>
                                        <p className="text-sm text-gray-500 mt-1">Members</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-gray-800">{team.total_points}</p>
                                        <p className="text-sm text-gray-500 mt-1">Total Points</p>
                                    </div>
                                </div>
                                {user && (
                                    <button
                                        onClick={team.is_member ? handleLeave : handleJoin}
                                        disabled={joining}
                                        className={`w-full py-3 px-4 rounded-lg font-semibold transition duration-200 ${
                                            team.is_member
                                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md'
                                        }`}
                                    >
                                        {joining ? '...' : team.is_member ? 'Leave Team' : 'Join Team'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Leaderboard */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                            <div className="p-6 border-b border-gray-100">
                                <h2 className="text-xl font-bold text-gray-800">Leaderboard</h2>
                            </div>
                            {leaderboard.length === 0 ? (
                                <div className="p-10 text-center text-gray-500">
                                    No members yet. Be the first to join!
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {leaderboard.map(entry => (
                                        <div key={entry.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition duration-150">
                                            <div className="flex items-center gap-4">
                                                <span className="text-xl w-8 text-center">{rankBadge(Number(entry.rank))}</span>
                                                <Link to={`/users/${entry.id}`} className="font-medium text-gray-800 hover:text-blue-600 transition duration-150">
                                                    {entry.username}
                                                </Link>
                                            </div>
                                            <span className="font-bold text-blue-600">{entry.total_points} pts</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="mt-6 text-center">
                    <Link to="/teams" className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Teams
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default TeamPage;
