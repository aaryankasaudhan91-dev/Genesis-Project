
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { User } from '../types';

interface SupportChatModalProps {
  user: User;
  onClose: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
}

const SupportChatModal: React.FC<SupportChatModalProps> = ({ user, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello ${user.name.split(' ')[0]}! 👋 I'm your AI Support Assistant. Ask me anything about using MEALers connect!`,
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<any>(null);

  useEffect(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    chatSessionRef.current = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: `You are the friendly and helpful AI Support Agent for 'MEALers connect', a food rescue application. 
        
        App Overview:
        - MEALers connect connects Food Donors (Restaurants, etc.), Volunteers, and Requesters (Orphanages/Shelters).
        - Goal: Reduce food waste and hunger.
        
        Key Features & Troubleshooting:
        1. Donors: Can post food details, photo (AI safety check), quantity, location. Must verify pickup proofs from volunteers.
        2. Volunteers: Browse 'Find Food', accept missions, navigate to pickup, upload pickup proof, navigate to dropoff, upload delivery proof.
        3. Requesters: Browse available food, request pickup (if volunteer needed), or see incoming deliveries. Must verify delivery proofs.
        4. Verification: 2-step photo verification (Pickup & Delivery) ensures security. AI checks photos.
        5. Impact Points: Earned by Donors and Volunteers for successful cycles.
        
        Support Info:
        - If a user has a technical error, suggest refreshing or checking internet.
        - For urgent issues or if you cannot help, tell them to call Human Support at +91 85910 95318.
        
        Tone: Professional, empathetic, concise, and using emojis occasionally.`,
      },
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: inputText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      if (chatSessionRef.current) {
          const result = await chatSessionRef.current.sendMessage({ message: userMsg.text });
          setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: result.text, timestamp: Date.now() }]);
      }
    } catch (err) {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: "I'm having trouble connecting to the server. Please try again later.", timestamp: Date.now() }]);
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white rounded-[2rem] w-full max-w-md h-[600px] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-xl backdrop-blur-md border border-white/10">🤖</div>
                <div>
                    <h3 className="font-black text-white text-sm uppercase tracking-wide">AI Support</h3>
                    <p className="text-slate-400 text-xs font-medium">Always here to help</p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
            {messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${m.sender === 'user' ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                        {m.text}
                    </div>
                </div>
            ))}
            {isTyping && (
                <div className="flex justify-start">
                    <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-100"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-200"></span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-2">
            <input 
                type="text" 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                placeholder="Type your question..." 
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
            />
            <button type="submit" disabled={!inputText.trim() || isTyping} className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-lg shadow-emerald-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
        </form>
      </div>
    </div>
  );
};

export default SupportChatModal;
