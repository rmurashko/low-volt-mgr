'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Wrench, Package, ShieldCheck, Zap, Menu, X, UserCircle, Activity, LogOut } from 'lucide-react'
import { Toaster } from 'react-hot-toast'
import TechnicianGate from './TechnicianGate'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [user, setUser] = useState('Loading...')
  const pathname = usePathname()

  useEffect(() => {
    setUser(localStorage.getItem('lv_user') || 'Technician')
    setIsOpen(false) // Close menu on route change
  }, [pathname])

  const handleLogout = () => {
    localStorage.removeItem('lv_user')
    window.location.reload()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-brand-silver">
      <Toaster position="top-right" />
      <TechnicianGate />

      {/* MOBILE OVERLAY */}
      {isOpen && (
        <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden animate-in fade-in"
            onClick={() => setIsOpen(false)}
        />
      )}

      {/* SIDEBAR (Responsive) */}
      <aside className={`fixed md:relative z-50 flex flex-col w-72 h-full bg-brand-navy text-white border-r border-slate-700 shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        
        {/* LOGO AREA */}
        <div className="p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-brand-electric/10 p-2 rounded-lg border border-brand-electric/50 shadow-glow">
                <Zap size={24} className="text-brand-electric fill-current" />
            </div>
            <div>
                <h1 className="font-bold text-lg tracking-tighter leading-tight">LOW VOLT <span className="text-brand-electric block text-sm tracking-widest mt-[-2px]">MGR</span></h1>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="md:hidden text-slate-400 hover:text-white"><X /></button>
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            <NavItem href="/" icon={<LayoutDashboard size={20}/>} label="Mission Control" active={pathname === '/'} />
            <NavItem href="/dashboard" icon={<Activity size={20}/>} label="Site Health" active={pathname === '/dashboard'} />
            
            <div className="pt-6 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3">Field Ops</div>
            <NavItem href="/tools" icon={<Wrench size={20}/>} label="Tool Tracker" active={pathname === '/tools'} />
            <NavItem href="/materials" icon={<Package size={20}/>} label="Materials" active={pathname === '/materials'} />
            
            <div className="pt-6 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3">Admin</div>
            <NavItem href="/admin" icon={<ShieldCheck size={20}/>} label="Superintendent" active={pathname === '/admin'} />
        </nav>

        {/* USER PROFILE */}
        <div className="p-4 border-t border-slate-800 bg-brand-dark/50">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <UserCircle className="text-slate-400" size={32} />
                    <div>
                        <p className="text-sm font-bold text-white truncate w-32">{user}</p>
                        <p className="text-[10px] text-brand-electric flex items-center gap-1"><span className="block w-1.5 h-1.5 rounded-full bg-brand-electric animate-pulse"></span> Online</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors"><LogOut size={18}/></button>
            </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* MOBILE HEADER */}
        <header className="md:hidden bg-brand-navy text-white p-4 flex items-center justify-between shadow-md z-20 shrink-0">
           <div className="flex items-center gap-2">
             <Zap className="text-brand-electric" size={20} />
             <span className="font-bold tracking-tighter">LOW VOLT MGR</span>
           </div>
           <button onClick={() => setIsOpen(true)} className="text-slate-300 active:scale-95 transition-transform"><Menu /></button> 
        </header>

        {/* DESKTOP HEADER */}
        <header className="hidden md:flex bg-white/80 backdrop-blur-md h-16 border-b border-slate-200 items-center justify-between px-8 shadow-sm shrink-0">
           <div className="text-xs text-slate-400 font-mono flex items-center gap-2">
             LOCATION: <span className="text-brand-navy font-bold uppercase">West Campus</span>
             <span className="text-slate-300">|</span>
             STATUS: <span className="text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded text-[10px] border border-green-200 uppercase">Active Deployment</span>
           </div>
           <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">v2.5.0</div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8 relative scroll-smooth">
           <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px]"></div>
           <div className="relative z-10 pb-20">{children}</div>
        </main>
      </div>
    </div>
  )
}

function NavItem({ href, icon, label, active }: any) {
  return (
    <Link href={href} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all group ${active ? 'bg-brand-electric text-brand-navy font-bold shadow-[0_0_15px_rgba(14,165,233,0.4)]' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>
      <span className={active ? '' : 'group-hover:text-brand-electric transition-colors duration-300'}>{icon}</span>
      <span className="text-sm tracking-wide">{label}</span>
    </Link>
  )
}