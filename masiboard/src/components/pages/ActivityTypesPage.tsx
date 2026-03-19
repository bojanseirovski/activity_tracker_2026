import React, { useState, useEffect } from 'react';
import ModalMessage from '../common/ModalMessage';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

interface ActivityType {
    id: number;
    name: string;
    description?: string;
    userId: number;
}

type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' | 'confirm'; onConfirm?: () => void } | null;

const ActivityTypesPage: React.FC = () => {
    const { user } = useAuth();
    const [types, setTypes] = useState<ActivityType[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [createForm, setCreateForm] = useState({ name: '', description: '' });
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editForm, setEditForm] = useState({ name: '', description: '' });
    const [modal, setModal] = useState<ModalState>(null);

    const fetchTypes = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await apiClient.get(API.ACTIVITY_TYPES, { params: { userId: user?.id } });
            setTypes(data);
        } catch (err) {
            console.error('Error fetching activity types:', err);
            setError(MESSAGES.ACTIVITY_TYPES_LOAD_ERROR);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTypes();
    }, []);

    const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setCreateForm({ ...createForm, [e.target.name]: e.target.value });
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { data } = await apiClient.post(API.ACTIVITY_TYPES, { ...createForm, userId: user?.id });
            setTypes([...types, data]);
            setCreateForm({ name: '', description: '' });
            setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_CREATE_SUCCESS, type: 'success' });
        } catch (err) {
            console.error('Error creating activity type:', err);
            setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_CREATE_ERROR, type: 'error' });
        }
    };

    const startEditing = (type: ActivityType) => {
        setEditingId(type.id);
        setEditForm({ name: type.name, description: type.description || '' });
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditForm({ name: '', description: '' });
    };

    const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setEditForm({ ...editForm, [e.target.name]: e.target.value });
    };

    const handleUpdate = async (id: number) => {
        try {
            const { data: updated } = await apiClient.put(API.ACTIVITY_TYPE(id), { ...editForm, userId: user?.id });
            setTypes(types.map(t => t.id === id ? { ...t, ...updated } : t));
            setEditingId(null);
            setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_UPDATE_SUCCESS, type: 'success' });
        } catch (err) {
            console.error('Error updating activity type:', err);
            setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_UPDATE_ERROR, type: 'error' });
        }
    };

    const performDelete = async (id: number) => {
        try {
            await apiClient.delete(API.ACTIVITY_TYPE(id), { params: { userId: user?.id } });
            setTypes(prev => prev.filter(t => t.id !== id));
            setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_DELETE_SUCCESS, type: 'success' });
        } catch (err) {
            console.error('Error deleting activity type:', err);
            setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_DELETE_ERROR, type: 'error' });
        }
    };

    const handleDelete = (id: number) => {
        setModal({
            isOpen: true,
            message: MESSAGES.ACTIVITY_TYPE_DELETE_CONFIRM,
            type: 'confirm',
            onConfirm: () => performDelete(id)
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
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Activity Types</h1>
                    <p className="text-gray-600">Manage your activity categories</p>
                </div>

                {/* Create form */}
                <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Add New Activity Type</h2>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <input
                                type="text"
                                name="name"
                                value={createForm.name}
                                onChange={handleCreateChange}
                                placeholder="e.g. Running, Cycling..."
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                            <input
                                type="text"
                                name="description"
                                value={createForm.description}
                                onChange={handleCreateChange}
                                placeholder="Short description..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            type="submit"
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold px-6 py-2 rounded-md shadow transition duration-200"
                        >
                            Create
                        </button>
                    </form>
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
                        <button onClick={fetchTypes} className="ml-4 underline text-sm">Retry</button>
                    </div>
                )}

                {!loading && !error && (
                    <div className="space-y-3">
                        {types.length === 0 ? (
                            <div className="bg-white rounded-xl shadow-md p-10 text-center text-gray-500">
                                No activity types yet. Create one above!
                            </div>
                        ) : (
                            types.map(type => (
                                <div key={type.id} className="bg-white rounded-xl shadow-md p-5 transition-all duration-200 hover:shadow-lg">
                                    {editingId === type.id ? (
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-lg font-semibold text-gray-800">Edit Activity Type</h3>
                                                <button onClick={cancelEditing} className="text-gray-400 hover:text-gray-600">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                                    <input
                                                        type="text"
                                                        name="name"
                                                        value={editForm.name}
                                                        onChange={handleEditChange}
                                                        required
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                                                    <input
                                                        type="text"
                                                        name="description"
                                                        value={editForm.description}
                                                        onChange={handleEditChange}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                                <div className="flex space-x-2">
                                                    <button
                                                        onClick={() => handleUpdate(type.id)}
                                                        className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-md transition duration-200"
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        onClick={cancelEditing}
                                                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 py-2 px-4 rounded-md transition duration-200"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-800">{type.name}</h3>
                                                {type.description && (
                                                    <p className="text-gray-500 text-sm mt-1">{type.description}</p>
                                                )}
                                            </div>
                                            {user && user.id === type.userId && (
                                                <div className="flex space-x-2 ml-4">
                                                    <button
                                                        onClick={() => startEditing(type)}
                                                        className="text-blue-500 hover:text-blue-700"
                                                        title="Edit"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(type.id)}
                                                        className="text-red-500 hover:text-red-700"
                                                        title="Delete"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActivityTypesPage;
