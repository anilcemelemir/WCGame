import { Tactic, TacticalPlan } from "../types";

export interface TacticDefinition {
  id: Tactic;
  label: string;
  family: "Denge" | "Hücum" | "Savunma" | "Geçiş" | "Pres";
  description: string;
  plan: TacticalPlan;
}

export const tacticDefinitions: Record<Tactic, TacticDefinition> = {
  balanced: {
    id: "balanced",
    label: "Dengeli Oyun",
    family: "Denge",
    description: "Riskleri dengeler, topu ve alanı birlikte kontrol eder.",
    plan: { mentality: 50, defensiveLine: 52, pressIntensity: 50, counterPress: 45, buildUpSpeed: 50, passingDirectness: 45, attackingWidth: 55, tempo: 50 },
  },
  attacking: {
    id: "attacking",
    label: "Önde Hücum",
    family: "Hücum",
    description: "Kalabalık hücum, yüksek tempo ve geniş yerleşim.",
    plan: { mentality: 78, defensiveLine: 68, pressIntensity: 62, counterPress: 58, buildUpSpeed: 66, passingDirectness: 52, attackingWidth: 70, tempo: 72 },
  },
  defensive: {
    id: "defensive",
    label: "Kompakt Savunma",
    family: "Savunma",
    description: "Bloklar arası mesafeyi kısaltır, rakibi düşük kalite şuta zorlar.",
    plan: { mentality: 24, defensiveLine: 30, pressIntensity: 32, counterPress: 24, buildUpSpeed: 36, passingDirectness: 48, attackingWidth: 42, tempo: 34 },
  },
  counter: {
    id: "counter",
    label: "Kontra Atak",
    family: "Geçiş",
    description: "Top kazanıldığında hızlı dikine çıkış ve arkaya koşu.",
    plan: { mentality: 42, defensiveLine: 38, pressIntensity: 42, counterPress: 36, buildUpSpeed: 78, passingDirectness: 78, attackingWidth: 64, tempo: 62 },
  },
  gegenpress: {
    id: "gegenpress",
    label: "Gegenpress",
    family: "Pres",
    description: "Top kaybı sonrası anında baskı, yüksek çizgi ve yoğun tempo.",
    plan: { mentality: 72, defensiveLine: 78, pressIntensity: 88, counterPress: 90, buildUpSpeed: 68, passingDirectness: 54, attackingWidth: 58, tempo: 84 },
  },
  highPress: {
    id: "highPress",
    label: "Ön Alan Presi",
    family: "Pres",
    description: "Stoper ve kaleci çıkışlarını bozar, rakibi uzun topa zorlar.",
    plan: { mentality: 66, defensiveLine: 74, pressIntensity: 86, counterPress: 74, buildUpSpeed: 58, passingDirectness: 46, attackingWidth: 56, tempo: 76 },
  },
  tikiTaka: {
    id: "tikiTaka",
    label: "Pas Oyunu",
    family: "Hücum",
    description: "Kısa pas, sabır, merkez kontrolü ve yüksek top sahipliği.",
    plan: { mentality: 64, defensiveLine: 62, pressIntensity: 58, counterPress: 62, buildUpSpeed: 38, passingDirectness: 20, attackingWidth: 52, tempo: 48 },
  },
  wingPlay: {
    id: "wingPlay",
    label: "Kanat Hücumu",
    family: "Hücum",
    description: "Genişlik, bindirmeler ve ceza sahasına erken servis.",
    plan: { mentality: 66, defensiveLine: 56, pressIntensity: 52, counterPress: 46, buildUpSpeed: 62, passingDirectness: 62, attackingWidth: 88, tempo: 66 },
  },
  directPlay: {
    id: "directPlay",
    label: "Direkt Oyun",
    family: "Geçiş",
    description: "Az pasla hızlı mesafe alır, fizik ve ikinci topları önemser.",
    plan: { mentality: 56, defensiveLine: 48, pressIntensity: 44, counterPress: 34, buildUpSpeed: 82, passingDirectness: 88, attackingWidth: 58, tempo: 68 },
  },
  lowBlock: {
    id: "lowBlock",
    label: "Alçak Blok",
    family: "Savunma",
    description: "Ceza sahası çevresini kapatır, sürprizi hızlı çıkışta arar.",
    plan: { mentality: 18, defensiveLine: 18, pressIntensity: 24, counterPress: 18, buildUpSpeed: 46, passingDirectness: 70, attackingWidth: 44, tempo: 30 },
  },
};

export const tacticList = Object.values(tacticDefinitions);
