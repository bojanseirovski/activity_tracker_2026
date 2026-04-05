import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ModalMessage from '../common/ModalMessage';
import ErrorMessage from '../common/ErrorMessage';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

interface LeaderboardEntry {
    id: number;
    name: string;
    points: number;
    date: string;
    user_id: number;
    activity_type: string;
    like_count?: number;
    liked_by_me?: boolean;
    image_url?: string | null;
}

interface LikeUser {
    user_id: number;
    username: string;
}

interface LikesState {
    count: number;
    likedByMe: boolean;
    users: LikeUser[] | null;
    popoverOpen: boolean;
    loadingUsers: boolean;
}

const PAGE_SIZE = 10;

type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' | 'confirm'; onConfirm?: () => void } | null;

const LeaderboardPage: React.FC = () => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState<{ points: number }>({ points: 0 });
    const [modal, setModal] = useState<ModalState>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [likesMap, setLikesMap] = useState<Record<number, LikesState>>({});
    const navigate = useNavigate();
    const sentinelRef = useRef<HTMLDivElement>(null);

    const fetchLeaderboard = async (pageNum = 1) => {
        pageNum === 1 ? setLoading(true) : setLoadingMore(true);
        if (pageNum === 1) setError(null);
        try {
            const { data } = await apiClient.get(API.LEADERBOARD, {
                params: { userId: user?.id, page: pageNum, limit: PAGE_SIZE , sort: 'date' }
            });
            const incoming: LeaderboardEntry[] = data;
            setEntries(prev => pageNum === 1 ? incoming : [...prev, ...incoming]);
            setHasMore(incoming.length === PAGE_SIZE);
            setLikesMap(prev => {
                const next = { ...prev };
                incoming.forEach(e => {
                    if (!next[e.id]) {
                        next[e.id] = { count: e.like_count ?? 0, likedByMe: e.liked_by_me ?? false, users: null, popoverOpen: false, loadingUsers: false };
                    }
                });
                return next;
            });
        } catch (err) {
            console.error('Error fetching leaderboard:', err);
            if (pageNum === 1) setError(MESSAGES.LEADERBOARD_LOAD_ERROR);
        } finally {
            pageNum === 1 ? setLoading(false) : setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchLeaderboard(1);
    }, []);

    useEffect(() => {
        if (!sentinelRef.current || !hasMore || loadingMore) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchLeaderboard(nextPage);
            }
        }, { threshold: 1.0 });
        observer.observe(sentinelRef.current);
        return () => observer.disconnect();
    }, [hasMore, loadingMore, page]);

    const performDelete = async (id: number) => {
        try {
            await apiClient.delete(API.ENTRY(id), { params: { userId: user?.id } });
            setEntries(prev => prev.filter(entry => entry.id !== id));
            setModal({ isOpen: true, message: MESSAGES.ENTRY_DELETE_SUCCESS, type: 'success' });
        } catch (err) {
            console.error('Error deleting entry:', err);
            setModal({ isOpen: true, message: MESSAGES.ENTRY_DELETE_ERROR, type: 'error' });
        }
    };

    const handleDelete = (id: number) => {
        setModal({
            isOpen: true,
            message: MESSAGES.ENTRY_DELETE_CONFIRM,
            type: 'confirm',
            onConfirm: () => performDelete(id)
        });
    };

    const startEditing = (entry: LeaderboardEntry) => {
        setEditingId(entry.id);
        setEditForm({ points: entry.points });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({ points: 0 });
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setEditForm({ points: Number(e.target.value) });
    };

    const handleUpdate = async (id: number) => {
        try {
            const { data: updatedEntry } = await apiClient.put(API.ENTRY(id), {
                points: editForm.points,
                date: new Date().toISOString().split('T')[0],
                userId: user?.id
            });

            setEntries(entries.map(entry =>
                entry.id === id ? { ...entry, points: updatedEntry.points } : entry
            ));

            setEditingId(null);
            setModal({ isOpen: true, message: MESSAGES.ENTRY_UPDATE_SUCCESS, type: 'success' });
        } catch (err) {
            console.error('Error updating entry:', err);
            setModal({ isOpen: true, message: MESSAGES.ENTRY_UPDATE_ERROR, type: 'error' });
        }
    };

    const handleLikeToggle = async (entryId: number) => {
        const current = likesMap[entryId];
        if (!current) return;
        const wasLiked = current.likedByMe;
        // optimistic update
        setLikesMap(prev => ({
            ...prev,
            [entryId]: { ...prev[entryId], likedByMe: !wasLiked, count: prev[entryId].count + (wasLiked ? -1 : 1) }
        }));
        try {
            if (wasLiked) {
                await apiClient.delete(API.ENTRY_LIKES(entryId));
            } else {
                await apiClient.post(API.ENTRY_LIKES(entryId));
            }
        } catch {
            // revert on error
            setLikesMap(prev => ({
                ...prev,
                [entryId]: { ...prev[entryId], likedByMe: wasLiked, count: prev[entryId].count + (wasLiked ? 1 : -1) }
            }));
        }
    };

    const handleLikeCountClick = async (entryId: number) => {
        const current = likesMap[entryId];
        if (!current) return;
        const opening = !current.popoverOpen;
        setLikesMap(prev => ({ ...prev, [entryId]: { ...prev[entryId], popoverOpen: opening } }));
        if (opening && current.users === null) {
            setLikesMap(prev => ({ ...prev, [entryId]: { ...prev[entryId], loadingUsers: true } }));
            try {
                const { data } = await apiClient.get(API.ENTRY_LIKES(entryId));
                setLikesMap(prev => ({ ...prev, [entryId]: { ...prev[entryId], users: data.users ?? [], loadingUsers: false } }));
            } catch {
                setLikesMap(prev => ({ ...prev, [entryId]: { ...prev[entryId], users: [], loadingUsers: false } }));
            }
        }
    };

    const closeLikesPopover = (entryId: number) => {
        setLikesMap(prev => ({ ...prev, [entryId]: { ...prev[entryId], popoverOpen: false } }));
    };

    const closeModal = () => {
        setModal(null);
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-8">
            {/* Modal */}
            <ModalMessage
                isOpen={modal?.isOpen || false}
                message={modal?.message || ''}
                type={modal?.type || 'success'}
                onClose={closeModal}
                onConfirm={modal?.onConfirm}
            />

            <div className="container mx-auto px-4 max-w-4xl">
                {/* <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Leaderboard</h1>
                    <p className="text-gray-600">Top performers ranked by points</p>
                </div> */}

                <div className="flex justify-center mb-8">
                    <Link
                        to="/entries/add"
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold px-6 py-3 rounded-full shadow-lg transform transition-all duration-200 hover:scale-105 hover:shadow-xl"
                    >
                        + Add New Entry
                    </Link>
                </div>

                {loading && (
                    <div className="flex justify-center items-center h-64 bg-white rounded-2xl shadow-xl">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}

                {error && <ErrorMessage message={error} onReload={() => fetchLeaderboard(1)} />}

                {!loading && !error && (
                    <div className="space-y-4">
                        {entries.length > 0 ? (
                            <>
                                {entries.map((entry, index) => (
                                    <div
                                        key={entry.id}
                                        onClick={() => navigate(`/entries/${entry.id}`)}
                                        className={`
                                            flex items-center justify-between p-6 bg-white rounded-xl shadow-md transition-all duration-300
                                            transform hover:scale-[1.02] hover:shadow-lg cursor-pointer
                                        `}
                                    >
                                        {editingId === entry.id ? (
                                            // Edit mode
                                            <div className="w-full">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h3 className="text-xl font-semibold text-gray-800">Edit Entry</h3>
                                                    <button
                                                        onClick={cancelEditing}
                                                        className="text-gray-500 hover:text-gray-700"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                                                        </svg>
                                                    </button>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                                                        <input
                                                            type="number"
                                                            name="points"
                                                            value={editForm.points}
                                                            onChange={handleEditChange}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                    <div className="flex items-end space-x-2">
                                                        <button
                                                            onClick={() => handleUpdate(entry.id)}
                                                            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition duration-200"
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            onClick={cancelEditing}
                                                            className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-md transition duration-200"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            // Display mode
                                            <>
                                                <div className="flex items-center">
                                                    <div className={`
                                                        flex items-center justify-center w-12 h-12 rounded-full mr-6 font-bold text-lg
                                                        ${index === 0 ? 'bg-yellow-500 text-white' : ''}
                                                        ${index === 1 ? 'bg-gray-400 text-white' : ''}
                                                        ${index === 2 ? 'bg-orange-500 text-white' : ''}
                                                        ${index > 2 ? 'bg-gray-200 text-gray-700' : ''}
                                                    `}>
                                                        {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                                    </div>
                                                    <div>
                                                        <Link to={`/users/${entry.user_id}`} onClick={(e) => e.stopPropagation()} className="text-xl font-semibold text-blue-600 hover:text-blue-800">{entry.name}</Link>
                                                        <p className="text-gray-600 text-sm">Player</p>
                                                        <p className="text-gray-500 text-xs">{new Date(entry.date).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <p className="text-sm font-medium text-gray-700">{entry.activity_type}</p>
                                                    <p className="text-gray-500 text-xs">Activity</p>
                                                </div>
                                                <div className="flex items-center space-x-4">
                                                    {/* Like button + count + popover */}
                                                    {likesMap[entry.id] && (() => {
                                                        const likeState = likesMap[entry.id];
                                                        return (
                                                            <div className="relative flex flex-col items-center">
                                                                {user && user.id !== entry.user_id ? (
                                                                    <button
                                                                        onClick={(e) => { e.stopPropagation(); handleLikeToggle(entry.id); }}
                                                                        className="focus:outline-none"
                                                                        title={likeState.likedByMe ? 'Unlike' : 'Like'}
                                                                    >
                                                                        {likeState.likedByMe ? (
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                                                                                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                                            </svg>
                                                                        ) : (
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400 hover:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                                            </svg>
                                                                        )}
                                                                    </button>
                                                                ) : (
                                                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                                                    </svg>
                                                                )}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleLikeCountClick(entry.id); }}
                                                                    className="text-xs text-gray-500 hover:text-gray-700 mt-0.5 leading-none"
                                                                >
                                                                    {likeState.count}
                                                                </button>
                                                                {likeState.popoverOpen && (
                                                                    <>
                                                                        <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); closeLikesPopover(entry.id); }} />
                                                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 bg-white rounded-xl shadow-lg border border-gray-200 p-3 w-44 max-h-52 overflow-y-auto">
                                                                            <p className="text-xs font-semibold text-gray-500 mb-2">Liked by</p>
                                                                            {likeState.loadingUsers && (
                                                                                <div className="flex justify-center py-2">
                                                                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500" />
                                                                                </div>
                                                                            )}
                                                                            {!likeState.loadingUsers && likeState.users?.length === 0 && (
                                                                                <p className="text-xs text-gray-400">No likes yet</p>
                                                                            )}
                                                                            {likeState.users?.map(u => (
                                                                                <Link
                                                                                    key={u.user_id}
                                                                                    to={`/users/${u.user_id}`}
                                                                                    onClick={() => closeLikesPopover(entry.id)}
                                                                                    className="block text-sm text-blue-600 hover:text-blue-800 py-0.5"
                                                                                >
                                                                                    {u.username}
                                                                                </Link>
                                                                            ))}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                    <div className="text-right mr-4">
                                                        <div className="text-2xl font-bold text-gray-800">{entry.points}</div>
                                                        <p className="text-gray-600 text-sm">Points</p>
                                                    </div>
                                                    {user && user.id === entry.user_id && (
                                                    <div className="flex flex-col space-y-2">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); startEditing(entry); }}
                                                            className="text-blue-500 hover:text-blue-700"
                                                            title="Edit"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                                            className="text-red-500 hover:text-red-700"
                                                            title="Delete"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1-1v3M4 7h16"></path>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                                <div ref={sentinelRef} className="h-4" />
                                {loadingMore && (
                                    <div className="flex justify-center py-4">
                                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="bg-white rounded-xl shadow-md p-12 text-center">
                                <div className="text-gray-400 mb-4">
                                    <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                    </svg>
                                </div>
                                <h3 className="text-xl font-medium text-gray-900 mb-1">No entries yet</h3>
                                <p className="text-gray-500 mb-6">Be the first to add an entry to the leaderboard!</p>
                                <Link
                                    to="/entries/add"
                                    className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    Add Your First Entry
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeaderboardPage;
