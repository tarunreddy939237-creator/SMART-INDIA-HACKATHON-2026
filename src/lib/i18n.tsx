'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Lang = 'en' | 'te' | 'hi';

const translations = {
  en: {
    // Sidebar nav
    dashboard: 'Dashboard', studyPlan: 'Study Plan', quizzes: 'Quizzes',
    videoLectures: 'Video Lectures', registerFace: 'Register Face', feedback: 'Feedback',
    myProfile: 'My Profile', help: 'Help', attendance: 'Attendance', manualAttendance: 'Manual Attendance',
    students: 'Students', classAnalytics: 'Class Analytics', createQuiz: 'Create Quiz',
    myQuizzes: 'My Quizzes', notesResources: 'Notes & Resources', controlTower: 'Control Tower', accountApprovals: 'Account Approvals',
    menu: 'MENU', language: 'Language',
    home: 'Home', aiStudyCopilot: 'AI Study Copilot', progress: 'Progress',
    achievements: 'Achievements', dailyTasks: 'Daily Tasks', academicCalendar: 'Academic Calendar', courses: 'Courses', meetings: 'Meetings',

    // Topbar / page titles
    attendanceOverview: 'Attendance & Academic Overview',
    currentSemester: 'Current Semester',
    btech: 'B.Tech',

    // Stat cards
    attendanceSemester: 'Attendance — Current Semester',
    presentAbsentOf: (p: number, a: number, t: number) => `${p} present · ${a} absent of ${t}`,
    vsLastMonth: '+6% vs last month',
    studyStreak: 'Study Streak',
    personalBest: (n: number) => `Personal best: ${n} days`,
    days: 'days',
    avgQuizScore: 'Avg. Quiz Score',
    noAttemptsYet: 'No attempts yet',
    attempts: (n: number) => `${n} attempt${n !== 1 ? 's' : ''}`,
    abovePassingThreshold: 'Above passing threshold',
    activeSubject: 'Active Subject',
    focus: (t: string) => `Focus: ${t}`,
    takeQuizForRec: 'Take a quiz to get recommendations',

    // Weekly attendance chart
    weeklyAttendance: 'Weekly Attendance',
    percentPerDay: '% present per day · minimum required 75%',
    eligibleForExams: 'Eligible for exams',
    belowThreshold: 'Below 75% threshold',

    // Pending actions
    pendingActions: 'Pending Actions',
    items: (n: number) => `${n} items`,
    dueToday: 'Due today',
    recommended: 'Recommended',
    anonymous: 'Anonymous',

    // AI recommendation
    aiRecommendation: 'AI Recommendation',
    spendMinOn: (topic: string) => `Spend 15 min on ${topic} before the next quiz — identified as your weakest topic.`,
    completeQuizForAI: 'Complete a quiz to get personalised AI recommendations.',
    openStudyPlan: 'Open study plan',

    // My Courses
    myCourses: 'My Courses',
    synced: (n: number) => `${n} synced`,

    // Practice assessments
    practiceAssessments: 'Practice Assessments',
    viewAll: 'View all',
    available: 'Available',
    noActiveAssessments: 'No active assessments',
    questions: (n: number) => `${n} questions`,
    recentAttempts: 'Recent Attempts',
    noAttemptsYetShort: 'No attempts yet',
    diagnostic: 'Diagnostic',

    // Notes & Resources
    notesAndResources: 'Notes & Resources',
    fromYourFaculty: 'From your faculty',
    noNotesYet: 'No notes or resources posted yet.',
    openResource: 'Open Resource',
    by: 'By',

    // Notices
    noticesFromFaculty: 'Notices from Faculty',
    unread: (n: number) => `${n} unread`,

    // Attendance table
    attendanceRecords: 'Attendance Records',
    clickToSort: 'Click column headers to sort',
    present: 'Present', absent: 'Absent', late: 'Late',
    date: 'Date', subject: 'Subject', status: 'Status', time: 'Time', faculty: 'Faculty',
    showingRecords: (n: number) => `Showing ${n} record${n !== 1 ? 's' : ''} · Current semester`,
    minAttendance: 'Minimum attendance required: 75%',

    // Sync
    synced_at: (t: string) => `Synced ${t}`,
  },
  te: {
    dashboard: 'డాష్‌బోర్డ్', studyPlan: 'అధ్యయన ప్రణాళిక', quizzes: 'క్విజ్‌లు',
    videoLectures: 'వీడియో లెక్చర్లు', registerFace: 'ముఖం నమోదు', feedback: 'అభిప్రాయం',
    myProfile: 'నా ప్రొఫైల్', help: 'సహాయం', attendance: 'హాజరు', manualAttendance: 'మాన్యువల్ హాజరు',
    students: 'విద్యార్థులు', classAnalytics: 'తరగతి విశ్లేషణ', createQuiz: 'క్విజ్ సృష్టించు',
    myQuizzes: 'నా క్విజ్లు', notesResources: 'నోట్స్ & వనరులు', controlTower: 'నియంత్రణ టవర్', accountApprovals: 'ఖాతా ఆమోదాలు',
    menu: 'మెనూ', language: 'భాష',
    home: 'హోమ్', aiStudyCopilot: 'AI అధ్యయన సహాయకుడు', progress: 'ప్రగతి', dailyTasks: 'రోజువారీ పనులు',
    achievements: 'సాధనలు', academicCalendar: 'విద్యా క్యాలెండర్', courses: 'కోర్సులు', meetings: 'మీటింగ్‌లు',

    attendanceOverview: 'హాజరు & విద్యా అవలోకనం',
    currentSemester: 'ప్రస్తుత సెమిస్టర్',
    btech: 'బి.టెక్',

    attendanceSemester: 'హాజరు — ప్రస్తుత సెమిస్టర్',
    presentAbsentOf: (p: number, a: number, t: number) => `${p} హాజరు · ${a} గైర్హాజరు / ${t}`,
    vsLastMonth: '+6% గత నెల కంటే',
    studyStreak: 'అధ్యయన స్ట్రీక్',
    personalBest: (n: number) => `వ్యక్తిగత రికార్డు: ${n} రోజులు`,
    days: 'రోజులు',
    avgQuizScore: 'సగటు క్విజ్ స్కోర్',
    noAttemptsYet: 'ఇంకా ప్రయత్నాలు లేవు',
    attempts: (n: number) => `${n} ప్రయత్నం${n !== 1 ? 'లు' : ''}`,
    abovePassingThreshold: 'పాసింగ్ పరిమితి కంటే ఎక్కువ',
    activeSubject: 'చురుకైన విషయం',
    focus: (t: string) => `దృష్టి: ${t}`,
    takeQuizForRec: 'సిఫార్సులు పొందడానికి క్విజ్ తీసుకోండి',

    weeklyAttendance: 'వారపు హాజరు',
    percentPerDay: '% రోజువారీ హాజరు · కనీసం 75% అవసరం',
    eligibleForExams: 'పరీక్షలకు అర్హులు',
    belowThreshold: '75% కంటే తక్కువ',

    pendingActions: 'పెండింగ్ చర్యలు',
    items: (n: number) => `${n} అంశాలు`,
    dueToday: 'ఈరోజు గడువు',
    recommended: 'సిఫార్సు చేయబడింది',
    anonymous: 'అనామక',

    aiRecommendation: 'AI సిఫార్సు',
    spendMinOn: (topic: string) => `తదుపరి క్విజ్ కు ముందు ${topic} పై 15 నిమిషాలు గడపండి — మీ బలహీన అంశంగా గుర్తించబడింది.`,
    completeQuizForAI: 'వ్యక్తిగతీకరించిన AI సిఫార్సులు పొందడానికి క్విజ్ పూర్తి చేయండి.',
    openStudyPlan: 'అధ్యయన ప్రణాళిక తెరవండి',

    myCourses: 'నా కోర్సులు',
    synced: (n: number) => `${n} సమకాలీకరించబడింది`,

    practiceAssessments: 'అభ్యాస మూల్యాంకనాలు',
    viewAll: 'అన్నీ చూడండి',
    available: 'అందుబాటులో',
    noActiveAssessments: 'చురుకైన మూల్యాంకనాలు లేవు',
    questions: (n: number) => `${n} ప్రశ్నలు`,
    recentAttempts: 'ఇటీవలి ప్రయత్నాలు',
    noAttemptsYetShort: 'ఇంకా ప్రయత్నాలు లేవు',
    diagnostic: 'నిర్ధారణ',

    notesAndResources: 'నోట్స్ & వనరులు',
    fromYourFaculty: 'మీ అధ్యాపకుల నుండి',
    noNotesYet: 'ఇంకా నోట్స్ లేదా వనరులు పోస్ట్ చేయబడలేదు.',
    openResource: 'వనరు తెరవండి',
    by: 'ద్వారా',

    noticesFromFaculty: 'అధ్యాపకుల నోటీసులు',
    unread: (n: number) => `${n} చదవలేదు`,

    attendanceRecords: 'హాజరు రికార్డులు',
    clickToSort: 'క్రమబద్ధీకరించడానికి కాలమ్ హెడర్లపై క్లిక్ చేయండి',
    present: 'హాజరు', absent: 'గైర్హాజరు', late: 'ఆలస్యం',
    date: 'తేదీ', subject: 'విషయం', status: 'స్థితి', time: 'సమయం', faculty: 'అధ్యాపకుడు',
    showingRecords: (n: number) => `${n} రికార్డు${n !== 1 ? 'లు' : ''} చూపిస్తున్నాం · ప్రస్తుత సెమిస్టర్`,
    minAttendance: 'కనీస హాజరు అవసరం: 75%',

    synced_at: (t: string) => `సమకాలీకరించబడింది ${t}`,
  },
  hi: {
    dashboard: 'डैशबोर्ड', studyPlan: 'अध्ययन योजना', quizzes: 'क्विज़',
    videoLectures: 'वीडियो व्याख्यान', registerFace: 'चेहरा पंजीकृत करें', feedback: 'प्रतिक्रिया',
    myProfile: 'मेरा प्रोफाइल', help: 'सहायता', attendance: 'उपस्थिति', manualAttendance: 'मैनुअल उपस्थिति',
    students: 'छात्र', classAnalytics: 'कक्षा विश्लेषण', createQuiz: 'क्विज़ बनाएं',
    myQuizzes: 'मेरी क्विज़', notesResources: 'नोट्स और संसाधन', controlTower: 'नियंत्रण टॉवर', accountApprovals: 'खाता अनुमोदन',
    menu: 'मेनू', language: 'भाषा',
    home: 'होम', aiStudyCopilot: 'AI अध्ययन सहायक', progress: 'प्रगति',
    achievements: 'उपलब्धियाँ', dailyTasks: 'दैनिक कार्य', academicCalendar: 'शैक्षणिक कैलेंडर', courses: 'पाठ्यक्रम', meetings: 'मीटिंग',

    attendanceOverview: 'उपस्थिति और शैक्षणिक अवलोकन',
    currentSemester: 'वर्तमान सेमेस्टर',
    btech: 'बी.टेक',

    attendanceSemester: 'उपस्थिति — वर्तमान सेमेस्टर',
    presentAbsentOf: (p: number, a: number, t: number) => `${p} उपस्थित · ${a} अनुपस्थित / ${t}`,
    vsLastMonth: '+6% पिछले महीने से',
    studyStreak: 'अध्ययन स्ट्रीक',
    personalBest: (n: number) => `व्यक्तिगत सर्वश्रेष्ठ: ${n} दिन`,
    days: 'दिन',
    avgQuizScore: 'औसत क्विज़ स्कोर',
    noAttemptsYet: 'अभी तक कोई प्रयास नहीं',
    attempts: (n: number) => `${n} प्रयास`,
    abovePassingThreshold: 'पासिंग सीमा से ऊपर',
    activeSubject: 'सक्रिय विषय',
    focus: (t: string) => `फोकस: ${t}`,
    takeQuizForRec: 'सिफारिशें पाने के लिए क्विज़ लें',

    weeklyAttendance: 'साप्ताहिक उपस्थिति',
    percentPerDay: '% प्रतिदिन उपस्थिति · न्यूनतम 75% आवश्यक',
    eligibleForExams: 'परीक्षा के लिए पात्र',
    belowThreshold: '75% से कम',

    pendingActions: 'लंबित कार्य',
    items: (n: number) => `${n} आइटम`,
    dueToday: 'आज देय',
    recommended: 'अनुशंसित',
    anonymous: 'गुमनाम',

    aiRecommendation: 'AI अनुशंसा',
    spendMinOn: (topic: string) => `अगली क्विज़ से पहले ${topic} पर 15 मिनट बिताएं — आपके सबसे कमज़ोर विषय के रूप में पहचाना गया।`,
    completeQuizForAI: 'व्यक्तिगत AI अनुशंसाएं पाने के लिए क्विज़ पूरी करें।',
    openStudyPlan: 'अध्ययन योजना खोलें',

    myCourses: 'मेरे कोर्स',
    synced: (n: number) => `${n} सिंक किए गए`,

    practiceAssessments: 'अभ्यास मूल्यांकन',
    viewAll: 'सभी देखें',
    available: 'उपलब्ध',
    noActiveAssessments: 'कोई सक्रिय मूल्यांकन नहीं',
    questions: (n: number) => `${n} प्रश्न`,
    recentAttempts: 'हाल के प्रयास',
    noAttemptsYetShort: 'अभी तक कोई प्रयास नहीं',
    diagnostic: 'निदान',

    notesAndResources: 'नोट्स और संसाधन',
    fromYourFaculty: 'आपके शिक्षक से',
    noNotesYet: 'अभी तक कोई नोट्स या संसाधन पोस्ट नहीं किए गए।',
    openResource: 'संसाधन खोलें',
    by: 'द्वारा',

    noticesFromFaculty: 'शिक्षक की सूचनाएं',
    unread: (n: number) => `${n} अपठित`,

    attendanceRecords: 'उपस्थिति रिकॉर्ड',
    clickToSort: 'क्रमबद्ध करने के लिए कॉलम हेडर पर क्लिक करें',
    present: 'उपस्थित', absent: 'अनुपस्थित', late: 'देर से',
    date: 'तारीख', subject: 'विषय', status: 'स्थिति', time: 'समय', faculty: 'शिक्षक',
    showingRecords: (n: number) => `${n} रिकॉर्ड दिखा रहे हैं · वर्तमान सेमेस्टर`,
    minAttendance: 'न्यूनतम उपस्थिति आवश्यक: 75%',

    synced_at: (t: string) => `सिंक किया ${t}`,
  },
} as const;

export type TKey = keyof typeof translations.en;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TFunc = (k: TKey, ...args: any[]) => any;

interface LangCtx { lang: Lang; setLang: (l: Lang) => void; t: TFunc; }
const LangContext = createContext<LangCtx>({ lang: 'en', setLang: () => {}, t: (k) => k });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('eduvision_lang') as Lang | null;
    if (saved && ['en', 'te', 'hi'].includes(saved)) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('eduvision_lang', l);
    document.documentElement.setAttribute('lang', l);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t: TFunc = (k: TKey, ...args: any[]) => {
    const val = (translations[lang] as any)[k] ?? (translations.en as any)[k] ?? k;
    return typeof val === 'function' ? val(...args) : val;
  };

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
