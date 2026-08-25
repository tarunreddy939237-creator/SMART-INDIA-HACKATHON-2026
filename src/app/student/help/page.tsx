'use client';

import React, { useState } from 'react';
import {
  GraduationCap, CalendarCheck, BookOpen, Brain, Video,
  ScanFace, MessageSquare, Flame, BarChart2, ChevronDown,
  ChevronRight, LifeBuoy, CheckCircle2, AlertCircle, Globe,
} from 'lucide-react';
import StudentSidebar from '@/components/dashboard/StudentSidebar';
import StudentTopbar from '@/components/dashboard/StudentTopbar';
import { useLang } from '@/lib/i18n';

interface Section {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  subtitle: string;
  steps: { heading: string; body: string }[];
  tips?: string[];
}

const SECTIONS: Section[] = [
  {
    id: 'dashboard',
    icon: GraduationCap,
    color: 'indigo',
    title: 'Dashboard',
    subtitle: 'Your academic home screen',
    steps: [
      { heading: 'Attendance card', body: 'Shows your overall attendance % for the current semester. Green = eligible for exams (≥75%). Red = below threshold — contact your faculty immediately.' },
      { heading: 'Study Streak', body: 'Counts consecutive days you have been active on EduVision (attending class, taking quizzes, or opening the app). Keep it going to earn badges!' },
      { heading: 'Avg. Quiz Score', body: 'Average of all quiz attempts this semester. Tap "View all" to see individual attempt breakdowns.' },
      { heading: 'Active Subject', body: 'The subject of your most recent quiz attempt. The AI focus tip below it is personalised to your weakest topic.' },
      { heading: 'Weekly Attendance chart', body: 'Bar chart showing % present each day this week. The dashed orange line is the 75% minimum. Hover any bar for exact numbers.' },
      { heading: 'Pending Actions', body: 'Quick-access cards for your most urgent tasks — overdue quizzes, recommended study sessions, and feedback requests.' },
    ],
    tips: ['Refresh the page or wait 30 s for live data sync.', 'Click any stat card to navigate to the related section.'],
  },
  {
    id: 'attendance',
    icon: CalendarCheck,
    color: 'emerald',
    title: 'Attendance Records',
    subtitle: 'Full history of every class',
    steps: [
      { heading: 'Biometric attendance', body: 'Your face is scanned at the start of each lecture. Make sure your face is registered (see Register Face section). The system marks you Present, Absent, or Late automatically.' },
      { heading: 'Attendance table', body: 'Scroll down on the Dashboard to see every attendance record — date, subject, status, time, and faculty name. Click column headers to sort.' },
      { heading: 'Below 75% warning', body: 'If your attendance drops below 75% you will see a red banner. You may become ineligible for semester exams. Contact your faculty or HOD immediately.' },
    ],
    tips: ['Attendance is synced every 30 seconds.', 'If a record is wrong, contact your faculty to submit a correction via Manual Attendance.'],
  },
  {
    id: 'studyplan',
    icon: Brain,
    color: 'violet',
    title: 'AI Study Plan',
    subtitle: 'Personalised learning roadmap',
    steps: [
      { heading: 'How it works', body: 'The AI analyses your quiz scores, weak topics, and attendance patterns to generate a personalised weekly study plan.' },
      { heading: 'Generating a plan', body: 'Go to Study Plan → click "Generate New Plan". The AI will create topic-by-topic recommendations with estimated time per topic.' },
      { heading: 'Following the plan', body: 'Each topic card shows priority (High/Medium/Low) and links to relevant quizzes and video lectures. Mark topics as done to track progress.' },
      { heading: 'Updating the plan', body: 'After each quiz attempt the plan auto-updates to reflect your latest weak topics. You can also regenerate manually at any time.' },
    ],
    tips: ['The more quizzes you take, the more accurate your plan becomes.', 'Plans are private — only you and your faculty can see them.'],
  },
  {
    id: 'quizzes',
    icon: BookOpen,
    color: 'cyan',
    title: 'Quizzes',
    subtitle: 'Practice assessments & diagnostics',
    steps: [
      { heading: 'Taking a quiz', body: 'Go to Quizzes → select a subject → click Start. Answer all MCQs and submit. Your score is saved instantly.' },
      { heading: 'Reviewing results', body: 'After submission you see your score, correct answers, and which topics you got wrong. These weak topics feed into your AI Study Plan.' },
      { heading: 'Quiz history', body: 'The "Recent Attempts" section on the Dashboard shows your last 3 attempts. Go to the Quizzes page for the full history.' },
      { heading: 'AI-generated quizzes', body: 'Faculty can push AI-generated quizzes targeted at your weak topics. You will see them appear in the Available section.' },
    ],
    tips: ['Attempt quizzes regularly — streaks are updated on each attempt.', 'A score ≥75% is considered passing.'],
  },
  {
    id: 'videos',
    icon: Video,
    color: 'rose',
    title: 'Video Lectures',
    subtitle: 'Watch recorded lectures anytime',
    steps: [
      { heading: 'Finding lectures', body: 'Go to Video Lectures. Lectures are organised by subject and section. Use the search bar to find a specific topic.' },
      { heading: 'Watching offline', body: 'EduVision is a PWA — install it on your phone or laptop and previously loaded lecture pages are available offline.' },
      { heading: 'Lecture notes', body: 'Faculty may attach notes or resource links below each video. Download them for offline study.' },
    ],
  },
  {
    id: 'face',
    icon: ScanFace,
    color: 'amber',
    title: 'Register Face',
    subtitle: 'One-time biometric setup',
    steps: [
      { heading: 'Why register?', body: 'EduVision uses face recognition for contactless attendance. Without registration your attendance cannot be marked automatically.' },
      { heading: 'How to register', body: 'Go to Register Face → allow camera access → look directly at the camera in good lighting → click Capture. The system saves your face embedding securely.' },
      { heading: 'Re-registering', body: 'If recognition fails repeatedly (e.g. after a haircut or glasses change) you can re-register at any time from the same page.' },
    ],
    tips: ['Use a well-lit environment.', 'Remove sunglasses or heavy filters.', 'Your face data is stored as a mathematical embedding — never as a photo.'],
  },
  {
    id: 'feedback',
    icon: MessageSquare,
    color: 'teal',
    title: 'Feedback',
    subtitle: 'Anonymous lecture feedback',
    steps: [
      { heading: 'Submitting feedback', body: 'Go to Feedback → select the subject/faculty → rate 1–5 stars → optionally add a comment → Submit. All feedback is anonymous by default.' },
      { heading: 'What happens next', body: 'Faculty see aggregated ratings and anonymised comments in their Feedback Review page. Individual identities are never revealed.' },
    ],
    tips: ['Be constructive — your feedback directly improves teaching quality.'],
  },
  {
    id: 'pwa',
    icon: Globe,
    color: 'slate',
    title: 'Install as App (PWA)',
    subtitle: 'Use EduVision offline on any device',
    steps: [
      { heading: 'On Android (Chrome)', body: 'Open EduVision in Chrome → tap the three-dot menu → "Add to Home Screen" → Install. The app icon appears on your home screen.' },
      { heading: 'On iPhone (Safari)', body: 'Open EduVision in Safari → tap the Share button → "Add to Home Screen" → Add.' },
      { heading: 'On Desktop (Chrome/Edge)', body: 'Look for the install icon (⊕) in the address bar → click Install. EduVision opens as a standalone window.' },
      { heading: 'Offline access', body: 'Once installed, the Dashboard, Quizzes, and Study Plan pages load from cache even without internet. Data syncs automatically when you reconnect.' },
    ],
  },
];

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  violet: 'bg-violet-100 text-violet-700 border-violet-200',
  cyan: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  rose: 'bg-rose-100 text-rose-700 border-rose-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
  teal: 'bg-teal-100 text-teal-700 border-teal-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
};

