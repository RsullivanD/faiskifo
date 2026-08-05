import { supabase } from './client';

// Read helpers for existing schema (categories, tasks, task_steps)

// Fetch all categories with their tasks and steps nested.
// Returns an array of categories: [{ id, name, icon, is_default, created_at, tasks: [{... , task_steps: [{...}]}] }]
export async function fetchCategoriesWithTasks() {
  const { data, error } = await supabase
    .from('categories')
    .select(`*, tasks ( *, task_steps (*) )`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching categories', error);
    throw error;
  }

  return data || [];
}

// Fetch tasks for a specific category
export async function fetchTasksByCategory(categoryId) {
  if (!categoryId) throw new Error('categoryId is required');
  const { data, error } = await supabase
    .from('tasks')
    .select('*, task_steps (*)')
    .eq('category_id', categoryId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching tasks', error);
    throw error;
  }

  return data || [];
}

// Fetch steps for a specific task ordered by step_order
export async function fetchStepsByTask(taskId) {
  if (!taskId) throw new Error('taskId is required');
  const { data, error } = await supabase
    .from('task_steps')
    .select('*')
    .eq('task_id', taskId)
    .order('step_order', { ascending: true });

  if (error) {
    console.error('Error fetching steps', error);
    throw error;
  }

  return data || [];
}
