
import React, { useState, useEffect } from 'react';

interface PaymentModalProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ amount, onSuccess, onCancel }) => {
  const [step, setStep] = useState<'METHOD' | 'PROCESSING' | 'SUCCESS'>('METHOD');
  const [activeTab, setActiveTab] = useState<'UPI' | 'CARD' | 'NETBANKING'>('UPI');
  
  // UPI State
  const [upiMethod, setUpiMethod] = useState<'APPS' | 'QR'>('APPS');
  
  // Card State
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  // Bank State
  const [selectedBank, setSelectedBank] = useState('');

  const handlePay = () => {
    setStep('PROCESSING');
    setTimeout(() => {
      setStep('SUCCESS');
      setTimeout(onSuccess, 2000);
    }, 2500);
  };

  // QR Auto-Simulation
  useEffect(() => {
      let timer: any;
      if (step === 'METHOD' && activeTab === 'UPI' && upiMethod === 'QR') {
          timer = setTimeout(() => {
              handlePay();
          }, 8000); // Increased time to allow scanning
      }
      return () => clearTimeout(timer);
  }, [activeTab, upiMethod, step]);

  const isValidCard = cardNumber.length === 16 && cardExpiry.length === 5 && cardCvv.length === 3 && cardName.length > 2;
  const isValidBank = selectedBank !== '';

  // Dynamic QR Code Generation
  const upiId = "8591095318@fam";
  const qrData = `upi://pay?pa=${upiId}&pn=MEALers&am=${amount.toFixed(2)}&cu=INR`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl relative border border-slate-200 flex flex-col md:flex-row h-[600px] md:h-auto">
        
        {/* Sidebar / Topbar */}
        <div className="bg-slate-50 p-6 md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col">
            <div className="mb-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Payable</p>
                <h2 className="text-3xl font-black text-slate-800">₹{amount.toFixed(2)}</h2>
                <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wide">Secure</span>
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase tracking-wide">Test Mode</span>
                </div>
            </div>

            <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-hide">
                <button 
                    onClick={() => setActiveTab('UPI')}
                    className={`p-4 rounded-2xl flex items-center gap-3 transition-all text-left min-w-[140px] md:min-w-0 ${activeTab === 'UPI' ? 'bg-white shadow-md text-emerald-600 ring-1 ring-emerald-100' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${activeTab === 'UPI' ? 'bg-emerald-100' : 'bg-slate-200'}`}>⚡</div>
                    <div>
                        <span className="block text-xs font-black uppercase tracking-wide">UPI</span>
                        <span className="block text-[10px] font-medium opacity-70">GooglePay, PhonePe</span>
                    </div>
                </button>

                <button 
                    onClick={() => setActiveTab('CARD')}
                    className={`p-4 rounded-2xl flex items-center gap-3 transition-all text-left min-w-[140px] md:min-w-0 ${activeTab === 'CARD' ? 'bg-white shadow-md text-blue-600 ring-1 ring-blue-100' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${activeTab === 'CARD' ? 'bg-blue-100' : 'bg-slate-200'}`}>💳</div>
                    <div>
                        <span className="block text-xs font-black uppercase tracking-wide">Card</span>
                        <span className="block text-[10px] font-medium opacity-70">Credit / Debit</span>
                    </div>
                </button>