const HELP_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    title: 'Help & Getting Started',
    subtitle: 'Everything you need to know about EduVision — from scratch.',
    search: 'Search help topics…',
    steps: 'Steps',
    tips: 'Tips',
    quickStart: 'Quick Start Checklist',
    qs1: 'Register your face for biometric attendance',
    qs2: 'Check your attendance % on the Dashboard',
    qs3: 'Take your first quiz to activate the AI Study Plan',
    qs4: 'Watch a video lecture for your active subject',
    qs5: 'Submit anonymous feedback after a lecture',
    qs6: 'Install EduVision as an app on your phone',
  },
  te: {
    title: 'సహాయం & ప్రారంభం',
    subtitle: 'EduVision గురించి మీకు తెలుసుకోవలసిన ప్రతిదీ.',
    search: 'సహాయ విషయాలు వెతకండి…',
    steps: 'దశలు',
    tips: 'చిట్కాలు',
    quickStart: 'త్వరిత ప్రారంభ చెక్‌లిస్ట్',
    qs1: 'బయోమెట్రిక్ హాజరు కోసం మీ ముఖాన్ని నమోదు చేయండి',
    qs2: 'డాష్‌బోర్డ్‌లో మీ హాజరు % తనిఖీ చేయండి',
    qs3: 'AI అధ్యయన ప్రణాళికను సక్రియం చేయడానికి మొదటి క్విజ్ తీసుకోండి',
    qs4: 'మీ చురుకైన విషయానికి వీడియో లెక్చర్ చూడండి',
    qs5: 'లెక్చర్ తర్వాత అనామక అభిప్రాయం సమర్పించండి',
    qs6: 'మీ ఫోన్‌లో EduVision ని యాప్‌గా ఇన్‌స్టాల్ చేయండి',
  },
  hi: {
    title: 'सहायता और शुरुआत',
    subtitle: 'EduVision के बारे में शुरू से जानने के लिए सब कुछ।',
    search: 'सहायता विषय खोजें…',
    steps: 'चरण',
    tips: 'सुझाव',
    quickStart: 'त्वरित शुरुआत चेकलिस्ट',
    qs1: 'बायोमेट्रिक उपस्थिति के लिए अपना चेहरा पंजीकृत करें',
    qs2: 'डैशबोर्ड पर अपनी उपस्थिति % जांचें',
    qs3: 'AI अध्ययन योजना सक्रिय करने के लिए पहली क्विज़ लें',
    qs4: 'अपने सक्रिय विषय के लिए वीडियो व्याख्यान देखें',
    qs5: 'व्याख्यान के बाद गुमनाम प्रतिक्रिया सबमिट करें',
    qs6: 'अपने फोन पर EduVision को ऐप के रूप में इंस्टॉल करें',
  },
};

