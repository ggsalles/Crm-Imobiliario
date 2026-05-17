import { Activity, Deal } from "./db";
import { isBefore, isToday, isTomorrow, isAfter, startOfDay, addDays } from "date-fns";

export type UrgencyGroup = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'completed';

export interface GroupedActivities {
  overdue: Activity[];
  today: Activity[];
  tomorrow: Activity[];
  soon: Activity[];
  completed: Activity[];
}

export function groupActivities(activities: Activity[]): GroupedActivities {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);
  const dayAfterTomorrow = addDays(today, 2);

  const groups: GroupedActivities = {
    overdue: [],
    today: [],
    tomorrow: [],
    soon: [],
    completed: []
  };

  activities.forEach(activity => {
    if (activity.status === 'completed') {
      groups.completed.push(activity);
      return;
    }

    const activityDate = new Date(activity.date);

    if (isBefore(activityDate, today)) {
      groups.overdue.push(activity);
    } else if (isToday(activityDate)) {
      groups.today.push(activity);
    } else if (isTomorrow(activityDate)) {
      groups.tomorrow.push(activity);
    } else {
      groups.soon.push(activity);
    }
  });

  return groups;
}

export function calculateActivityScore(activity: Activity, deals: Deal[]): number {
  if (!activity || !activity.date) return 0;
  
  const deal = activity.dealId ? deals.find(d => d.id === activity.dealId) : null;
  if (!deal) return 0;

  // Base score from deal value (normalized, e.g., 100k = 1 point)
  const valueScore = (deal.value || 0) / 100000;
  
  // Probability score (0.2 to 1.0)
  const probabilityScore = (deal.probability || 20) / 100;
  
  // Proximity score: things closer to now get higher score
  const now = new Date();
  const activityDate = new Date(activity.date);
  if (isNaN(activityDate.getTime())) return 0;

  const diffDays = Math.max(0, (activityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const proximityScore = 1 / (diffDays + 1);

  return valueScore * probabilityScore * proximityScore;
}

export function isPriorityActivity(activity: Activity, deals: Deal[]): boolean {
  if (!activity || !activity.date) return false;
  
  const deal = activity.dealId ? deals.find(d => d.id === activity.dealId) : null;
  if (!deal) return false;

  const isHighValue = (deal.value || 0) >= 500000;
  
  const now = new Date();
  const activityDate = new Date(activity.date);
  if (isNaN(activityDate.getTime())) return false;

  const diffDays = (activityDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const isSoon = diffDays >= 0 && diffDays <= 2;

  return isHighValue || (isSoon && activity.status === 'pending');
}
