// game/data/courses.ts
// Courses are university DEGREES forming a one-time prerequisite tech tree
// (faithful to Jones in the Fast Lane). Earn a degree once; it unlocks its
// successors. Two roots (Junior College, Trade School) are available at start.
export type CourseId = string;

export interface Course {
  id: CourseId;
  name: string;
  cost: number;            // tuition (paid once at enroll)
  timeCost: number;        // time units per study session
  educationGain: number;   // education points granted on graduation
  requires: CourseId[];    // prerequisite degrees (all must be completed); [] = root
}

export const COURSES: Record<CourseId, Course> = {
  // Roots
  juniorcollege: { id: "juniorcollege", name: "Junior College", cost: 50,  timeCost: 15, educationGain: 20, requires: [] },
  tradeschool:   { id: "tradeschool",   name: "Trade School",   cost: 50,  timeCost: 15, educationGain: 20, requires: [] },
  // Junior College branch
  busadmin:      { id: "busadmin",      name: "Business Administration", cost: 120, timeCost: 20, educationGain: 25, requires: ["juniorcollege"] },
  academic:      { id: "academic",      name: "Academic",       cost: 120, timeCost: 20, educationGain: 25, requires: ["juniorcollege"] },
  // Trade School branch
  preeng:        { id: "preeng",        name: "Pre-Engineering", cost: 120, timeCost: 20, educationGain: 25, requires: ["tradeschool"] },
  engineering:   { id: "engineering",   name: "Engineering",    cost: 250, timeCost: 25, educationGain: 35, requires: ["preeng"] },
};
