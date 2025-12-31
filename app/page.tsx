'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'
import { 
  Wrench, 
  AlertTriangle, 
  Package, 
  ArrowRight, 
  Activity, 
  BarChart3, 
  ShieldCheck,
  TrendingUp,
  Clock
} from 'lucide-react'

export default function Home() {
  const [stats, setStats] = useState({
    toolsOut: 0,
    brokenTools: 0,
    shortageCount: 0,
    healthScore: 0
  })
  const [loading, setLoading] = useState(true)
  
  // --- HYDRATION FIX: Use state for time ---
  const [lastSync, setLastSync] = useState<string | null>(null)

  useEffect(() => {
    // Set time only on client side to avoid server mismatch
    setLastSync(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))

    async function fetchDashboardStats() {
      setLoading(true)
      try {
        // 1. Fetch Tools Status
        const { data: tools } = await supabase.from('tools').select('status')
        const toolsOut = tools?.filter((t: any) => t.status === 'checked_out').length || 0
        const brokenTools = tools?.filter((t: any) => t.status === 'maintenance').length || 0

        // 2. Fetch Material Pipeline
        const { data: materials } = await supabase.from('materials').select('qty_bid_day, qty_on_order, qty_at_office, qty_at_site')
        
        const shortages = materials?.filter((m: any) => 
          ((m.qty_on_order || 0) + (m.qty_at_office || 0) + (m.qty_at_site || 0)) < (m.qty_bid_day || 0)
        ).length || 0

        const totalBid = materials?.reduce((acc, m) => acc + (m.qty_bid_day || 0), 0) || 0
        const totalProcured = materials?.reduce((acc, m) => acc + ((m.qty_on_order || 0) + (m.qty_at_office || 0) + (m.qty_at_site || 0)), 0) || 0
        const health = totalBid > 0 ? Math.round((totalProcured / totalBid) * 100) : 0

        setStats({ toolsOut, brokenTools, shortageCount: shortages, healthScore: health })
      } catch (err) {
        console.error("Dashboard fetch error:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboardStats()
  }, [])

  return (
    <div className="flex flex-col min-h-screen p-6 md:p-10 animate-in fade-in duration-700">
      
      {/* PAGE HEADER */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-2">
            <span className="h-2 w-2 rounded-full bg-brand-electric animate-pulse shadow-[0_0_8px_#38bdf8]"></span>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] font-data">Status: Active • West Campus</p>
        </div>
        <h1 className="text-5xl font-black text-brand-navy mb-2 tracking-tighter uppercase">Morning <span className="text-brand-electric">Report</span></h1>
        <p className="text-slate-500 font-medium italic text-sm">Automated logistics briefing for the project superintendent.</p>
      </div>

      {/* PRIMARY STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        <HomeStatCard 
          title="Project Health" 
          val={`${stats.healthScore}%`} 
          icon={<BarChart3 size={28}/>} 
          loading={loading}
          desc="Overall Procurement"
          accent="border-brand-navy"
          text="text-brand-electric"
        />
        <HomeStatCard 
          title="Material Gaps" 
          val={stats.shortageCount} 
          icon={<Package size={28}/>} 
          loading={loading}
          isAlert={stats.shortageCount > 0}
          desc="Items Under-Ordered"
          accent={stats.shortageCount > 0 ? "border-orange-500 ring-4 ring-orange-50" : ""}
          text={stats.shortageCount > 0 ? "text-orange-500" : "text-brand-navy"}
        />
        <HomeStatCard 
          title="Tools In Field" 
          val={stats.toolsOut} 
          icon={<Wrench size={28}/>} 
          loading={loading}
          desc="Current Checkouts"
          text="text-brand-navy"
        />
        <HomeStatCard 
          title="Down For Repair" 
          val={stats.brokenTools} 
          icon={<AlertTriangle size={28}/>} 
          loading={loading}
          isAlert={stats.brokenTools > 0}
          desc="Needs Maintenance"
          accent={stats.brokenTools > 0 ? "border-red-500 ring-4 ring-red-50" : ""}
          text={stats.brokenTools > 0 ? "text-red-600" : "text-brand-navy"}
        />
      </div>

      {/* QUICK NAVIGATION SECTION */}
      <div className="flex items-center gap-4 mb-8">
        <h3 className="font-black text-brand-navy uppercase text-xs tracking-[0.2em] whitespace-nowrap">Command Terminal</h3>
        <div className="h-[1px] w-full bg-slate-100"></div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <QuickNavButton href="/dashboard" label="Project Health" icon={<TrendingUp size={24}/>} desc="Supply Chain Analytics" color="group-hover:border-brand-electric" />
        <QuickNavButton href="/materials" label="Logistics" icon={<Package size={24}/>} desc="Inventory & Transfers" color="group-hover:border-orange-400" />
        <QuickNavButton href="/tools" label="Tool Tracker" icon={<Wrench size={24}/>} desc="Check-in / Check-out" color="group-hover:border-blue-400" />
        <QuickNavButton href="/admin" label="Superintendent" icon={<ShieldCheck size={24}/>} desc="Admin Controls & CSV" color="group-hover:border-slate-900" />
      </div>

      {/* SYSTEM FOOTER */}
      <div className="mt-auto pt-16 flex justify-center">
        <div className="bg-white/80 backdrop-blur-md px-6 py-2 rounded-full border border-slate-100 shadow-sm flex items-center gap-3">
            <Clock size={14} className="text-brand-electric" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {/* --- HYDRATION FIX: Conditional render --- */}
                Last Sync: {lastSync || '--:--'}
            </p>
        </div>
      </div>
    </div>
  )
}

function HomeStatCard({ title, val, icon, loading, isAlert, desc, accent, text }: any) {
    return (
        <div className={`card-volt !p-8 flex flex-col justify-between h-56 ${accent}`}>
            <div className="flex justify-between items-start">
                <div className="p-3 bg-slate-50 rounded-2xl text-slate-400 shadow-inner">
                    {icon}
                </div>
                {isAlert && <span className="flex h-3 w-3 rounded-full bg-current animate-ping opacity-75 text-orange-500"></span>}
            </div>
            <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <h2 className={`text-6xl font-data leading-none tracking-tighter ${text}`}>{loading ? '---' : val}</h2>
                <p className="text-[9px] text-slate-400 font-bold mt-2 uppercase italic">{desc}</p>
            </div>
        </div>
    )
}

function QuickNavButton({ href, label, icon, desc, color }: any) {
    return (
        <Link href={href} className={`card-volt group !p-8 flex flex-col justify-between h-48 border-2 ${color}`}>
            <div className="bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-brand-navy group-hover:text-brand-electric transition-all shadow-inner">
                {icon}
            </div>
            <div>
                <div className="flex items-center justify-between">
                    <p className="font-black text-brand-navy uppercase text-sm tracking-tight">{label}</p>
                    <ArrowRight size={18} className="text-slate-200 group-hover:text-brand-electric transition-all -translate-x-2 group-hover:translate-x-0" />
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-1">{desc}</p>
            </div>
        </Link>
    )
}