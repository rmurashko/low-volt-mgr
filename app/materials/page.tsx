'use client'
import { useState, useEffect } from 'react'
import { 
  Package, Truck, Building2, HardHat, 
  Search, Minus, Plus, RefreshCcw, Keyboard, MapPin, ArrowRight, Download, AlertTriangle, Save, X, Lock
} from 'lucide-react'
import Scanner from '../../components/Scanner'
import { supabase } from '../../utils/supabaseClient'
import { toast } from 'react-hot-toast'

export default function MaterialsPage() {
  const [activeTab, setActiveTab] = useState<'scan' | 'list'>('scan')
  const [scannedItem, setScannedItem] = useState<any>(null)
  const [allMaterials, setAllMaterials] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [manualId, setManualId] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [transferAmount, setTransferAmount] = useState<number>(0)
  
  // Logic States
  const [rooms, setRooms] = useState<any[]>([])
  const [selectedRoom, setSelectedRoom] = useState('')
  const [receiveTarget, setReceiveTarget] = useState<'office' | 'site'>('office')
  
  // Audit & Security State
  const [isAuditMode, setIsAuditMode] = useState(false)
  const [showPinPad, setShowPinPad] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [auditValues, setAuditValues] = useState({ order: 0, office: 0, site: 0 })

  const fetchInitialData = async () => {
    const { data: roomsData } = await supabase.from('rooms').select('*').order('id')
    setRooms(roomsData || [])
    
    if (activeTab === 'list') {
      setLoading(true)
      const { data } = await supabase.from('materials').select('*').order('name')
      setAllMaterials(data || [])
      setLoading(false)
    }
  }

  useEffect(() => { fetchInitialData() }, [activeTab])

  // Reset audit mode when switching items
  useEffect(() => {
      if (scannedItem) {
          setIsAuditMode(false)
          setShowPinPad(false)
          setPinInput('')
          setAuditValues({
              order: scannedItem.qty_on_order || 0,
              office: scannedItem.qty_at_office || 0,
              site: scannedItem.qty_at_site || 0
          })
      }
  }, [scannedItem])

  const handleLookup = async (input: string) => {
    if (!input || loading) return
    setLoading(true)
    const tid = toast.loading('Searching Inventory...')

    let { data } = await supabase.from('materials').select('*').eq('id', input.trim().toUpperCase()).maybeSingle()
    if (!data) {
      const { data: nameMatch } = await supabase.from('materials').select('*').ilike('name', `%${input.trim()}%`).limit(1).maybeSingle()
      data = nameMatch
    }

    if (!data) {
      toast.error('No ID or Name match found', { id: tid })
      setScannedItem(null)
    } else {
      setScannedItem(data); setManualId(''); setTransferAmount(0); setSelectedRoom('');
      toast.success(`Found: ${data.name}`, { id: tid })
    }
    setLoading(false)
  }

  // --- LOGISTICS FUNCTIONS ---

  const handleReceive = async (amount: number) => {
    if (!scannedItem || amount <= 0) return
    const tid = toast.loading(`Receiving...`)
    try {
        const newOrder = Math.max(0, (scannedItem.qty_on_order || 0) - amount)
        let updates: any = { qty_on_order: newOrder }
        if (receiveTarget === 'office') updates.qty_at_office = (scannedItem.qty_at_office || 0) + amount
        else updates.qty_at_site = (scannedItem.qty_at_site || 0) + amount

        await supabase.from('materials').update(updates).eq('id', scannedItem.id)
        await supabase.from('inventory_ledger').insert({
            material_id: scannedItem.id,
            quantity: amount,
            reason: `RECEIVED_TO_${receiveTarget.toUpperCase()}`
        })
        setScannedItem({ ...scannedItem, ...updates })
        toast.success(`Received!`, { id: tid })
        setTransferAmount(0)
    } catch (err: any) { toast.error(err.message, { id: tid }) }
  }

  const handleSendToSite = async (amount: number) => {
    if (!scannedItem || amount <= 0) return
    if ((scannedItem.qty_at_office || 0) < amount) return toast.error("Not enough Office stock")
    const newOffice = (scannedItem.qty_at_office || 0) - amount
    const newSite = (scannedItem.qty_at_site || 0) + amount
    const { error } = await supabase.from('materials').update({ qty_at_office: newOffice, qty_at_site: newSite }).eq('id', scannedItem.id)
    if (!error) {
        setScannedItem({ ...scannedItem, qty_at_office: newOffice, qty_at_site: newSite })
        toast.success('Moved to Site Stock')
        setTransferAmount(0)
    }
  }

  const handleInstall = async (amount: number) => {
    if (!scannedItem || amount <= 0) return
    if ((scannedItem.qty_at_site || 0) < amount) return toast.error("Not enough Site stock")
    const tid = toast.loading("Installing...")
    try {
        const newSite = (scannedItem.qty_at_site || 0) - amount
        const newBid = Math.max(0, (scannedItem.qty_bid_day || 0) - amount)
        await supabase.from('materials').update({ qty_at_site: newSite, qty_bid_day: newBid }).eq('id', scannedItem.id)
        
        if (selectedRoom) {
            const { data: reqData } = await supabase.from('room_requirements').select('id, qty_fulfilled').eq('tr_id', selectedRoom).eq('material_id', scannedItem.id).maybeSingle()
            if (reqData) await supabase.from('room_requirements').update({ qty_fulfilled: (reqData.qty_fulfilled || 0) + amount }).eq('id', reqData.id)
        }
        await supabase.from('inventory_ledger').insert({
            material_id: scannedItem.id,
            quantity: -amount,
            reason: selectedRoom ? `INSTALLED_TR_${selectedRoom}` : 'FIELD_CONSUMPTION'
        })
        setScannedItem({ ...scannedItem, qty_at_site: newSite, qty_bid_day: newBid })
        toast.success('Installed!', { id: tid })
        setTransferAmount(0)
    } catch (err: any) { toast.error(err.message, { id: tid }) }
  }

  // --- SECURITY & AUDIT ---
  const handleUnlockAudit = (e: any) => {
      e.preventDefault()
      if (pinInput === '8888') {
          setIsAuditMode(true)
          setShowPinPad(false)
          setPinInput('')
          toast.success("Audit Mode Unlocked")
      } else {
          toast.error("Incorrect PIN")
          setPinInput('')
      }
  }

  const handleAuditSave = async () => {
      const tid = toast.loading("Saving Corrections...")
      try {
          const diffOrder = auditValues.order - (scannedItem.qty_on_order || 0)
          const diffOffice = auditValues.office - (scannedItem.qty_at_office || 0)
          const diffSite = auditValues.site - (scannedItem.qty_at_site || 0)

          await supabase.from('materials').update({
              qty_on_order: auditValues.order,
              qty_at_office: auditValues.office,
              qty_at_site: auditValues.site
          }).eq('id', scannedItem.id)

          if (diffOrder !== 0 || diffOffice !== 0 || diffSite !== 0) {
              const user = localStorage.getItem('lv_user') || 'Admin'
              await supabase.from('inventory_ledger').insert({
                  material_id: scannedItem.id,
                  quantity: 0,
                  reason: `AUDIT_FIX_BY_${user} (Order:${diffOrder}, Office:${diffOffice}, Site:${diffSite})`
              })
          }

          setScannedItem({ ...scannedItem, qty_on_order: auditValues.order, qty_at_office: auditValues.office, qty_at_site: auditValues.site })
          setIsAuditMode(false)
          toast.success("Counts Corrected", { id: tid })

      } catch (err) { toast.error("Audit Failed", { id: tid }) }
  }

  return (
    <div className="max-w-7xl mx-auto px-6 pb-20 pt-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-black text-brand-navy tracking-tight flex items-center gap-3 uppercase">
              <Package className="text-brand-electric" size={36} /> Logistics <span className="text-brand-electric">Terminal</span>
          </h1>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">West Campus • Material Flow</p>
        </div>
        <div className="bg-white p-1.5 rounded-2xl border-2 border-slate-100 flex shadow-sm backdrop-blur-md">
            <button onClick={() => setActiveTab('scan')} className={`px-8 py-3 text-xs font-black rounded-xl transition-all tracking-widest ${activeTab === 'scan' ? 'bg-brand-navy text-white shadow-lg' : 'text-slate-400 hover:text-brand-navy'}`}>SCANNER</button>
            <button onClick={() => setActiveTab('list')} className={`px-8 py-3 text-xs font-black rounded-xl transition-all tracking-widest ${activeTab === 'list' ? 'bg-brand-navy text-white shadow-lg' : 'text-slate-400 hover:text-brand-navy'}`}>MASTER LIST</button>
        </div>
      </div>

      {activeTab === 'scan' ? (
        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-8">
            <div className="relative group">
               <div className="absolute -inset-1 bg-gradient-to-r from-brand-electric to-blue-600 rounded-[2.5rem] blur opacity-25"></div>
               <div className="relative bg-black rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl aspect-square">
                 <Scanner onScan={handleLookup} />
               </div>
            </div>
            <div className="card-volt">
              <label className="text-[10px] font-black text-slate-400 uppercase mb-4 block tracking-[0.2em] flex items-center gap-2">
                <Keyboard size={16} className="text-brand-electric" /> Manual Terminal
              </label>
              <div className="flex gap-2">
                <input type="text" placeholder="Search ID or Part..." value={manualId} onChange={(e) => setManualId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLookup(manualId)} className="flex-1 bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-sm font-bold focus:border-brand-electric outline-none transition-all" />
                <button onClick={() => handleLookup(manualId)} className="btn-volt px-8">GO</button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8">
            {scannedItem ? (
              <div className="animate-in slide-in-from-bottom-8 duration-500">
                <div className={`card-volt !p-0 overflow-hidden border-0 shadow-2xl ring-1 ring-slate-200 transition-colors duration-500 ${isAuditMode ? 'ring-4 ring-orange-400' : ''}`}>
                  
                  {/* DETAIL HEADER */}
                  <div className={`${isAuditMode ? 'bg-orange-500' : 'bg-brand-navy'} p-8 text-white relative transition-colors duration-500`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-3xl font-black tracking-tight mb-2 uppercase">{scannedItem.name}</h2>
                            <div className="flex flex-wrap gap-4">
                                <span className="px-3 py-1 bg-white/20 rounded-lg text-[10px] font-mono font-black border border-white/10">ID: {scannedItem.id}</span>
                                <span className="px-3 py-1 bg-white/10 text-white/80 rounded-lg text-[10px] font-mono font-black border border-white/10">PART: {scannedItem.part_number}</span>
                            </div>
                        </div>
                        {/* SECURE TOGGLE */}
                        <button onClick={() => isAuditMode ? setIsAuditMode(false) : setShowPinPad(true)} className="p-3 bg-white/10 rounded-xl hover:bg-white text-white hover:text-brand-navy transition-all shadow-lg border border-white/20">
                            {isAuditMode ? <X size={24}/> : <AlertTriangle size={24}/>}
                        </button>
                    </div>
                    {isAuditMode && <div className="absolute top-0 left-0 w-full h-1 bg-stripes animate-move-stripes"></div>}
                  </div>

                  {/* STANDARD MODE */}
                  {!isAuditMode && !showPinPad && (
                      <>
                        <div className="p-8 bg-slate-50 border-b flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-4">
                                <div className="text-center md:text-left">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Movement Qty</p>
                                    <div className="flex items-center bg-white border-2 border-slate-200 rounded-2xl mt-2 overflow-hidden shadow-sm">
                                        <button onClick={() => setTransferAmount(Math.max(0, transferAmount - 1))} className="p-4 hover:bg-slate-50"><Minus size={20}/></button>
                                        <input type="number" value={transferAmount} onChange={(e) => setTransferAmount(parseInt(e.target.value) || 0)} className="w-24 text-center font-black text-brand-navy outline-none text-2xl font-data bg-transparent" />
                                        <button onClick={() => setTransferAmount(transferAmount + 1)} className="p-4 hover:bg-slate-50"><Plus size={20}/></button>
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining Scope</p>
                                <p className="text-5xl font-data text-brand-navy leading-none mt-2">{scannedItem.qty_bid_day}<span className="text-sm font-bold ml-1 opacity-30">{scannedItem.unit}</span></p>
                            </div>
                        </div>

                        <div className="p-8 grid md:grid-cols-3 gap-8">
                            <StatusCard title="On Order" qty={scannedItem.qty_on_order} icon={<Truck className="text-orange-500"/>} active={transferAmount > 0}>
                                <div className="space-y-2">
                                    <select value={receiveTarget} onChange={(e: any) => setReceiveTarget(e.target.value)} className="w-full p-2 text-[10px] font-bold border-2 border-slate-100 rounded-xl bg-white outline-none focus:border-brand-electric transition-all uppercase">
                                        <option value="office">Add to Office</option>
                                        <option value="site">Add to Site</option>
                                    </select>
                                    <button disabled={transferAmount <= 0} onClick={() => handleReceive(transferAmount)} className="btn-volt !py-2 !text-[9px] w-full">Confirm Receipt</button>
                                </div>
                            </StatusCard>

                            <StatusCard title="At Office" qty={scannedItem.qty_at_office} icon={<Building2 className="text-blue-500"/>} active={transferAmount > 0 && (scannedItem.qty_at_office || 0) >= transferAmount}>
                                <button disabled={transferAmount <= 0 || (scannedItem.qty_at_office || 0) < transferAmount} onClick={() => handleSendToSite(transferAmount)} className="btn-volt !bg-blue-600 !py-3 !text-[10px] w-full flex items-center justify-center gap-2">Send to Site <ArrowRight size={14}/></button>
                            </StatusCard>
                            
                            <StatusCard title="At Site (Ready)" qty={scannedItem.qty_at_site} icon={<HardHat className="text-green-600"/>} active={transferAmount > 0 && (scannedItem.qty_at_site || 0) >= transferAmount}>
                                <div className="space-y-2">
                                <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className="w-full p-2 text-[10px] font-bold border-2 border-slate-100 rounded-xl bg-white outline-none focus:border-brand-electric transition-all">
                                    <option value="">SELECT ROOM...</option>
                                    {rooms.map(r => <option key={r.id} value={r.id}>TR {r.id}</option>)}
                                </select>
                                <button disabled={transferAmount <= 0 || (scannedItem.qty_at_site || 0) < transferAmount} onClick={() => handleInstall(transferAmount)} className="btn-volt !bg-green-600 !py-2 !text-[9px] w-full flex items-center justify-center gap-1"><MapPin size={12} /> INSTALL</button>
                                </div>
                            </StatusCard>
                        </div>
                      </>
                  )}

                  {/* PIN PAD */}
                  {showPinPad && (
                      <div className="p-12 text-center bg-slate-50 animate-in fade-in">
                          <Lock size={48} className="mx-auto text-slate-300 mb-4"/>
                          <h3 className="text-brand-navy font-black uppercase tracking-widest mb-6">Security Clearance</h3>
                          <form onSubmit={handleUnlockAudit} className="max-w-xs mx-auto space-y-4">
                              <input 
                                autoFocus
                                type="password" 
                                pattern="[0-9]*" 
                                inputMode="numeric" 
                                placeholder="Enter PIN" 
                                className="w-full text-center p-4 rounded-xl border-2 border-slate-200 font-black text-2xl outline-none focus:border-brand-electric"
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => setShowPinPad(false)} className="flex-1 py-4 font-bold text-slate-400 uppercase text-xs hover:bg-slate-100 rounded-xl">Cancel</button>
                                <button type="submit" className="flex-1 py-4 bg-brand-navy text-white font-black uppercase text-xs rounded-xl shadow-lg">Unlock</button>
                              </div>
                          </form>
                      </div>
                  )}

                  {/* AUDIT MODE */}
                  {isAuditMode && (
                      <div className="p-8 bg-orange-50 animate-in slide-in-from-top-4 duration-300">
                          <div className="flex items-center gap-3 mb-6 text-orange-700">
                              <AlertTriangle />
                              <p className="font-black uppercase tracking-widest text-xs">Correction Mode Active</p>
                          </div>
                          
                          <div className="grid md:grid-cols-3 gap-8">
                              <AuditInput label="On Order" val={auditValues.order} onChange={(v: number) => setAuditValues({...auditValues, order: v})} />
                              <AuditInput label="At Office" val={auditValues.office} onChange={(v: number) => setAuditValues({...auditValues, office: v})} />
                              <AuditInput label="At Site" val={auditValues.site} onChange={(v: number) => setAuditValues({...auditValues, site: v})} />
                          </div>

                          <button onClick={handleAuditSave} className="w-full mt-8 py-5 bg-brand-navy text-white font-black rounded-2xl shadow-xl hover:bg-brand-electric transition-all flex items-center justify-center gap-3 uppercase tracking-widest">
                              <Save /> Save Corrections
                          </button>
                      </div>
                  )}

                </div>
              </div>
            ) : (
              <div className="h-full min-h-[500px] border-4 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center text-slate-200 p-12 text-center">
                <RefreshCcw size={48} className="opacity-20 animate-spin-slow mb-6" />
                <p className="text-lg font-black uppercase tracking-[0.3em] opacity-30 text-slate-400">Scanner Active</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* MASTER LIST VIEW */
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-50 flex gap-6 shadow-sm items-center focus-within:border-brand-electric transition-all">
                <Search className="text-slate-400" size={24} />
                <input type="text" placeholder="Search master catalog..." className="flex-1 outline-none text-lg font-bold text-slate-700" onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <div className="card-volt !p-0 overflow-hidden shadow-2xl border-0">
                <table className="w-full text-left">
                    <thead className="bg-brand-navy text-white text-[10px] font-black uppercase tracking-[0.2em]">
                        <tr>
                            <th className="px-8 py-6">Specification</th>
                            <th className="px-6 py-6 text-center">Rem. Scope</th>
                            <th className="px-6 py-6 text-center text-orange-400">Order</th>
                            <th className="px-6 py-6 text-center text-blue-400">Office</th>
                            <th className="px-6 py-6 text-center text-green-400">Site</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {allMaterials.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()) || m.part_number?.toLowerCase().includes(searchTerm.toLowerCase())).map((item) => (
                            <tr key={item.id} className="hover:bg-slate-50 cursor-pointer group" onClick={() => { setScannedItem(item); setActiveTab('scan'); }}>
                                <td className="px-8 py-6">
                                    <div className="font-black text-brand-navy group-hover:text-brand-electric transition-colors uppercase tracking-tight">{item.name}</div>
                                    <div className="text-[10px] font-data text-slate-400 uppercase mt-1">{item.part_number} • {item.id}</div>
                                </td>
                                <td className="px-6 py-6 text-center font-data text-slate-300 text-lg">{item.qty_bid_day}</td>
                                <td className="px-6 py-6 text-center font-data text-orange-600 text-lg">{item.qty_on_order || 0}</td>
                                <td className="px-6 py-6 text-center font-data text-blue-600 text-lg">{item.qty_at_office || 0}</td>
                                <td className="px-6 py-6 text-center font-data text-green-600 text-2xl">{item.qty_at_site || 0}</td>
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

function StatusCard({ title, qty, icon, children, active }: any) {
  return (
    <div className={`p-6 rounded-[2rem] border-2 transition-all flex flex-col gap-6 text-center ${active ? 'border-brand-electric shadow-glow ring-4 ring-brand-electric/10 bg-white' : 'border-slate-50 bg-slate-50/50'}`}>
      <div><div className="flex items-center justify-center gap-2 mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">{icon} {title}</div><div className={`text-4xl font-data ${active ? 'text-brand-navy' : 'text-slate-300'}`}>{qty || 0}</div></div>
      {children}
    </div>
  )
}

function AuditInput({ label, val, onChange }: any) {
    return (
        <div className="bg-white p-4 rounded-xl border border-orange-200 text-center shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-400 mb-2">{label}</p>
            <input type="number" value={val} onChange={(e) => onChange(parseInt(e.target.value) || 0)} className="w-full text-center font-black text-3xl text-brand-navy outline-none border-b-2 border-orange-100 focus:border-orange-500" />
        </div>
    )
}