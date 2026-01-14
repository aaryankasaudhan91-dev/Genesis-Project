
import React, { useState, useRef, useEffect } from 'react';
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
      text: `Hello ${user.name.split(' ')[0]}! 👋 I'm your AI Support Assistant powered by DeepSeek. How can I help you rescue food today?`,
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      // Enhanced System Prompt for DeepSeek
      const systemPrompt = `
        You are "RescueBot", the AI support agent for 'MEALers connect'.
        
        Current User Context:
        - Name: ${user.name}
        - Role: ${user.role}
        
        Platform Knowledge:
        1. Donors post food. Volunteers deliver it. Requesters (Orphanages) receive it.
        2. Safety is priority. We use AI to check food, but manual verification is mandatory.
        3. App flows: Post Food -> Volunteer Accepts -> Pickup Verification -> Delivery -> Dropoff Verification.
        
        Guidelines:
        - Be friendly, concise, and solution-oriented.
        - If the user has a technical issue, suggest checking their internet or restarting the app.
        - For urgent safety issues, tell them to call the helpline: +91 85910 95318.
        - Answer as if you are a helpful team member.
      `;

      // Construct conversation history
      const apiMessages = [
          { role: "system", content: systemPrompt },
          ...messages.slice(-6).map(m => ({ 
              role: m.sender === 'user' ? 'user' : 'assistant', 
              content: m.text 
          })),
          { role: "user", content: userMsg.text }
      ];

      const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
              model: "deepseek-chat",
              messages: apiMessages,
              stream: false,
              temperature: 0.7,
              max_tokens: 300
          })
      });

      if (!response.ok) throw new Error("API Request failed");

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content || "I'm thinking... could you rephrase that?";

      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: aiText, timestamp: Date.now() }]);
    } catch (err) {
        console.error(err);
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: "I'm currently offline. Please try again later or contact support manually.", timestamp: Date.now() }]);
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
                    <h3 className="font-black text-white text-sm uppercase tracking-wide">DeepSeek Support</h3>
                    <p className="text-slate-400 text-xs font-medium">Powered by AI</p>
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