                <button 
                    onClick={() => setActiveTab('NETBANKING')}
                    className={`p-4 rounded-2xl flex items-center gap-3 transition-all text-left min-w-[140px] md:min-w-0 ${activeTab === 'NETBANKING' ? 'bg-white shadow-md text-purple-600 ring-1 ring-purple-100' : 'text-slate-500 hover:bg-white hover:shadow-sm'}`}
                >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${activeTab === 'NETBANKING' ? 'bg-purple-100' : 'bg-slate-200'}`}>🏦</div>
                    <div>
                        <span className="block text-xs font-black uppercase tracking-wide">NetBanking</span>
                        <span className="block text-[10px] font-medium opacity-70">All Indian Banks</span>
                    </div>
                </button>
            </div>
            
            <div className="mt-auto hidden md:block">
                <button onClick={onCancel} className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    Cancel Transaction
                </button>
            </div>
        </div>

        {/* Content Area */}
        <div className="p-8 md:w-2/3 bg-white relative flex flex-col">
            <button onClick={onCancel} className="absolute top-6 right-6 md:hidden p-2 bg-slate-100 rounded-full text-slate-500">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {step === 'METHOD' && (
                <div className="flex-1 flex flex-col animate-fade-in-up">
                    <h3 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                        {activeTab === 'UPI' && 'Pay via UPI'}
                        {activeTab === 'CARD' && 'Enter Card Details'}
                        {activeTab === 'NETBANKING' && 'Select Your Bank'}
                    </h3>

                    <div className="flex-1">
                        {activeTab === 'UPI' && (
                            <div className="space-y-6">
                                <div className="flex bg-slate-100 p-1 rounded-xl">
                                    <button onClick={() => setUpiMethod('APPS')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${upiMethod === 'APPS' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>UPI Apps</button>
                                    <button onClick={() => setUpiMethod('QR')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${upiMethod === 'QR' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>Scan QR</button>
                                </div>

                                {upiMethod === 'APPS' ? (
                                    <div className="space-y-3">
                                        {['Google Pay', 'PhonePe', 'Paytm', 'BHIM'].map(app => (
                                            <button key={app} onClick={handlePay} className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-2xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group">
                                                <span className="font-bold text-slate-700 group-hover:text-emerald-700">{app}</span>
                                                <div className="w-5 h-5 rounded-full border-2 border-slate-300 group-hover:border-emerald-500 group-hover:bg-emerald-500"></div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <div className="w-48 h-48 mx-auto bg-slate-900 rounded-xl p-2 shadow-lg mb-4 relative overflow-hidden">
                                            <div 
                                                className="w-full h-full bg-white rounded-lg flex items-center justify-center bg-cover bg-center"
                                                style={{ backgroundImage: `url('${qrUrl}')` }}
                                            ></div>
                                            <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shadow-[0_0_10px_#10b981] animate-[scan_2s_ease-in-out_infinite]"></div>
                                        </div>
                                        <p className="text-xs font-bold text-emerald-600 animate-pulse">Waiting for payment...</p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-2">UPI ID: <span className="text-slate-600 font-bold select-all">{upiId}</span></p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'CARD' && (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Card Number</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            maxLength={16} 
                                            value={cardNumber}
                                            onChange={e => setCardNumber(e.target.value.replace(/\D/g, ''))}
                                            placeholder="0000 0000 0000 0000" 
                                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        />
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">💳</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Expiry</label>
                                        <input 
                                            type="text" 
                                            maxLength={5}
                                            value={cardExpiry}
                                            onChange={e => {
                                                let v = e.target.value.replace(/\D/g,'');
                                                if(v.length >= 2) v = v.substring(0,2) + '/' + v.substring(2);
                                                setCardExpiry(v);
                                            }}
                                            placeholder="MM/YY" 
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">CVV</label>
                                        <input 
                                            type="password" 
                                            maxLength={3}
                                            value={cardCvv}
                                            onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))}
                                            placeholder="•••" 
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Card Holder Name</label>
                                    <input 
                                        type="text" 
                                        value={cardName}
                                        onChange={e => setCardName(e.target.value.toUpperCase())}
                                        placeholder="JOHN DOE" 
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                    />
                                </div>
                                <button 
                                    onClick={handlePay} 
                                    disabled={!isValidCard}
                                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-all mt-4"
                                >
                                    Pay ₹{amount.toFixed(2)}
                                </button>
                            </div>
                        )}

                        {activeTab === 'NETBANKING' && (
                            <div className="grid grid-cols-2 gap-3">
                                {['HDFC', 'SBI', 'ICICI', 'Axis', 'Kotak', 'BOB'].map(bank => (
                                    <button 
                                        key={bank} 
                                        onClick={() => setSelectedBank(bank)}
                                        className={`p-4 border rounded-xl flex flex-col items-center justify-center gap-2 hover:shadow-md transition-all ${selectedBank === bank ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 hover:border-purple-200 text-slate-600'}`}
                                    >
                                        <span className="text-xl">🏦</span>
                                        <span className="font-bold text-xs">{bank}</span>
                                    </button>
                                ))}
                                <button 
                                    onClick={handlePay} 
                                    disabled={!isValidBank}
                                    className="col-span-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 text-white font-black py-4 rounded-xl uppercase text-xs tracking-widest transition-all mt-4"
                                >
                                    Pay via {selectedBank || 'NetBanking'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {step === 'PROCESSING' && (
                <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in-up">
                    <div className="relative w-24 h-24 mb-8">
                        <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center text-2xl">💸</div>
                    </div>
                    <h3 className="text-xl font-black text-slate-800 mb-2">Processing Payment...</h3>
                    <p className="text-slate-500 text-xs font-bold">Please do not close this window.</p>
                </div>
            )}

            {step === 'SUCCESS' && (
                <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in-up">
                    <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-xl shadow-emerald-100 scale-110">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-2xl font-black text-emerald-700 mb-2">Payment Successful!</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Txn ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
                </div>
            )}
        </div>
        
        <style>{`
            @keyframes scan {
                0%, 100% { top: 0; }
                50% { top: 100%; }
            }
        `}</style>
      </div>
    </div>
  );
};

export default PaymentModal;
