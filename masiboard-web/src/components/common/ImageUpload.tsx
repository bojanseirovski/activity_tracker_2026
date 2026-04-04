import React, { useState, useRef } from 'react';
import apiClient from '../../api/client';
import { API } from '../../constants/api';

interface ImageUploadProps {
    entityType: 'user' | 'activity_type' | 'challenge' | 'team' | 'entry';
    entityId: number;
    currentImageUrl?: string | null;
    onUploadSuccess: (url: string) => void;
    circular?: boolean;
    className?: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const ImageUpload: React.FC<ImageUploadProps> = ({
    entityType,
    entityId,
    currentImageUrl,
    onUploadSuccess,
    circular = false,
    className = '',
}) => {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!ALLOWED_TYPES.includes(file.type)) {
            setError('Only JPEG, PNG, WebP, and GIF images are allowed');
            return;
        }
        if (file.size > MAX_SIZE) {
            setError('Image must be under 5MB');
            return;
        }

        setError(null);
        setUploading(true);

        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('entity_type', entityType);
            formData.append('entity_id', String(entityId));

            const { data } = await apiClient.post(API.IMAGE_UPLOAD, formData);
            onUploadSuccess(data.url);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to upload image');
        } finally {
            setUploading(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    const shape = circular ? 'rounded-full' : 'rounded-lg';

    return (
        <div className={className}>
            <div
                className={`relative w-20 h-20 ${shape} overflow-hidden cursor-pointer group bg-gray-200`}
                onClick={handleClick}
            >
                {currentImageUrl ? (
                    <img
                        src={currentImageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                )}

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploading ? (
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div>
                    ) : (
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    )}
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </div>
    );
};

export default ImageUpload;
