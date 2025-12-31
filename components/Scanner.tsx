'use client'
import { useState, useEffect } from 'react'
import { QrReader } from 'react-qr-reader'

const Scanner = ({ onScan }) => {
  const [hasMounted, setHasMounted] = useState(false)
  const [lastScan, setLastScan] = useState('')

  // Sanity Fix 1: Prevent "Window not defined" error in Next.js
  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return (
      <div className="h-64 w-full bg-slate-900 flex items-center justify-center">
        <p className="text-slate-500 text-xs animate-pulse font-mono">INITIALIZING CAMERA...</p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden">
      <div className="w-full aspect-square md:aspect-video relative">
        <QrReader
          onResult={(result, error) => {
            if (!!result) {
              const text = result?.getText() // Updated for v3.0.0-beta-1 syntax
              
              // Sanity Fix 2: Throttling
              // This prevents the app from firing 100 scans for a single QR code
              if (text !== lastScan) {
                setLastScan(text)
                onScan(text)
                
                // Feedback: Optional - clear the "lastScan" after 2 seconds 
                // to allow scanning the same item twice if needed
                setTimeout(() => setLastScan(''), 2000)
              }
            }
          }}
          constraints={{ 
            facingMode: 'environment',
            aspectRatio: 1 // Forces a square view for better alignment on mobile
          }}
          // Sanity Fix 3: Proper Video Container Styling
          containerStyle={{ width: '100%', height: '100%' }}
          videoStyle={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />

        {/* Visual Scanning Guide Overlay */}
        <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
            <div className="w-full h-full border-2 border-brand-electric/50 relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-brand-electric"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-brand-electric"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-brand-electric"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-brand-electric"></div>
            </div>
        </div>
      </div>
      
      <div className="absolute bottom-4 bg-brand-navy/80 px-4 py-1 rounded-full border border-white/20">
         <p className="text-white text-[10px] font-bold tracking-widest uppercase animate-pulse">
            Ready to Scan
         </p>
      </div>
    </div>
  )
}

export default Scanner