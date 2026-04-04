import React from 'react';

interface ModalMessageProps {
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'confirm';
    onClose: () => void;
    onConfirm?: () => void;
}

const ModalMessage: React.FC<ModalMessageProps> = ({ isOpen, message, type, onClose, onConfirm }) => {
    if (!isOpen) return null;

    const isConfirm = type === 'confirm';

    const handleConfirm = () => {
        if (onConfirm) onConfirm();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`text-lg font-semibold ${
                        type === 'success' ? 'text-green-600' :
                        type === 'error' ? 'text-red-600' :
                        'text-gray-800'
                    }`}>
                        {type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Confirm'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <p className="text-gray-700 mb-6">{message}</p>
                <div className="flex justify-end space-x-2">
                    {isConfirm && (
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={isConfirm ? handleConfirm : onClose}
                        className={`px-4 py-2 rounded-md ${
                            type === 'success' ? 'bg-green-500 hover:bg-green-600 text-white' :
                            type === 'error' ? 'bg-red-500 hover:bg-red-600 text-white' :
                            'bg-blue-500 hover:bg-blue-600 text-white'
                        }`}
                    >
                        {isConfirm ? 'Confirm' : 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ModalMessage;
