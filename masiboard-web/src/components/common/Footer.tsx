import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-4 z-50">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-500">
            <span>© {new Date().getFullYear()} ActivityTracker.</span>
            <Link to="/terms" className="hover:text-blue-600 transition duration-150">Terms of Service</Link>
        </div>
    </footer>
);

export default Footer;
