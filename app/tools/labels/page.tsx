'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../../utils/supabaseClient'
import QRCode from 'react-qr-code'
import { Printer, CheckSquare, Square, ArrowLeft, Eye, Lock, Unlock } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'react-hot-toast'

export default function LabelGenerator() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [pinInput, setPinInput] = useState('')
  const [tools, setTools] = useState([])
  const [selected, setSelected] = useState([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState('selection') 

  const fetchTools = async () => {
    setLoading(true)
    const { data } = await supabase.from('tools').select('*').order('name')
    setTools(data || [])
    setLoading(false)
  }

  const handleUnlock = (e) => {
    e.preventDefault()
    if (pinInput === "8888") {
        setIsAuthenticated(true)
        toast.success("Access Granted")
        fetchTools()
    } else {
        toast.error("Incorrect PIN")
        setPinInput('')
    }
  }

  const toggleSelect = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(x => x !== id))
    } else {
      setSelected([...selected, id])
    }
  }

  const handlePrint = () => {
    window.print()
  }

  // --- 🔒 LOCK SCREEN ---
  if (!isAuthenticated) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-sm w-full text-center border border-gray-100">
                <div className="bg-slate-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 text-white shadow-lg">
                    <Lock size={32} />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">Restricted Access</h1>
                <p className="text-gray-500 mb-6 text-sm">Please enter Admin PIN to print labels.</p>
                
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
                        <Unlock size={18} /> Unlock System
                    </button>
                </form>
                <Link href="/admin" className="block mt-6 text-sm text-gray-400 hover:text-gray-600">Back to Dashboard</Link>
            </div>
        </div>
    )
  }

  // --- 👁️ PRINT PREVIEW SCREEN ---
  if (viewMode === 'print_preview') {
    return (
      <div className="bg-white min-h-screen p-8">
        <div className="print:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50 rounded-lg mb-8 shadow-xl">
            <h2 className="font-bold text-xl flex items-center gap-2"><Printer/> Ready to Print</h2>
            <div className="flex gap-4">
                <button 
                    onClick={() => setViewMode('selection')} 
                    className="text-gray-300 hover:text-white underline font-medium"
                >
                    Back to Selection
                </button>
                <button 
                    onClick={handlePrint} 
                    className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-bold shadow-lg transform active:scale-95 transition-all flex items-center gap-2"
                >
                    PRINT NOW <Printer size={16}/>
                </button>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-8">
            {tools.filter(t => selected.includes(t.id)).map(tool => (
                <div key={tool.id} className="border-4 border-black p-4 flex flex-col items-center justify-center text-center aspect-square rounded-xl break-inside-avoid">
                    <h2 className="font-bold text-2xl mb-2 text-black">{tool.name}</h2>
                    <QRCode value={tool.qr_code || 'MISSING'} size={150} />
                    <p className="font-mono text-lg mt-2 text-black">{tool.qr_code}</p>
                </div>
            ))}
        </div>
        <style jsx global>{` 
            @media print { 
                body * { visibility: hidden; } 
                .grid, .grid * { visibility: visible; } 
                .grid { position: absolute; left: 0; top: 0; width: 100%; } 
                .print\\:hidden { display: none !important; } 
            } 
        `}</style>
      </div>
    )
  }

  // --- 📋 SELECTION SCREEN ---
  return (
    <div className="p-8 max-w-4xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-4">
        <Link href="/admin" className="text-gray-500 hover:text-blue-600"><ArrowLeft /></Link>
        <h1 className="text-3xl font-bold text-slate-800">QR Label Generator</h1>
      </div>

      <div className="flex gap-4 mb-6 sticky top-0 bg-white z-10 p-4 shadow-lg border-b rounded-xl ring-1 ring-gray-200">
        <button 
            onClick={() => {
                if(selected.length === 0) return toast.error("Select at least one tool!");
                setViewMode('print_preview');
            }}
            className="bg-slate-900 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-700 shadow-xl transition-all"
        >
          <Eye size={20} /> Preview & Print ({selected.length})
        </button>
        
        <button onClick={() => setSelected(tools.map(t => t.id))} className="text-gray-600 font-bold px-4 hover:bg-gray-100 rounded">Select All</button>
        <button onClick={() => setSelected([])} className="text-gray-600 font-bold px-4 hover:bg-gray-100 rounded">Clear</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {tools.map(tool => (
          <div 
            key={tool.id} 
            onClick={() => toggleSelect(tool.id)} 
            className={`p-4 rounded-xl border-2 cursor-pointer flex items-center justify-between transition-all ${selected.includes(tool.id) ? 'bg-blue-50 border-blue-500 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'}`}
          >
            <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${tool.qr_code ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="font-bold text-gray-800">{tool.name}</span>
            </div>
            {selected.includes(tool.id) ? <CheckSquare className="text-blue-600" size={24}/> : <Square className="text-gray-300" size={24}/>}
          </div>
        ))}
      </div>
    </div>
  )
}