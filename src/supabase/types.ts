export interface TaskStep {
  id: string;
  task_id: string;
  step_order: number;
  description?: string;
  duration_seconds?: number;
}
export interface Task {
  id: string;
  category_id: string;
  name: string;
  created_by_user_id?: string;
  created_at?: string;
  task_steps?: TaskStep[];
}
export interface Category {
  id: string;
  name: string;
  icon?: string;
  is_default?: boolean;
  created_at?: string;
  tasks?: Task[];
}
