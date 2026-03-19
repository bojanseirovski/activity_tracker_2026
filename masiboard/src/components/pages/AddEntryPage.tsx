import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ModalMessage from '../common/ModalMessage';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

interface ActivityType {
    id: number;
    name: string;
}

interface Entry {
    name: string;
    points: number;
    date?: string;
    activity_type_id: number | '';
}

const AddEntryPage: React.FC = () => {
    const { user } = useAuth();
    const [entry, setEntry] = useState<Entry>({
        name: user?.username || '',
        points: 0,
        date: new Date().toISOString().split('T')[0],
        activity_type_id: ''
    });
    const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
    const [modal, setModal] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' } | null>(null);

    useEffect(() => {
        apiClient.get(API.ACTIVITY_TYPES, { params: { userId: user?.id } })
            .then(res => setActivityTypes(res.data))
            .catch(() => setModal({ isOpen: true, message: MESSAGES.ACTIVITY_TYPE_LOAD_ERROR, type: 'error' }));
    }, [user?.id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setEntry({
            ...entry,
            [name]: name === 'points' || name === 'activityTypeId' ? Number(value) : value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            console.log(user);
            await apiClient.post(API.ENTRIES, { ...entry });
            setModal({ isOpen: true, message: MESSAGES.ENTRY_ADD_SUCCESS, type: 'success' });
            // Reset form after successful submission
            setEntry({
                name: user?.username || '',
                points: 0,
                date: new Date().toISOString().split('T')[0],
                activity_type_id: ''
            });
        } catch (error) {
            console.error(error);
            setModal({ isOpen: true, message: MESSAGES.ENTRY_ADD_ERROR, type: 'error' });
        }
    };

    const closeModal = () => {
        setModal(null);
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-12">
            {/* Modal */}
            <ModalMessage
                isOpen={modal?.isOpen || false}
                message={modal?.message || ''}
                type={modal?.type || 'success'}
                onClose={closeModal}
            />

            <div className="container mx-auto px-4 max-w-md">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-center">
                        <h2 className="text-2xl font-bold text-white">Add New Entry</h2>
                        <p className="text-blue-100 mt-1">Enter participant details</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                                Participant Name
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={entry.name}
                                readOnly
                                className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label htmlFor="activityTypeId" className="block text-sm font-medium text-gray-700 mb-1">
                                Activity Type
                            </label>
                            <select
                                id="activityTypeId"
                                name="activity_type_id"
                                value={entry.activity_type_id}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                            >
                                <option value="" disabled>Select an activity type</option>
                                {activityTypes.map(t => (
                                    <option key={t.id} value={t.id}>{t.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="points" className="block text-sm font-medium text-gray-700 mb-1">
                                Points
                            </label>
                            <input
                                type="number"
                                id="points"
                                name="points"
                                value={entry.points}
                                onChange={handleChange}
                                placeholder="Enter points"
                                min="0"
                                required
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                            />
                        </div>

                        <div>
                            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                                Date
                            </label>
                            <input
                                type="date"
                                id="date"
                                name="date"
                                value={entry.date || ''}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                            >
                                Add Entry
                            </button>
                        </div>
                    </form>
                </div>

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

export default AddEntryPage;
