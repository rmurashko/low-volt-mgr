'use client'
import { useState, useEffect } from 'react'
import { 
  Wrench, Search, Camera, ArrowRightLeft, CheckCircle, 
  Keyboard, Filter, AlertTriangle, Hammer, Lock, X, ShieldAlert 
} from 'lucide-react'
import Scanner from '../../components/Scanner'
import { supabase } from '../../utils/supabaseClient'
import { toast } from 'react-hot-toast'

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<'scan' | 'list'>('scan')
  const [scannedTool, setScannedTool] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [manualId, setManualId] = useState('')
  const [toolList, setToolList] = useState<any[]>([])
  const [listFilter, setListFilter] = useState('all')
  const [currentUser, setCurrentUser] = useState('Technician')

  // SECURITY STATES
  const [showPinPad, setShowPinPad] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null) // 'repair' or 'override'
  const [isAdminMode, setIsAdminMode] = useState(false) // Unlocks manual status buttons

  useEffect(() => { 
      setCurrentUser(localStorage.getItem('lv_user') || 'Technician')
      if (activeTab === 'list') fetchToolList() 
  }, [activeTab])

  // Reset security when switching tools
  useEffect(() => {
    if (scannedTool) {
        setIsAdminMode(false)
        setShowPinPad(false)
        setPinInput('')
    }
  }, [scannedTool])

  const fetchToolList = async () => {
    setLoading(true)
    const { data } = await supabase.from('tools').select('*').order('name')
    setToolList(data || [])
    setLoading(false)
  }

  const handleLookup = async (code: string) => {
    if (!code || loading) return
    setLoading(true)
    const tid = toast.loading('Searching assets...')
    const { data, error } = await supabase.from('tools').select('*').eq('id', code).single()
    if (error || !data) {
      toast.error('Asset not found', { id: tid })
      setScannedTool(null)
    } else {
      setScannedTool(data)
      toast.success('Asset Located', { id: tid })
      setManualId('') 
    }
    setLoading(false)
  }

  // --- SECURITY LOGIC ---
  const requestSecureAction = (actionType: string) => {
      setPendingAction(actionType)
      setShowPinPad(true)
  }

  const handlePinSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      if (pinInput === '8888') {
          toast.success("Authorized")
          setShowPinPad(false)
          setPinInput('')
          
          if (pendingAction === 'repair') {
              executeAction('repair')
          } else if (pendingAction === 'override') {
              setIsAdminMode(true)
          }
      } else {
          toast.error("Incorrect PIN")
          setPinInput('')
      }
  }

  // --- ACTION LOGIC ---
  const executeAction = async (action: 'checkout' | 'checkin' | 'maintenance' | 'repair') => {
    if (!scannedTool) return
    let newStatus = ''
    let logAction = ''

    if (action === 'checkout') { newStatus = 'checked_out'; logAction = 'CHECK_OUT'; }
    else if (action === 'checkin') { newStatus = 'available'; logAction = 'RETURN'; }
    else if (action === 'maintenance') { newStatus = 'maintenance'; logAction = 'FLAG_BROKEN'; }
    else if (action === 'repair') { newStatus = 'available'; logAction = 'REPAIR_COMPLETE'; }

    const tid = toast.loading('Updating status...')
    try {
        const { error } = await supabase.from('tools').update({ status: newStatus }).eq('id', scannedTool.id)
        if (error) throw error

        await supabase.from('tool_logs').insert({
            tool_id: scannedTool.id,
            action_type: logAction,
            user_id: currentUser
        })

        setScannedTool({ ...scannedTool, status: newStatus })
        toast.success(`Action Logged: ${logAction}`, { id: tid })
        if(activeTab === 'list') fetchToolList()
    } catch (err) {
        toast.error('Update Failed', { id: tid })
    }
  }

  // Admin Force Status
  const handleForceStatus = async (status: string) => {
      const tid = toast.loading("Forcing Status...")
      await supabase.from('tools').update({ status }).eq('id', scannedTool.id)
      await supabase.from('tool_logs').insert({ tool_id: scannedTool.id, action_type: `ADMIN_FORCE_${status.toUpperCase()}`, user_id: `${currentUser} (Admin)` })
      setScannedTool({ ...scannedTool, status })
      toast.success("Status Overridden", { id: tid })
      setIsAdminMode(false)
  }

  const filteredTools = toolList.filter(t => {
      if (listFilter === 'available') return t.status === 'available'
      if (listFilter === 'out') return t.status === 'checked_out'
      if (listFilter === 'broken') return t.status === 'maintenance'
      return true
  })

  return (
    <div className="max-w-5xl mx-auto pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
            <h1 className="text-3xl font-black text-brand-navy flex items-center gap-2 tracking-tighter">
            <Wrench className="text-brand-electric" size={32} /> TOOL <span className="text-brand-electric">TRACKER</span>
            </h1>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest pl-1">Asset Control • {currentUser}</p>
        </div>
        <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <button onClick={() => setActiveTab('scan')} className={`flex items-center gap-2 px-6 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-wider ${activeTab === 'scan' ? 'bg-brand-navy text-white shadow-md' : 'text-slate-400 hover:text-brand-navy'}`}><Camera size={16}/> Scan</button>
            <button onClick={() => setActiveTab('list')} className={`flex items-center gap-2 px-6 py-3 text-xs font-black rounded-xl transition-all uppercase tracking-wider ${activeTab === 'list' ? 'bg-brand-navy text-white shadow-md' : 'text-slate-400 hover:text-brand-navy'}`}><Filter size={16}/> Inventory</button>
        </div>
      </div>

      {activeTab === 'scan' ? (
        <div className="grid md:grid-cols-2 gap-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="space-y-6">
            <div className="bg-black rounded-[2rem] overflow-hidden border-4 border-brand-navy shadow-2xl relative aspect-square flex flex-col">
              <div className="flex-1 relative"><Scanner onScan={handleLookup} /></div>
              <div className="bg-brand-navy p-3 text-center"><p className="text-brand-electric font-mono text-[10px] uppercase tracking-widest flex items-center justify-center gap-2"><span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span> Live Feed Active</p></div>
            </div>
            <div className="card-volt !p-2 flex items-center gap-2">
                <input type="text" placeholder="Or enter Asset ID manually..." value={manualId} onChange={(e) => setManualId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLookup(manualId)} className="flex-1 bg-transparent p-4 outline-none font-bold text-brand-navy placeholder:text-slate-300"/>
                <button onClick={() => handleLookup(manualId)} className="bg-slate-100 p-3 rounded-xl hover:bg-brand-electric hover:text-white transition-colors"><ArrowRightLeft size={20}/></button>
            </div>
          </div>

          <div className="flex flex-col h-full">
            {scannedTool ? (
              <div className={`card-volt flex-1 flex flex-col animate-in slide-in-from-right-8 duration-300 border-2 ${scannedTool.status === 'maintenance' ? 'border-red-500 bg-red-50' : isAdminMode ? 'border-orange-500 ring-4 ring-orange-100' : 'border-brand-electric'}`}>
                <div className="flex-1">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <span className="bg-slate-100 text-slate-500 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">{scannedTool.brand || 'Generic'}</span>
                            <span className="text-[10px] font-mono text-slate-300 ml-2">{scannedTool.id}</span>
                        </div>
                        {/* ADMIN OVERRIDE BUTTON */}
                        <button onClick={() => isAdminMode ? setIsAdminMode(false) : requestSecureAction('override')} className="p-2 text-slate-300 hover:text-brand-navy transition-colors">
                            {isAdminMode ? <X size={20}/> : <Lock size={20}/>}
                        </button>
                    </div>
                    
                    <h2 className="text-4xl font-black text-brand-navy mb-2 leading-tight uppercase">{scannedTool.name}</h2>
                    
                    {/* STATUS BADGE */}
                    <div className="bg-white/50 rounded-2xl p-6 border border-slate-100 mt-6">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Current Status</p>
                        <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full ${scannedTool.status === 'available' ? 'bg-green-500 shadow-glow' : scannedTool.status === 'maintenance' ? 'bg-red-500 animate-pulse' : 'bg-orange-500'}`}></div>
                            <span className={`text-xl font-black uppercase ${scannedTool.status === 'available' ? 'text-green-600' : scannedTool.status === 'maintenance' ? 'text-red-600' : 'text-orange-500'}`}>
                                {scannedTool.status === 'checked_out' ? 'IN USE' : scannedTool.status === 'maintenance' ? 'NEEDS REPAIR' : 'AVAILABLE'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-200/50 space-y-3">
                    {/* STANDARD ACTIONS */}
                    {!showPinPad && !isAdminMode && (
                        <>
                            {scannedTool.status === 'available' && (
                                <>
                                    <button onClick={() => executeAction('checkout')} className="w-full py-4 bg-brand-navy text-white font-black rounded-2xl shadow-lg hover:bg-brand-electric transition-all flex items-center justify-center gap-3">
                                        <ArrowRightLeft /> CHECK OUT ASSET
                                    </button>
                                    <button onClick={() => executeAction('maintenance')} className="w-full py-4 bg-red-100 text-red-600 font-black rounded-2xl hover:bg-red-200 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                                        <AlertTriangle size={16}/> Report Broken
                                    </button>
                                </>
                            )}
                            
                            {scannedTool.status === 'checked_out' && (
                                <>
                                    <button onClick={() => executeAction('checkin')} className="w-full py-4 bg-green-500 text-white font-black rounded-2xl shadow-lg hover:bg-green-400 transition-all flex items-center justify-center gap-3">
                                        <CheckCircle /> RETURN TO INVENTORY
                                    </button>
                                    <button onClick={() => executeAction('maintenance')} className="w-full py-4 bg-red-100 text-red-600 font-black rounded-2xl hover:bg-red-200 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest">
                                        <AlertTriangle size={16}/> Return as Broken
                                    </button>
                                </>
                            )}

                            {scannedTool.status === 'maintenance' && (
                                <button onClick={() => requestSecureAction('repair')} className="w-full py-4 bg-green-600 text-white font-black rounded-2xl shadow-lg hover:bg-green-500 transition-all flex items-center justify-center gap-3">
                                    <Lock size={16}/> MARK REPAIRED & RETURN
                                </button>
                            )}
                        </>
                    )}

                    {/* PIN PAD UI */}
                    {showPinPad && (
                        <div className="bg-slate-50 p-6 rounded-2xl text-center animate-in fade-in">
                            <Lock size={32} className="mx-auto text-slate-400 mb-2"/>
                            <p className="text-xs font-black uppercase text-brand-navy mb-4">Superintendent Approval</p>
                            <form onSubmit={handlePinSubmit} className="space-y-3">
                                <input autoFocus type="password" pattern="[0-9]*" inputMode="numeric" className="w-full text-center p-3 rounded-xl border font-black text-xl" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="PIN" />
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setShowPinPad(false)} className="flex-1 py-3 text-[10px] font-bold uppercase bg-white border rounded-xl">Cancel</button>
                                    <button type="submit" className="flex-1 py-3 text-[10px] font-bold uppercase bg-brand-navy text-white rounded-xl">Authorize</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* ADMIN OVERRIDE MODE */}
                    {isAdminMode && (
                        <div className="p-4 bg-orange-50 rounded-2xl border border-orange-200 animate-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-2 mb-3 text-orange-600"><ShieldAlert size={16}/><span className="text-xs font-black uppercase">Force Status</span></div>
                            <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => handleForceStatus('available')} className="p-2 bg-green-100 text-green-700 rounded-lg text-[10px] font-bold uppercase">Ready</button>
                                <button onClick={() => handleForceStatus('checked_out')} className="p-2 bg-blue-100 text-blue-700 rounded-lg text-[10px] font-bold uppercase">Out</button>
                                <button onClick={() => handleForceStatus('maintenance')} className="p-2 bg-red-100 text-red-700 rounded-lg text-[10px] font-bold uppercase">Broken</button>
                            </div>
                        </div>
                    )}
                </div>
              </div>
            ) : (
              <div className="h-full border-4 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center text-slate-300 p-8 text-center bg-slate-50/50">
                <Search size={48} className="mb-4 opacity-20"/>
                <p className="font-black uppercase tracking-widest text-sm">Ready to Scan</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* LIST VIEW */
        <div className="animate-in fade-in duration-300">
            <div className="flex gap-2 mb-6 overflow-x-auto">
                {['all', 'available', 'out', 'broken'].map(filter => (
                    <button key={filter} onClick={() => setListFilter(filter)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${listFilter === filter ? 'bg-brand-navy text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}>
                        {filter === 'out' ? 'Checked Out' : filter === 'broken' ? 'Maintenance' : filter}
                    </button>
                ))}
            </div>
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset</th>
                            <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand</th>
                            <th className="px-6 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {filteredTools.map((tool) => (
                            <tr key={tool.id} onClick={() => { setScannedTool(tool); setActiveTab('scan'); }} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                                <td className="px-8 py-5">
                                    <p className="font-black text-brand-navy group-hover:text-brand-electric transition-colors">{tool.name}</p>
                                    <p className="text-[9px] font-mono text-slate-300">{tool.id}</p>
                                </td>
                                <td className="px-6 py-5 text-xs font-bold text-slate-500 uppercase">{tool.brand}</td>
                                <td className="px-6 py-5 text-right">
                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${tool.status === 'checked_out' ? 'bg-orange-100 text-orange-500' : tool.status === 'maintenance' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                        {tool.status === 'checked_out' ? 'In Use' : tool.status === 'maintenance' ? 'Broken' : 'Ready'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}
    </div>
  )
}