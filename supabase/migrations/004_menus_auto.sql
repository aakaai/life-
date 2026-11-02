-- Alimentation v0.6 : menus proposés automatiquement, batch cooking, repas à l'école.
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». Sans danger si tu le relances.

-- Type d'agenda : perso ou horaire de cours (Hyperplanning). L'horaire sert à savoir
-- quels midis tu manges à l'école, et il compte comme occupé pour le planning sport.
alter table public.calendar_sources add column if not exists kind text not null default 'perso';

-- Repas prévus : séance de cuisine, portion d'un même plat en lot, boîte à emporter.
alter table public.meal_plans add column if not exists batch_id uuid;
alter table public.meal_plans add column if not exists cook boolean not null default false;  -- c'est ce repas-là qu'on cuisine
alter table public.meal_plans add column if not exists box boolean not null default false;   -- à emporter (école)
alter table public.meal_plans add column if not exists auto boolean not null default false;  -- proposé par l'app

-- Réglages
alter table public.nutrition_settings add column if not exists school_lunch_days jsonb not null default '[1, 2]';  -- si pas d'horaire : mardi et mercredi
alter table public.nutrition_settings add column if not exists fridge_days int not null default 3;                 -- un plat cuisiné se garde 3 jours au frigo
alter table public.nutrition_settings add column if not exists proposed_weeks jsonb not null default '[]';         -- semaines déjà proposées
