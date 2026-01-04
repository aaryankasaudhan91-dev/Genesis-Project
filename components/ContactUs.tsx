
import React, { useState } from 'react';
import { User } from '../types';
import SupportChatModal from './SupportChatModal';

interface ContactUsProps {
  user: User;
  onBack: () => void;
}

const ContactUs: React.FC<ContactUsProps> = ({ user, onBack }) => {
  const [formData, setFormData] = useState({
    name: user.name || '',
    email: user.email || '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showAiChat, setShowAiChat] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
        setIsSubmitting(false);
        setSubmitted(true);
    }, 1500);
  };

  if (submitted) {
      return (
          <div className="max-w-2xl mx-auto pt-10 text-center animate-fade-in-up">
              <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-emerald-100">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-500 shadow-inner ring-1 ring-emerald-100">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Message Sent!</h2>
                  <p className="text-slate-500 mb-8 font-medium">Thank you for reaching out. We'll get back to you shortly.</p>
                  <button onClick={onBack} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 transition-all shadow-lg hover:-translate-y-0.5">Back to Dashboard</button>
              </div>
          </div>
      );
  }

  return (
    <div className="max-w-2xl mx-auto pb-12 animate-fade-in-up">
      <button onClick={onBack} className="mb-6 flex items-center text-slate-500 font-bold text-sm hover:text-emerald-600 transition-colors">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        Back to Dashboard
      </button>

      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100 relative">
        <div className="bg-slate-900 p-10 text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
             <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
             
             <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex-1">
                    <h2 className="text-3xl font-black tracking-tight mb-2">Contact Support</h2>
                    <p className="text-slate-400 font-medium max-w-sm leading-relaxed mb-6">We're here to help with any questions, technical issues, or feedback you might have.</p>
                    
                    <div className="flex flex-col md:flex-row gap-3">
                        <a href="tel:+918591095318" className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 px-5 py-3 rounded-2xl transition-all group">
                            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform shrink-0">
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Call Us Now</p>
                                <p className="text-lg font-bold text-white tracking-wide">+91 85910 95318</p>
                            </div>
                        </a>

                        <button onClick={() => setShowAiChat(true)} className="inline-flex items-center gap-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/10 px-5 py-3 rounded-2xl transition-all group text-left">
                            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform shrink-0">
                                 <span className="text-xl">🤖</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-blue-300">Instant Help</p>
                                <p className="text-lg font-bold text-white tracking-wide">Chat with AI</p>
                            </div>
                        </button>
                    </div>
                </div>
                <div className="hidden md:flex w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl items-center justify-center text-emerald-400 border border-white/10 shrink-0">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
             </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:p-10 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Name</label>
                    <input name="name" value={formData.name} onChange={handleChange} required className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all" />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all" />
                </div>
            </div>
            
            <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Subject</label>
                <div className="relative">
                     <select name="subject" value={formData.subject} onChange={handleChange} required className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all appearance-none cursor-pointer">
                        <option value="" disabled>Select a topic</option>
                        <option value="General Inquiry">General Inquiry</option>
                        <option value="Technical Issue">Technical Issue</option>
                        <option value="Report a User">Report a User</option>
                        <option value="Feedback">Feedback</option>
                     </select>
                     <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                     </div>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs font-black text-slate-400 uppercase ml-1 tracking-widest">Message</label>
                <textarea name="message" value={formData.message} onChange={handleChange} required rows={5} className="w-full px-5 py-4 border border-slate-200 bg-slate-50/50 rounded-2xl font-bold text-slate-800 focus:outline-none focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all resize-none" placeholder="How can we help you?"></textarea>
            </div>

            <div className="pt-4">
                <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl uppercase text-xs tracking-widest shadow-xl shadow-slate-200 transform hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:transform-none">
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Sending...
                        </>
                    ) : (
                        'Send Message'
                    )}
                </button>
            </div>
        </form>
      </div>

      {showAiChat && <SupportChatModal user={user} onClose={() => setShowAiChat(false)} />}
    </div>
  );
};

export default ContactUs;
