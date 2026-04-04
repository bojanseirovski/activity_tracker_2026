import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ModalMessage from '../common/ModalMessage';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

interface ActivityType { id: number; name: string; }
interface Team {
    id: number;
    title: string;
    activity_type_name: string | null;
    activity_type_id: number | null;
    created_by: number;
    member_count: number;
}
type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' | 'confirm'; onConfirm?: () => void } | null;

const TeamsPage: React.FC = () => {
    const { user } = useAuth();
    const [teams, setTeams] = useState<Team[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [createForm, setCreateForm] = useState({ title: '', activity_type_id: '' as number | '' });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ title: '', activity_type_id: '' as number | '' });
    const [modal, setModal] = useState<ModalState>(null);
    const [showCreateForm, setShowCreateForm] = useState(false);

    const fetchTeams = async (q?: string) => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await apiClient.get(API.TEAMS, { params: q ? { q } : {} });
            setTeams(data);
        } catch {
            setError(MESSAGES.TEAMS_LOAD_ERROR);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTeams();
        apiClient.get(API.ACTIVITY_TYPES).then(r => setActivityTypes(r.data)).catch(() => {});
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchTeams(searchQuery || undefined);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data } = await apiClient.post(API.TEAMS, {
                ...createForm,
                activity_type_id: createForm.activity_type_id || null,
            });
            setTeams([data, ...teams]);
            setCreateForm({ title: '', activity_type_id: '' });
            setShowCreateForm(false);
            setModal({ isOpen: true, message: MESSAGES.TEAM_CREATE_SUCCESS, type: 'success' });
        } catch {
            setModal({ isOpen: true, message: MESSAGES.TEAM_CREATE_ERROR, type: 'error' });
        }
    };

    const startEditing = (t: Team) => {
        setEditingId(t.id);
        setEditForm({ title: t.title, activity_type_id: t.activity_type_id ?? '' });
    };

    const handleUpdate = async (id: number) => {
        try {
            await apiClient.put(API.TEAM(id), { ...editForm, activity_type_id: editForm.activity_type_id || null });
            setTeams(teams.map(t => t.id === id
                ? { ...t, title: editForm.title as string, activity_type_id: editForm.activity_type_id as number | null }
                : t
            ));
            setEditingId(null);
            setModal({ isOpen: true, message: MESSAGES.TEAM_UPDATE_SUCCESS, type: 'success' });
        } catch {
            setModal({ isOpen: true, message: MESSAGES.TEAM_UPDATE_ERROR, type: 'error' });
        }
    };

    const handleDelete = (id: number) => {
        setModal({
            isOpen: true,
            message: MESSAGES.TEAM_DELETE_CONFIRM,
            type: 'confirm',
            onConfirm: async () => {
                try {
                    await apiClient.delete(API.TEAM(id));
                    setTeams(prev => prev.filter(t => t.id !== id));
                    setModal({ isOpen: true, message: MESSAGES.TEAM_DELETE_SUCCESS, type: 'success' });
                } catch {
                    setModal({ isOpen: true, message: MESSAGES.TEAM_DELETE_ERROR, type: 'error' });
                }
            }
        });
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-8">
            <ModalMessage
                isOpen={modal?.isOpen || false}
                message={modal?.message || ''}
                type={modal?.type || 'success'}
                onClose={() => setModal(null)}
                onConfirm={modal?.onConfirm}
            />

            <div className="container mx-auto px-4 max-w-3xl">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Teams</h1>
                    <p className="text-gray-600">Join permanent groups and accumulate points together</p>
                </div>

                {/* Search */}
                <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search teams..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button type="submit" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition duration-200">
                        Search
                    </button>
                    {searchQuery && (
                        <button type="button" onClick={() => { setSearchQuery(''); fetchTeams(); }}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition duration-200">
                            Clear
                        </button>
                    )}
                </form>

                {/* Create form */}
                <div className="bg-white rounded-xl shadow-md mb-8">
                    <button
                        type="button"
                        onClick={() => setShowCreateForm(v => !v)}
                        className="w-full flex items-center justify-between px-6 py-4 text-left"
                    >
                        <h2 className="text-xl font-semibold text-gray-800">Create Team</h2>
                        <svg className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${showCreateForm ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    {showCreateForm && <div className="px-6 pb-6">
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                            <input
                                type="text"
                                value={createForm.title}
                                onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                                placeholder="e.g. The Running Crew"
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Activity Type</label>
                            <select
                                value={createForm.activity_type_id}
                                onChange={e => setCreateForm({ ...createForm, activity_type_id: e.target.value ? Number(e.target.value) : '' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Any activity type</option>
                                {activityTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <button
                            type="submit"
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold px-6 py-2 rounded-md shadow transition duration-200"
                        >
                            Create
                        </button>
                    </form>
                    </div>}
                </div>

                {/* List */}
                {loading && (
                    <div className="flex justify-center items-center h-32">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-center">
                        {error}
                        <button onClick={() => fetchTeams()} className="ml-4 underline text-sm">Retry</button>
                    </div>
                )}
                {!loading && !error && (
                    <div className="space-y-3">
                        {teams.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-md p-10 text-center text-gray-500">
                                No teams found. Create one above!
                            </div>
                        ) : teams.map(t => (
                            <div key={t.id} className="bg-white rounded-xl shadow-md p-5 transition-all duration-200 hover:shadow-lg">
                                {editingId === t.id ? (
                                    <div>
                                        <div className="flex items-center justify-between mb-3">
                                            <h3 className="text-lg font-semibold text-gray-800">Edit Team</h3>
                                            <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-600">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            <input
                                                type="text"
                                                value={editForm.title}
                                                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                                placeholder="Team name"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            <select
                                                value={editForm.activity_type_id}
                                                onChange={e => setEditForm({ ...editForm, activity_type_id: e.target.value ? Number(e.target.value) : '' })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">Any activity type</option>
                                                {activityTypes.map(at => <option key={at.id} value={at.id}>{at.name}</option>)}
                                            </select>
                                            <div className="flex space-x-2">
                                                <button onClick={() => handleUpdate(t.id)}
                                                    className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition duration-200">Save</button>
                                                <button onClick={() => setEditingId(null)}
                                                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition duration-200">Cancel</button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-800">{t.title}</h3>
                                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                                {t.activity_type_name && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {t.activity_type_name}
                                                    </span>
                                                )}
                                                <span className="text-xs text-gray-500">{t.member_count} member{Number(t.member_count) !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                            <Link
                                                to={`/teams/${t.id}`}
                                                className="text-sm bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium px-3 py-1.5 rounded-md transition duration-200"
                                            >
                                                View
                                            </Link>
                                            {user && user.id === t.created_by && (
                                                <>
                                                    <button onClick={() => startEditing(t)} title="Edit"
                                                        className="text-blue-500 hover:text-blue-700">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button onClick={() => handleDelete(t.id)} title="Delete"
                                                        className="text-red-500 hover:text-red-700">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TeamsPage;
