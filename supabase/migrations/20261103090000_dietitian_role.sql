-- Dietitians are staff who build nutrition plans. Added on its own because a
-- new enum value can't be used in the same transaction that adds it.
alter type public.gym_role add value if not exists 'dietitian' before 'member';
