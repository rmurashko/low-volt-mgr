'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../utils/supabaseClient'
import Papa from 'papaparse'
import { toast } from 'react-hot-toast'
import { 
  FileUp, History, Package, Lock, ShieldCheck, 
  Printer, Search, Trash2, Plus, X, Map, FileSpreadsheet, 
  Building2, Download, AlertTriangle, Terminal, Database, Wrench
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [activeTab, setActiveTab] = useState('upload')
  const [logs, setLogs] = useState<string[]>([]) 
  const [allMaterials, setAllMaterials] = useState<any[]>([])
  const [allTools, setAllTools] = useState<any[]>([]) // New State for Tools
  const [allRooms, setAllRooms] = useState<any[]>([])
  
  // Edit/Manual State
  const [newRoomId, setNewRoomId] = useState('')
  const [newBldg, setNewBldg] = useState('')
  const [editSearch, setEditSearch] = useState('')

  // QR Generator State
  const [qrSearch, setQrSearch] = useState('')
  const [qrSource, setQrSource] = useState<'materials' | 'tools'>('materials') // Toggle State
  const [selectedItems, setSelectedItems] = useState<any[]>([])

  // History State
  const [toolHistory, setToolHistory] = useState<any[]>([])
  const [materialHistory, setMaterialHistory] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Part Mapping
  const PART_MAP = {
    standing_rack: 'OR-MM2073038-W',
    wm_rack: '12419-E48',
    standing_pdu: 'AP8861',
    wm_pdu: 'AP9563',
    standing_ups: 'ZC0517708100000',
    wm_ups: 'SU3000RMXL3U',
    patch_panel: 'PHAHJU48-W'
  }

  useEffect(() => {
    if (isAuthenticated) {
        fetchInitialData()
        if (activeTab === 'history') fetchHistory()
    }
  }, [activeTab, isAuthenticated])

  const fetchInitialData = async () => {
    const { data: mats } = await supabase.from('materials').select('*').order('name')
    const { data: tools } = await supabase.from('tools').select('*').order('name') // Fetch Tools
    const { data: rooms } = await supabase.from('rooms').select('*').order('id')
    setAllMaterials(mats || [])
    setAllTools(tools || [])
    setAllRooms(rooms || [])
  }

  const fetchHistory = async () => {
    setLoadingHistory(true)
    try {
        const { data: tools } = await supabase.from('tools').select('id, name')
        const { data: materials } = await supabase.from('materials').select('id, name, unit')
        const toolMap: any = {}; tools?.forEach(t => toolMap[t.id] = t.name)
        const matMap: any = {}; materials?.forEach(m => matMap[m.id] = m)
        const { data: tLogs } = await supabase.from('tool_logs').select('*').order('created_at', { ascending: false }).limit(50)
        const { data: mLogs } = await supabase.from('inventory_ledger').select('*').order('created_at', { ascending: false }).limit(50)
        setToolHistory(tLogs?.map(log => ({ ...log, tool_name: toolMap[log.tool_id] || 'Unknown' })) || [])
        setMaterialHistory(mLogs?.map(log => ({ ...log, item_name: matMap[log.material_id]?.name || 'Unknown', unit: matMap[log.material_id]?.unit || '' })) || [])
    } catch (err) { console.error(err) } 
    finally { setLoadingHistory(false) }
  }

  // --- 1. NUCLEAR WIPE ---
  const wipeAllRoomData = async () => {
    if (!confirm("⚠️ WARNING: This deletes ALL Room & Requirement data. Continue?")) return
    const tid = toast.loading("Wiping database...")
    const { error: reqErr } = await supabase.from('room_requirements').delete().neq('id', '00000000-0000-0000-0000-000000000000') 
    const { error: roomErr } = await supabase.from('rooms').delete().neq('id', 'WIPE_SENTRY')
    if (reqErr || roomErr) toast.error("Wipe had errors", { id: tid })
    else { toast.success("Database Cleared", { id: tid }); fetchInitialData(); setLogs(['Database wiped clean. Ready for import.']) }
  }

  // --- 2. BULK BID IMPORT ---
  const handleBulkBidUpload = (event: any) => {
    const file = event.target.files[0]; if (!file) return
    setLogs(['Reading Bid CSV...'])
    Papa.parse(file, { header: false, skipEmptyLines: true, complete: async (results) => { await processBulkMaterialData(results.data) } })
  }

  const processBulkMaterialData = async (rows: any[]) => {
    let newLog = []; let headerIndex = -1;
    for (let i = 0; i < rows.length; i++) { if (JSON.stringify(rows[i]).includes('Item Description')) { headerIndex = i; break; } }
    if (headerIndex === -1) { toast.error("Headers not found"); return; }
    const headers = rows[headerIndex]; const dataRows = rows.slice(headerIndex + 1);
    const descIdx = headers.indexOf('Item Description'); const qtyIdx = headers.indexOf('Qty');
    const partIdx = headers.indexOf('Part Number'); const mfgIdx = headers.indexOf('Manufacturer');
    let count = 0;
    for (const row of dataRows) {
      const name = row[descIdx]?.toString().trim(); const part = row[partIdx]?.toString().trim() || 'N/A';
      if (!name) continue;
      const { data: existing } = await supabase.from('materials').select('id').eq('part_number', part).maybeSingle();
      const qrId = existing?.id || `VM-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      await supabase.from('materials').upsert({ id: qrId, part_number: part, name: name, category: row[mfgIdx] || 'General', qty_bid_day: parseInt(row[qtyIdx]) || 0, unit: 'pcs' }, { onConflict: 'id' })
      count++;
    }
    newLog.push(`✅ Synced ${count} items.`); setLogs(newLog); toast.success("Materials Synced"); fetchInitialData()
  }

  // --- 3. TR TRACKER IMPORT ---
  const handleTRTrackerUpload = (event: any) => {
    const file = event.target.files[0]; if (!file) return
    setLogs(['Reading CSV...'])
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: async (results) => { await processTRRows(results.data) } })
  }

  const processTRRows = async (data: any[]) => {
    let newLogs: string[] = []; let successCount = 0; let errorCount = 0
    const { data: mats } = await supabase.from('materials').select('id, part_number')
    const partMap: any = {}
    mats?.forEach(m => partMap[m.part_number?.trim()] = m.id)
    newLogs.push(`Processing ${data.length} rows...`)

    for (const row of data) {
      const normalizedRow: any = {}; Object.keys(row).forEach(key => { normalizedRow[key.toLowerCase().trim()] = row[key] })
      const trVal = normalizedRow['tr'] || normalizedRow['room'] || normalizedRow['room id']
      const bldgVal = normalizedRow['bldg(floor)'] || normalizedRow['building'] || normalizedRow['bldg']
      if (!trVal || trVal === 'TR' || normalizedRow['rack qty & type'] === 'Descope') continue 

      const rackKey = Object.keys(normalizedRow).find(k => k.includes('rack') && k.includes('qty'))
      const upsKey = Object.keys(normalizedRow).find(k => k.includes('ups') && k.includes('qty'))
      const pduKey = Object.keys(normalizedRow).find(k => k.includes('pdu') && k.includes('qty'))
      const cableKey = Object.keys(normalizedRow).find(k => k.includes('cable') && k.includes('count'))

      const rackStr = normalizedRow[rackKey || ''] || ""; const isWM = rackStr.toUpperCase().includes('WM')
      const cableCount = parseInt((normalizedRow[cableKey || ''] || "").match(/\d+/)?.[0] || '0')
      let patchPanelQty = 0
      if (cableCount > 0) { const required = Math.ceil(cableCount / 48); patchPanelQty = (required % 2 === 0) ? required : required + 1 }

      const reqs = [
        { part: isWM ? PART_MAP.wm_rack : PART_MAP.standing_rack, qty: parseInt(rackStr.match(/\d+/)?.[0] || '0'), type: 'Rack' },
        { part: isWM ? PART_MAP.wm_ups : PART_MAP.standing_ups, qty: parseInt((normalizedRow[upsKey || ''] || "").match(/\d+/)?.[0] || '0'), type: 'UPS' },
        { part: isWM ? PART_MAP.wm_pdu : PART_MAP.standing_pdu, qty: parseInt((normalizedRow[pduKey || ''] || "").match(/\d+/)?.[0] || '0'), type: 'PDU' },
        { part: PART_MAP.patch_panel, qty: patchPanelQty, type: 'Patch Panel' }
      ]

      const { error: roomErr } = await supabase.from('rooms').upsert({ id: trVal.trim(), building_number: bldgVal?.split('(')[0] || 'Unknown' })
      if (roomErr) { newLogs.push(`❌ Room Save Error (${trVal}): ${roomErr.message}`); errorCount++; continue; }

      let itemsAdded = 0
      for (const req of reqs) {
        if (req.qty > 0) {
          let internalId = partMap[req.part]
          if (!internalId) {
             const newId = `AUTO-${req.part}`; await supabase.from('materials').upsert({ id: newId, part_number: req.part, name: `⚠️ AUTO: ${req.part}`, category: 'Auto-Imported', qty_bid_day: 0 }); internalId = newId; partMap[req.part] = newId; newLogs.push(`⚡ Created part: ${req.part}`)
          }
          const { error: linkErr } = await supabase.from('room_requirements').upsert({ tr_id: trVal.trim(), material_id: internalId, qty_required: req.qty }, { onConflict: 'tr_id, material_id' })
          if (linkErr) { newLogs.push(`❌ Link Error (${trVal}): ${linkErr.message}`); errorCount++ } else { itemsAdded++ }
        }
      }
      if (itemsAdded > 0) successCount++
    }
    if (errorCount > 0) newLogs.push(`⚠️ WARNING: ${errorCount} DB Errors occurred.`)
    newLogs.push(`🎉 FINISHED: Configured ${successCount} TR Rooms.`)
    setLogs(newLogs)
    if (successCount > 0) { toast.success(`Imported ${successCount} Rooms`); fetchInitialData() } else { toast.error("Import Failed. Check Logs.") }
  }

  // --- MANUAL & UTILS ---
  const handleAddRoomManual = async (e: React.FormEvent) => { e.preventDefault(); if (!newRoomId || !newBldg) return toast.error("Missing Info"); await supabase.from('rooms').upsert({ id: newRoomId.trim().toUpperCase(), building_number: newBldg.trim() }); toast.success("Room Added"); fetchInitialData() }
  const deleteRoom = async (id: string) => { if (!confirm(`Delete TR ${id}?`)) return; await supabase.from('rooms').delete().eq('id', id); fetchInitialData() }
  const deleteMaterial = async (id: string) => { if (!confirm(`Delete Item?`)) return; await supabase.from('materials').delete().eq('id', id); fetchInitialData() }
  const handleUnlock = (e: any) => { e.preventDefault(); if (passwordInput === "8888") { setIsAuthenticated(true); toast.success("Access Granted") } else { toast.error("Incorrect PIN"); setPasswordInput('') } }
  const exportTRToCSV = () => { const csv = Papa.unparse(allRooms); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'LowVolt_Rooms.csv'; a.click() }

  if (!isAuthenticated) return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] p-4">
      <div className="card-volt w-full max-w-sm text-center shadow-2xl border-brand-electric/20">
        <div className="w-20 h-20 bg-brand-navy rounded-3xl flex items-center justify-center mx-auto mb-6 text-brand-electric shadow-glow"><Lock size={40} /></div>
        <h1 className="text-3xl font-black mb-2 text-brand-navy tracking-tight uppercase tracking-tighter">LOW VOLT MGR</h1>
        <form onSubmit={handleUnlock} className="space-y-4"><input type="password" placeholder="••••" className="w-full p-5 bg-slate-50 border-2 rounded-2xl text-center text-4xl font-black tracking-[0.5em] outline-none" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} autoFocus /><button type="submit" className="btn-volt w-full py-5 text-lg font-black uppercase">Unlock</button></form>
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6 print:hidden">
          <div className="flex items-center gap-5"><div className="p-4 bg-brand-navy rounded-2xl text-brand-electric shadow-lg"><ShieldCheck size={32} /></div><div><h1 className="text-3xl font-black text-brand-navy tracking-tight uppercase tracking-tighter">LOW VOLT <span className="text-brand-electric">MGR</span></h1><p className="text-[10px] text-slate-400 font-black tracking-[0.3em] uppercase font-data">Admin Console</p></div></div>
          <button onClick={() => setIsAuthenticated(false)} className="btn-outline-volt !text-red-500">LOGOUT</button>
      </div>

      <div className="flex bg-white/80 backdrop-blur-md rounded-[2rem] shadow-sm mb-10 border-2 border-slate-100 overflow-hidden print:hidden overflow-x-auto">
        <button onClick={() => setActiveTab('upload')} className={`flex-1 p-6 font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'upload' ? 'bg-brand-navy text-white' : 'text-slate-400 hover:text-brand-navy'}`}>Data Import</button>
        <button onClick={() => setActiveTab('edit')} className={`flex-1 p-6 font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'edit' ? 'bg-brand-navy text-white' : 'text-slate-400 hover:text-brand-navy'}`}>Master Data</button>
        <button onClick={() => setActiveTab('qrgen')} className={`flex-1 p-6 font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'qrgen' ? 'bg-brand-navy text-white' : 'text-slate-400 hover:text-brand-navy'}`}>Label Factory</button>
        <button onClick={() => setActiveTab('history')} className={`flex-1 p-6 font-black text-[10px] uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'history' ? 'bg-brand-navy text-white' : 'text-slate-400 hover:text-brand-navy'}`}>Logs</button>
      </div>

      {activeTab === 'upload' && (
        <div className="grid md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            <div className="card-volt !p-8 border-slate-100 shadow-sm">
                <h2 className="text-lg font-black text-brand-navy uppercase mb-4 flex items-center gap-2"><FileSpreadsheet className="text-brand-electric"/> Project Bid Sync</h2>
                <div className="border-4 border-dashed border-slate-50 rounded-3xl p-10 text-center relative hover:border-brand-electric transition-all group">
                    <input type="file" accept=".csv" onChange={handleBulkBidUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <FileUp size={40} className="mx-auto mb-4 text-slate-300 group-hover:text-brand-navy transition-colors" />
                    <p className="text-sm font-black text-brand-navy uppercase tracking-tight">Upload Master Catalog</p>
                </div>
            </div>
            <div className="card-volt !p-8 border-brand-electric/20 shadow-lg shadow-brand-electric/5">
                <h2 className="text-lg font-black text-brand-navy uppercase mb-4 flex items-center gap-2"><Map className="text-brand-electric"/> TR Tracker Sync</h2>
                <div className="border-4 border-dashed border-slate-50 rounded-3xl p-10 text-center relative hover:border-brand-electric transition-all group">
                    <input type="file" accept=".csv" onChange={handleTRTrackerUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <FileUp size={40} className="mx-auto mb-4 text-slate-300 group-hover:text-brand-electric transition-colors" />
                    <p className="text-sm font-black text-brand-navy uppercase tracking-tight">Upload TR Tracker CSV</p>
                </div>
            </div>
            <div className="col-span-2 bg-brand-navy p-6 rounded-[2rem] h-[300px] overflow-hidden flex flex-col shadow-xl">
                <div className="flex items-center gap-2 border-b border-white/10 pb-4 mb-2"><Terminal size={16} className="text-green-400" /><p className="text-xs font-mono text-green-400 uppercase tracking-widest">System Log</p></div>
                <div className="flex-1 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1 pr-2 custom-scrollbar">{logs.map((log, i) => (<p key={i} className={`py-0.5 border-b border-white/5 ${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : ''}`}><span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>{log}</p>))}</div>
            </div>
        </div>
      )}

      {activeTab === 'edit' && (
        <div className="grid lg:grid-cols-12 gap-10 animate-in fade-in">
            <div className="lg:col-span-5 flex flex-col gap-6">
                <div className="card-volt !bg-red-50 border-red-200">
                    <h3 className="text-xs font-black text-red-800 mb-4 uppercase flex items-center gap-2"><AlertTriangle size={18}/> Wipe Zone</h3>
                    <button onClick={wipeAllRoomData} className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200">DELETE ALL ROOM DATA</button>
                </div>
                <div className="card-volt !p-8 h-[400px] flex flex-col">
                    <div className="flex justify-between items-center mb-6"><h3 className="text-xs font-black text-brand-navy uppercase">Room Index ({allRooms.length})</h3><button onClick={exportTRToCSV} className="text-[10px] font-black text-brand-electric flex items-center gap-1"><Download size={14}/> EXPORT</button></div>
                    <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">{allRooms.map(room => (<div key={room.id} className="p-3 bg-slate-50 border rounded-xl flex justify-between items-center"><div><p className="text-xs font-black">TR {room.id}</p><p className="text-[9px] font-data text-slate-400">Bldg {room.building_number}</p></div><button onClick={() => deleteRoom(room.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16}/></button></div>))}</div>
                </div>
            </div>
            <div className="lg:col-span-7 card-volt h-full flex flex-col min-h-[600px]">
                <h3 className="text-xs font-black text-brand-navy mb-6 uppercase flex items-center gap-3"><Package className="text-orange-500" /> Catalog Management</h3>
                <div className="relative mb-6"><Search className="absolute left-4 top-4 text-slate-400" size={20} /><input type="text" placeholder="Search catalog..." className="w-full pl-12 p-4 bg-slate-50 border-2 rounded-2xl outline-none font-bold" value={editSearch} onChange={(e) => setEditSearch(e.target.value)} /></div>
                <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">{allMaterials.filter(m => m.name.toLowerCase().includes(editSearch.toLowerCase())).map(item => (<div key={item.id} className="p-4 border rounded-2xl flex justify-between items-center hover:bg-slate-50"><div><p className="text-sm font-black text-brand-navy uppercase">{item.name}</p><p className="text-[10px] font-data text-slate-400">{item.id}</p></div><button onClick={() => deleteMaterial(item.id)} className="p-3 text-slate-300 hover:text-red-500"><Trash2 size={20}/></button></div>))}</div>
            </div>
        </div>
      )}

      {/* QR GENERATOR TAB (UPDATED FOR TOOLS) */}
      {activeTab === 'qrgen' && (
        <div className="grid lg:grid-cols-12 gap-10 animate-in fade-in">
            <div className="lg:col-span-7 card-volt h-[700px] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-black text-brand-navy uppercase tracking-tighter flex items-center gap-2">Label Factory</h2>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button onClick={() => setQrSource('materials')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${qrSource === 'materials' ? 'bg-brand-navy text-white shadow-md' : 'text-slate-400'}`}>Equipment</button>
                        <button onClick={() => setQrSource('tools')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${qrSource === 'tools' ? 'bg-brand-navy text-white shadow-md' : 'text-slate-400'}`}>Tools</button>
                    </div>
                </div>
                
                <div className="relative mb-6">
                    <Search className="absolute left-4 top-4 text-slate-400" size={20} />
                    <input type="text" placeholder={`Search ${qrSource}...`} className="w-full pl-12 p-4 bg-slate-50 border-2 rounded-2xl font-bold outline-none focus:border-brand-electric" value={qrSearch} onChange={(e) => setQrSearch(e.target.value)} />
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                    {(qrSource === 'materials' ? allMaterials : allTools)
                        .filter(item => item.name.toLowerCase().includes(qrSearch.toLowerCase()))
                        .map(item => (
                        <div key={item.id} className="p-4 border-2 rounded-2xl hover:bg-slate-50 flex justify-between items-center group transition-colors">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl ${qrSource === 'tools' ? 'bg-orange-100 text-orange-600' : 'bg-blue-50 text-blue-500'}`}>
                                    {qrSource === 'tools' ? <Wrench size={18}/> : <Package size={18}/>}
                                </div>
                                <div>
                                    <p className="text-sm font-black text-brand-navy uppercase tracking-tight">{item.name}</p>
                                    {qrSource === 'materials' ? (
                                        <p className="text-[10px] font-data text-slate-400">{item.part_number} • {item.id}</p>
                                    ) : (
                                        <p className="text-[10px] font-data text-slate-400">{item.brand} • {item.id}</p>
                                    )}
                                </div>
                            </div>
                            <button onClick={() => setSelectedItems([...selectedItems, item])} className="p-3 bg-brand-navy/5 text-brand-navy rounded-xl hover:bg-brand-electric hover:text-white transition-all shadow-sm"><Plus size={20}/></button>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* PRINT QUEUE */}
            <div className="lg:col-span-5 flex flex-col gap-8">
                <div className="bg-brand-navy p-8 rounded-[2.5rem] shadow-2xl flex flex-col h-full text-white ring-4 ring-brand-navy/5">
                    <h2 className="text-xl font-black flex items-center gap-3 text-brand-electric mb-8 tracking-tight uppercase"><Printer/> Print Queue ({selectedItems.length})</h2>
                    <div className="flex-1 overflow-y-auto space-y-4 min-h-[300px] custom-scrollbar">
                        {selectedItems.map((item, idx) => (
                            <div key={idx} className="bg-white/5 p-4 rounded-2xl flex justify-between items-center border border-white/10 animate-in slide-in-from-right-4">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-tight">{item.name}</p>
                                    <p className="text-[8px] font-mono text-slate-400">{item.id}</p>
                                </div>
                                <button onClick={() => setSelectedItems(selectedItems.filter((_, i) => i !== idx))} className="hover:text-red-400 transition-colors"><X size={18}/></button>
                            </div>
                        ))}
                        {selectedItems.length === 0 && <p className="text-center text-slate-500 italic text-sm mt-10">Queue is empty.</p>}
                    </div>
                    <button onClick={() => window.print()} className="mt-8 btn-volt !bg-brand-electric !text-brand-navy !py-5 font-black uppercase shadow-lg shadow-brand-electric/20 tracking-widest">Generate Labels</button>
                </div>
            </div>
            
            {/* HIDDEN PRINT LAYOUT */}
            {selectedItems.length > 0 && (
                <div className="hidden print:flex lg:col-span-12 card-volt !bg-white fixed inset-0 z-[9999] overflow-auto">
                    <div className="flex flex-wrap gap-4 justify-start p-8">
                        {selectedItems.map((item, idx) => (
                            <div key={`${item.id}-${idx}`} className="w-[48%] md:w-[30%] lg:w-[22%] border-2 border-black p-6 rounded-xl flex flex-col items-center text-center break-inside-avoid">
                                <QRCodeSVG value={item.id} size={120} level="H" includeMargin={true} />
                                <p className="text-[12px] font-black text-black mt-2 font-data uppercase leading-none">{item.id}</p>
                                <p className="text-[10px] font-bold text-black leading-tight line-clamp-2 uppercase mt-1">{item.name}</p>
                                <p className="text-[8px] text-black uppercase mt-1 border-t border-black w-full pt-1">Low Volt Mgr</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div className="grid lg:grid-cols-2 gap-10 animate-in fade-in">
            <div className="card-volt flex flex-col h-[600px]">
                <h3 className="text-xs font-black text-brand-navy mb-8 uppercase tracking-[0.2em] flex items-center gap-3"><History className="text-brand-electric" /> Tool Logistics</h3>
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                    {toolHistory.map((log: any) => (
                        <div key={log.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex justify-between items-center group">
                            <div><p className="text-xs font-black text-brand-navy uppercase tracking-tight">{log.tool_name}</p><p className="text-[10px] font-black text-brand-electric uppercase tracking-widest mt-1 font-data">{log.action_type}</p></div>
                            <p className="text-[10px] font-data text-slate-300 uppercase font-bold">{new Date(log.created_at).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            </div>
            <div className="card-volt flex flex-col h-[600px]">
                <h3 className="text-xs font-black text-brand-navy mb-8 uppercase tracking-[0.2em] flex items-center gap-3"><Package className="text-orange-500" /> Material Consumption</h3>
                <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                    {materialHistory.map((log: any) => (
                        <div key={log.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl flex justify-between items-center group">
                            <div><p className="text-xs font-black text-brand-navy uppercase tracking-tight">{log.item_name}</p><p className={`text-[10px] font-black font-data uppercase tracking-widest mt-1 ${log.quantity < 0 ? 'text-red-500' : 'text-green-600'}`}>{log.quantity > 0 ? '+' : ''}{log.quantity} {log.unit}</p></div>
                            <p className="text-[10px] font-data text-slate-300 uppercase font-bold">{new Date(log.created_at).toLocaleDateString()}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  )
}