"use client";

import React from 'react';
import MobileLayout from '@/components/Navigation/MobileLayout';
import { CheckCircle2, AlertCircle, ChevronRight, Folder } from 'lucide-react';

const sampleSubjects = [
  {
    id: '1',
    title: 'Company Handbook & Core Values',
    description: 'Essential policies, work guidelines, and cultural standards.',
    completedDocuments: 2,
    totalDocuments: 2,
    documents: [
      { id: '101', title: 'Code of Conduct', standardMet: true },
      { id: '102', title: 'Time Tracking & Attendance', standardMet: true },
    ]
  },
  {
    id: '2',
    title: 'Standard Operating Procedures (SOPs)',
    description: 'Step-by-step documentation detailing daily service production workflows.',
    completedDocuments: 1,
    totalDocuments: 2,
    documents: [
      { id: '201', title: 'Client Onboarding Runbook', standardMet: true },
      { id: '202', title: 'Incident Escalation Protocol', standardMet: false },
    ]
  }
];

export default function UserDashboardPage() {
  return (
    <MobileLayout userRole="admin">
      {/* Header Info */}
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Waybook Workspace</h1>
        <p className="text-xs text-gray-500 mt-0.5">Your official repository for company documentation</p>
      </header>

      {/* Flat Search bar layout placeholder */}
      <div className="relative mb-6">
        <input 
          type="text" 
          placeholder="Search documentation, keywords..." 
          className="w-full h-11 bg-gray-100 border border-transparent rounded-xl pl-4 pr-10 text-sm focus:bg-white focus:border-blue-500 focus:outline-none transition-all"
        />
      </div>

      {/* Main Content Feed */}
      <section className="space-y-6">
        {sampleSubjects.map((subject) => {
          const isComplete = subject.completedDocuments === subject.totalDocuments;
          return (
            <div key={subject.id} className="border-b border-gray-100 pb-5 last:border-0">
              
              {/* Subject Title Group */}
              <div className="flex items-start justify-between mb-3">
                <div className="max-w-[80%]">
                  <div className="flex items-center gap-2 mb-1">
                    <Folder size={18} className="text-gray-400 fill-gray-50" />
                    <h2 className="text-base font-semibold text-gray-800">{subject.title}</h2>
                  </div>
                  <p className="text-xs text-gray-500 line-clamp-2">{subject.description}</p>
                </div>
                <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${isComplete ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {subject.completedDocuments}/{subject.totalDocuments} Done
                </span>
              </div>

              {/* Child Documents cards */}
              <div className="space-y-2">
                {subject.documents.map((doc) => (
                  <div key={doc.id} className="w-full flex items-center justify-between p-3.5 bg-white border border-gray-100 rounded-xl hover:border-gray-300 transition-all cursor-pointer shadow-sm">
                    <div className="flex items-center gap-3">
                      {doc.standardMet ? <CheckCircle2 size={18} className="text-green-500" /> : <AlertCircle size={18} className="text-amber-500" />}
                      <span className="text-sm font-medium text-gray-700">{doc.title}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!doc.standardMet && <span className="text-[10px] font-bold text-white bg-amber-500 px-1.5 py-0.5 rounded">UPDATE REQ</span>}
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </div>
                ))}
              </div>

            </div>
          );
        })}
      </section>
    </MobileLayout>
  );
}