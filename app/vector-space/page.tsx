"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

export default function VectorSpaceVisualization() {
  const [plotData, setPlotData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch('/api/viz-data')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setLoading(false);
          return;
        }

        const traces = [];
        const colors = {
          'Infrastructure': '#3b82f6', // blue
          'Application': '#8b5cf6', // purple
          'Security': '#ef4444', // red
          'Database': '#f59e0b', // amber
          'Network': '#10b981', // emerald
          'Access Management': '#ec4899', // pink
        };

        for (const [category, coords] of Object.entries(data)) {
          traces.push({
            x: (coords as any).x,
            y: (coords as any).y,
            z: (coords as any).z,
            text: (coords as any).titles,
            mode: 'markers',
            type: 'scatter3d',
            name: category,
            marker: {
              size: 4,
              color: (colors as any)[category] || '#ffffff',
              opacity: 0.8
            },
            hovertemplate: '<b>%{text}</b><br>Category: ' + category + '<extra></extra>'
          });
        }
        setPlotData(traces);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load visualization data.");
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 tracking-tight">AI Brain Visualization</h1>
        <p className="text-neutral-400 mb-8 max-w-2xl text-lg">
          This 3D scatter plot represents the high-dimensional mathematical space of our trained Machine Learning classifier. 
          The 384-dimensional ticket embeddings have been compressed to 3 dimensions using Principal Component Analysis (PCA). 
          Notice how the ML model naturally clusters overlapping concepts (e.g., Network vs Infrastructure) without any human intervention.
        </p>

        {loading ? (
          <div className="flex items-center justify-center h-[600px] border border-neutral-800 rounded-xl bg-neutral-900/50">
            <div className="text-xl animate-pulse">Loading Tensor Data...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-[600px] border border-red-900/50 text-red-400 rounded-xl bg-red-900/10">
            {error}
          </div>
        ) : (
          <div className="border border-neutral-800 rounded-xl overflow-hidden bg-black/50 shadow-2xl">
            {typeof window !== 'undefined' && (
              <Plot
                data={plotData}
                layout={{
                  autosize: true,
                  height: 700,
                  margin: { l: 0, r: 0, b: 0, t: 0 },
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                  scene: {
                    xaxis: { showgrid: true, gridcolor: '#333', zerolinecolor: '#555', title: 'PCA 1', showbackground: false },
                    yaxis: { showgrid: true, gridcolor: '#333', zerolinecolor: '#555', title: 'PCA 2', showbackground: false },
                    zaxis: { showgrid: true, gridcolor: '#333', zerolinecolor: '#555', title: 'PCA 3', showbackground: false },
                    camera: { eye: { x: 1.5, y: 1.5, z: 1.5 } }
                  },
                  legend: { font: { color: '#fff' } }
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '100%' }}
                config={{ responsive: true, displayModeBar: false }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
