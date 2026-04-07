import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { API } from '../../constants/api';
import { MESSAGES } from '../../constants/messages';
import ErrorMessage from '../common/ErrorMessage';
import ModalMessage from '../common/ModalMessage';
import ImageUpload from '../common/ImageUpload';
import TrackMap from '../map/TrackMap';
import { formatDistance } from '../../utils/distance';

interface EntryDetail {
    id: number;
    name: string;
    points: number;
    date: string;
    activityTypeId: number | null;
    userId: number;
    activity_type: string | null;
    image_url: string | null;
    unit?: string;
    tracking_data?: { latitude: number; longitude: number; speed?: number | null; altitude?: number | null }[] | null;
}

interface LikesData {
    count: number;
    liked_by_me: boolean;
    users: { user_id: number; username: string }[];
}

type ModalState = { isOpen: boolean; message: string; type: 'success' | 'error' | 'confirm'; onConfirm?: () => void } | null;

function avgSpeed(data: { speed?: number | null }[]): string {
    const speeds = data.map(c => c.speed).filter((s): s is number => s != null && s >= 0);
    if (!speeds.length) return '--';
    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    return `${(avg * 3.6).toFixed(1)} km/h`;
}

function elevationGain(data: { altitude?: number | null }[]): string {
    const alts = data.map(c => c.altitude).filter((a): a is number => a != null);
    if (alts.length < 2) return '--';
    let gain = 0;
    for (let i = 1; i < alts.length; i++) {
        if (alts[i] > alts[i - 1]) gain += alts[i] - alts[i - 1];
    }
    return `+${Math.round(gain)} m`;
}

const EntryPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [entry, setEntry] = useState<EntryDetail | null>(null);
    const [likes, setLikes] = useState<LikesData | null>(null);
    const [gallery, setGallery] = useState<{ id: number; url: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<ModalState>(null);
    const [editingPoints, setEditingPoints] = useState(false);
    const [editPoints, setEditPoints] = useState(0);
    const [galleryUploading, setGalleryUploading] = useState(false);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const fetchData = () => {
        setLoading(true);
        setError(null);
        const eid = Number(id);
        Promise.all([
            apiClient.get(API.ENTRY(eid)),
            apiClient.get(API.ENTRY_LIKES(eid)),
            apiClient.get(API.IMAGES('entry', eid)),
        ])
            .then(([entryRes, likesRes, galleryRes]) => {
                setEntry(entryRes.data);
                setLikes(likesRes.data);
                setGallery(galleryRes.data);
            })
            .catch(() => setError(MESSAGES.ENTRY_LOAD_ERROR))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchData(); }, [id]);

    const handleLikeToggle = async () => {
        if (!entry || !likes) return;
        const wasLiked = likes.liked_by_me;
        setLikes(prev => prev ? { ...prev, liked_by_me: !wasLiked, count: prev.count + (wasLiked ? -1 : 1) } : prev);
        try {
            if (wasLiked) {
                await apiClient.delete(API.ENTRY_LIKES(entry.id));
            } else {
                await apiClient.post(API.ENTRY_LIKES(entry.id));
            }
        } catch {
            setLikes(prev => prev ? { ...prev, liked_by_me: wasLiked, count: prev.count + (wasLiked ? 1 : -1) } : prev);
        }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            setModal({ isOpen: true, message: 'Entry link copied to clipboard!', type: 'success' });
        });
    };

    const handleUpdate = async () => {
        if (!entry) return;
        try {
            const { data } = await apiClient.put(API.ENTRY(entry.id), {
                points: editPoints,
                date: entry.date,
                userId: user?.id,
            });
            setEntry(prev => prev ? { ...prev, points: data.points } : prev);
            setEditingPoints(false);
            setModal({ isOpen: true, message: MESSAGES.ENTRY_UPDATE_SUCCESS, type: 'success' });
        } catch {
            setModal({ isOpen: true, message: MESSAGES.ENTRY_UPDATE_ERROR, type: 'error' });
        }
    };

    const performDelete = async () => {
        if (!entry) return;
        try {
            await apiClient.delete(API.ENTRY(entry.id), { params: { userId: user?.id } });
            setModal({
                isOpen: true,
                message: MESSAGES.ENTRY_DELETE_SUCCESS,
                type: 'success',
            });
            setTimeout(() => navigate('/'), 1200);
        } catch {
            setModal({ isOpen: true, message: MESSAGES.ENTRY_DELETE_ERROR, type: 'error' });
        }
    };

    const handleDelete = () => {
        setModal({
            isOpen: true,
            message: MESSAGES.ENTRY_DELETE_CONFIRM,
            type: 'confirm',
            onConfirm: performDelete,
        });
    };

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !entry) return;
        setGalleryUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('entity_type', 'entry');
            formData.append('entity_id', String(entry.id));
            const { data } = await apiClient.post(API.IMAGE_UPLOAD, formData);
            setGallery(prev => [...prev, { id: data.id, url: data.url }]);
        } catch {
            setModal({ isOpen: true, message: 'Failed to upload image', type: 'error' });
        } finally {
            setGalleryUploading(false);
            if (galleryInputRef.current) galleryInputRef.current.value = '';
        }
    };

    const handleGalleryDelete = async (imageId: number) => {
        try {
            await apiClient.delete(API.IMAGE_DELETE(imageId));
            setGallery(prev => prev.filter(img => img.id !== imageId));
        } catch {
            setModal({ isOpen: true, message: 'Failed to delete image', type: 'error' });
        }
    };

    const isOwner = user && entry && user.id === entry.userId;
    const trackingPoints = entry?.tracking_data ?? null;
    const hasMap = Array.isArray(trackingPoints) && trackingPoints.length >= 2;
    const unit = entry?.unit ?? 'km';

    return (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen py-12">
            <ModalMessage
                isOpen={modal?.isOpen || false}
                message={modal?.message || ''}
                type={modal?.type || 'success'}
                onClose={() => setModal(null)}
                onConfirm={modal?.onConfirm}
            />

            <div className="container mx-auto px-4 max-w-2xl space-y-3">
                <div className="mt-3 text-center">
                    <Link to="/" className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back
                    </Link>
                </div>
                {loading && (
                    <div className="flex justify-center items-center h-64 bg-white rounded-2xl shadow-xl">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                )}
                {error && <ErrorMessage message={error} onReload={fetchData} />}

                {!loading && !error && entry && (
                    <div className="space-y-6">
                        {/* Header card */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6">
                                <div className="flex items-center gap-4 mb-2">
                                    {isOwner ? (
                                        <ImageUpload
                                            entityType="entry"
                                            entityId={entry.id}
                                            currentImageUrl={entry.image_url}
                                            onUploadSuccess={(url) => setEntry(prev => prev ? { ...prev, image_url: url } : prev)}
                                        />
                                    ) : entry.image_url ? (
                                        <img src={entry.image_url} alt="" className="w-20 h-20 rounded-lg object-cover" />
                                    ) : null}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Link
                                                to={"/users/" + entry.userId}
                                                className="font-semibold px-6 py-3 rounded-full shadow-lg "
                                            >
                                                <h1 className="font-bold text-white">{entry.name}</h1>
                                            </Link>

                                            <button onClick={handleShare} title="Share" className="text-white/80 hover:text-white">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                                </svg>
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            {entry.activity_type && (
                                                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-white bg-opacity-20 text-white">
                                                    {entry.activity_type}
                                                </span>
                                            )}
                                            <span className="text-blue-100 text-sm">{new Date(entry.date).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Map */}
                            {hasMap && (
                                <div style={{ height: 300 }}>
                                    <TrackMap path={trackingPoints!} />
                                </div>
                            )}

                            <div className="p-6">
                                {/* Metrics grid */}
                                <div className={`grid gap-4 mb-6 ${hasMap ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2'}`}>
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        {editingPoints ? (
                                            <div className="space-y-2">
                                                <input
                                                    type="number"
                                                    value={editPoints}
                                                    onChange={(e) => setEditPoints(Number(e.target.value))}
                                                    className="w-full px-2 py-1 border border-gray-300 rounded-md text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <div className="flex gap-2 justify-center">
                                                    <button onClick={handleUpdate} className="text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md">Save</button>
                                                    <button onClick={() => setEditingPoints(false)} className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded-md">Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <p className="text-3xl font-bold text-gray-800">{formatDistance(entry.points, unit)}</p>
                                                <p className="text-sm text-gray-500 mt-1">{unit}</p>
                                            </>
                                        )}
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                                        <p className="text-3xl font-bold text-gray-800">{likes?.count ?? 0}</p>
                                        <p className="text-sm text-gray-500 mt-1">Likes</p>
                                    </div>
                                    {hasMap && (
                                        <>
                                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                                <p className="text-3xl font-bold text-gray-800">{avgSpeed(trackingPoints!)}</p>
                                                <p className="text-sm text-gray-500 mt-1">Avg Speed</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                                <p className="text-3xl font-bold text-gray-800">{elevationGain(trackingPoints!)}</p>
                                                <p className="text-sm text-gray-500 mt-1">Elevation</p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Like button */}
                                {user && user.id !== entry.userId && likes && (
                                    <button
                                        onClick={handleLikeToggle}
                                        className={`w-full py-3 px-4 rounded-lg font-semibold transition duration-200 flex items-center justify-center gap-2 ${likes.liked_by_me
                                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                                                : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md'
                                            }`}
                                    >
                                        {likes.liked_by_me ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                            </svg>
                                        )}
                                        {likes.liked_by_me ? 'Unlike' : 'Like'}
                                    </button>
                                )}

                                {/* Owner actions */}
                                {isOwner && (
                                    <div className="flex gap-3 mt-4">
                                        {!editingPoints && (
                                            <button
                                                onClick={() => { setEditPoints(entry.points); setEditingPoints(true); }}
                                                className="flex-1 py-2 px-4 rounded-lg font-semibold transition duration-200 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                                            >
                                                Edit Points
                                            </button>
                                        )}
                                        <button
                                            onClick={handleDelete}
                                            className="flex-1 py-2 px-4 rounded-lg font-semibold transition duration-200 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200"
                                        >
                                            Delete Entry
                                        </button>
                                    </div>
                                )}

                                {/* Liked by */}
                                {likes && likes.users.length > 0 && (
                                    <div className="mt-6">
                                        <h3 className="text-sm font-medium text-gray-700 mb-3">Liked by</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {likes.users.map(u => (
                                                <Link
                                                    key={u.user_id}
                                                    to={`/users/${u.user_id}`}
                                                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition duration-150"
                                                >
                                                    {u.username}
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Photo gallery */}
                                {(gallery.length > 0 || isOwner) && (
                                    <div className="mt-6">
                                        <h3 className="text-sm font-medium text-gray-700 mb-3">Photos</h3>
                                        <div className="grid grid-cols-3 gap-2">
                                            {gallery.map(img => (
                                                <div key={img.id} className="relative">
                                                    <img
                                                        src={img.url}
                                                        alt=""
                                                        className="w-full aspect-square object-cover rounded-lg"
                                                    />
                                                    {isOwner && (
                                                        <button
                                                            onClick={() => handleGalleryDelete(img.id)}
                                                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs leading-none"
                                                            title="Delete photo"
                                                        >
                                                            ×
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                            {isOwner && (
                                                <>
                                                    <button
                                                        onClick={() => galleryInputRef.current?.click()}
                                                        disabled={galleryUploading}
                                                        className="aspect-square rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-400 transition-colors disabled:opacity-50"
                                                        title="Add photo"
                                                    >
                                                        {galleryUploading ? (
                                                            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-400 border-t-transparent" />
                                                        ) : (
                                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                    <input
                                                        ref={galleryInputRef}
                                                        type="file"
                                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                                        onChange={handleGalleryUpload}
                                                        className="hidden"
                                                    />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
};

export default EntryPage;
