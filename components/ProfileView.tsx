
import React, { useState, useRef } from 'react';
import { User, UserRole } from '../types';
import { generateAvatar } from '../services/geminiService';

interface ProfileViewProps {
  user: User;
  onUpdate: (updates: Partial<User>) => void;
  onBack: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ user, onUpdate, onBack }) => {
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [contactNo, setContactNo] = useState(user?.contactNo || '');
  const [profilePictureUrl, setProfilePictureUrl] = useState(user?.profilePictureUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (contactNo && !/^\d{10}$/.test(contactNo)) {
      alert("Please enter a valid 10-digit Contact Number.");
      return;
    }
    onUpdate({ name, email, contactNo, profilePictureUrl });
    alert("Profile updated!");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePictureUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateAvatar = async () => {
    setIsGenerating(true);
    const generatedUrl = await generateAvatar(name);
    if (generatedUrl) {
      setProfilePictureUrl(generatedUrl);
    } else {
      alert("Failed to generate avatar. Please try again.");
    }
    setIsGenerating(false);
  };

  return (
    <div className="max-w-2xl mx-auto pb-12 animate-fade-in-up">
      <button onClick={onBack} className="mb-6 flex items-center text-slate-500 font-bold text-sm hover:text-emerald-600 transition-colors">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        Back to Dashboard
      </button>
      
      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
        <div className="relative h-48 bg-gradient-to-r from-emerald-600 to-teal-500">
            <div className="absolute inset-0 bg-white/10 pattern-dots"></div>
            <div className="absolute -bottom-12 left-8 group">
                <div className="w-24 h-24 bg-white rounded-3xl p-1 shadow-lg relative overflow-hidden">
                    {profilePictureUrl ? (
                      <img src={profilePictureUrl} alt="Profile" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 rounded-2xl flex items-center justify-center text-3xl font-black text-emerald-600">
                          {name.charAt(0)}
                      </div>
                    )}
                    
                    {/* Hover Overlay for quick edit hint */}
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-2xl" onClick={() => fileInputRef.current?.click()}>
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </div>
                </div>
            </div>
            
            {/* Rating Stat (Only for Volunteers) */}
            {user?.role === UserRole.VOLUNTEER && (
                <div className="absolute bottom-4 right-8 bg-white/20 backdrop-blur-md rounded-2xl p-3 flex gap-4 text-white border border-white/20">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 font-black text-xl">
                            {user.averageRating ? user.averageRating.toFixed(1) : '0.0'}
                            <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase opacity-80">Rating</span>
                    </div>
                    <div className="w-px bg-white/20"></div>
                    <div className="text-center">
                        <div className="font-black text-xl">{user.ratingsCount || 0}</div>
                        <span className="text-[10px] font-bold uppercase opacity-80">Reviews</span>
                    </div>
                </div>
            )}

            {/* Impact Score (Only for Donors) */}
            {user?.role === UserRole.DONOR && (
                <div className="absolute bottom-4 right-8 bg-white/20 backdrop-blur-md rounded-2xl p-3 flex gap-4 text-white border border-white/20">
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 font-black text-xl">
                            {user.impactScore || 0}
                            <svg className="w-4 h-4 text-emerald-300" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>
                        </div>
                        <span className="text-[10px] font-bold uppercase opacity-80">Lives Touched</span>
                    </div>
                </div>
            )}
        </div>
        
        <div className="pt-16 px-8 pb-8">
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h2 className="text-3xl font-black text-slate-800">{name}</h2>
                    <p className="text-slate-500 font-medium text-sm">{user?.role}</p>
                </div>
                <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider">
                    {user?.role} Account
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Profile Picture Controls */}
              <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleFileUpload} 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Upload Photo
                </button>
                <div className="text-xs text-slate-400 font-bold uppercase">OR</div>
                <button 
                  type="button" 
                  onClick={handleGenerateAvatar}
                  disabled={isGenerating}
                  className="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl text-xs font-bold hover:shadow-lg hover:opacity-90 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Magic...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Generate AI Avatar
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500 uppercase ml-1">Full Name</label>
                 <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email Address</label>
                 <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" />
              </div>
              <div className="space-y-2">
                 <label className="text-xs font-bold text-slate-500 uppercase ml-1">Contact Number</label>
                 <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                        <span className="text-slate-500 font-bold text-sm border-r border-slate-300 pr-2">+91</span>
                    </div>
                    <input 
                        type="tel" 
                        maxLength={10}
                        value={contactNo} 
                        onChange={e => {
                            const val = e.target.value.replace(/\D/g, '');
                            if(val.length <= 10) setContactNo(val);
                        }}
                        className="w-full pl-20 pr-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" 
                    />
                 </div>
              </div>

              <div className="pt-4">
                  <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-lg shadow-slate-200 transform active:scale-95 transition-all">
                    Save Changes
                  </button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
