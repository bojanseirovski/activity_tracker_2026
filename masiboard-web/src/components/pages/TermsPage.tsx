import React from 'react';
import { Link } from 'react-router-dom';

const TermsPage: React.FC = () => {
    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-12">
            <div className="container mx-auto px-4 max-w-3xl">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 text-center">
                        <h1 className="text-2xl font-bold text-white">Terms of Service</h1>
                        <p className="text-blue-100 mt-1">Please read these terms carefully before using the app</p>
                    </div>

                    <div className="p-8 space-y-8 text-gray-700">

                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Acceptance of Terms</h2>
                            <p className="text-sm leading-relaxed">
                                By registering for or using this application, you agree to be bound by these Terms of Service.
                                If you do not agree to these terms, you may not access or use the app.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Real Names Required</h2>
                            <p className="text-sm leading-relaxed">
                                You must register using your real, legal name. Fictitious names, pseudonyms, or
                                impersonations of other individuals are strictly prohibited. Any account found to be using
                                a false identity may be suspended or permanently removed without notice.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">3. Valid Email Address</h2>
                            <p className="text-sm leading-relaxed">
                                You must provide a real, valid email address that you own and have access to. Disposable,
                                temporary, or falsified email addresses are not permitted. Your email address may be used
                                for account-related communications and verification purposes.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Accuracy of Activity Data</h2>
                            <p className="text-sm leading-relaxed">
                                You are solely responsible for the accuracy and completeness of any activity entries,
                                points, or other data you submit. The app does not verify the correctness of user-submitted
                                data. Submitting false, exaggerated, or misleading activity records undermines the fairness
                                of the leaderboard and may result in account suspension.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Disclaimer of Liability</h2>
                            <p className="text-sm leading-relaxed">
                                This application is provided <strong>"as is"</strong> without warranties of any kind,
                                express or implied. We are not responsible for:
                            </p>
                            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                                <li>Loss, corruption, or deletion of any data, including activity entries and account information</li>
                                <li>Inaccuracies or errors in data displayed within the application</li>
                                <li>Service interruptions, downtime, or technical failures</li>
                                <li>Any direct, indirect, incidental, or consequential damages arising from your use of the app</li>
                            </ul>
                            <p className="text-sm leading-relaxed mt-2">
                                You use this application at your own risk. We strongly recommend keeping your own records
                                of any important activity data independently of this app.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Account Security</h2>
                            <p className="text-sm leading-relaxed">
                                You are responsible for maintaining the confidentiality of your account credentials.
                                You agree to notify us immediately of any unauthorized use of your account. We are not
                                liable for any loss or damage arising from your failure to protect your login information.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Changes to Terms</h2>
                            <p className="text-sm leading-relaxed">
                                We reserve the right to update or modify these Terms of Service at any time. Continued
                                use of the application after any changes constitutes your acceptance of the new terms.
                            </p>
                        </section>

                        <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 text-center">
                            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                </div>

                <div className="mt-6 text-center">
                    <Link
                        to="/register"
                        className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Register
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default TermsPage;
