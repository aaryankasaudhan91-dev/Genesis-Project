
import React, { useState } from 'react';

interface HelpFAQProps {
  onBack: () => void;
  onContact: () => void;
}

const faqs = [
  {
    category: 'General',
    questions: [
      { q: "What is MEALers connect?", a: "MEALers connect is a platform that bridges the gap between food donors (restaurants, events, individuals) and those in need (orphanages, shelters), facilitated by volunteer delivery partners." },
      { q: "Is this service free?", a: "Yes, the platform is completely free to use for volunteers, and requesters. But for donor they have to pay 5 rupees as platform fee for donation. Our mission is to reduce food waste and hunger" },
      { q: "Is my data safe?", a: "We prioritize user privacy and only share necessary location and contact details during active food rescue missions." }
    ]
  },
  {
    category: 'For Donors',
    questions: [
      { q: "What kind of food can I donate?", a: "You can donate prepared meals, packaged food, or raw ingredients. Please ensure all cooked food is fresh and hygienic. We recommend donating food within 2-4 hours of preparation." },
      { q: "How do I ensure food safety?", a: "Our app uses AI to visually analyze food safety. However, you are responsible for ensuring the food is stored properly and is safe to eat. Pack food in clean, sealed containers." },
      { q: "Can I cancel a donation?", a: "Yes, you can cancel a donation from your dashboard as long as it hasn't been picked up yet." }
    ]
  },
  {
    category: 'For Volunteers',
    questions: [
      { q: "How do I start a delivery?", a: "Go to the 'Find Food' tab, select an available donation, and click 'Start Delivery Mission'. You'll get directions to the pickup location." },
      { q: "What is the verification process?", a: "You must upload a photo proof upon picking up the food and another upon delivering it. The Donor will review the pickup proof, and the Donor/System will review the delivery proof." },
      { q: "Do I get paid?", a: "This is a volunteer-driven initiative. While there is no monetary compensation, you earn Impact Points and badges for your contributions to society." }
    ]
  },
  {
    category: 'For Requesters',
    questions: [
      { q: "How do I request food?", a: "Browse the 'Available' tab. If you see food nearby, click 'Request Pickup'. If a volunteer accepts the mission, they will bring it to you." },
      { q: "Can I request specific food?", a: "Currently, you can only request what is available on the platform. However, donors can see your organization category and location." }
    ]
  }
];

const HelpFAQ: React.FC<HelpFAQProps> = ({ onBack, onContact }) => {
  const [activeCategory, setActiveCategory] = useState('General');
  const [openQuestionIndex, setOpenQuestionIndex] = useState<number | null>(null);

  const toggleQuestion = (index: number) => {
    setOpenQuestionIndex(openQuestionIndex === index ? null : index);
  };

  const currentFaqs = faqs.find(f => f.category === activeCategory)?.questions || [];

  return (
    <div className="max-w-4xl mx-auto pb-12 animate-fade-in-up">
      <button onClick={onBack} className="mb-6 flex items-center text-slate-500 font-bold text-sm hover:text-emerald-600 transition-colors">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
        Back to Dashboard
      </button>

      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100 min-h-[600px] flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="bg-slate-50 p-6 md:p-8 md:w-64 border-b md:border-b-0 md:border-r border-slate-100 flex-shrink-0">
            <h2 className="text-2xl font-black text-slate-800 mb-6 tracking-tight">Help Center</h2>
            <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-hide">
                {faqs.map((section) => (
                    <button
                        key={section.category}
                        onClick={() => { setActiveCategory(section.category); setOpenQuestionIndex(null); }}
                        className={`px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-wider text-left transition-all whitespace-nowrap ${activeCategory === section.category ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}
                    >
                        {section.category}
                    </button>
                ))}
            </div>
            
            <div className="mt-8 hidden md:block">
                <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100">
                    <p className="text-emerald-800 text-xs font-bold leading-relaxed mb-3">Still need help? Our support team is just a message away.</p>
                    <button onClick={onContact} className="w-full py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase hover:bg-emerald-700 transition-colors">Contact Support</button>
                </div>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-10 bg-white">
            <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-sm">
                    {activeCategory === 'General' ? '🌍' : activeCategory === 'For Donors' ? '🎁' : activeCategory === 'For Volunteers' ? '🚴' : '🏠'}
                </span>
                {activeCategory} FAQs
            </h3>

            <div className="space-y-4">
                {currentFaqs.map((item, idx) => (
                    <div key={idx} className="border border-slate-100 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-200">
                        <button 
                            onClick={() => toggleQuestion(idx)}
                            className="w-full flex items-center justify-between p-5 text-left bg-slate-50/50 hover:bg-slate-50 transition-colors"
                        >
                            <span className="font-bold text-slate-700 text-sm pr-4">{item.q}</span>
                            <span className={`transform transition-transform duration-300 text-slate-400 ${openQuestionIndex === idx ? 'rotate-180' : ''}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </span>
                        </button>
                        <div 
                            className={`overflow-hidden transition-all duration-300 ease-in-out ${openQuestionIndex === idx ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}
                        >
                            <div className="p-5 pt-0 text-sm text-slate-500 font-medium leading-relaxed border-t border-slate-100 bg-white">
                                {item.a}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default HelpFAQ;
