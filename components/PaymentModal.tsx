
import React, { useState, useEffect } from 'react';

interface PaymentModalProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ amount, onSuccess, onCancel }) => {
  const [step, setStep] = useState<'SELECT' | 'PROCESSING' | 'SUCCESS'>('SELECT');
  const [selectedMethod, setSelectedMethod] = useState('');

  const handlePayment = (method: string) => {
    setSelectedMethod(method);
    setStep('PROCESSING');
    // Simulate API delay and bank processing
    setTimeout(() => {
      setStep('SUCCESS');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in-up">
      <div className="bg-white w-full max-w-sm rounded-[2.5rem] overflow-hidden shadow-2xl relative border border-slate-200">
        
        {/* Header */}
        <div className="bg-slate-50 p-8 text-center border-b border-slate-100">
            <div className="w-12 h-12 bg-white rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-sm border border-slate-100">
                <span className="text-2xl">⚡</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Payable</p>
            <h2 className="text-4xl font-black text-slate-800">₹{amount.toFixed(2)}</h2>
        </div>

        <div className="p-8">
            {step === 'SELECT' && (
                <div className="space-y-4">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Pay using UPI</p>
                    
                    <button onClick={() => handlePayment('Google Pay')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-sm text-lg">
                            🔵
                        </div>
                        <span className="font-bold text-slate-700 group-hover:text-blue-700">Google Pay</span>
                        <div className="ml-auto w-5 h-5 rounded-full border-2 border-slate-200 group-hover:border-blue-500 group-hover:bg-blue-500 transition-colors"></div>
                    </button>

                    <button onClick={() => handlePayment('PhonePe')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-purple-200 hover:bg-purple-50 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm text-white font-black text-xs">
                            Pe
                        </div>
                        <span className="font-bold text-slate-700 group-hover:text-purple-700">PhonePe</span>
                        <div className="ml-auto w-5 h-5 rounded-full border-2 border-slate-200 group-hover:border-purple-500 group-hover:bg-purple-500 transition-colors"></div>
                    </button>

                    <button onClick={() => handlePayment('Paytm')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50 hover:shadow-md transition-all group">
                        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-sm font-black text-[9px] border border-sky-200">
                            PAYTM
                        </div>
                        <span className="font-bold text-slate-700 group-hover:text-sky-700">Paytm UPI</span>
                        <div className="ml-auto w-5 h-5 rounded-full border-2 border-slate-200 group-hover:border-sky-500 group-hover:bg-sky-500 transition-colors"></div>
                    </button>

                    <button onClick={onCancel} className="w-full py-4 text-slate-400 font-bold text-[10px] uppercase tracking-widest hover:text-rose-500 transition-colors mt-2">
                        Cancel Transaction
                    </button>
                </div>
            )}

            {step === 'PROCESSING' && (
                <div className="text-center py-4">
                    <div className="relative w-24 h-24 mx-auto mb-8">
                        <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-2xl animate-pulse">💸</span>
                        </div>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">Processing Payment...</h3>
                    <p className="text-slate-500 text-xs font-bold leading-relaxed px-4">
                        Request sent to <span className="text-slate-800">{selectedMethod}</span>.<br/>
                        Please check your phone to approve.
                    </p>
                    <div className="mt-8 flex justify-center gap-1">
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-150"></div>
                    </div>
                </div>
            )}

            {step === 'SUCCESS' && (
                <div className="text-center py-4 animate-fade-in-up">
                    <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-100 border border-emerald-100 scale-110">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                    </div>
                    <h3 className="text-2xl font-black text-emerald-700 mb-2">Payment Successful!</h3>
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">
                        Txn ID: UPI{Math.floor(Math.random() * 1000000000)}
                    </p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
