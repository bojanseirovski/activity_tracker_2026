import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { user } = useAuth();

    const navItems = user
        ? [
            { name: 'Activities', path: '/' },
            { name: 'Search', path: '/search' },
            { name: 'Activity Types', path: '/activity-types' },
            { name: 'Challenges', path: '/challenges' },
            { name: 'Teams', path: '/teams' },
            { name: 'Add Entry', path: '/entries/add' },
            { name: 'Profile', path: '/profile' },
            { name: 'Logout', path: '/logout' },
        ]
        : [
            { name: 'Login', path: '/login' },
            { name: 'Register', path: '/register' },
        ];

    const getInitials = (name: string) =>
        (name || '').split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);

    return (
        <nav className="bg-white border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <div className="flex items-center">
                        <Link to="/">
                            <img src="/logo192.png" alt="ActivityTracker2026" className="h-8 w-8" />
                        </Link>
                    </div>

                    <span className="text-lg font-bold text-gray-800">ActivityTracker2026</span>

                    <div className="flex items-center gap-3">
                        {user && (
                            <Link to="/search" className="text-gray-600 hover:text-indigo-600" title="Search">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                                </svg>
                            </Link>
                        )}
                        {user ? (
                            <div
                                className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold cursor-pointer select-none"
                                onClick={() => setIsMenuOpen(!isMenuOpen)}
                                aria-expanded={isMenuOpen}
                            >
                                {getInitials(user.username || user.name)}
                            </div>
                        ) : (
                            <div className="h-8 w-8" />
                        )}
                    </div>
                </div>
            </div>

            {/* Dropdown Menu */}
            {isMenuOpen && (
                <div>
                    <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white shadow-lg rounded-b-lg">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-indigo-600 hover:bg-gray-50"
                                onClick={() => setIsMenuOpen(false)} // Close menu when clicking a link
                            >
                                {item.name}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </nav>
    );
};

export default Navbar;