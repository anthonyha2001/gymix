-- Members and trainers may only choose exercises for equipment the gym has
-- added: machines it registered, plus the free-equipment types it ticked.
-- Gyms used to start with every free-equipment type ticked, so ~600 exercises
-- were available before the owner added anything. Now they start with none.

alter table public.gyms alter column equipment set default '{}';

-- Gyms still on the old untouched default never chose; they start over.
-- Gyms whose owner changed the list keep their choice.
update public.gyms
   set equipment = '{}'
 where equipment = array[
   'body only', 'dumbbell', 'barbell', 'cable', 'kettlebells', 'e-z curl bar',
   'bands', 'medicine ball', 'exercise ball', 'foam roll'
 ];
