'use client'
import { useState, useEffect } from 'react'
import { ShieldCheck, Fingerprint, ArrowRight, Lock, User } from 'lucide-react'

export default function TechnicianGate() {
  const [user, setUser] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    // Check if user is already logged in
    const storedUser = localStorage.getItem('lv_user')
    if (storedUser) {
      setUser(storedUser)
    } else {
      setShowModal(true)
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const entry = inputValue.trim()

    if (!entry) {
      setError("ID Required")
      return
    }

    // SUPERINTENDENT PIN CHECK
    if (entry === '8888') {
        completeLogin('Superintendent')
    } else {
        // STANDARD TECHNICIAN LOGIN
        completeLogin(entry) // Uses whatever name they typed
    }
  }

  const completeLogin = (name: string) => {
    localStorage.setItem('lv_user', name)
    setUser(name)
    setShowModal(false)
    window.location.reload() // Refresh to apply user context
  }

  if (!showModal) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] max-w-sm w-full overflow-hidden shadow-2xl ring-4 ring-white/10">
        
        {/* HEADER */}
        <div className="bg-brand-navy p-8 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-brand-electric shadow-[0_0_20px_#38bdf8]"></div>
            <div className="mx-auto w-20 h-20 bg-brand-navy rounded-full flex items-center justify-center mb-4 ring-4 ring-brand-electric/20 shadow-glow relative z-10">
                <Fingerprint className="text-brand-electric" size={40} />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Identity Check</h2>
            <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Security Clearance Required</p>
        </div>
        
        {/* INPUT FORM */}
        <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
                <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block ml-1">
                        Technician Name <span className="text-slate-300">or</span> Admin PIN
                    </label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-electric transition-colors">
                            {inputValue.match(/^\d+$/) ? <Lock size={20}/> : <User size={20}/>}
                        </div>
                        <input 
                            autoFocus
                            type="text" 
                            placeholder="Enter Name or PIN..." 
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none font-bold text-lg text-brand-navy placeholder:text-slate-300 focus:border-brand-electric transition-all"
                            value={inputValue}
                            onChange={(e) => {
                                setInputValue(e.target.value)
                                setError('')
                            }}
                        />
                    </div>
                    {error && <p className="text-red-500 text-xs font-bold mt-2 ml-1 animate-pulse">{error}</p>}
                </div>

                <button 
                    type="submit" 
                    className="w-full py-5 bg-brand-navy text-white font-black rounded-xl shadow-lg hover:bg-brand-electric transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-sm group"
                >
                    Access System <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform"/>
                </button>
            </form>
        </div>

        {/* FOOTER */}
        <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
            <p className="text-[9px] text-slate-400 font-mono flex items-center justify-center gap-2 opacity-70">
                <ShieldCheck size={10}/> SECURE TERMINAL v2.4
            </p>
        </div>
      </div>
    </div>
  )
}