export default function StudentHelpPage() {
  const { lang } = useLang();
  const h = HELP_TRANSLATIONS[lang] || HELP_TRANSLATIONS.en;
  const [open, setOpen] = useState<string | null>('dashboard');
  const [query, setQuery] = useState('');

  const filtered = SECTIONS.filter(s =>
    !query || s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.steps.some(st => st.heading.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="flex min-h-screen bg-[#F4F6FA] text-slate-900">
      <StudentSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <StudentTopbar title={h.title} subtitle="Help & documentation" />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto max-w-4xl">

          {/* Header */}
          <div className="pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <LifeBuoy className="w-5 h-5 text-indigo-600" />
              <h1 className="text-2xl font-bold text-slate-900">{h.title}</h1>
            </div>
            <p className="text-sm text-slate-500">{h.subtitle}</p>
          </div>

          {/* Quick start checklist */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5">
            <h2 className="text-sm font-bold text-indigo-900 flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />{h.quickStart}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[h.qs1, h.qs2, h.qs3, h.qs4, h.qs5, h.qs6].map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-indigo-800">
                  <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder={h.search}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm outline-none"
          />

          {/* Accordion sections */}
          <div className="space-y-3">
            {filtered.map(section => {
              const Icon = section.icon;
              const isOpen = open === section.id;
              const colorCls = COLOR_MAP[section.color] || COLOR_MAP.slate;
              return (
                <div key={section.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <button
                    onClick={() => setOpen(isOpen ? null : section.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`p-2 rounded-xl border ${colorCls}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{section.title}</p>
                        <p className="text-xs text-slate-500">{section.subtitle}</p>
                      </div>
                    </div>
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 space-y-4 border-t border-slate-100">
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pt-4">{h.steps}</p>
                      <ol className="space-y-3">
                        {section.steps.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">{step.heading}</p>
                              <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{step.body}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                      {section.tips && (
                        <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                          <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />{h.tips}
                          </p>
                          {section.tips.map((tip, i) => (
                            <p key={i} className="text-xs text-amber-700">• {tip}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
