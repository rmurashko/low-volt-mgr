'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient'
import { 
  BarChart3, AlertCircle, TrendingUp, Package, Search, 
  Activity, Building2, ListChecks, Database, ArrowUpDown, X, CheckCircle2, AlertTriangle
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'

export default function ProjectHealthPage() {
  const [materials, setMaterials] = useState<any[]>([])
  const [roomHealth, setRoomHealth] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const [activeView, setActiveView] = useState<'inventory' | 'rooms'>('inventory')
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'shortage'>('shortage')
  const [searchTerm, setSearchTerm] = useState('')
  
  // INSPECTOR STATE
  const [selectedTR, setSelectedTR] = useState<string | null>(null)
  const [inspectData, setInspectData] = useState<any[]>([])
  
  // SORT STATE
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({ key: 'tr_id', direction: 'asc' })

  useEffect(() => { fetchDashboardData() }, [])

  async function fetchDashboardData() {
    setLoading(true)
    const logs: string[] = []
    
    try {
      const { data: allMats, error: matErr } = await supabase.from('materials').select('*')
      if (matErr) throw matErr
      
      const { data: allRooms, error: roomErr } = await supabase.from('rooms').select('*')
      if (roomErr) throw roomErr

      const { data: allReqs, error: reqErr } = await supabase.from('room_requirements').select('*')
      if (reqErr) throw reqErr

      logs.push(`Found ${allReqs?.length || 0} requirements links.`)

      const matMap: any = {}
      allMats?.forEach((m: any) => matMap[m.id] = m) // Store full material object

      const roomMap: any = {}
      allRooms?.forEach((r: any) => roomMap[r.id] = r.building_number)

      const stitchedData = allReqs?.map((req: any) => ({
        id: req.id,
        tr_id: req.tr_id,
        building_number: roomMap[req.tr_id] || 'Unknown',
        material_id: req.material_id, // Keep ID for logic
        material_name: matMap[req.material_id]?.name || `Unlinked Item (${req.material_id})`,
        qty_required: req.qty_required,
        qty_fulfilled: req.qty_fulfilled,
        current_site_stock: matMap[req.material_id]?.qty_at_site || 0 // For availability check
      })) || []

      setMaterials(allMats || [])
      setRoomHealth(stitchedData)
      setDebugLog(logs)

    } catch (err: any) {
      console.error("Fetch Error:", err)
      logs.push(`ERROR: ${err.message}`)
      setDebugLog(logs)
    } finally {
      setLoading(false)
    }
  }

  // --- INSPECTOR LOGIC ---
  const handleInspect = (trId: string) => {
      const roomItems = roomHealth.filter(r => r.tr_id === trId)
      setInspectData(roomItems)
      setSelectedTR(trId)
  }

  const handleQuickDeploy = async () => {
      if (!selectedTR) return
      const missingItems = inspectData.filter(i => i.qty_fulfilled < i.qty_required)
      
      // 1. Validation Check
      const blockers = missingItems.filter(i => i.current_site_stock < (i.qty_required - i.qty_fulfilled))
      if (blockers.length > 0) {
          return toast.error(`Stock Error: Not enough ${blockers[0].material_name} on site.`)
      }

      const tid = toast.loading("Deploying materials...")
      try {
          const user = localStorage.getItem('lv_user') || 'Technician'

          for (const item of missingItems) {
              const needed = item.qty_required - item.qty_fulfilled
              
              // A. Deduct Site Stock
              const { error: matErr } = await supabase.from('materials')
                .update({ qty_at_site: item.current_site_stock - needed })
                .eq('id', item.material_id)
              if (matErr) throw matErr

              // B. Update Room Requirement
              const { error: reqErr } = await supabase.from('room_requirements')
                .update({ qty_fulfilled: item.qty_required }) // Mark Full
                .eq('id', item.id)
              if (reqErr) throw reqErr

              // C. Log It
              await supabase.from('inventory_ledger').insert({
                  material_id: item.material_id,
                  quantity: -needed,
                  reason: `QUICK_DEPLOY_${selectedTR}_${user}`
              })
          }
          
          toast.success(`TR ${selectedTR} Completed!`, { id: tid })
          setSelectedTR(null)
          fetchDashboardData() // Refresh UI

      } catch (err: any) {
          toast.error("Deployment Failed", { id: tid })
          console.error(err)
      }
  }

  // --- SORTING LOGIC ---
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  const sortedRoomHealth = [...roomHealth].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1
    if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1
    return 0
  })

  // Analytics
  const shortageItems = materials.filter(m => ((m.qty_on_order || 0) + (m.qty_at_office || 0) + (m.qty_at_site || 0)) < (m.qty_bid_day || 0))
  const totalBidUnits = materials.reduce((acc, m) => acc + (m.qty_bid_day || 0), 0)
  const totalProcured = materials.reduce((acc, m) => acc + ((m.qty_on_order || 0) + (m.qty_at_office || 0) + (m.qty_at_site || 0)), 0)
  const healthScore = totalBidUnits > 0 ? Math.round((totalProcured / totalBidUnits) * 100) : 0

  const filteredMaterials = materials.filter(m => {
    const total = (m.qty_on_order || 0) + (m.qty_at_office || 0) + (m.qty_at_site || 0)
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.part_number?.toLowerCase().includes(searchTerm.toLowerCase())
    return inventoryFilter === 'shortage' ? (total < m.qty_bid_day && matchesSearch) : matchesSearch
  })

  return (
    <div className="max-w-7xl mx-auto px-6 pb-20 pt-8 animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-brand-navy tracking-tight uppercase">
            PROJECT <span className="text-brand-electric">HEALTH</span>
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-2">DB STATUS: {loading ? "SYNCING..." : "ONLINE"}</p>
        </div>

        <div className="bg-white/80 backdrop-blur-md p-1.5 rounded-2xl border-2 border-slate-100 flex shadow-sm">
          <button onClick={() => setActiveView('inventory')} className={`px-6 py-3 text-[10px] font-black rounded-xl transition-all flex items-center gap-2 ${activeView === 'inventory' ? 'bg-brand-navy text-white shadow-lg' : 'text-slate-400 hover:text-brand-navy'}`}>
            <BarChart3 size={14}/> PIPELINE
          </button>
          <button onClick={() => setActiveView('rooms')} className={`px-6 py-3 text-[10px] font-black rounded-xl transition-all flex items-center gap-2 ${activeView === 'rooms' ? 'bg-brand-navy text-white shadow-lg' : 'text-slate-400 hover:text-brand-navy'}`}>
            <Building2 size={14}/> ROOM TRACKER
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <StatCard title="Overall Health" value={`${healthScore}%`} sub="Procured vs. Bid" icon={<TrendingUp className="text-brand-electric" />} progress={healthScore} />
        <StatCard title="Shortage Alerts" value={shortageItems.length} sub="Procurement Gaps" icon={<AlertCircle className="text-orange-500" />} isAlert={shortageItems.length > 0} />
        <StatCard title="Field Stock" value={materials.reduce((acc, m) => acc + (m.qty_at_site || 0), 0).toLocaleString()} sub="Units Delivered" icon={<Activity className="text-green-500" />} />
        <StatCard title="Room Progress" value={`${Math.round((roomHealth.filter(r => r.qty_fulfilled >= r.qty_required).length / (roomHealth.length || 1)) * 100)}%`} sub="Completed Closets" icon={<ListChecks className="text-blue-500" />} />
      </div>

      {/* VIEW: ROOM FULFILLMENT TABLE */}
      {activeView === 'rooms' && (
        <div className="animate-in slide-in-from-right-4 duration-500">
            <div className="card-volt !p-0 overflow-hidden shadow-2xl border-0 ring-1 ring-slate-200">
                <table className="w-full text-left">
                    <thead className="bg-brand-navy text-white text-[10px] font-black uppercase tracking-widest cursor-pointer select-none">
                        <tr>
                            <th className="px-8 py-6 hover:bg-white/10 transition-colors" onClick={() => handleSort('tr_id')}>
                                <div className="flex items-center gap-2">Building / TR ID <ArrowUpDown size={14} className="opacity-50"/></div>
                            </th>
                            <th className="px-6 py-6 hover:bg-white/10 transition-colors" onClick={() => handleSort('material_name')}>
                                <div className="flex items-center gap-2">Equipment Spec <ArrowUpDown size={14} className="opacity-50"/></div>
                            </th>
                            <th className="px-6 py-6 text-center">Required</th>
                            <th className="px-6 py-6 text-center">Fulfilled</th>
                            <th className="px-8 py-6 text-right hover:bg-white/10 transition-colors" onClick={() => handleSort('qty_fulfilled')}>
                                <div className="flex items-center justify-end gap-2">Status <ArrowUpDown size={14} className="opacity-50"/></div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {sortedRoomHealth.map((row) => (
                            <tr key={row.id} onClick={() => handleInspect(row.tr_id)} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                                <td className="px-8 py-6">
                                    <div className="font-black text-brand-navy group-hover:text-brand-electric transition-colors">TR {row.tr_id}</div>
                                    <div className="text-[10px] font-data text-slate-400 uppercase tracking-widest font-bold">{row.building_number}</div>
                                </td>
                                <td className="px-6 py-6 text-xs font-bold text-slate-600 uppercase tracking-tight">{row.material_name}</td>
                                <td className="px-6 py-6 text-center font-data text-slate-300 text-lg">{row.qty_required}</td>
                                <td className="px-6 py-6 text-center font-data text-brand-navy text-lg">{row.qty_fulfilled}</td>
                                <td className="px-8 py-6 text-right">
                                    {row.qty_fulfilled >= row.qty_required ? 
                                        <span className="bg-green-100 text-green-600 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest shadow-sm">COMPLETE</span> :
                                        <span className="bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest shadow-sm">SHORT {row.qty_required - row.qty_fulfilled}</span>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {roomHealth.length === 0 && (
                    <div className="p-10 text-center flex flex-col items-center gap-6">
                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl max-w-md w-full">
                            <h3 className="text-sm font-black text-brand-navy uppercase mb-4 flex items-center justify-center gap-2"><Database size={16}/> System Diagnostic</h3>
                            <div className="text-left space-y-2 font-mono text-[10px] text-slate-500">
                                {debugLog.map((log, i) => <div key={i} className="border-b border-slate-100 pb-1">{log}</div>)}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
      )}

      {/* VIEW: INVENTORY PIPELINE (Omitted for brevity, exact same as before) */}
      {activeView === 'inventory' && (
        <div className="space-y-10 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 bg-white/80 backdrop-blur-md p-4 rounded-3xl border-2 border-slate-100 flex items-center gap-4 shadow-sm focus-within:border-brand-electric transition-all">
                    <Search className="text-slate-400" size={24} />
                    <input type="text" placeholder="Search catalog..." className="flex-1 bg-transparent outline-none text-lg font-bold text-brand-navy placeholder:text-slate-300" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {filteredMaterials.map((item) => (
                    <Link href="/materials" key={item.id} className="block group">
                        <div className="card-volt hover:translate-y-[-4px] group-hover:border-brand-electric transition-all">
                            <div className="flex justify-between mb-4"><h3 className="font-black text-brand-navy">{item.name}</h3></div>
                            <div className="grid grid-cols-4 gap-2">
                                <MiniData label="Bid" val={item.qty_bid_day} />
                                <MiniData label="On Order" val={item.qty_on_order} />
                                <MiniData label="Office" val={item.qty_at_office} />
                                <MiniData label="Site" val={item.qty_at_site} />
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
      )}

      {/* --- ROOM DETAIL MODAL --- */}
      {selectedTR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] w-full max-w-2xl overflow-hidden shadow-2xl">
                <div className="bg-brand-navy p-6 flex justify-between items-start">
                    <div>
                        <p className="text-brand-electric font-mono text-xs uppercase mb-1">Building {inspectData[0]?.building_number}</p>
                        <h2 className="text-3xl font-black text-white leading-none">TR {selectedTR}</h2>
                    </div>
                    <button onClick={() => setSelectedTR(null)} className="text-white/50 hover:text-white transition-colors"><X size={24}/></button>
                </div>
                
                <div className="max-h-[60vh] overflow-y-auto custom-scrollbar p-6 space-y-4">
                    {inspectData.map((item: any, i: number) => {
                        const needed = item.qty_required - item.qty_fulfilled
                        const isStockAvailable = item.current_site_stock >= needed
                        const isDone = needed <= 0

                        return (
                            <div key={i} className={`p-4 rounded-xl border-2 flex items-center justify-between ${isDone ? 'border-green-100 bg-green-50/50' : 'border-slate-100'}`}>
                                <div>
                                    <p className="font-bold text-brand-navy text-sm">{item.material_name}</p>
                                    <div className="flex gap-4 mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <span>Req: {item.qty_required}</span>
                                        <span>Done: {item.qty_fulfilled}</span>
                                        {!isDone && (
                                            <span className={isStockAvailable ? 'text-green-600' : 'text-red-500'}>
                                                Stock: {item.current_site_stock}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    {isDone ? (
                                        <CheckCircle2 className="text-green-500" />
                                    ) : (
                                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${isStockAvailable ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                                            {isStockAvailable ? 'Ready' : 'No Stock'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-100">
                    <button 
                        onClick={handleQuickDeploy}
                        className="w-full py-4 bg-brand-navy text-white font-black rounded-xl hover:bg-brand-electric transition-all shadow-lg flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                    >
                        <Package size={18} /> Deploy All Materials
                    </button>
                    <p className="text-center text-[10px] text-slate-400 mt-3 font-medium">
                        Automatically deducts from Site Stock and marks complete.
                    </p>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, sub, icon }: any) {
  return (
    <div className="card-volt !p-8 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-6"><div className="p-3 bg-slate-50 rounded-2xl text-slate-400">{icon}</div></div>
      <div><h4 className="text-5xl font-data text-brand-navy leading-none mb-3 tracking-tighter">{value}</h4><p className="text-xs font-black text-brand-navy uppercase">{title}</p><p className="text-[10px] text-slate-400 mt-1">{sub}</p></div>
    </div>
  )
}

function MiniData({ label, val }: any) {
    return <div className="bg-slate-50 p-2 rounded text-center"><p className="text-xs font-bold">{val}</p><p className="text-[8px] uppercase text-slate-400">{label}</p></div>
}