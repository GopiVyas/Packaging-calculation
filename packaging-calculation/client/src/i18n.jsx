// Minimal translation layer: t('key') with EN / DE / ZH. Add keys here as screens grow.
import { createContext, useContext, useState } from 'react';

const DICT = {
  en: {
    projects: 'Projects', jobs: 'Running Jobs', masterData: 'Master data', plans: 'Saved plans', team: 'Team', logout: 'Log out',
    s1: 'Calculation settings', s1d: 'What was run — and what to change before running again.',
    s2: 'Part', s2d: 'The geometry everything below is computed from.',
    s3: 'Cluster', s3d: 'How pieces group before they are packed.',
    s4: 'Carton', s4d: 'Click any carton on the right — the 3-D on the left follows.',
    s5: 'Pallet', s5d: 'How the chosen carton stacks on a pallet.',
    s6: 'Container', s6d: 'How pallets fill each container type.',
    s7: 'Result', s7d: 'The numbers you quote, and the decision you lock in.',
    s8: 'Download', s8d: 'The PDF record and the share link — how this calculation leaves the screen.',
    dragHint: 'drag to rotate · scroll to zoom', boundingBox: 'Bounding box', downloadGlb: 'Download GLB',
    of: 'of', comingIn: 'Coming in', newProject: 'New project', addPart: 'Add part', parts: 'parts'
  },
  de: {
    projects: 'Projekte', jobs: 'Laufende Jobs', masterData: 'Stammdaten', plans: 'Gespeicherte Pläne', team: 'Team', logout: 'Abmelden',
    s1: 'Berechnungseinstellungen', s1d: 'Was berechnet wurde — und was vor einem neuen Lauf zu ändern ist.',
    s2: 'Teil', s2d: 'Die Geometrie, auf der alles Weitere beruht.',
    s3: 'Cluster', s3d: 'Wie sich Teile vor dem Verpacken gruppieren.',
    s4: 'Karton', s4d: 'Karton rechts anklicken — die 3-D-Ansicht links folgt.',
    s5: 'Palette', s5d: 'Wie der gewählte Karton auf der Palette gestapelt wird.',
    s6: 'Container', s6d: 'Wie Paletten jeden Containertyp füllen.',
    s7: 'Ergebnis', s7d: 'Die Zahlen, die Sie anbieten, und die Entscheidung, die Sie festschreiben.',
    s8: 'Download', s8d: 'PDF-Protokoll und Freigabelink.',
    dragHint: 'ziehen zum Drehen · scrollen zum Zoomen', boundingBox: 'Begrenzungsrahmen', downloadGlb: 'GLB herunterladen',
    of: 'von', comingIn: 'Kommt in', newProject: 'Neues Projekt', addPart: 'Teil hinzufügen', parts: 'Teile'
  },
  zh: {
    projects: '项目', jobs: '运行中的任务', masterData: '主数据', plans: '已保存方案', team: '团队', logout: '退出',
    s1: '计算设置', s1d: '已运行的内容，以及再次运行前可更改的内容。',
    s2: '零件', s2d: '以下所有计算所依据的几何形状。',
    s3: '组合', s3d: '零件在装箱前如何组合。',
    s4: '纸箱', s4d: '点击右侧任一纸箱，左侧三维视图随之变化。',
    s5: '托盘', s5d: '所选纸箱如何在托盘上堆叠。',
    s6: '集装箱', s6d: '托盘如何装满每种集装箱。',
    s7: '结果', s7d: '您报价的数字，以及您锁定的决定。',
    s8: '下载', s8d: 'PDF 记录和分享链接。',
    dragHint: '拖动旋转 · 滚动缩放', boundingBox: '包围盒', downloadGlb: '下载 GLB',
    of: '/', comingIn: '即将推出于', newProject: '新建项目', addPart: '添加零件', parts: '个零件'
  }
};

const I18n = createContext(null);

function initialLang() {
  try { return localStorage.getItem('ps_lang') || 'en'; } catch { return 'en'; }
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem('ps_lang', l); } catch { /* private mode */ }
  };
  const t = (k) => DICT[lang]?.[k] ?? DICT.en[k] ?? k;
  return <I18n.Provider value={{ lang, setLang, t }}>{children}</I18n.Provider>;
}

export const useI18n = () => useContext(I18n);
