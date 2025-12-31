'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabaseClient'
import Scanner from '../../../components/Scanner'
import { toast } from 'react-hot-toast'
import { CheckCircle, XCircle, QrCode, ArrowLeft, AlertTriangle, Lock, Unlock } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AuditPage() {
  const router = useRouter()
  
  // --- AUTH STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [pinInput, setPinInput] = useState('')

  // --- DATA STATE ---
  const [tools, setTools] = useState([])
  const [scannedIds, setScannedIds] = useState([]) 
  const [loading, setLoading] = useState(false)
  
  // --- UI STATE ---
  const [showScanner, setShowScanner] = useState(false)
  const [saving, setSaving] = useState(false)

  // Only fetch tools AFTER unlock
  const fetchTools = async () => {
    setLoading(true)
    const { data } = await supabase.from('tools').select('*').neq('status', 'maintenance').order('name')
    setTools(data || [])
    setLoading(false)
  }

  const handleUnlock = (e) => {
    e.preventDefault()
    if (pinInput === "8888") {
        setIsAuthenticated(true)
        toast.success("Audit Mode Unlocked")
        fetchTools() // Start loading data
    } else {
        toast.error("Incorrect PIN")
        setPinInput('')
    }
  }

  // 2. Handle a Scan
  const handleScan = (code) => {
    if (!code) return
    const foundTool = tools.find(t => t.qr_code === code)
    if (foundTool) {
      if (!scannedIds.includes(foundTool.id)) {
        setScannedIds(prev => [...prev, foundTool.id])
        toast.success(`Found: ${foundTool.name}`)
      }
    } else {
      toast.error("Unknown QR Code")
    }
  }

  // 3. Manual Check
  const toggleManual = (id) => {
    if (scannedIds.includes(id)) {
      setScannedIds(scannedIds.filter(x => x !== id))
    } else {
      setScannedIds([...scannedIds, id])
    }
  }

  // 4. Submit Audit
  const finishAudit = async () => {
    const missingCount = tools.length - scannedIds.length
    if (!window.confirm(`Finish Audit? \n\nFound: ${scannedIds.length}\nMissing: ${missingCount}`)) return

    setSaving(true)
    
    const missingTools = tools.filter(t => !scannedIds.includes(t.id)).map(t => t.name).join(', ')
    const note = `Audit Complete. Found ${scannedIds.length}/${tools.length}. Missing: ${missingTools || 'None'}`

    const { error } = await supabase.from('tool_logs').insert({
        tool_id: null,
        action_type: 'audit',
        user_name: 'Admin',
        location: 'Site Container',
        note: note
    })

    if (!error) {
      toast.success("Audit Saved!")
      router.push('/admin')
    } else {
      toast.error("Save failed")
      setSaving(false)
    }
  }

  // Calculations
  const progress = tools.length > 0 ? Math.round((scannedIds.length / tools.length) * 100) : 0
  const missingTools = tools.filter(t => !scannedIds.includes(t.id))
  const foundTools = tools.filter(t => scannedIds.includes(t.id))

  // --- 🔒 LOCK SCREEN VIEW ---
  if (!isAuthenticated) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-gray-100">
                <div className="bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg">
                    <Lock size={32} />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Inventory Audit</h1>
                <p className="text-gray-500 mb-6 text-sm">Authorized Personnel Only.</p>
                
                <form onSubmit={handleUnlock} className="space-y-4">
                    <input 
                        type="password" 
                        pattern="[0-9]*" 
                        inputMode="numeric" 
                        placeholder="Enter PIN" 
                        className="w-full text-center text-xl p-3 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none transition-all" 
                        value={pinInput} 
                        onChange={(e) => setPinInput(e.target.value)} 
                        autoFocus 
                    />
                    <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2">
                        <Unlock size={18} /> Start Audit
                    </button>
                </form>
                <Link href="/admin" className="block mt-6 text-sm text-gray-400 hover:text-gray-600">Back to Dashboard</Link>
            </div>
        </div>
    )
  }

  // --- 📋 AUDIT INTERFACE ---
  if (loading) return <div className="p-10 text-center font-bold text-gray-500">Loading Inventory...</div>

  return (
    <div className="p-4 max-w-xl mx-auto pb-24">
      
      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <Link href="/admin" className="text-gray-500 hover:text-blue-600"><ArrowLeft /></Link>
        <h1 className="text-2xl font-bold text-slate-900">Inventory Audit</h1>
        <div className="w-8"></div>
      </div>

      {/* PROGRESS BAR */}
      <div className="bg-white p-4 rounded-xl shadow-sm border mb-6 sticky top-2 z-10">
        <div className="flex justify-between text-sm font-bold mb-2">
            <span className="text-green-600">{scannedIds.length} Found</span>
            <span className="text-red-500">{tools.length - scannedIds.length} Missing</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div 
                className="bg-green-500 h-4 transition-all duration-500 ease-out" 
                style={{ width: `${progress}%` }}
            ></div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-2">{progress}% Complete</p>
      </div>

      {/* SCANNER TOGGLE */}
      <button 
        onClick={() => setShowScanner(!showScanner)}
        className={`w-full p-4 rounded-xl font-bold mb-6 flex items-center justify-center gap-2 transition-all ${showScanner ? 'bg-red-100 text-red-600' : 'bg-slate-900 text-white shadow-lg'}`}
      >
        {showScanner ? <><XCircle /> Stop Scanning</> : <><QrCode /> Start Scanner</>}
      </button>

      {showScanner && (
        <div className="mb-6 bg-black rounded-xl overflow-hidden border-4 border-slate-900 shadow-2xl">
            <Scanner onScan={handleScan} />
        </div>
      )}

      {/* LISTS */}
      <div className="space-y-8">
        {/* MISSING */}
        <div>
            <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2">
                <AlertTriangle size={18}/> Missing Items ({missingTools.length})
            </h3>
            <div className="space-y-2">
                {missingTools.map(tool => (
                    <div 
                        key={tool.id} 
                        onClick={() => toggleManual(tool.id)}
                        className="bg-white p-3 rounded-lg border border-red-100 shadow-sm flex justify-between items-center opacity-80 hover:opacity-100 cursor-pointer"
                    >
                        <div>
                            <p className="font-bold text-gray-800">{tool.name}</p>
                            <p className="text-xs text-red-400 font-mono">{tool.qr_code}</p>
                        </div>
                        <div className="w-6 h-6 rounded-full border-2 border-gray-300"></div>
                    </div>
                ))}
                {missingTools.length === 0 && <p className="text-green-500 text-sm italic">All items accounted for!</p>}
            </div>
        </div>

        {/* FOUND */}
        {foundTools.length > 0 && (
            <div>
                <h3 className="font-bold text-green-600 mb-3 flex items-center gap-2">
                    <CheckCircle size={18}/> Scanned ({foundTools.length})
                </h3>
                <div className="space-y-2">
                    {foundTools.map(tool => (
                        <div 
                            key={tool.id} 
                            onClick={() => toggleManual(tool.id)}
                            className="bg-green-50 p-3 rounded-lg border border-green-100 flex justify-between items-center cursor-pointer"
                        >
                            <div>
                                <p className="font-bold text-green-800">{tool.name}</p>
                                <p className="text-xs text-green-600 font-mono">{tool.qr_code}</p>
                            </div>
                            <CheckCircle className="text-green-600" size={24} />
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      {/* FOOTER ACTION */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 z-20">
        <button 
            onClick={finishAudit}
            disabled={saving}
            className="w-full max-w-xl mx-auto bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2"
        >
            {saving ? 'Saving...' : `Finish Audit (${scannedIds.length}/${tools.length})`}
        </button>
      </div>

    </div>
  )
}