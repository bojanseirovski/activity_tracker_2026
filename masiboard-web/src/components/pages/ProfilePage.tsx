import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ModalMessage from '../common/ModalMessage';
import ImageUpload from '../common/ImageUpload';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

const ProfilePage: React.FC = () => {
    const { user, updateUser } = useAuth();
    const [form, setForm] = useState({
        id: user?.id,
        username: user?.username || '',
        email: user?.email || '',
        profileImagePublic: true,
        image_url: null as string | null,
        unit: 'km' as 'km' | 'mi',
    });
    const [modal, setModal] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        apiClient.get(API.USER_ME)
            .then(response => {
                setForm({
                    id: response.data.id,
                    username: response.data.username || '',
                    email: response.data.email || '',
                    profileImagePublic: response.data.profileImagePublic ?? true,
                    image_url: response.data.image_url ?? null,
                    unit: response.data.unit === 'mi' ? 'mi' : 'km',
                });
                updateUser(response.data);
            })
            .catch(error => {
                console.error(error);
                setModal({ isOpen: true, message: MESSAGES.PROFILE_LOAD_ERROR, type: 'error' });
            });
    }, []);

    const handleShare = () => {
        const url = `${window.location.origin}/users/${form.id}`;
        navigator.clipboard.writeText(url).then(() => {
            setModal({ isOpen: true, message: 'Profile link copied to clipboard!', type: 'success' });
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await apiClient.post(API.USER_ME, {
                username: form.username,
                profile_image_public: form.profileImagePublic,
                unit: form.unit,
            });
            updateUser({ ...response.data, image_url: form.image_url });
            setModal({ isOpen: true, message: MESSAGES.PROFILE_UPDATE_SUCCESS, type: 'success' });
        } catch (error) {
            console.error(error);
            setModal({ isOpen: true, message: MESSAGES.PROFILE_UPDATE_ERROR, type: 'error' });
        }
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-12">
            <ModalMessage
                isOpen={modal?.isOpen || false}
                message={modal?.message || ''}
                type={modal?.type || 'success'}
                onClose={() => setModal(null)}
            />

            <div className="container mx-auto px-4 max-w-md">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-center">
                        {form.id && (
                            <ImageUpload
                                entityType="user"
                                entityId={form.id}
                                currentImageUrl={form.image_url}
                                onUploadSuccess={(url) => setForm({ ...form, image_url: url })}
                                circular
                                className="flex justify-center mb-3"
                            />
                        )}
                        <div className="flex items-center justify-center gap-3">
                            <h2 className="text-2xl font-bold text-white">My Profile</h2>
                            {form.id && (
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    title="Copy profile link"
                                    className="text-white/80 hover:text-white transition-colors"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                    </svg>
                                </button>
                            )}
                        </div>
                        <p className="text-blue-100 mt-1">Update your account details</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                value={form.username}
                                onChange={handleChange}
                                placeholder="Enter your name"
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                id="email"
                                name="email"
                                value={form.email}
                                readOnly
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Distance Unit</label>
                            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                                {(['km', 'mi'] as const).map(u => (
                                    <button
                                        key={u}
                                        type="button"
                                        onClick={() => setForm({ ...form, unit: u })}
                                        className={`flex-1 py-2 text-sm font-medium transition-colors ${
                                            form.unit === u ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        {u}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <label htmlFor="profileImagePublic" className="text-sm font-medium text-gray-700">
                                Show profile image publicly
                            </label>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={form.profileImagePublic}
                                onClick={() => setForm({ ...form, profileImagePublic: !form.profileImagePublic })}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                    form.profileImagePublic ? 'bg-blue-500' : 'bg-gray-300'
                                }`}
                            >
                                <span
                                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                        form.profileImagePublic ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                                />
                            </button>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>

                <div className="mt-6 bg-white rounded-2xl shadow-xl overflow-hidden">
                    <Link
                        to="/activity-types"
                        className="flex items-center gap-3 py-4 px-6 hover:bg-gray-50 text-gray-700 border-b border-gray-100"
                    >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        <span className="font-medium">Activity Types</span>
                    </Link>
                    <Link
                        to="/search"
                        className="flex items-center gap-3 py-4 px-6 hover:bg-gray-50 text-gray-700"
                    >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="font-medium">Search Entries</span>
                    </Link>
                </div>

                <div className="mt-4 text-center">
                    <Link
                        to="/"
                        className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
                        </svg>
                        Back
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
