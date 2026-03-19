import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';

interface SearchResult {
    name: string;
    points: number;
    activity_type_name: string;
}

const SearchFilterPage: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setHasSearched(true);
        setLoading(true);
        setError(null);

        try {
            const { data } = await apiClient.get(API.SEARCH, { params: { q: query } });
            setResults(data);
        } catch (err) {
            console.error('Search error:', err);
            setError(MESSAGES.SEARCH_ERROR);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-12">
            <div className="container mx-auto px-4 max-w-4xl">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold text-gray-800 mb-2">Search & Filter</h1>
                    <p className="text-gray-600">Find participants by name or filter by criteria</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
                    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-grow">
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search by name..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-semibold py-3 px-6 rounded-lg shadow-md transform transition-all duration-200 hover:scale-[1.02] disabled:opacity-70"
                        >
                            {loading ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 mb-8">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">
                                    {error}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {results.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-gray-800 mb-4">Search Results ({results.length})</h2>
                            <div className="space-y-4">
                                {results.map((result, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition duration-200"
                                    >
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-800">{result.name}</h3>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-gray-700">{result.activity_type_name}</p>
                                            <p className="text-gray-500 text-xs">Activity</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-gray-800">{result.points}</div>
                                            <p className="text-gray-600 text-sm">Points</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {hasSearched && !loading && results.length === 0 && !error && (
                    <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
                        <div className="text-gray-400 mb-4">
                            <svg className="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <h3 className="text-xl font-medium text-gray-900 mb-1">No results found</h3>
                        <p className="text-gray-500">No participants match your search for "{query}"</p>
                    </div>
                )}

                <div className="mt-8 text-center">
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

export default SearchFilterPage;
