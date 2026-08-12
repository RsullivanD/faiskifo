-- Policies RLS (Row Level Security) pour la lecture du catalogue
-- À exécuter dans l'éditeur SQL de ton projet Supabase (onglet SQL Editor).
-- Ces policies donnent aux utilisateurs connectés le droit de lire
-- les tables du catalogue. Elles ne touchent pas aux droits d'écriture.

-- 1. Activer RLS sur les tables (si ce n'est pas déjà fait)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_steps ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes policies du même nom si elles existent déjà
DROP POLICY IF EXISTS "catalogue_categories_select_authenticated" ON categories;
DROP POLICY IF EXISTS "catalogue_tasks_select_authenticated" ON tasks;
DROP POLICY IF EXISTS "catalogue_task_steps_select_authenticated" ON task_steps;

-- 3. Créer les policies de lecture pour les utilisateurs authentifiés
CREATE POLICY "catalogue_categories_select_authenticated"
  ON categories
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "catalogue_tasks_select_authenticated"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "catalogue_task_steps_select_authenticated"
  ON task_steps
  FOR SELECT
  TO authenticated
  USING (true);
