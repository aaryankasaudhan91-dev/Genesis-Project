
import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';
import { askWithSearch, askWithMaps, askWithThinking } from '../services/geminiService';
import { GoogleGenAI } from "@google/genai";

interface SupportChatModalProps {
  user: User;
  onClose: () => void;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: number;
  sources?: any[];
}

const SupportChatModal: React.FC<SupportChatModalProps> = ({ user, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `Hello ${user.name.split(' ')[0]}! 👋 I'm RescueBot. Ask me about food safety, regulations, or find nearby food banks.`,
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [mode, setMode] = useState<'support' | 'search' | 'maps' | 'thinking'>('support');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
      let aiText = "";
      let sources: any[] = [];

      if (mode === 'search') {
          const result = await askWithSearch(userMsg.text);
          aiText = result.text;
          sources = result.sources;
      } else if (mode === 'maps') {
          const location = user.address?.lat && user.address?.lng ? { lat: user.address.lat, lng: user.address.lng } : undefined;
          const result = await askWithMaps(userMsg.text, location);
          aiText = result.text;
          sources = result.sources;
      } else if (mode === 'thinking') {
          const context = `Name: ${user.name}, Role: ${user.role}`;
          aiText = await askWithThinking(userMsg.text, context);
      } else {
          // Default Support Mode
          const apiKey = process.env.API_KEY;
          if (!apiKey) throw new Error("API Key missing");
          const ai = new GoogleGenAI({ apiKey });
          const systemPrompt = `
            You are "RescueBot", the AI support agent for 'MEALers connect'.
            Current User Context: Name: ${user.name}, Role: ${user.role}.
            Guidelines: Be friendly, concise, and solution-oriented.
          `;
          const history = messages.filter(m => !m.sources).slice(-6).map(m => ({
              role: m.sender === 'user' ? 'user' : 'model',
              parts: [{ text: m.text }]
          }));
          const chat = ai.chats.create({
              model: 'gemini-3-flash-preview',
              history: history,
              config: { systemInstruction: systemPrompt, maxOutputTokens: 300, temperature: 0.7 }
          });
          const result = await chat.sendMessage({ message: userMsg.text });
          aiText = result.text || "I didn't catch that.";
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: aiText, timestamp: Date.now(), sources }]);
    } catch (err) {
        console.error(err);
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: "Service temporarily unavailable.", timestamp: Date.now() }]);
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white rounded-[2rem] w-full max-w-md h-[600px] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 shrink-0">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-xl backdrop-blur-md border border-white/10">🤖</div>
                    <div>
                        <h3 className="font-black text-white text-sm uppercase tracking-wide">RescueBot</h3>
                        <p className="text-slate-400 text-xs font-medium">
                            {mode === 'search' ? 'Web Search Mode' : mode === 'maps' ? 'Maps Mode' : mode === 'thinking' ? 'Deep Reasoning Mode' : 'Support Mode'}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            {/* Mode Toggles */}
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                <button onClick={() => setMode('support')} className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${mode === 'support' ? 'bg-white text-slate-900' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}>Support</button>
                <button onClick={() => setMode('thinking')} className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${mode === 'thinking' ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}>Deep Think</button>
                <button onClick={() => setMode('search')} className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${mode === 'search' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}>Web</button>
                <button onClick={() => setMode('maps')} className={`flex-1 py-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${mode === 'maps' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}>Maps</button>
            </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
            {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${m.sender === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                        {m.text}
                    </div>
                    {/* Sources Display */}
                    {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 max-w-[85%] space-y-2">
                            {m.sources.map((chunk: any, idx: number) => {
                                if (chunk.web?.uri) {
                                    return (
                                        <a key={idx} href={chunk.web.uri} target="_blank" rel="noreferrer" className="block bg-blue-50 border border-blue-100 p-2 rounded-lg text-xs hover:bg-blue-100 transition-colors">
                                            <p className="font-bold text-blue-800 truncate">{chunk.web.title}</p>
                                            <p className="text-blue-500 truncate">{chunk.web.uri}</p>
                                        </a>
                                    );
                                }
                                if (chunk.maps?.uri) {
                                     return (
                                        <a key={idx} href={chunk.maps.uri} target="_blank" rel="noreferrer" className="block bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-xs hover:bg-emerald-100 transition-colors">
                                            <p className="font-bold text-emerald-800 truncate">{chunk.maps.title}</p>
                                            <p className="text-emerald-500 truncate">View on Maps</p>
                                        </a>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    )}
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
                placeholder={mode === 'search' ? "Ask Google..." : mode === 'maps' ? "Find places..." : mode === 'thinking' ? "Ask complex question..." : "Type your question..."}
                className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-500 transition-all" 
            />
            <button type="submit" disabled={!inputText.trim() || isTyping} className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white p-3 rounded-xl transition-all shadow-lg shadow-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
        </form>
      </div>
    </div>
  );
};

export default SupportChatModal;
