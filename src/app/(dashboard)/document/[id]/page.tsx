"use client";

import React, { useState } from 'react';
import MobileLayout from '@/components/Navigation/MobileLayout';
import { ArrowLeft, Check, Award, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

const mockDocDetails = {
  title: "Incident Escalation Protocol",
  subject: "Standard Operating Procedures (SOPs)",
  lastUpdated: "June 17, 2026",
  steps: [
    { 
      title: "Triage & Classification", 
      summary: "Identify severity parameters quickly.", 
      body: "Review systematic telemetry dashboard triggers immediately upon ticket arrival. Assign severity ratings between Severity-1 (Critical System Outage) and Severity-4 (Minor Functional UI Bug)." 
    },
    { 
      title: "Stakeholder Communication Flow", 
      summary: "Notify active support channels.", 
      body: "Send a structured incident summary dispatch wire directly into the designated emergency communication channels within 10 minutes of initial service drop verification." 
    },
    {
      title: "Root Cause Resolution Log",
      summary: "Prevent recurring system patterns.",
      body: "Document system logs, structural code adjustments, and immediate hotfixes within the team documentation registry inside 48 hours to prevent code regression anomalies."
    }
  ]
};

export default function DocumentStepViewer() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [isSignedOff, setIsSignedOff] = useState(false);

  return (
    <MobileLayout userRole="admin">
      
      {/* Top Header Row with Back Button */}
      <div className="flex items-center gap-2 mb-4 -ml-1">
        <button 
          onClick={() => router.back()} 
          className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{mockDocDetails.subject}</span>
          <h1 className="text-lg font-bold text-gray-900浏览 leading-tight">{mockDocDetails.title}</h1>
        </div>
      </div>

      {/* Revision Timeline Date Stamp */}
      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-5">
        <Clock size={13} />
        <span>Version updated on {mockDocDetails.lastUpdated}</span>
      </div>

      {/* Horizontal Nav Tabs for Steps */}
      <div className="flex items-center w-full gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
        {mockDocDetails.steps.map((step, index) => (
          <button
            key={index}
            onClick={() => setActiveStep(index)}
            className={`flex-1 text-center py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
              activeStep === index 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Step {index + 1}
          </button>
        ))}
      </div>

      {/* Main Instruction Body Card */}
      <article className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm mb-28">
        <span className="text-xs font-bold text-blue-600 tracking-wide uppercase">
          {mockDocDetails.steps[activeStep].summary}
        </span>
        <h3 className="text-xl font-bold text-gray-900 mt-1 mb-3">
          {mockDocDetails.steps[activeStep].title}
        </h3>
        <p className="text-sm text-gray-600 leading-relaxed">
          {mockDocDetails.steps[activeStep].body}
        </p>
      </article>

      {/* Sticky Compliance Sign-Off Panel */}
      <div className="absolute bottom-16 left-0 right-0 bg-gray-50 border-t border-gray-100 p-4 z-40 flex items-center justify-between">
        <div className="max-w-[65%]">
          <p className="text-xs font-semibold text-gray-800">Compliance Verification</p>
          <p className="text-[10px] text-gray-400 leading-tight">Confirm understanding of this protocol version.</p>
        </div>
        
        <button
          disabled={isSignedOff}
          onClick={() => setIsSignedOff(true)}
          className={`h-10 px-4 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            isSignedOff 
              ? 'bg-green-100 text-green-700 cursor-not-allowed' 
              : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-xs'
          }`}
        >
          {isSignedOff ? (
            <>
              <Award size={14} /> Signed Off
            </>
          ) : (
            <>
              <Check size={14} /> Mark as Read
            </>
          )}
        </button>
      </div>

    </MobileLayout>
  );
}