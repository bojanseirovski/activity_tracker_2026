import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import ModalMessage from '../common/ModalMessage';
import apiClient from '../../api/client';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

const ForgotPasswordPage: React.FC = () => {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [modal, setModal] = useState<{ isOpen: boolean; message: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await apiClient.post(API.FORGOT_PASSWORD, { email });
            setSent(true);
        } catch {
            setModal({ isOpen: true, message: MESSAGES.FORGOT_PASSWORD_ERROR });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-12">
            <ModalMessage
                isOpen={modal?.isOpen || false}
                message={modal?.message || ''}
                type="error"
                onClose={() => setModal(null)}
            />

            <div className="container mx-auto px-4 max-w-md">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-center">
                        <h2 className="text-2xl font-bold text-white">Forgot Password</h2>
                        <p className="text-blue-100 mt-1">We'll send you a reset link</p>
                    </div>

                    <div className="p-6">
                        {sent ? (
                            <div className="text-center py-6">
                                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <p className="text-gray-700 font-medium">{MESSAGES.FORGOT_PASSWORD_SUCCESS}</p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="your@email.com"
                                        required
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                                    />
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className={`w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-4 rounded-lg shadow-md transform transition-all duration-200 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
                                    >
                                        {loading ? 'Sending...' : 'Send Reset Link'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>

                    <div className="px-6 py-4 bg-gray-50 text-center">
                        <p className="text-sm text-gray-600">
                            Remember your password?{' '}
                            <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
