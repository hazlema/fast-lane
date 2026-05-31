// game/data/courses.ts
export type CourseId = string;

export interface Course {
  id: CourseId;
  name: string;
  cost: number;
  timeCost: number;
  educationGain: number;
}

export const COURSES: Record<CourseId, Course> = {
  basics:   { id: "basics",   name: "Adult Basics", cost: 50,  timeCost: 15, educationGain: 20 },
  business: { id: "business", name: "Business 101", cost: 120, timeCost: 20, educationGain: 25 },
  engineering: { id: "engineering", name: "Engineering", cost: 250, timeCost: 25, educationGain: 30 },
};
