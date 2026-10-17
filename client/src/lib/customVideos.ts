export type CustomVideo = {
  number: number;
  sortOrder: number;
  id: string;
  title: string;
  category: "شرح" | "حل إمتحان جزئي" | "حل إمتحان شامل" | "أساسيات";
  lesson: string;
  section: "الشرح" | "الاختبارات الجزئية" | "الامتحانات الشاملة" | "الحل";
  solutionGroup?: "حل المذكرة" | "حل كتاب الامتحان" | "حل الامتحانات الجزئية" | "حل الامتحانات الشاملة";
  duration?: string;
  homework?: string[];
  description?: string;
};

const STORAGE_KEY = "gravity-custom-videos";

export function parseCustomVideos(raw: string | null): CustomVideo[] {
  try {
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is CustomVideo => Boolean(item && typeof item.id === "string" && typeof item.title === "string")) : [];
  } catch {
    return [];
  }
}

export function readCustomVideos(): CustomVideo[] {
  return parseCustomVideos(window.localStorage.getItem(STORAGE_KEY));
}

export function saveCustomVideos(videos: CustomVideo[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(videos));
}
