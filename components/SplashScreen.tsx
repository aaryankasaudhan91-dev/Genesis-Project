import React from 'react';

const SplashScreen: React.FC = () => {
  return (
    <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500 via-teal-600 to-slate-900 z-[1000] flex flex-col items-center justify-center text-white overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-emerald-400/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10 flex flex-col items-center">
            <div className="relative mb-8 group">
                <div className="absolute inset-0 bg-white/20 blur-2xl rounded-full scale-150 animate-pulse"></div>
                <div className="text-[8rem] relative z-10 animate-bounce-slow drop-shadow-2xl leading-none filter contrast-125 transform transition-transform group-hover:scale-110 duration-700 select-none">🍃</div>
            </div>
            
            <h1 className="text-6xl md:text-7xl font-black tracking-tighter mb-4 animate-fade-in-up drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-b from-white to-emerald-100 select-none">
                MEALers
            </h1>
            
            {/* Wrapper for delay animation */}
            <div className="opacity-0 animate-fade-in-up-delay" style={{ animationFillMode: 'forwards' }}>
                <p className="text-emerald-900 font-bold tracking-[0.4em] text-xs md:text-sm uppercase bg-white/90 px-8 py-3 rounded-full backdrop-blur-md border border-white/50 shadow-[0_0_20px_rgba(255,255,255,0.3)] select-none">
                    connect
                </p>
            </div>
        </div>

        {/* Loading Indicator */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 animate-fade-in-up-delay" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
            <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
    </div>
  );
};

export default SplashScreen;