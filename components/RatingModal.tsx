
import React, { useState } from 'react';

interface RatingModalProps {
  targetName: string;
  title?: string;
  onSubmit: (rating: number, feedback: string) => void;
  onClose: () => void;
}

const RatingModal: React.FC<RatingModalProps> = ({ targetName, title = "Rate Experience", onSubmit, onClose }) => {
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    onSubmit(rating, feedback);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl scale-100 transition-transform animate-fade-in-up">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-yellow-50 text-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
             <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
          </div>
          <h3 className="text-xl font-black text-slate-800">{title}</h3>
          <p className="text-slate-500 text-sm font-medium">How was your experience with <span className="text-slate-800 font-bold">{targetName}</span>?</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="focus:outline-none transition-transform hover:scale-110 active:scale-90"
                    >
                        <svg className={`w-10 h-10 ${rating >= star ? 'text-yellow-400' : 'text-slate-200'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </button>
                ))}
            </div>

            <textarea 
                placeholder="Any additional feedback? (Optional)"
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                className="w-full p-4 border border-slate-200 bg-slate-50 rounded-2xl font-bold text-sm h-24 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
            />

            <div className="flex gap-3">
              <button 
                type="button"
                onClick={onClose} 
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl transition-colors uppercase text-xs tracking-wider"
              >
                Skip
              </button>
              <button 
                type="submit"
                disabled={rating === 0}
                className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black rounded-2xl transition-colors shadow-lg shadow-slate-200 uppercase text-xs tracking-wider"
              >
                Submit
              </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default RatingModal;
