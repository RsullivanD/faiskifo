import { supabase } from './client';
import { Category, Task, TaskStep } from './types';

// Read helpers for existing schema (categories, tasks, task_steps)

// Fetch all categories with their tasks and steps nested.
export async function fetchCategoriesWithTasks(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(`*, tasks ( *, task_steps (*) )`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching categories', error);
    throw new Error(`fetchCategoriesWithTasks failed: ${error.message}`);
  }

  return (data as any) || [];
}

// Fetch tasks for a specific category
export async function fetchTasksByCategory(categoryId: string): Promise<Task[]> {
  if (!categoryId) throw new Error('categoryId is required');
  const { data, error } = await supabase
    .from('tasks')
    .select('*, task_steps (*)')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching tasks', error);
    throw new Error(`fetchTasksByCategory failed: ${error.message}`);
  }

  return (data as any) || [];
}

// Fetch steps for a specific task ordered by step_order
export async function fetchStepsByTask(taskId: string): Promise<TaskStep[]> {
  if (!taskId) throw new Error('taskId is required');
  const { data, error } = await supabase
    .from('task_steps')
    .select('*')
    .eq('task_id', taskId)
    .order('step_order', { ascending: true });

  if (error) {
    console.error('Error fetching steps', error);
    throw new Error(`fetchStepsByTask failed: ${error.message}`);
  }

  return (data as any) || [];
}
