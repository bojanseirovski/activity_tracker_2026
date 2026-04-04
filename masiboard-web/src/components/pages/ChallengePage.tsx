import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';
import ErrorMessage from '../common/ErrorMessage';
import ModalMessage from '../common/ModalMessage';
import ImageUpload from '../common/ImageUpload';

interface ChallengeDetail {
    id: number;
    title: string;
    activity_type_name: string | null;
    start_date: string;
    end_date: string;
    member_count: number;
    total_points: number;
    is_member: boolean;
    createdBy?: number;
    image_url?: string | null;
}
interface LeaderboardEntry { id: number; username: string; total_points: number; rank: number; }
type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' } | null;

const ChallengePage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [challenge, setChallenge] = useState<ChallengeDetail | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);
    const [modal, setModal] = useState<ModalState>(null);

    const fetchData = () => {
        setLoading(true);
        setError(null);
        Promise.all([
            apiClient.get(API.CHALLENGE(Number(id))),
            apiClient.get(API.CHALLENGE_LEADERBOARD(Number(id))),
        ])
            .then(([cRes, lRes]) => {
                setChallenge(cRes.data);
                setLeaderboard(lRes.data);
            })
            .catch(() => setError(MESSAGES.CHALLENGE_LOAD_ERROR))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, [id]);

    const handleJoin = async () => {
        if (!challenge) return;
        setJoining(true);
        try {
            await apiClient.post(API.CHALLENGE_JOIN(challenge.id));
            setChallenge(prev => prev ? { ...prev, is_member: true, member_count: Number(prev.member_count) + 1 } : prev);
        } catch {
            setModal({ isOpen: true, message: MESSAGES.CHALLENGE_JOIN_ERROR, type: 'error' });
        } finally {
            setJoining(false);
        }
    };

    const handleLeave = async () => {
        if (!challenge) return;
        setJoining(true);
        try {
            await apiClient.delete(API.CHALLENGE_JOIN(challenge.id));
            setChallenge(prev => prev ? { ...prev, is_member: false, member_count: Math.max(0, Number(prev.member_count) - 1) } : prev);
        } catch {
            setModal({ isOpen: true, message: MESSAGES.CHALLENGE_LEAVE_ERROR, type: 'error' });
        } finally {
            setJoining(false);
        }
    };

    const rankBadge = (rank: number) =>
        rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setModal({ isOpen: true, message: 'Challenge link copied to clipboard!', type: 'success' });
        });
    };

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

                {!loading && !error && challenge && (
                    <div className="space-y-6">
                        {/* Header card */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
                                <div className="flex items-center gap-4 mb-2">
                                    {user?.id === challenge.createdBy ? (
                                        <ImageUpload
                                            entityType="challenge"
                                            entityId={challenge.id}
                                            currentImageUrl={challenge.image_url}
                                            onUploadSuccess={(url) => setChallenge(prev => prev ? { ...prev, image_url: url } : prev)}
                                        />
                                    ) : challenge.image_url ? (
                                        <img src={challenge.image_url} alt="" className="w-20 h-20 rounded-lg object-cover" />
                                    ) : null}
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h1 className="text-3xl font-bold text-white mb-1">{challenge.title}</h1>
                                            <button
                                                type="button"
                                                onClick={handleShare}
                                                title="Copy challenge link"
                                                className="text-white/80 hover:text-white transition-colors mb-1"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            {challenge.activity_type_name && (
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white bg-opacity-20 text-white">
                                                    {challenge.activity_type_name}
                                                </span>
                                            )}
                                            <span className="text-blue-100 text-sm">{challenge.start_date} → {challenge.end_date}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-gray-800">{challenge.member_count}</p>
                                        <p className="text-sm text-gray-500 mt-1">Members Joined</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-gray-800">{challenge.total_points}</p>
                                        <p className="text-sm text-gray-500 mt-1">Total Points</p>
                                    </div>
                                </div>
                                {user && (
                                    <button
                                        onClick={challenge.is_member ? handleLeave : handleJoin}
                                        disabled={joining}
                                        className={`w-full py-3 px-4 rounded-lg font-semibold transition duration-200 ${
                                            challenge.is_member
                                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md'
                                        }`}
                                    >
                                        {joining ? '...' : challenge.is_member ? 'Leave Challenge' : 'Join Challenge'}
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
                                    No participants yet. Be the first to join and submit!
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
                    <Link to="/challenges" className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Challenges
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ChallengePage;
