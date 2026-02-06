
import React from 'react';

interface AboutCreatorsProps {
  onBack: () => void;
}

const creators = [
  {
    name: "Akshay Paswan",
    role: "Full Stack Developer",
    bio: "Passionate about building scalable web applications and solving real-world problems through code. Led the architectural design of MEALers Connect.",
    color: "from-blue-500 to-indigo-600",
    icon: "👨‍💻"
  },
  {
    name: "Surbhi Maurya",
    role: "UI/UX Designer & Frontend",
    bio: "Focused on creating intuitive and accessible user experiences. Crafted the visual identity and seamless interactions of the platform.",
    color: "from-purple-500 to-pink-600",
    icon: "🎨"
  },
  {
    name: "Aaryan Kasaudhan",
    role: "Backend & Logic Engineer",
    bio: "Expert in logic optimization and data structures. Ensured the reliability of the matching algorithms and database integrity.",
    color: "from-emerald-500 to-teal-600",
    icon: "⚙️"
  }
];

const AboutCreators: React.FC<AboutCreatorsProps> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto pb-12 animate-fade-in-up">
      <button onClick={onBack} className="mb-6 flex items-center text-slate-500 font-bold text-sm hover:text-emerald-600 transition-colors">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        Back to Dashboard
      </button>

      <div className="text-center mb-12">
        <h2 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">Meet the Creators</h2>
        <p className="text-slate-500 font-medium max-w-xl mx-auto">
          MEALers Connect was built with ❤️ by a dedicated team of developers committed to using technology for social good.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {creators.map((creator, idx) => (
          <div 
            key={idx} 
            className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-100 hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 group"
          >
            <div className={`h-32 bg-gradient-to-r ${creator.color} relative`}>
                <div className="absolute inset-0 bg-white/10 pattern-dots"></div>
                <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                    <div className="w-20 h-20 bg-white rounded-full p-1 shadow-lg">
                        <div className="w-full h-full bg-slate-50 rounded-full flex items-center justify-center text-3xl">
                            {creator.icon}
                        </div>
                    </div>
                </div>
            </div>
            <div className="pt-12 p-8 text-center">
                <h3 className="text-xl font-black text-slate-800 mb-1">{creator.name}</h3>
                <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 mb-4`}>
                    {creator.role}
                </span>
                <p className="text-slate-500 text-sm font-medium leading-relaxed mb-6">
                    "{creator.bio}"
                </p>
                <div className="flex justify-center gap-4">
                    <button className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    </button>
                    <button className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white transition-all">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    </button>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AboutCreators;
