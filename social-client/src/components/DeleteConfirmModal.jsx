import { Trash2, X } from "lucide-react";

export default function DeleteConfirmModal({ isOpen, onConfirm, onCancel, message = "Do you want to delete this post?" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
              <Trash2 size={15} className="text-red-500" />
            </div>
            <h2 className="text-base font-semibold text-gray-800">Delete Post</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          <p className="text-sm text-gray-600">{message}</p>
          <p className="text-xs text-gray-400 mt-1">This action cannot be undone.</p>
        </div>

        {/* Buttons */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}