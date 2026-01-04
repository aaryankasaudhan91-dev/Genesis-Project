
import React, { useState, useEffect, useRef } from 'react';
import { User, FoodPosting, ChatMessage, UserRole } from '../types';
import { storage } from '../services/storageService';

interface ChatModalProps {
  posting: FoodPosting;
  user: User;
  onClose: () => void;
}

const ChatModal: React.FC<ChatModalProps> = ({ posting, user, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initial load
    setMessages(storage.getMessages(posting.id));
    
    // Polling for new messages (simulating real-time socket)
    const interval = setInterval(() => {
        const storedMsgs = storage.getMessages(posting.id);
        if (storedMsgs.length !== messages.length) {
            setMessages(storedMsgs);
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [posting.id, messages.length]);

  useEffect(() => { 
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user) return;
    
    const msg: ChatMessage = { 
        id: Math.random().toString(36).substr(2, 9), 
        postingId: posting.id, 
        senderId: user.id, 
        senderName: user.name || 'Unknown', 
        senderRole: user.role, 
        text: inputText.trim(), 
        createdAt: Date.now() 
    };
    
    storage.saveMessage(posting.id, msg);
    setMessages(prev => [...prev, msg]);
    setInputText('');
  };

  const formatTime = (timestamp: number) => {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRoleBadge = (role: UserRole) => {
      switch(role) {
          case UserRole.DONOR: return 'bg-emerald-100 text-emerald-700';
          case UserRole.VOLUNTEER: return 'bg-blue-100 text-blue-700';
          case UserRole.REQUESTER: return 'bg-orange-100 text-orange-700';
          default: return 'bg-slate-100 text-slate-700';
      }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white rounded-[2rem] w-full max-w-md h-[650px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-900 p-5 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-xl backdrop-blur-md border border-white/10">
                    💬
                </div>
                <div>
                    <h3 className="font-black text-white text-sm uppercase tracking-wide line-clamp-1">{posting.foodName}</h3>
                    <p className="text-slate-400 text-xs font-medium">Group Chat</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
          {messages.length === 0 && (
              <div className="text-center py-10 opacity-50">
                  <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">👋</div>
                  <p className="text-sm font-bold text-slate-500">No messages yet.<br/>Start the conversation!</p>
              </div>
          )}
          
          {messages.map((m, index) => {
            const isMe = m.senderId === user.id;
            const showName = index === 0 || messages[index-1].senderId !== m.senderId;

            return (
                <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    {(!isMe && showName) && (
                        <div className="flex items-center gap-2 mb-1 ml-1">
                            <span className="text-[10px] font-bold text-slate-500">{m.senderName.split(' ')[0]}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black uppercase ${getRoleBadge(m.senderRole)}`}>{m.senderRole}</span>
                        </div>
                    )}
                    <div 
                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm relative shadow-sm ${
                            isMe 
                            ? 'bg-slate-800 text-white rounded-tr-none' 
                            : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                        }`}
                    >
                        <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
                        <p className={`text-[9px] font-bold mt-1 text-right ${isMe ? 'text-slate-400' : 'text-slate-300'}`}>
                            {formatTime(m.createdAt)}
                        </p>
                    </div>
                </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} className="p-4 bg-white border-t border-slate-100 shrink-0">
            <div className="flex gap-2 items-end">
                <input 
                    type="text" 
                    value={inputText} 
                    onChange={e => setInputText(e.target.value)} 
                    placeholder="Type a message..." 
                    className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400 p-4 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all" 
                />
                <button 
                    type="submit" 
                    disabled={!inputText.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white p-4 rounded-2xl transition-all shadow-lg shadow-emerald-200 disabled:shadow-none"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default ChatModal;
